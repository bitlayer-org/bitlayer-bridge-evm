import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'

import lockfile from 'proper-lockfile'

import {
  EthereumProvider,
  HardhatMetadata,
  getAnvilMetadata,
  getChainId,
  getHardhatMetadata,
  networkNames,
} from './provider'

const PROJECT = process.env.NAME || 'unknown'

export interface ManifestData {
  project: string
  proxies: Record<string, ProxyDeployment>
}

export interface ProxyDeployment {
  name: string
  address: string
}

function defaultManifest(project: string): ManifestData {
  return {
    project: project,
    proxies: {},
  }
}

const MANIFEST_DEFAULT_DIR = '.deploy'
const MANIFEST_TEMP_DIR = 'deploy-runtime'

type DevNetworkType = 'hardhat' | 'anvil'

async function getDevInstanceMetadata(
  provider: EthereumProvider,
  chainId: number
): Promise<DevInstanceMetadata | undefined> {
  let networkMetadata: HardhatMetadata
  let networkType: DevNetworkType
  try {
    networkMetadata = await getAnvilMetadata(provider)
    networkType = 'anvil'
  } catch (e: unknown) {
    try {
      networkMetadata = await getHardhatMetadata(provider)
      networkType = 'hardhat'
    } catch (e: unknown) {
      return undefined
    }
  }

  if (networkMetadata.chainId !== chainId) {
    throw new Error(
      `Broken invariant: Hardhat or Anvil metadata's chainId ${networkMetadata.chainId} does not match eth_chainId ${chainId}`
    )
  }

  return {
    networkName: networkType,
    instanceId: networkMetadata.instanceId,
    forkedNetwork: networkMetadata.forkedNetwork,
  }
}

function getSuffix(chainId: number, devInstanceMetadata?: DevInstanceMetadata) {
  if (devInstanceMetadata !== undefined) {
    return `${chainId}-${devInstanceMetadata.instanceId}`
  } else {
    return `${chainId}`
  }
}

interface DevInstanceMetadata {
  networkName: string
  instanceId: string
  forkedNetwork?: {
    // The chainId of the network that is being forked
    chainId: number
  } | null
}

export class Manifest {
  readonly chainId: number
  readonly file: string
  readonly fallbackFile: string
  private readonly dir: string

  private readonly chainIdSuffix: string
  private readonly parent?: Manifest

  private locked = false
  private project = PROJECT

  static async forNetwork(
    project: string,
    provider: EthereumProvider
  ): Promise<Manifest> {
    const chainId = await getChainId(provider)
    const devInstanceMetadata = await getDevInstanceMetadata(provider, chainId)
    if (devInstanceMetadata !== undefined) {
      return new Manifest(chainId, project, devInstanceMetadata, os.tmpdir())
    } else {
      return new Manifest(chainId, project)
    }
  }

  constructor(
    chainId: number,
    project: string,
    devInstanceMetadata?: DevInstanceMetadata,
    osTmpDir?: string
  ) {
    this.chainId = chainId
    this.chainIdSuffix = getSuffix(chainId, devInstanceMetadata)

    const defaultFallbackName = `${project}-unknown-${chainId}`

    if (devInstanceMetadata !== undefined) {
      assert(osTmpDir !== undefined)
      this.dir = path.join(osTmpDir, MANIFEST_TEMP_DIR)
      console.debug('development manifest directory:', this.dir)

      const devName = `${project}-${devInstanceMetadata.networkName}-${this.chainIdSuffix}`
      const devFile = path.join(this.dir, `${devName}.json`)

      this.file = devFile
      if (chainId === 31337) {
        this.fallbackFile = path.join(
          MANIFEST_DEFAULT_DIR,
          `${defaultFallbackName}.json`
        )
      } else {
        this.fallbackFile = devFile
      }
      console.debug(
        'development manifest file:',
        this.file,
        '\nfallback file:',
        this.fallbackFile
      )

      if (devInstanceMetadata.forkedNetwork) {
        const forkedChainId = devInstanceMetadata.forkedNetwork.chainId
        console.debug('forked network chain id:', forkedChainId)

        this.parent = new Manifest(forkedChainId, project)
      }
    } else {
      this.dir = MANIFEST_DEFAULT_DIR

      const networkName = networkNames[chainId]
      this.file = path.join(
        MANIFEST_DEFAULT_DIR,
        `${
          networkName ? `${project}-${networkName}` : defaultFallbackName
        }.json`
      )
      this.fallbackFile = path.join(
        MANIFEST_DEFAULT_DIR,
        `${defaultFallbackName}.json`
      )

      console.debug(
        'manifest file:',
        this.file,
        '\nfallback file:',
        this.fallbackFile
      )
    }
  }

  setPoject(project: string): void {
    this.project = project
  }

  getPoject(): string {
    return this.project
  }

  async getProxyFromAddress(address: string): Promise<ProxyDeployment> {
    const data = await this.read()
    for (let name in data.proxies) {
      let proxy: ProxyDeployment = data.proxies[name]
      if (address == proxy.address) {
        return proxy
      }
    }
    throw new DeploymentNotFound(
      `Proxy at address ${address} is not registered`
    )
  }

  async addProxy(proxy: ProxyDeployment): Promise<void> {
    await this.lockedRun(async () => {
      const data = await this.read()
      data.proxies[proxy.name] = proxy
      await this.write(data)
    })
  }

  private async exists(file: string): Promise<boolean> {
    try {
      await fs.access(file)
      return true
    } catch (e: any) {
      return false
    }
  }

  private async readFile(): Promise<string> {
    if (this.file === this.fallbackFile) {
      return await fs.readFile(this.file, 'utf8')
    } else {
      const fallbackExists = await this.exists(this.fallbackFile)
      const fileExists = await this.exists(this.file)

      if (fileExists && fallbackExists) {
        throw new Error(
          `Network files with different names ${this.fallbackFile} and ${this.file} were found for the same network.`
          //   () =>
          //     `More than one network file was found for chain ID ${this.chainId}. Determine which file is the most up to date version, then take a backup of and delete the other file.`,
        )
      } else if (fallbackExists) {
        return await fs.readFile(this.fallbackFile, 'utf8')
      } else {
        return await fs.readFile(this.file, 'utf8')
      }
    }
  }

  private async writeFile(content: string): Promise<void> {
    await this.renameFileIfRequired()
    await fs.writeFile(this.file, content)
  }

  private async renameFileIfRequired() {
    if (
      this.file !== this.fallbackFile &&
      (await this.exists(this.fallbackFile))
    ) {
      try {
        await fs.rename(this.fallbackFile, this.file)
      } catch (e: any) {
        throw new Error(
          `Failed to rename network file from ${this.fallbackFile} to ${this.file}: ${e.message}`
        )
      }
    }
  }

  async read(retries?: number): Promise<ManifestData> {
    const release = this.locked ? undefined : await this.lock(retries)
    try {
      const data = JSON.parse(await this.readFile()) as ManifestData
      return data
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        if (this.parent !== undefined) {
          return await this.parent.read(retries)
        } else {
          return defaultManifest(this.project)
        }
      } else {
        throw e
      }
    } finally {
      await release?.()
    }
  }

  async write(data: ManifestData): Promise<void> {
    if (!this.locked) {
      throw new Error('Manifest must be locked')
    }
    const normalized = normalizeManifestData(data)
    await this.writeFile(JSON.stringify(normalized, null, 2) + '\n')
  }

  async lockedRun<T>(cb: () => Promise<T>): Promise<T> {
    if (this.locked) {
      throw new Error('Manifest is already locked')
    }
    const release = await this.lock()
    try {
      return await cb()
    } finally {
      await release()
    }
  }

  private async lock(retries = 3) {
    const lockfileName = path.join(this.dir, `chain-${this.chainIdSuffix}`)

    await fs.mkdir(path.dirname(lockfileName), { recursive: true })
    const release = await lockfile.lock(lockfileName, {
      retries,
      realpath: false,
    })
    this.locked = true
    return async () => {
      await release()
      this.locked = false
    }
  }
}

export class DeploymentNotFound extends Error {}

export function normalizeManifestData(input: ManifestData): ManifestData {
  return {
    project: input.project,
    proxies: input.proxies,
  }
}

export function assertUnreachable(_: never): never {
  assert(false)
}

export function assert(p: unknown): asserts p {
  if (!p) {
    throw new Error(
      'An unexpected condition occurred. Please report this at https://zpl.in/upgrades/report'
    )
  }
}

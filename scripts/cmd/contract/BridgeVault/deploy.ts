import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { Manifest, ProxyDeployment } from '../../../shared/manifest'
import { deploy } from '../../../shared/utils'
import { ProjectConfig } from '../../../config/types'

export async function deployBridgeVault(
  project: string,
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  force: boolean,
  contract: string
): Promise<string | undefined> {
  const contractName = contracts.BridgeVault
  console.log(`| ${contractName} start ------------------`)

  let contractAddress: string | undefined
  if (proxies[contractName]) {
    contractAddress = proxies[contractName].address
  }

  if (
    (!proxies[contractName] || force) &&
    (contract == '*' || contract.split(',').includes(contractName))
  ) {
    console.info(`Deploying ${contractName}...`)

    const bridgeVaultFactory = await hre.ethers.getContractFactory(contractName)
    const bridgeVault = await bridgeVaultFactory.deploy(
      hre.ethers.getAddress(config.WBTC)
    )
    await bridgeVault.waitForDeployment()
    const proxyAddress = await bridgeVault.getAddress()
    console.info(`Deployed ${contractName} proxy: ${proxyAddress}`)

    const mainfest = await Manifest.forNetwork(project, hre.network.provider)
    await mainfest.addProxy({
      name: contractName,
      address: proxyAddress,
    })

    proxies[contractName] = {
      address: await bridgeVault.getAddress(),
      name: contractName,
    }
  }

  console.log(`| ${contractName} end ------------------`)
  return contractAddress
}

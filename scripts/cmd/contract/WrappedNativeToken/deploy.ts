import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Manifest, ProxyDeployment } from '../../../shared/manifest'
import { ProjectConfig } from '../../../config/types'
import contracts from '../../../config/contracts'

export async function deployWrappedNativeToken(
  project: string,
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  force: boolean,
  contract: string
): Promise<string | undefined> {
  const contractName = contracts.WrappedNativeToken
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

    const WrappedNativeTokenFactory = await hre.ethers.getContractFactory(
      contractName
    )
    const WrappedNativeToken = await WrappedNativeTokenFactory.deploy()
    await WrappedNativeToken.waitForDeployment()
    const proxyAddress = await WrappedNativeToken.getAddress()
    console.info(`Deployed ${contractName} proxy: ${proxyAddress}`)

    const mainfest = await Manifest.forNetwork(project, hre.network.provider)
    await mainfest.addProxy({
      name: contractName,
      address: proxyAddress,
    })

    proxies[contractName] = {
      address: await WrappedNativeToken.getAddress(),
      name: contractName,
    }
  }

  console.log(`| ${contractName} end ------------------`)
  return contractAddress
}

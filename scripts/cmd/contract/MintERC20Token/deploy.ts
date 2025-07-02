import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { deploy } from '../../../shared/utils'
import { ProjectConfig } from '../../../config/types'

export async function deployMintERC20Token(
  project: string,
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  force: boolean,
  contract: string
): Promise<string | undefined> {
  const contractName = contracts.MintERC20Token
  console.log(`| ${contractName} start ------------------`)

  let contractAddress: string | undefined
  if (proxies[contractName]) {
    contractAddress = proxies[contractName].address
  }

  if (
    (!proxies[contractName] || force) &&
    (contract == '*' || contract.split(',').includes(contractName))
  ) {
    if (config.token && config.token.needDeploy) {
      const contract = await deploy(project, hre, contractName, [
        config.token.admin,
        config.token.pauser,
        config.token.minter,
        config.token.upgrader,
        config.token.name,
        config.token.symbol,
        config.token.decimals,
      ])
      contractAddress = await contract.getAddress()
      proxies[contractName] = {
        address: contractAddress,
        name: contractName,
      }
    }
  }

  console.log(`| ${contractName} end ------------------`)
  return contractAddress
}

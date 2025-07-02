import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { deploy } from '../../../shared/utils'
import { ProjectConfig } from '../../../config/types'

export async function deployBridgeLimiter(
  project: string,
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  force: boolean,
  contract: string
): Promise<string | undefined> {
  const contractName = contracts.BridgeLimiter
  console.log(`| ${contractName} start ------------------`)

  let contractAddress: string | undefined
  if (proxies[contractName]) {
    contractAddress = proxies[contractName].address
  }

  if (
    (!proxies[contractName] || force) &&
    (contract == '*' || contract.split(',').includes(contractName))
  ) {
    const bridgeCommittee = proxies[contracts.BridgeCommittee]
    if (bridgeCommittee) {
      const supportedChains = []
      const supportedChainTokens = []
      const supportedChainTokenLimits = []
      for (const supportedChain of config.supportedChains) {
        for (const supportedToken of supportedChain.supportedTokens) {
          if (!supportedToken.address) {
            console.error(
              `deploy ${contractName}: No token address found for supported token`
            )
            return
          }

          supportedChains.push(supportedChain.id)
          supportedChainTokens.push(supportedToken.id)
          supportedChainTokenLimits.push(BigInt(supportedToken.limit))
        }
      }
      const contract = await deploy(project, hre, contractName, [
        bridgeCommittee.address,
        supportedChains,
        supportedChainTokens,
        supportedChainTokenLimits,
      ])
      contractAddress = await contract.getAddress()
      proxies[contractName] = {
        address: contractAddress,
        name: contractName,
      }
    } else {
      console.error(
        `deploy ${contractName}: Please deploy first ${bridgeCommittee}`
      )
    }
  }

  console.log(`| ${contractName} end ------------------`)
  return contractAddress
}

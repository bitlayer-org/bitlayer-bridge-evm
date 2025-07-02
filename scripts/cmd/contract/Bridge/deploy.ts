import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { deploy } from '../../../shared/utils'
import { ProjectConfig } from '../../../config/types'

export async function deployBridge(
  project: string,
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  force: boolean,
  contract: string
): Promise<string | undefined> {
  const contractName = contracts.Bridge
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
    const bridgeVault = proxies[contracts.BridgeVault]
    const bridgeLimiter = proxies[contracts.BridgeLimiter]
    if (bridgeCommittee && bridgeLimiter && bridgeVault) {
      const contract = await deploy(project, hre, contractName, [
        bridgeCommittee.address,
        bridgeVault.address,
        bridgeLimiter.address,
      ])
      contractAddress = await contract.getAddress()
      proxies[contractName] = {
        address: contractAddress,
        name: contractName,
      }
    } else {
      console.error(
        `deploy ${contractName}: Please deploy first: bridgeCommittee: ${bridgeCommittee} | bridgeLimiter: ${bridgeLimiter} | bridgeVault: ${bridgeVault}`
      )
    }
  }

  console.log(`| ${contractName} end ------------------`)
  return contractAddress
}

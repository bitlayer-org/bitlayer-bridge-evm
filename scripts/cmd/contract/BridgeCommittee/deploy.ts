import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { deploy } from '../../../shared/utils'
import { ProjectConfig } from '../../../config/types'

export async function deployBridgeCommittee(
  project: string,
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  force: boolean,
  contract: string
): Promise<string | undefined> {
  const contractName = contracts.BridgeCommittee

  console.log(`| ${contractName} start ------------------`)

  let contractAddress: string | undefined
  if (proxies[contractName]) {
    contractAddress = proxies[contractName].address
  }

  if (
    (!proxies[contractName] || force) &&
    (contract == '*' || contract.split(',').includes(contractName))
  ) {
    // handle params
    const minStakeRequired = config.minStakeRequired
    const submitter = config.submitter
    const committees = []
    const stakes = []
    for (const committee of config.committees) {
      committees.push(committee.address)
      stakes.push(committee.staked)
    }
    // deploy
    const contract = await deploy(project, hre, contractName, [
      committees,
      stakes,
      minStakeRequired,
      submitter,
    ])
    contractAddress = await contract.getAddress()
    proxies[contractName] = { address: contractAddress, name: contractName }
  }

  console.log(`| ${contractName} end ------------------`)
  return contractAddress
}

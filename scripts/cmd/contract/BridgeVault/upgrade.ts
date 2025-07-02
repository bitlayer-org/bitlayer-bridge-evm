import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { upgradeByCommittee } from '../../../shared/utils'
import { getAvailableCommittes } from '../../../config/config'
import { ProjectConfig } from '../../../config/types'

export async function upgradeBridgeVault(
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  contract: string
) {
  const contractName = contracts.BridgeVault
  if (contract == '*' || contract.split(',').includes(contractName)) {
    console.log(`| ${contractName} start ------------------`)

    await upgradeByCommittee(
      hre,
      proxies[contractName].address,
      contractName,
      config.id,
      getAvailableCommittes(config.committees),
      config.submitter
    )
    console.log(`| ${contractName} end ------------------`)
  }
}

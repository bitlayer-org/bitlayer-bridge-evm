import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { ProjectConfig } from '../../../config/types'
import { sendTxn } from '../../../shared/utils'

export async function setupBridgeVault(
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  contract: string
) {
  const contractName = contracts.BridgeVault

  if (contract == '*' || contract.split(',').includes(contractName)) {
    const contractAddress = proxies[contractName].address
    if (contractAddress) {
      console.log(`| ${contractName} start ------------------`)

      const Bridge = proxies[contracts.Bridge].address
      if (Bridge) {
        const contract = await hre.ethers.getContractAt(
          'BridgeVault',
          contractAddress
        )
        const admin = await hre.ethers.getSigner(config.admin)
        if ((await contract.owner()) == admin.address) {
          await sendTxn(
            contract.connect(admin).transferOwnership(Bridge),
            `${contractName}.connect(admin).transferOwnership(${Bridge})`
          )
        }
      } else {
        console.error(`deploy ${contractName}: Please deploy first ${Bridge}`)
      }
      console.log(`| ${contractName} end ------------------`)
    }
  }
}

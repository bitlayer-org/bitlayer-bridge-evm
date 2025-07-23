import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { committeeSignatures, sendTxn } from '../../../shared/utils'
import {
  MessageType,
  MessageVersion,
  ProjectConfig,
} from '../../../config/types'
import { getAvailableCommittes } from '../../../config/config'
import { BridgeUtils } from '../../../../typechain-types/contracts/interfaces/IBridgeCommittee'

export async function setupBridgeLimiter(
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  contract: string
) {
  const contractName = contracts.BridgeLimiter

  if (contract == '*' || contract.split(',').includes(contractName)) {
    const contractAddress = proxies[contractName].address
    if (contractAddress) {
      console.log(`| ${contractName} start ------------------`)
      const contract = await hre.ethers.getContractAt(
        'BridgeLimiter',
        // contractName,
        contractAddress
      )

      const admin = await hre.ethers.getSigner(config.admin)
      for (const supportedChain of config.supportedChains) {
        for (const supportedToken of supportedChain.supportedTokens) {
          // check bridge chain token limit
          const chainTokenId =
            ((supportedChain.id & 0xffff) << 8) | (supportedToken.id & 0xffff)
          const chainTokenLimit = await contract.chainTokenLimits(chainTokenId)
          const limit = BigInt(supportedToken.limit)
          if (chainTokenLimit != limit) {
            const nonce = await contract.nonces(MessageType.UPDATE_BRIDGE_LIMIT)

            const message: BridgeUtils.MessageStruct = {
              messageType: MessageType.ADD_EVM_TOKENS,
              version: MessageVersion,
              nonce: nonce,
              chainID: config.id,
              payload: hre.ethers.solidityPacked(
                ['uint8', 'uint8', 'uint128'],
                [supportedChain.id, supportedToken.id, limit]
              ),
            }

            sendTxn(
              contract
                .connect(admin)
                .updateLimit(message),
              `${contractName}.updateLimit(${message})`
            )
          }
        }
      }
     // contract
      console.log(`| ${contractName} end ------------------`)
    }
  }

  const contractNameLimiter = contracts.BridgeLimiter

  const contractAddress = proxies[contractNameLimiter].address
  if (contractAddress) {
    console.log(`| ${contractNameLimiter} start ------------------`)

    const Bridge = proxies[contracts.Bridge].address
    if (Bridge) {
      const contract = await hre.ethers.getContractAt(
        'BridgeLimiter',
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

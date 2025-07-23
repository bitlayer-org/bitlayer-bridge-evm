import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { committeeSignatures, sendTxn } from '../../../shared/utils'
import {
  MessageType,
  MessageVersion,
  ProjectConfig,
} from '../../../config/types'
import { BridgeUtils } from '../../../../typechain-types/contracts/interfaces/IBridgeCommittee'
import { getAvailableCommittes } from '../../../config/config'

export async function setupBridgeConfig(
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  contract: string
) {
  const contractName = contracts.BridgeConfig

  if (contract == '*' || contract.split(',').includes(contractName)) {
    const contractAddress = proxies[contractName].address
    if (contractAddress) {
      console.log(`| ${contractName} start ------------------`)
      const contract = await hre.ethers.getContractAt(
        'BridgeConfig',
        contractAddress
      )
      const admin = await hre.ethers.getSigner(config.admin)

      let isNative = false
      for (let i = 0; i < 2; i++) {
        let num = 0
        const supportedTokenIDs = []
        const supportedTokenAddresses = []
        const supportedTokenToChainDecimals = []
        const supportedTokenPrices = []

        for (const supportedChain of config.supportedChains) {
          for (const supportedToken of supportedChain.supportedTokens) {
            if (supportedToken.native != isNative) continue
            // check supported chain
            const chainSupported = await contract.supportedChains(
              supportedChain.id
            )
            if (chainSupported != supportedChain.supported) {
              await sendTxn(
                contract
                  .connect(admin)
                  .updateChainID(supportedChain.id, supportedChain.supported),
                `${contractName}.updateChainID(${supportedChain.id}, ${supportedChain.supported})`
              )
            }

            // check supported token
            if (
              !supportedToken.targetChainMintTokenDecimals ||
              !supportedToken.address
            ) {
              console.error('targetChainMintTokenDecimals is empty')
            } else {
              const targetChainMintTokenDecimals = BigInt(
                supportedToken.targetChainMintTokenDecimals
              )
              const supportedTokenInfo = await contract.supportedTokens(
                supportedToken.id
              )
              if (
                supportedTokenInfo.tokenAddress !=
                  hre.ethers.getAddress(supportedToken.address) ||
                supportedTokenInfo.decimal != targetChainMintTokenDecimals
              ) {
                supportedTokenIDs.push(supportedToken.id)
                supportedTokenAddresses.push(supportedToken.address)
                supportedTokenToChainDecimals.push(targetChainMintTokenDecimals)
                supportedTokenPrices.push(1)
                num++
              }
            }
          }
        }

        if (num != 0) {
          const nonce = await contract.nonces(MessageType.ADD_EVM_TOKENS)
          const message: BridgeUtils.MessageStruct = {
            messageType: MessageType.ADD_EVM_TOKENS,
            version: MessageVersion,
            nonce: nonce,
            chainID: config.id,
            payload: hre.ethers.solidityPacked(
              [
                'bool',
                'uint8',
                ...supportedTokenIDs.map(() => 'uint8'),
                'uint8',
                ...supportedTokenAddresses.map(() => 'address'),
                'uint8',
                ...supportedTokenToChainDecimals.map(() => 'uint8'),
                'uint8',
                ...supportedTokenPrices.map(() => 'uint64'),
              ],
              [
                isNative,
                num,
                ...supportedTokenIDs,
                num,
                ...supportedTokenAddresses,
                num,
                ...supportedTokenToChainDecimals,
                num,
                ...supportedTokenPrices,
              ]
            ),
          }

          await sendTxn(
            contract
              .connect(admin)
              .addTokens(message),
            `${contractName}.addTokens(${message})`
          )
        }
        isNative = !isNative
      }
      console.log(`| ${contractName} end ------------------`)
    }
  }
}

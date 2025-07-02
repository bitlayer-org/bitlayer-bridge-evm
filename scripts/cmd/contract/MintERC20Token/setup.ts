import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { sendTxn } from '../../../shared/utils'
import { ProjectConfig } from '../../../config/types'

export async function setupBridge(
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  contract: string
) {
  const contractName = contracts.Bridge

  if (contract == '*' || contract.split(',').includes(contractName)) {
    const contractAddress = proxies[contractName].address
    if (contractAddress) {
      console.log(`| ${contractName} start ------------------`)
      const contract = await hre.ethers.getContractAt(
        contractName,
        contractAddress
      )

      const supportedChains = []
      const supportedChainTokens = []
      const supportedChainTokenInitBridgeAmounts = []
      const supportedChainTokenStates = []
      for (const supportedChain of config.supportedChains) {
        for (const supportedToken of supportedChain.supportedTokens) {
          const tokenInfo = await contract.getTokenInfo(
            supportedChain.id,
            supportedToken.id
          )
          const supportedChainTokenInitBridgeAmount =
            supportedToken.initBridgeAmount || BigInt(0)
          if (
            tokenInfo.bridgeAmount == supportedChainTokenInitBridgeAmount &&
            tokenInfo.state == supportedToken.state
          ) {
            continue
          }
          supportedChains.push(supportedChain.id)
          supportedChainTokens.push(supportedToken.id)
          supportedChainTokenInitBridgeAmounts.push(
            supportedChainTokenInitBridgeAmount
          )
          supportedChainTokenStates.push(supportedToken.state)
        }
      }

      if (supportedChains.length > 0) {
        await sendTxn(
          contract.addTokens(
            supportedChains,
            supportedChainTokens,
            supportedChainTokenInitBridgeAmounts,
            supportedChainTokenStates
          ),
          `${contractName}.addTokens(
              ${supportedChains},
              ${supportedChainTokens},
              ${supportedChainTokenInitBridgeAmounts},
              ${supportedChainTokenStates}
            )`
        )
      }
      console.log(`| ${contractName} end ------------------`)
    }
  }
}

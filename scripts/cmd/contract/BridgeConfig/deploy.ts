import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { deploy, sendTxn } from '../../../shared/utils'
import { ProjectConfig } from '../../../config/types'
import { BridgeCommitteeInterface } from '../../../../typechain-types/contracts/BridgeCommittee'

export async function deployBridgeConfig(
  project: string,
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  force: boolean,
  contract: string
): Promise<string | undefined> {
  const contractName = contracts.BridgeConfig
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
      const supportedTokenIDs = []
      const supportedTokenDecimals = []
      const supportedTokenFeePercentages = []
      const supportedTokenAddresses = []
      const supportedTokenMinAmounts = []

      for (const supportedChain of config.supportedChains) {
        for (const supportedToken of supportedChain.supportedTokens) {
          supportedChains.push(supportedChain.id)
          supportedTokenIDs.push(supportedToken.id)
          if (
            !supportedToken.targetChainMintTokenDecimals ||
            !supportedToken.address
          ) {
            console.error(`targetChainMintTokenDecimals or address is null`)
            return
          }
          supportedTokenDecimals.push(
            supportedToken.targetChainMintTokenDecimals
          )
          supportedTokenAddresses.push(supportedToken.address)

          supportedTokenMinAmounts.push(BigInt(supportedToken.minAmount))

          supportedTokenFeePercentages.push(supportedToken.feePercentage)
        }
      }

      const contract = await deploy(project, hre, contractName, [
        bridgeCommittee.address,
        config.id,
        config.admin,
        config.feeRecipient,
        [
          supportedChains,
          supportedTokenIDs,
          supportedTokenDecimals,
          supportedTokenFeePercentages,
          supportedTokenAddresses,
          supportedTokenMinAmounts,
        ],
      ])

      contractAddress = await contract.getAddress()
      proxies[contractName] = { address: contractAddress, name: contractName }

      // check BridgeCommittee initializeConfig
      const bridgeCommitteeContract = await hre.ethers.getContractAt(
        contracts.BridgeCommittee,
        bridgeCommittee.address
      )
      const _bridgeConfig = await bridgeCommitteeContract.config()
      const admin = await hre.ethers.getSigner(config.admin)
      if (
        _bridgeConfig != hre.ethers.ZeroAddress &&
        _bridgeConfig != contractAddress
      ) {
        console.error(
          `BridgeCommittee seted config: ${_bridgeConfig}, is not equal to new config: ${contractAddress}`
        )
        return
      }
      console.log(bridgeCommittee)
      if (_bridgeConfig == hre.ethers.ZeroAddress) {
        await sendTxn(
          bridgeCommitteeContract
            .connect(admin)
            .initializeConfig(contractAddress),
          `${bridgeCommittee.name} initializeConfig(${contractAddress})`
        )
      }
    } else {
      console.error(
        `deploy ${contractName}: Please deploy ${contracts.BridgeCommittee} first`
      )
    }
  }

  console.log(`| ${contractName} end ------------------`)
  return contractAddress
}

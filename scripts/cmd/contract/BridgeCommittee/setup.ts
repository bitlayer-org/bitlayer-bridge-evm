import { HardhatRuntimeEnvironment } from 'hardhat/types'
import contracts from '../../../config/contracts'
import { ProxyDeployment } from '../../../shared/manifest'
import { committeeSignatures, sendTxn } from '../../../shared/utils'
import { MessageType, ProjectConfig } from '../../../config/types'
import { BridgeUtils } from '../../../../typechain-types/contracts/interfaces/IBridgeCommittee'
import { getAvailableCommittes } from '../../../config/config'

export async function setupBridgeCommittee(
  hre: HardhatRuntimeEnvironment,
  proxies: Record<string, ProxyDeployment>,
  config: ProjectConfig,
  contract: string
) {
  const contractName = contracts.BridgeCommittee

  if (contract == '*' || contract.split(',').includes(contractName)) {
    const contractAddress = proxies[contractName].address

    const BridgeConfigAddress = proxies[contracts.BridgeConfig].address
    if (contractAddress && BridgeConfigAddress) {
      console.log(`| ${contractName} setup start ------------------`)
      const admin = await hre.ethers.getSigner(config.admin)
      const submitter = await hre.ethers.getSigner(config.submitter)
      const contract = await hre.ethers.getContractAt(
        'BridgeCommittee',
        contractAddress
      )
      console.log('contractAddress: ', contractAddress)
      // check BridgeCommittee initializeConfig
      const bridgeConfig = await contract.config()
      if (bridgeConfig == hre.ethers.ZeroAddress) {
        await sendTxn(
          contract.connect(admin).initializeConfig(BridgeConfigAddress),
          `${contractName} initializeConfig(${BridgeConfigAddress})`
        )
      }

      // check BridgeCommittee add committee
      const commitees = []
      const commiteeStaked = []
      for (const committee of config.committees) {
        const staked = await contract.committeeStake(committee.address)
        const index = await contract.committeeIndex(committee.address)
        console.log(committee.address, staked)
        console.log(committee.address, index)
        if (staked != BigInt(committee.staked)) {
          commitees.push(committee.address)
          commiteeStaked.push(committee.staked)
        }
      }
      if (commitees.length > 0) {
        await sendTxn(
          contract.connect(admin).addCommitteeStake(commitees, commiteeStaked),
          `${contractName}.connect(admin).addCommitteeStake(${commitees}, ${commiteeStaked})`
        )
      }

      // check BridgeCommittee add blocklist
      const blocklist: Record<number, string[]> = {}
      for (const committee of config.committees) {
        const isBlocklisted = await contract.blocklist(committee.address)
        if (isBlocklisted != committee.isBlocklisted) {
          if (isBlocklisted) {
            blocklist['1'].push(committee.address)
          } else {
            blocklist['0'].push(committee.address)
          }
        }
      }
      const nonce = await contract.nonces(MessageType.BLOCKLIST)
      const committees = getAvailableCommittes(config.committees)
      for (const [key, value] of Object.entries(blocklist)) {
        const vaultLen = value.length
        if (vaultLen > 0) {
          let setBlocklisted: boolean
          if (key == '1') {
            setBlocklisted = true
          } else {
            setBlocklisted = false
          }

          const message: BridgeUtils.MessageStruct = {
            messageType: MessageType.BLOCKLIST,
            version: 1,
            nonce: nonce,
            chainID: config.id,
            payload: hre.ethers.solidityPacked(
              ['bool', 'uint8', ...value.map(() => 'address')],
              [setBlocklisted, vaultLen, ...value]
            ),
          }
          const signatures = await committeeSignatures(hre, message, committees)

          await sendTxn(
            contract
              .connect(submitter)
              .updateBlocklistWithSignatures(signatures, message),
            `${contractName}.connect(submitter).updateBlocklistWithSignatures(${signatures}, ${message})`
          )
        }
      }
      console.log(`| ${contractName} setup end ------------------`)
    }
  }
}

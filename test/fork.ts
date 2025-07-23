import hre, { ethers } from 'hardhat'
import { getConfig } from '../scripts/config/config'
import { deploy } from '../scripts/shared/utils'
import { upgradeBridgeCommittee } from '../scripts/cmd/contract/BridgeCommittee/upgrade'
import { Manifest, ManifestData } from '../scripts/shared/manifest'
import contracts from '../scripts/config/contracts'
import { deployBridgeConfig } from '../scripts/cmd/contract/BridgeConfig/deploy'
import { deployBridgeCommittee } from '../scripts/cmd/contract/BridgeCommittee/deploy'
import { upgradeBridge } from '../scripts/cmd/contract/Bridge/upgrade'

describe('FORK', function () {
  const project = 'sourceChain'
  const chainID = 200810
  const config = getConfig(project, 200810)
  let data: ManifestData
  this.timeout(120000);
  before(async function () {
    const manifest = await Manifest.forNetwork(project, hre.network.provider)
    data = await manifest.read()
  })
  // it('fork deploy', async function () {
  //   if (!config) {
  //     console.error(`not found project: ${project} config`)
  //     return
  //   }
  //   await deployBridgeCommittee(
  //     project,
  //     hre,
  //     data.proxies,
  //     config,
  //     false,
  //     contracts.BridgeCommittee
  //   )
  //   await deployBridgeConfig(
  //     project,
  //     hre,
  //     data.proxies,
  //     config,
  //     false,
  //     contracts.BridgeConfig
  //   )
  // })
  it('fork upgrade', async function () {
    const manifest = await Manifest.forNetwork(project, hre.network.provider)
    const data = await manifest.read()
    if (!config) {
      console.error(`not found project: ${project} config`)
      return
    }
    await upgradeBridge(
      hre,
      data.proxies,
      config,
      contracts.Bridge
    )

    const bridgeLimiter = await hre.ethers.getContractAt(contracts.BridgeLimiter, data.proxies[contracts.BridgeLimiter].address)
    await bridgeLimiter.transferOwnership(data.proxies[contracts.Bridge].address)

    const bridge = await hre.ethers.getContractAt(contracts.Bridge, data.proxies[contracts.Bridge].address)
    const amount = await bridge.transferBridgedTokensWithSignatures(
      {
        messageType: 0,
        version: 1,
        nonce: 0n,
        chainID: 16,
        payload: '0x209c4d23fa4891160c6a734487d0df87919a7daaa926e65ed577887e0cd55054effa148e9fc1743b3fd7d79a9448a851fe6f4d7073c6105800000000000f3a71'
      }
    )
    console.log(amount)
    // if (!config) {
    //   return
    // }
    // const contractName = 'BridgeLimiter'
    // const supportedChains = []
    // const supportedChainTokens = []
    // const supportedChainTokenLimits = []
    // for (const supportedChain of config.supportedChains) {
    //   for (const supportedToken of supportedChain.supportedTokens) {
    //     if (!supportedToken.address) {
    //       console.error(
    //         `deploy ${contractName}: No token address found for supported token`
    //       )
    //       return
    //     }
    //     supportedChains.push(supportedChain.id)
    //     supportedChainTokens.push(supportedToken.id)
    //     supportedChainTokenLimits.push(BigInt(supportedToken.limit))
    //   }
    // }
    // const contract = await deploy(project, hre, contractName, [
    //   '0x20CB55590ee4856cEb970C75feDB2Dc069914b5F',
    //   supportedChains,
    //   supportedChainTokens,
    //   supportedChainTokenLimits,
    // ])
    // const contractAddress = await contract.getAddress()
    // console.log('================ namespaces ================')
  })
})

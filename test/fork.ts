import hre, { ethers } from 'hardhat'
import { getConfig } from '../scripts/config/config'
import { deploy } from '../scripts/shared/utils'
import { upgradeBridgeCommittee } from '../scripts/cmd/contract/BridgeCommittee/upgrade'
import { Manifest, ManifestData } from '../scripts/shared/manifest'
import contracts from '../scripts/config/contracts'
import { deployBridgeConfig } from '../scripts/cmd/contract/BridgeConfig/deploy'
import { deployBridgeCommittee } from '../scripts/cmd/contract/BridgeCommittee/deploy'

describe('FORK', function () {
  const project = 'sourceChain'
  const chainID = 200810
  const config = getConfig(project, 200810)
  let data: ManifestData
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
    const committe = await ethers.getContractAt(
      'BridgeCommittee',
      '0x7f3e5d233bca0c070da36ccb34992bda7cf2cda8'
    )
    await upgradeBridgeCommittee(
      hre,
      data.proxies,
      config,
      contracts.BridgeCommittee
    )
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

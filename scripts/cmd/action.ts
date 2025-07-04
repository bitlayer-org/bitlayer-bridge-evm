import { HardhatRuntimeEnvironment } from "hardhat/types"
import { parseUnits } from "ethers"
import { getConfig } from "../config/config"
import { Manifest, ProxyDeployment } from "../shared/manifest"
import contracts from "../config/contracts"
import { getChainId } from '../shared/provider'
import hre from 'hardhat'
import { sendTxn } from "../shared/utils"

async function main() {
    const project = 'sourceChain'
    
    const config = getConfig(project, await getChainId(hre.network.provider))
    const manifest = await Manifest.forNetwork(project, hre.network.provider)
    const data = await manifest.read()
    if (!config) {
      console.error(`not found project: ${project} config`)
      return
    }
    // await updateSubmitterList(data.proxies)
    // await addCommitteeStake(data.proxies)
    await bridgeERC20(data.proxies)
    // await queryCommittee(data.proxies)
    // await queryConfig(data.proxies)
    // await queryBridgeLimiter(data.proxies)
    // await queryBridgeVault(data.proxies)
}

async function updateSubmitterList(deployments: Record<string, ProxyDeployment>) {
    const bridgeCommitteeAddr = deployments[contracts.BridgeCommittee].address
    const bridgeCommittee = await hre.ethers.getContractAt(contracts.BridgeCommittee, bridgeCommitteeAddr)
    await sendTxn(bridgeCommittee.updateSubmitterlist(["0x9f0311F1e35e312d0F4B79Dcf5C1a936b8AE0771"], [true]), 'updateSubmitterList')
}

async function addCommitteeStake(deployments: Record<string, ProxyDeployment>) {
    const bridgeCommitteeAddr = deployments[contracts.BridgeCommittee].address
    const bridgeCommittee = await hre.ethers.getContractAt(contracts.BridgeCommittee, bridgeCommitteeAddr)
    await sendTxn(bridgeCommittee.addCommitteeStake(["0x9f0311F1e35e312d0F4B79Dcf5C1a936b8AE0771"], [7777]), 'addCommitteeStake')
}

async function bridgeERC20(deployments: Record<string, ProxyDeployment>) {
    const bridgeAddr = deployments[contracts.Bridge].address
    const bridge = await hre.ethers.getContractAt(contracts.Bridge, bridgeAddr)
    await sendTxn(bridge.bridgeERC20(88, parseUnits("0.011", 8), "0x9c4d23fa4891160c6a734487d0df87919a7daaa926e65ed577887e0cd55054ef", 16), 'bridgeERC20')
}

async function queryCommittee(deployments: Record<string, ProxyDeployment>) {
    const bridgeCommitteeAddr = deployments[contracts.BridgeCommittee].address
    const bridgeCommittee = await hre.ethers.getContractAt(contracts.BridgeCommittee, bridgeCommitteeAddr)
    const committee = await bridgeCommittee.submitterlist("0x8e9FC1743b3FD7D79a9448a851Fe6F4d7073c610")
    console.log(committee)
}

async function queryConfig(deployments: Record<string, ProxyDeployment>) {
    const bridgeConfigAddr = deployments[contracts.BridgeConfig].address
    const bridgeConfig = await hre.ethers.getContractAt(contracts.BridgeConfig, bridgeConfigAddr)
    const config = await bridgeConfig.isChainSupported(16)
    console.log(config)
}

async function queryBridgeLimiter(deployments: Record<string, ProxyDeployment>) {
    const bridgeLimiterAddr = deployments[contracts.BridgeLimiter].address
    const bridgeLimiter = await hre.ethers.getContractAt(contracts.BridgeLimiter, bridgeLimiterAddr)
    const config = await bridgeLimiter.willAmountExceedLimit(16, 88, parseUnits("0.0001", 8))
    console.log(config)
    const config2 = await bridgeLimiter.transferOwnership(deployments[contracts.Bridge].address)
}

async function queryBridgeVault(deployments: Record<string, ProxyDeployment>) {
    const bridgeVaultAddr = deployments[contracts.BridgeVault].address
    const bridgeVault = await hre.ethers.getContractAt(contracts.BridgeVault, bridgeVaultAddr)
    const config = await bridgeVault.owner()
    console.log(config)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
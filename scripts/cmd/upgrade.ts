import '@nomicfoundation/hardhat-toolbox'
import { task } from 'hardhat/config'
import { getConfig } from '../config/config'
import { getChainId } from '../shared/provider'
import { Manifest } from '../shared/manifest'
import { upgradeBridgeConfig } from './contract/BridgeConfig/upgrade'
import { upgradeBridge } from './contract/Bridge/upgrade'
import { upgradeBridgeCommittee } from './contract/BridgeCommittee/upgrade'
import { upgradeBridgeLimiter } from './contract/BridgeLimiter/upgrade'
// npx hardhat upgrade --project xxx --network xxx
task('upgrade', 'Start upgrading contracts')
  .addParam('project', 'How to deploy "sourceChain" or "targetChain"?')
  .addParam(
    'contract',
    'Which contract to deploy(Please use "," to separate)? default: *',
    '*'
  )
  .setAction(async ({ project, contract }, hre) => {
    // upgrade source-chain:
    //    npx hardhat upgrade --project sourceChain --network chapel  [--contract xxx] [--force true]
    // upgrade target-chain:
    //    npx hardhat upgrade --project targetChain --network chapel  [--contract xxx] [--force true]
    await hre.run('compile')

    const config = getConfig(project, await getChainId(hre.network.provider))
    const manifest = await Manifest.forNetwork(project, hre.network.provider)
    const data = await manifest.read()
    if (!config) {
      console.error(`not found project: ${project} config`)
      return
    }

    // BridgeCommittee ----------------------------------------------------------------------------------------------------
    await upgradeBridgeCommittee(hre, data.proxies, config, contract)

    // BridgeConfig ----------------------------------------------------------------------------------------------------
    await upgradeBridgeConfig(hre, data.proxies, config, contract)

    // BridgeLimiter ----------------------------------------------------------------------------------------------------
    await upgradeBridgeLimiter(hre, data.proxies, config, contract)

    // Bridge ----------------------------------------------------------------------------------------------------
    await upgradeBridge(hre, data.proxies, config, contract)

    // // BridgeVault ----------------------------------------------------------------------------------------------------
    // await upgradeBridgeVault(hre, data.proxies, config, contract)
  })

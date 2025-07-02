import '@nomicfoundation/hardhat-toolbox'
import { task } from 'hardhat/config'
import { Manifest } from '../shared/manifest'
import { getConfig } from '../config/config'
import { getChainId } from '../shared/provider'
import { setupBridgeConfig } from './contract/BridgeConfig/setup'
import { setupBridge } from './contract/Bridge/setup'
import { setupBridgeCommittee } from './contract/BridgeCommittee/setup'
import { setupBridgeLimiter } from './contract/BridgeLimiter/setup'
import { setupBridgeVault } from './contract/BridgeVault/setup'

task('setup', 'Initial configuration')
  .addParam('project', 'How to deploy "sourceChain" or "targetChain"?')
  .addParam(
    'contract',
    'Which contract to deploy(Please use "," to separate)? default: *',
    '*'
  )
  .setAction(async ({ project, contract }, hre) => {
    const chainId = await getChainId(hre.network.provider)

    const config = getConfig(project, chainId)

    const manifest = await Manifest.forNetwork(project, hre.network.provider)
    const data = await manifest.read()
    console.log('Contract length: ', Object.keys(data.proxies).length)
    if (Object.keys(data.proxies).length != 0 && config) {
      // setup source-chain:
      //    npx hardhat setup --project sourceChain --network chapel  [--contract xxx] [--force true]
      // setup target-chain:
      //    npx hardhat setup --project targetChain --network chapel  [--contract xxx] [--force true]

      // BridgeCommittee ----------------------------------------------------------------------------------------------------
      await setupBridgeCommittee(hre, data.proxies, config, contract)

      // BridgeConfig ----------------------------------------------------------------------------------------------------
      await setupBridgeConfig(hre, data.proxies, config, contract)

      // BridgeLimiter ----------------------------------------------------------------------------------------------------
      await setupBridgeLimiter(hre, data.proxies, config, contract)

      // BridgeVault ----------------------------------------------------------------------------------------------------
      await setupBridgeVault(hre, data.proxies, config, contract)

      // Bridge ----------------------------------------------------------------------------------------------------
      await setupBridge(hre, data.proxies, config, contract)
    }
  })

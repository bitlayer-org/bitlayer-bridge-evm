import '@nomicfoundation/hardhat-toolbox'
import { task } from 'hardhat/config'
import { getConfig } from '../config/config'
import { getChainId } from '../shared/provider'
import { Manifest } from '../shared/manifest'
import { boolean } from 'hardhat/internal/core/params/argumentTypes'

import { deployBridgeCommittee } from './contract/BridgeCommittee/deploy'
import { deployBridgeConfig } from './contract/BridgeConfig/deploy'
import { deployBridgeLimiter } from './contract/BridgeLimiter/deploy'
import { deployBridgeVault } from './contract/BridgeVault/deploy'
import { deployBridge } from './contract/Bridge/deploy'
import { deployMintERC20Token } from './contract/MintERC20Token/deploy'
import { deployWrappedNativeToken } from './contract/WrappedNativeToken/deploy'

// npx hardhat deploy --project xxx --network xxx
task('deploy', 'Start deploy contracts')
  .addParam('project', 'How to deploy "sourceChain" or "targetChain"?')
  .addParam(
    'contract',
    'Which contract to deploy(Please use "," to separate)? default: *',
    '*'
  )
  .addParam(
    'force',
    'Force deployment of proxy contract? default: false',
    false,
    boolean,
    true
  )
  .setAction(async ({ project, contract, force }, hre) => {
    await hre.run('compile')
    const config = getConfig(project, await getChainId(hre.network.provider))
    const manifest = await Manifest.forNetwork(project, hre.network.provider)
    const data = await manifest.read()
    if (!config) {
      console.error(`not found project: ${project} config`)
      return
    }

    // add new source-chain:
    //      npx hardhat deploy --network chapel --project sourceChain  [--contract xxx] [--force true]
    // add new target-chain:
    //      npx hardhat deploy --network chapel --project targetChain  [--contract xxx] [--force true]

    // WBTC ----------------------------------------------------------------------------------------------------
    // await deployWrappedNativeToken(
    //   project,
    //   hre,
    //   data.proxies,
    //   config,
    //   force,
    //   contract
    // )

    // MintERC20Token ----------------------------------------------------------------------------------------------------
    // await deployMintERC20Token(
    //   project,
    //   hre,
    //   data.proxies,
    //   config,
    //   force,
    //   contract
    // )

    // BridgeCommittee ----------------------------------------------------------------------------------------------------
    await deployBridgeCommittee(
      project,
      hre,
      data.proxies,
      config,
      force,
      contract
    )

    // BridgeConfig ----------------------------------------------------------------------------------------------------
    await deployBridgeConfig(
      project,
      hre,
      data.proxies,
      config,
      force,
      contract
    )

    // BridgeLimiter ----------------------------------------------------------------------------------------------------
    await deployBridgeLimiter(
      project,
      hre,
      data.proxies,
      config,
      force,
      contract
    )

    // BridgeVault ----------------------------------------------------------------------------------------------------
    await deployBridgeVault(project, hre, data.proxies, config, force, contract)

    // Bridge ----------------------------------------------------------------------------------------------------
    await deployBridge(project, hre, data.proxies, config, force, contract)
  })

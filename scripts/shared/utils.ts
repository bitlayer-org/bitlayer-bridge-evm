import {
  BigNumberish,
  Contract,
  ContractTransactionResponse,
  Overrides,
  solidityPacked,
  keccak256,
  BaseContract,
} from 'ethers'
import {
  ContractAddressOrInstance,
  DeployProxyOptions,
  UpgradeProxyOptions,
} from '@openzeppelin/hardhat-upgrades/dist/utils'
import { HardhatEthersHelpers, HardhatRuntimeEnvironment } from 'hardhat/types'

import { Manifest } from './manifest'
import { MessageType } from '../config/types'
import { BridgeUtils } from '../../typechain-types/contracts/utils/CommitteeUpgradeable'
import { COMMITTEE_MESSAGE_PREFIX } from '../config/config'

export function getOverrides(
  hre: HardhatRuntimeEnvironment
): Overrides | undefined {
  let gasLimit: BigNumberish | undefined, gasPrice: BigNumberish | undefined
  if (hre.network.config.gas != 'auto') {
    gasLimit = hre.ethers.parseUnits(`${hre.network.config.gas}`, 0)
  }
  if (hre.network.config.gasPrice != 'auto') {
    gasPrice = hre.ethers.parseUnits(`${hre.network.config.gasPrice}`, 0)
  }
  return {
    gasLimit: gasLimit,
    gasPrice: gasPrice,
  }
}

// 部署
export async function deploy(
  project: string,
  hre: HardhatRuntimeEnvironment,
  name: string,
  params?: unknown[],
  opts?: DeployProxyOptions | undefined
): Promise<
  BaseContract & {
    deploymentTransaction(): ContractTransactionResponse
  } & Omit<BaseContract, keyof BaseContract>
> {
  console.info(`Deploy ${name}:`)
  const contract = await hre.ethers.getContractFactory(name)
  if (opts) {
    opts.txOverrides = getOverrides(hre)
  } else {
    opts = {
      txOverrides: getOverrides(hre),
    }
  }
  const proxyContract = await hre.upgrades.deployProxy(contract, params, opts)
  console.info(`Deploying ${name}...`)
  await proxyContract.waitForDeployment()
  const proxyAddress: string = await proxyContract.getAddress()
  console.info(`Deployed ${name} proxy: ${proxyAddress}`)
  const mainfest = await Manifest.forNetwork(project, hre.network.provider)
  await mainfest.addProxy({
    name: name,
    address: proxyAddress,
  })
  return proxyContract
}

// Upgrade
export async function upgrade(
  hre: HardhatRuntimeEnvironment,
  proxy: ContractAddressOrInstance,
  name: string,
  opts?: UpgradeProxyOptions | undefined
) {
  console.info(`Upgrade ${name}:`)
  const contract = await hre.ethers.getContractFactory(name)
  if (opts) {
    opts.txOverrides = getOverrides(hre)
  } else {
    opts = {
      txOverrides: getOverrides(hre),
    }
  }
  const proxyContract = await hre.upgrades.upgradeProxy(proxy, contract, opts)
  console.info(`Upgrading ${name}...`)
  await proxyContract.waitForDeployment()
  console.info(`Upgraded ${name} proxy: ${await proxy.toString()}`)
  return proxyContract
}

// Upgrade by committee
export async function upgradeByCommittee(
  hre: HardhatRuntimeEnvironment,
  proxy: ContractAddressOrInstance,
  name: string,
  currentChainId: number,
  committees: string[],
  submiter: string,
  opts?: UpgradeProxyOptions | undefined
) {
  console.info(`Upgrade ${name}:`)
  const contract = await hre.ethers.getContractFactory(name)
  if (opts) {
    opts.txOverrides = getOverrides(hre)
  } else {
    opts = {
      txOverrides: getOverrides(hre),
    }
  }

  console.info(`Deploying ${name} new implementation...`)
  const implementation = await contract.deploy()
  await implementation.waitForDeployment()
  const implementationAddr = await implementation.getAddress()
  console.info(`Deployed ${name} new implementation: ${implementationAddr}`)

  const CommitteeUpgradeable = await hre.ethers.getContractAt(
    'CommitteeUpgradeable',
    proxy
  )

  // MessageVerify nonces
  const nonce = await CommitteeUpgradeable.nonces(MessageType.UPGRADE)
  const message: BridgeUtils.MessageStruct = {
    messageType: MessageType.UPGRADE,
    version: 1,
    nonce: nonce,
    chainID: currentChainId,
    payload: hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'bytes'],
      [proxy.toString(), implementationAddr, '0x']
    ),
  }
  const signatures = await committeeSignatures(hre, message, committees)

  let hash = computeCommitteeHash(message)
  const _submiter = await hre.ethers.getSigner(submiter)

  await sendTxn(
    CommitteeUpgradeable.connect(_submiter).upgradeWithSignatures(
      signatures,
      message
    ),
    `Upgrading ${name}`
  )

  return CommitteeUpgradeable
}

export async function committeeSignatures(
  hre: HardhatRuntimeEnvironment,
  message: BridgeUtils.MessageStruct,
  committees: string[]
) {
  const signatures = new Array<string>(0)
  let hash = computeCommitteeHash(message)
  for (let signerAddress of committees) {
    const signer = await hre.ethers.getSigner(signerAddress)
    const sign = await signer.provider.send('personal_sign', [
      hash,
      signer.address.toLowerCase(),
    ])
    signatures.push(sign)
  }
  return signatures
}

// 发送交易
export async function sendTxn(
  txnPromise: Promise<ContractTransactionResponse>,
  label: string
) {
  console.info(`Processsing ${label}:`)
  const txn = await txnPromise
  console.info(`Sending ${label}...`)
  await txn.wait(2)
  console.info(`... Sent! ${txn.hash}`)
}

export const computeCommitteeHash = (
  message: BridgeUtils.MessageStruct
): string => {
  const MESSAGE_PREFIX = COMMITTEE_MESSAGE_PREFIX

  const prefixTypeAndVersion = solidityPacked(
    ['string', 'uint8', 'uint8'],
    [MESSAGE_PREFIX, message.messageType, message.version]
  )
  const nonce = solidityPacked(['uint64'], [message.nonce])
  const chainId = solidityPacked(['uint8'], [message.chainID])

  const hash = solidityPacked(
    ['bytes', 'bytes', 'bytes', 'bytes'],
    [prefixTypeAndVersion, nonce, chainId, message.payload]
  )
  return keccak256(hash)
}

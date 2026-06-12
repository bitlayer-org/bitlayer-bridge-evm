import { ethers } from 'ethers'
import dotenv from 'dotenv'
import hre from 'hardhat'

dotenv.config()

const BRIDGE_ABI = [
  'function committee() view returns (address)',
  'function chainsIsTransferProcessed(uint64 chainID, uint64 nonce) view returns (bool)',
  'function isTransferProcessed(uint64 nonce) view returns (bool)',
  'function getTokenInfo(uint8 chainID, uint8 tokenID) view returns (tuple(uint256 bridgeAmount,bool state))',
  'function transferBridgedTokensWithSignatures(bytes[] signatures, tuple(uint8 messageType,uint8 version,uint64 nonce,uint8 chainID,bytes payload) message)',
]

const COMMITTEE_ABI = [
  'function config() view returns (address)',
  'function submitterlist(address member) view returns (bool)',
  'function committeeStake(address member) view returns (uint16)',
  'function blocklist(address member) view returns (bool)',
]

const CONFIG_ABI = [
  'function chainID() view returns (uint8)',
  'function isChainSupported(uint8 chainID) view returns (bool)',
  'function tokenAddressOf(uint8 tokenID) view returns (address)',
  'function tokenDecimalOf(uint8 tokenID) view returns (uint8)',
  'function tokenIsNative(uint8 tokenID) view returns (bool)',
]

const MESSAGE_TYPE_TOKEN_TRANSFER = 0
const MESSAGE_VERSION = 1
const TRANSFER_STAKE_REQUIRED = 6666
const UINT64_MAX = (1n << 64n) - 1n

type Args = Record<string, string | boolean>

type BridgeMessage = {
  messageType: number
  version: number
  nonce: bigint
  chainID: number
  payload: string
}

function usage(): never {
  console.error(`用法:
  BRIDGE_ADDRESS=<bridge> \\
  SOURCE_CHAIN_ID=<uint8> \\
  TRANSFER_NONCE=<uint64> \\
  TOKEN_ID=<uint8> \\
  RECIPIENT_ADDRESS=<evm address> \\
  AMOUNT_HUMAN=<decimal amount> \\
  npx hardhat run scripts/transfer-bridged-with-signatures.ts --network bitlayer

环境变量:
  BRIDGE_SIGNER_PRIVATE_KEY       committee signer 私钥，只用于签 bridge message
  BRIDGE_SUBMITTER_PRIVATE_KEY    submitter 私钥，用于 callStatic/estimateGas 和可选广播
  BRIDGE_ADDRESS                  Bridge 合约地址
  SOURCE_CHAIN_ID                 message 里的源链 ID
  TRANSFER_NONCE                  选定源链下未使用的 token-transfer nonce
  TOKEN_ID                        bridge token ID
  RECIPIENT_ADDRESS               EVM 收款地址
  AMOUNT_RAW                      uint64 bridge token decimal 口径金额
  AMOUNT_HUMAN                    按 BridgeConfig.tokenDecimalOf(tokenID) 解析的人类可读金额
  TARGET_CHAIN_ID                 可选；默认读取 BridgeConfig.chainID()
  SOURCE_SENDER                   可选 20 字节地址或 32 字节 hex；默认 bytes32(0)
  BROADCAST=true                  可选；simulation 成功后发送交易

说明:
  当前 Hardhat 工程不稳定支持透传脚本参数，推荐使用环境变量。
  脚本默认 dry-run。设置 BROADCAST=true 才会发送交易。`)
  process.exit(1)
}

function parseArgs(argv: string[]): Args {
  const args: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i]
    if (!item.startsWith('--')) usage()
    const key = item.slice(2)
    if (key === 'broadcast') {
      args[key] = true
      continue
    }
    const value = argv[++i]
    if (!value || value.startsWith('--')) usage()
    args[key] = value
  }
  return args
}

function requireArg(args: Args, key: string): string {
  const value = args[key] ?? process.env[envKey(key)]
  if (typeof value !== 'string' || value.length === 0) {
    usage()
  }
  return value
}

function optionalArg(args: Args, key: string): string | undefined {
  const value = args[key] ?? process.env[envKey(key)]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function envKey(key: string): string {
  const explicit: Record<string, string> = {
    bridge: 'BRIDGE_ADDRESS',
    'source-chain': 'SOURCE_CHAIN_ID',
    nonce: 'TRANSFER_NONCE',
    'token-id': 'TOKEN_ID',
    recipient: 'RECIPIENT_ADDRESS',
    'amount-raw': 'AMOUNT_RAW',
    'amount-human': 'AMOUNT_HUMAN',
    'target-chain': 'TARGET_CHAIN_ID',
    'source-sender': 'SOURCE_SENDER',
  }
  return explicit[key] || key.replace(/-/g, '_').toUpperCase()
}

function parseUintArg(args: Args, key: string, max: bigint): bigint {
  const raw = requireArg(args, key)
  if (!/^\d+$/.test(raw)) {
    throw new Error(`--${key} must be an unsigned integer`)
  }
  const value = BigInt(raw)
  if (value > max) {
    throw new Error(`--${key} exceeds ${max.toString()}`)
  }
  return value
}

function parseUint8Arg(args: Args, key: string): number {
  const value = parseUintArg(args, key, 255n)
  return Number(value)
}

function normalizeSourceSender(value?: string): string {
  if (!value) {
    return ethers.ZeroHash
  }

  if (!ethers.isHexString(value)) {
    throw new Error('--source-sender must be hex')
  }

  const bytes = ethers.getBytes(value)
  if (bytes.length === 32) {
    return ethers.hexlify(bytes)
  }
  if (bytes.length === 20) {
    return ethers.zeroPadValue(ethers.hexlify(bytes), 32)
  }

  throw new Error('--source-sender must be 20 bytes or 32 bytes')
}

function buildPayload(
  sourceSender: string,
  targetChain: number,
  recipient: string,
  tokenID: number,
  amount: bigint
): string {
  return ethers.solidityPacked(
    ['uint8', 'bytes32', 'uint8', 'uint8', 'address', 'uint8', 'uint64'],
    [32, sourceSender, targetChain, 20, recipient, tokenID, amount]
  )
}

function computeMessageHash(message: BridgeMessage): string {
  const encoded = ethers.solidityPacked(
    ['string', 'uint8', 'uint8', 'uint64', 'uint8', 'bytes'],
    ['DST_BRIDGE_MESSAGE', message.messageType, message.version, message.nonce, message.chainID, message.payload]
  )
  return ethers.keccak256(encoded)
}

function formatError(error: unknown): string {
  const maybe = error as { shortMessage?: string; reason?: string; message?: string }
  return maybe.shortMessage || maybe.reason || maybe.message || String(error)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const signerPrivateKey = process.env.BRIDGE_SIGNER_PRIVATE_KEY
  const submitterPrivateKey = process.env.BRIDGE_SUBMITTER_PRIVATE_KEY

  if (!signerPrivateKey) {
    throw new Error('Missing BRIDGE_SIGNER_PRIVATE_KEY')
  }
  if (!submitterPrivateKey) {
    throw new Error('Missing BRIDGE_SUBMITTER_PRIVATE_KEY')
  }

  const bridgeAddress = ethers.getAddress(requireArg(args, 'bridge'))
  const sourceChain = parseUint8Arg(args, 'source-chain')
  const nonce = parseUintArg(args, 'nonce', UINT64_MAX)
  const tokenID = parseUint8Arg(args, 'token-id')
  const recipient = ethers.getAddress(requireArg(args, 'recipient'))
  const sourceSender = normalizeSourceSender(optionalArg(args, 'source-sender'))
  const shouldBroadcast = args.broadcast === true || process.env.BROADCAST === 'true'

  const provider = hre.ethers.provider
  const signerWallet = new ethers.Wallet(signerPrivateKey, provider)
  const submitterWallet = new ethers.Wallet(submitterPrivateKey, provider)

  const bridge = new ethers.Contract(bridgeAddress, BRIDGE_ABI, submitterWallet)
  const committeeAddress = await bridge.committee()
  const committee = new ethers.Contract(committeeAddress, COMMITTEE_ABI, provider)
  const configAddress = await committee.config()
  const config = new ethers.Contract(configAddress, CONFIG_ABI, provider)

  const targetChain = optionalArg(args, 'target-chain')
    ? parseUint8Arg(args, 'target-chain')
    : Number(await config.chainID())

  const tokenDecimal = Number(await config.tokenDecimalOf(tokenID))
  let amount: bigint
  if (optionalArg(args, 'amount-raw')) {
    amount = parseUintArg(args, 'amount-raw', UINT64_MAX)
  } else if (optionalArg(args, 'amount-human')) {
    amount = ethers.parseUnits(requireArg(args, 'amount-human'), tokenDecimal)
    if (amount > UINT64_MAX) {
      throw new Error('--amount-human exceeds uint64 after tokenDecimalOf conversion')
    }
  } else {
    usage()
  }

  const payload = buildPayload(sourceSender, targetChain, recipient, tokenID, amount)
  const message: BridgeMessage = {
    messageType: MESSAGE_TYPE_TOKEN_TRANSFER,
    version: MESSAGE_VERSION,
    nonce,
    chainID: sourceChain,
    payload,
  }

  const messageHash = computeMessageHash(message)
  const signature = await signerWallet.signMessage(ethers.getBytes(messageHash))
  const recoveredSigner = ethers.verifyMessage(ethers.getBytes(messageHash), signature)

  const submitterAllowed = await committee.submitterlist(submitterWallet.address)
  const signerStake = Number(await committee.committeeStake(signerWallet.address))
  const signerBlocklisted = await committee.blocklist(signerWallet.address)
  const sourceChainSupported = await config.isChainSupported(sourceChain)
  const processed = sourceChain === 11
    ? await bridge.isTransferProcessed(nonce)
    : await bridge.chainsIsTransferProcessed(sourceChain, nonce)
  const tokenInfo = await bridge.getTokenInfo(sourceChain, tokenID)
  const tokenAddress = await config.tokenAddressOf(tokenID)
  const tokenIsNative = await config.tokenIsNative(tokenID)

  console.log('Manual bridge transfer preview')
  console.log('network', await provider.getNetwork())
  console.log('bridge', bridgeAddress)
  console.log('committee', committeeAddress)
  console.log('config', configAddress)
  console.log('submitter', submitterWallet.address, { allowed: submitterAllowed })
  console.log('signer', signerWallet.address, {
    recovered: recoveredSigner,
    stake: signerStake,
    requiredStake: TRANSFER_STAKE_REQUIRED,
    blocklisted: signerBlocklisted,
  })
  console.log('token', {
    tokenID,
    tokenAddress,
    tokenIsNative,
    tokenDecimal,
    enabledForSourceChain: tokenInfo.state,
    bridgeAmount: tokenInfo.bridgeAmount.toString(),
  })
  console.log('message', {
    messageType: message.messageType,
    version: message.version,
    nonce: message.nonce.toString(),
    sourceChain: message.chainID,
    targetChain,
    sourceSender,
    recipient,
    amount: amount.toString(),
    payload,
    messageHash,
    signature,
    sourceChainSupported,
    processed,
  })

  const warnings: string[] = []
  if (!submitterAllowed) warnings.push('submitter is not in BridgeCommittee.submitterlist')
  if (signerStake < TRANSFER_STAKE_REQUIRED) warnings.push('signer stake is below token transfer threshold')
  if (signerBlocklisted) warnings.push('signer is blocklisted')
  if (!sourceChainSupported) warnings.push('source chain is not supported by BridgeConfig')
  if (processed) warnings.push('nonce has already been processed for this source chain')
  if (!tokenInfo.state) warnings.push('token is disabled for this source chain in Bridge')

  if (warnings.length > 0) {
    console.log('warnings', warnings)
  }

  try {
    await bridge.transferBridgedTokensWithSignatures.staticCall([signature], message)
    const gas = await bridge.transferBridgedTokensWithSignatures.estimateGas([signature], message)
    console.log('simulation', { ok: true, estimatedGas: gas.toString() })
  } catch (error) {
    console.error('simulation', { ok: false, error: formatError(error) })
    process.exitCode = 1
    return
  }

  if (!shouldBroadcast) {
    console.log('dryRun', 'ok; add --broadcast to send the transaction')
    return
  }

  const tx = await bridge.transferBridgedTokensWithSignatures([signature], message)
  console.log('broadcast', { hash: tx.hash })
  const receipt = await tx.wait()
  console.log('receipt', { status: receipt?.status, blockNumber: receipt?.blockNumber })
}

main().catch((error) => {
  console.error(formatError(error))
  process.exitCode = 1
})

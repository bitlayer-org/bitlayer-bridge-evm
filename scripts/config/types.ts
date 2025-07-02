import { BigNumberish } from 'ethers'

export const MessageVersion = 1

export const MessageType = {
  TOKEN_TRANSFER: 0,
  BLOCKLIST: 1,
  EMERGENCY_OP: 2,
  UPDATE_BRIDGE_LIMIT: 3,
  UPDATE_TOKEN_PRICE: 4,
  UPGRADE: 5,
  ADD_EVM_TOKENS: 7,
}

export interface ProjectConfig {
  id: number // custom chain id
  name: string // chain name
  WBTC: string // wrapped BTC token
  admin: string // contract admin
  submitter: string // multi-sig sender
  feeRecipient: string // bridge fee recipient
  minStakeRequired: number // minimum staking amount, just verify committee staked amount
  committees: CommitteeConfig[] // committee members
  supportedChains: SupportedChainConfig[] // supported from or to chains
  token?: TokenConfig
}

export interface TokenConfig {
  needDeploy: boolean
  name: string
  symbol: string
  decimals: number
  admin: string
  pauser: string
  minter: string
  upgrader: string
}

export interface SupportedChainConfig {
  id: number // custom chain id
  supportedTokens: SupportedTokenConfig[] // supported tokens
  supported: boolean // is supported
}

export interface CommitteeConfig {
  address: string // committee member address
  staked: number // committee staked amount
  isBlocklisted: boolean // committee is bocklisted
}

export interface SupportedTokenConfig {
  id: number // custom token id
  address?: string // token's address of source chain
  targetChainMintTokenDecimals?: number // token's decimals of target chain
  feePercentage: number // bridge fee percentage
  minAmount: number // bridge minimum amount
  limit: number // total amount of bridge limit in 24h
  initBridgeAmount?: BigNumberish // init bridge amount of token, need to include decimals
  state: boolean // token state
  native: boolean // token is native token
}

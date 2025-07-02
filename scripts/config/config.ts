import { ProjectConfig, CommitteeConfig } from "./types";

export const getConfig = (project: string, chainId: number): ProjectConfig => {
  return {
    id: 1,
    name: 'testnet',
    WBTC: '0x0000000000000000000000000000000000000000',
    admin: '0x0000000000000000000000000000000000000000',
    submitter: '0x0000000000000000000000000000000000000000',
    feeRecipient: '0x0000000000000000000000000000000000000000',
    minStakeRequired: 1,
    committees: [{
      address: '0x0000000000000000000000000000000000000000',
      staked: 7777,
      isBlocklisted: false,
    }],
    supportedChains: [
      {
        id: 100, //sui
        supportedTokens: [
          {
            id: 88, // YBTC.b  88
            address: '0x0000000000000000000000000000000000000000',
            targetChainMintTokenDecimals: 8,
            feePercentage: 1000,
            minAmount: 0.0001 * 10 ** 8, // 0.0001 YBTC.b
            limit: 1000 * 10 ** 8, // 1000 YBTC.b
            initBridgeAmount: 0,
            state: true,
            native: false,
          }
        ],
        supported: true,
      }
    ]
  }
}

export const getAvailableCommittes = (committees: CommitteeConfig[]) => {
  return committees.filter(committee => !committee.isBlocklisted)
}

export const COMMITTEE_MESSAGE_PREFIX = '0x0000000000000000000000000000000000000000000000000000000000000000'
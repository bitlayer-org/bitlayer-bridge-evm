import { ProjectConfig, CommitteeConfig } from "./types";

const configs = [
  {
    id: 250,
    name: 'sourceChain',
    WBTC: '0x83f62399f2A417db8ad34A4fC54d58240Fc898e9',
    admin: '0x8e9FC1743b3FD7D79a9448a851Fe6F4d7073c610',
    submitter: '0x8e9FC1743b3FD7D79a9448a851Fe6F4d7073c610',
    feeRecipient: '0x8e9FC1743b3FD7D79a9448a851Fe6F4d7073c610',
    minStakeRequired: 1,
    committees: [{
      address: '0x8e9FC1743b3FD7D79a9448a851Fe6F4d7073c610',
      staked: 7777,
      isBlocklisted: false,
    }],
    supportedChains: [
      {
        id: 16, //sui
        supportedTokens: [
          {
            id: 88, // YBTC.b  88
            address: '0xb8300978Bfd1197637CDE50EAB4c37A887bB899a',
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
]

export const getConfig = (project: string, chainId: number): ProjectConfig => {
  if (chainId === 200810) {
    chainId = 250
  } else if (chainId === 200900) {
    chainId = 100
  } else {
    throw new Error(`Unsupported chainId: ${chainId}`)
  }
  return configs.find(config => config.id === chainId && config.name === project) as ProjectConfig
}

export const getAvailableCommittes = (committees: CommitteeConfig[]) => {
  return committees.filter(committee => !committee.isBlocklisted).map(committee => committee.address)
}

export const COMMITTEE_MESSAGE_PREFIX = 'DST_BRIDGE_MESSAGE'
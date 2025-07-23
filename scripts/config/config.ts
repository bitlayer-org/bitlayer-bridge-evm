import { ProjectConfig, CommitteeConfig } from "./types";

const configs = [
  {
    id: 1,
    name: 'sourceChain',
    WBTC: '0xff204e2681a6fa0e2c3fade68a1b28fb90e4fc5f',
    admin: '0x2B401f83bc5f9619Ce7d24770adBbB7b269Bee4C',
    submitter: '0x9A3d7111A0FD15e612878Db6011445025f88948b',
    feeRecipient: '0x79468a83e77423978e984E9799C51963B236F724',
    minStakeRequired: 1,
    committees: [{
      address: '0x078Bb71a6ad43883ECE9A4dB3d5EDcAF789A7EC8',
      staked: 2222,
      isBlocklisted: false,
    },
    {
      address: '0xE8ccbb36816e5f2fB69fBe6fbd46d7e370435d84',
      staked: 2222,
      isBlocklisted: false,
    },
    {
      address: '0xC81962aA3B3C400B6Db904c0cb8bd646f69B8550',
      staked: 2222,
      isBlocklisted: false,
    },
    {
      address: '0x6fBD04801f931E597B991df39804e78138F0c6Ba',
      staked: 2222,
      isBlocklisted: false,
    }, 
  ],
    supportedChains: [
      {
        id: 16, //sui
        supportedTokens: [
          {
            id: 1, // YBTC.b  88
            address: '0x2cd3cdb3bd68eea0d3be81da707bc0c8743d7335',
            targetChainMintTokenDecimals: 8,
            feePercentage: 0,
            minAmount: 0.0001 * 10 ** 8, // 0.0001 YBTC.b
            limit: 50 * 10 ** 8, // 1000 YBTC.b
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
  } else if (chainId === 200901) {
    chainId = 1
  } else {
    throw new Error(`Unsupported chainId: ${chainId}`)
  }
  return configs.find(config => config.id === chainId && config.name === project) as ProjectConfig
}

export const getAvailableCommittes = (committees: CommitteeConfig[]) => {
  return committees.filter(committee => !committee.isBlocklisted).map(committee => committee.address)
}

export const COMMITTEE_MESSAGE_PREFIX = 'DST_BRIDGE_MESSAGE'
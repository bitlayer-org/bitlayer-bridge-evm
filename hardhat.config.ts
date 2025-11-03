import type { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@openzeppelin/hardhat-upgrades'
import * as envEnc from '@chainlink/env-enc'

import './scripts/cmd/deploy'
import './scripts/cmd/upgrade'
import './scripts/cmd/setup'

import dotenv from 'dotenv'
import { parseEther } from 'ethers'

dotenv.config()

envEnc.config()

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.22',
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: 'http://127.0.0.1:8546',
      },
      accounts: [
        {
          privateKey: process.env.TEST_PRIVATE_KEY1 as string, // deployer
          balance: parseEther('100').toString(),
        },
      ],
    },
    bitlayerTest: {
      url: 'https://testnet-rpc.bitlayer.org',
      accounts: [
        process.env.TEST_PRIVATE_KEY1 as string, // deployer
      ],
    },
    bitlayer: {
      url: 'https://rpc.bitlayer.org',
      accounts: [
        process.env.MAINNET_PRIVATE_KEY as string, // deployer
      ],
    }
  },
  etherscan: {
    apiKey: {
      bitlayerTest: "xxxx",
      bitlayer: "xxxx"
    },
    customChains: [
      {
        network: "bitlayerTest",
        chainId: 200810,
        urls: {
          apiURL: "https://api-testnet.btrscan.com/scan/api",
          browserURL: "https://testnet.btrscan.com",
        },
      },
      {
        network: "bitlayer",
        chainId: 200901,
        urls: {
          apiURL: "https://api.btrscan.com/scan/api",
          browserURL: "https://btrscan.com",
        },
      },
    ],
  },
}

export default config

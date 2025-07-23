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
        // {
        //   privateKey: process.env.TEST_SUBMITTER_PRIVATE_KEY1 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
        // {
        //   privateKey: process.env.TEST_COMMITTEE_PRIVATE_KEY1 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
        // {
        //   privateKey: process.env.TEST_COMMITTEE_PRIVATE_KEY2 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
        // {
        //   privateKey: process.env.TEST_COMMITTEE_PRIVATE_KEY3 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
        // {
        //   privateKey: process.env.TEST_USER_PRIVATE_KEY1 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
        {
          privateKey: process.env.TEST_BITNOVA_SUBMITTER_PRIVATE_KEY1 as string, // deployer
          balance: parseEther('100').toString(),
        },
        // {
        //   privateKey: process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY1 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
        // {
        //   privateKey: process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY2 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
        // {
        //   privateKey: process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY3 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
        // {
        //   privateKey: process.env.TEST_BITNOVA_USER_PRIVATE_KEY1 as string, // deployer
        //   balance: parseEther('100').toString(),
        // },
      ],
    },
    // chapel: {
    //   url: 'https://rpc.ankr.com/bsc_testnet_chapel',
    //   accounts: [
    //     process.env.TEST_SUBMITTER_PRIVATE_KEY1 as string, // deployer
    //     process.env.TEST_COMMITTEE_PRIVATE_KEY1 as string,
    //     process.env.TEST_COMMITTEE_PRIVATE_KEY2 as string,
    //     process.env.TEST_COMMITTEE_PRIVATE_KEY3 as string,
    //     process.env.TEST_USER_PRIVATE_KEY1 as string,
    //   ],
    // },
    bitlayerTest: {
      url: 'https://testnet-rpc.bitlayer.org',
      accounts: [
        process.env.TEST_BITNOVA_SUBMITTER_PRIVATE_KEY1 as string, // deployer
      //   process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY1 as string,
      //   process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY2 as string,
      //   process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY3 as string,
      //   process.env.TEST_BITNOVA_USER_PRIVATE_KEY1 as string,
      ],
    },
  },
  etherscan: {
    apiKey: {
      bitlayerTest: "ITKKXWXCAYY5PNMC82U6GP4DUFY1A8MWCT",
      bitlayer: "ITKKXWXCAYY5PNMC82U6GP4DUFY1A8MWCT",
      bsc: "ITKKXWXCAYY5PNMC82U6GP4DUFY1A8MWCT",
      sepolia: "278RM9YN2CN5NR5Q43JSZJ7TZ8UFYAGA3J",
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

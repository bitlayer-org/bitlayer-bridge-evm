import type { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@openzeppelin/hardhat-upgrades'

import './scripts/cmd/deploy'
import './scripts/cmd/upgrade'
import './scripts/cmd/setup'

import dotenv from 'dotenv'
import { parseEther } from 'ethers'

dotenv.config()

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
      // forking: {
      //   url: 'https://testnet-rpc.bitlayer.org',
      // },
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
        {
          privateKey: process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY1 as string, // deployer
          balance: parseEther('100').toString(),
        },
        {
          privateKey: process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY2 as string, // deployer
          balance: parseEther('100').toString(),
        },
        {
          privateKey: process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY3 as string, // deployer
          balance: parseEther('100').toString(),
        },
        {
          privateKey: process.env.TEST_BITNOVA_USER_PRIVATE_KEY1 as string, // deployer
          balance: parseEther('100').toString(),
        },
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
    bitlayerTestnet: {
      url: 'https://testnet-rpc.bitlayer.org',
      accounts: [
        process.env.TEST_BITNOVA_SUBMITTER_PRIVATE_KEY1 as string, // deployer
        process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY1 as string,
        process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY2 as string,
        process.env.TEST_BITNOVA_COMMITTEE_PRIVATE_KEY3 as string,
        process.env.TEST_BITNOVA_USER_PRIVATE_KEY1 as string,
      ],
    },
  },
}

export default config

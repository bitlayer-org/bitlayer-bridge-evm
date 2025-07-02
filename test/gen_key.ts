import hre, { ethers } from 'hardhat'
import { getConfig } from '../scripts/config/config'
import { deploy } from '../scripts/shared/utils'

describe('Gen Keys', function () {
  it('gen key', async function () {
    const n = 5
    for (let i = 0; i < n; i++) {
      const wallet = ethers.Wallet.createRandom()

      console.log('===========================')
      console.log('wallet: ', i)
      console.log('address: ', wallet.address)
      console.log('publicKey: ', wallet.publicKey)
      console.log('privateKey: ', wallet.privateKey)
    }
  })
})

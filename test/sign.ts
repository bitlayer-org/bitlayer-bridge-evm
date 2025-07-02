import hre, { ethers } from 'hardhat'
import { committeeSignatures } from '../scripts/shared/utils'

describe('Sign', function () {
  it('sign', async function () {
    const signs = await committeeSignatures(
      hre,
      {
        messageType: 7,
        version: 1,
        nonce: 0,
        chainID: 16,
        payload: hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ['uint8[]', 'uint8[]', 'uint64[]', 'uint64[]', 'bool[]'],
          [[4], [5], [2000], [0], [true]]
        ),
      },
      [
        '0x2698895D0DDa3Ef6fb5Db6CD75441467173f099C',
        '0x638d08a93Df184FD9EC8d9da195F0DA35224798F',
        '0x4f36992D9c953C9D253D199821D39dAEa56120Ff',
      ]
    )
    console.log(signs)
  })

  // supported_chain_ids: vector<u8>,
  // supported_token_ids: vector<u8>,
  // fee_percentages: vector<u64>,
  // bridge_amounts: vector<u64>,
  // supporteds: vector<bool>,
})

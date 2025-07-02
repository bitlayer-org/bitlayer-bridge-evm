import { ethers } from 'hardhat'

const main = async () => {
  const bridgeCommittee = await ethers.getContractAt('BridgeCommittee', '')
  console.log(await bridgeCommittee.config())
}
main().catch((error) => {
  console.error(error)
})

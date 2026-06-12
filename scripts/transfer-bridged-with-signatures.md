# Manual `transferBridgedTokensWithSignatures` Script

This script constructs the existing bridge token-transfer message, signs it with a committee signer, and sends it from a submitter account. It does not change any contract.

## Prerequisites

The bridge admin must prepare the contract state first:

1. Add the signer to `BridgeCommittee.addCommitteeStake([signer], [stake])`.
   - For a single signer, use stake `>= 6666`.
2. Add the submitter to `BridgeCommittee.updateSubmitterlist([submitter], [true])`.
   - `MessageVerifier` checks `submitterlist[msg.sender]`.
3. Make sure the selected source `chainID` is supported, the source-chain/token pair is enabled, the pair has enough `bridgeAmount`, the rolling limit is enough, and the nonce is unused.

## Environment

Set these locally. Do not put private keys in chat or commit them.

```bash
export BRIDGE_SIGNER_PRIVATE_KEY=...
export BRIDGE_SUBMITTER_PRIVATE_KEY=...
```

## Dry Run

`--amount-human` is parsed with `BridgeConfig.tokenDecimalOf(tokenID)`.

```bash
BRIDGE_ADDRESS=0x3ecf2d23ca77510f63a44298223613e0e1ab44b0 \
SOURCE_CHAIN_ID=16 \
TRANSFER_NONCE=123456 \
TOKEN_ID=1 \
RECIPIENT_ADDRESS=0x0000000000000000000000000000000000000000 \
AMOUNT_HUMAN=99 \
npx hardhat run scripts/transfer-bridged-with-signatures.ts --network bitlayer
```

Use `--amount-raw` instead when you already know the exact uint64 bridge-decimal amount.

## Broadcast

Only add this flag after the dry run prints a successful `simulation`.

```bash
BROADCAST=true
```

The script prints:

- payload and message hash
- recovered signer address
- signer stake and submitter whitelist status
- token enabled state, bridge amount, nonce processed state
- callStatic result and estimated gas

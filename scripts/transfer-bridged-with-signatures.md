# 手工执行 `transferBridgedTokensWithSignatures` 操作文档

这个脚本用于在**不修改合约**的前提下，构造现有 Bridge 合约支持的 token transfer message，用 committee signer 私钥签名，然后由 submitter 地址发送 `transferBridgedTokensWithSignatures` 交易。

脚本默认只做 dry-run，不会广播交易。只有显式设置 `BROADCAST=true` 时才会发链上交易。

## 1. 合约前置条件

执行脚本前，需要先用 bridge admin 准备好链上权限和状态。

### 1.1 新增 signer

调用：

```solidity
BridgeCommittee.addCommitteeStake([signer], [stake])
```

要求：

- 调用者必须是 `BridgeConfig.admin()`
- `signer` 不能已经存在 committee stake
- 如果只用一个 signer 单签，`stake` 必须 `>= 6666`
- signer 不能在 `BridgeCommittee.blocklist` 里

### 1.2 新增 submitter

调用：

```solidity
BridgeCommittee.updateSubmitterlist([submitter], [true])
```

要求：

- 调用者必须是 `BridgeConfig.admin()`
- `transferBridgedTokensWithSignatures` 会经过 `MessageVerifier`
- `MessageVerifier` 会检查 `submitterlist[msg.sender]`
- 所以发送交易的钱包地址必须已经在 submitter 白名单里

### 1.3 确认 bridge 状态

需要确认：

- `sourceChainID` 已被 `BridgeConfig.isChainSupported(sourceChainID)` 支持
- `Bridge.getTokenInfo(sourceChainID, tokenID).state == true`
- `Bridge.getTokenInfo(sourceChainID, tokenID).bridgeAmount` 足够扣减
- `BridgeLimiter` 24 小时滚动限额足够
- 选择的 `nonce` 没有被处理过
- vault 里对应 token 余额足够

## 2. 私钥环境变量

不要把私钥写进命令、聊天或代码提交里。只在本地 shell 环境设置：

```bash
export BRIDGE_SIGNER_PRIVATE_KEY=...
export BRIDGE_SUBMITTER_PRIVATE_KEY=...
```

含义：

- `BRIDGE_SIGNER_PRIVATE_KEY`：committee signer 私钥，只用于对 bridge message 做 personal-sign
- `BRIDGE_SUBMITTER_PRIVATE_KEY`：submitter 私钥，用于 `callStatic`、`estimateGas` 和可选的正式广播

## 3. dry-run 执行

推荐先用 `AMOUNT_HUMAN`，脚本会读取 `BridgeConfig.tokenDecimalOf(tokenID)` 后自动换算成 payload 里的 uint64 金额。

示例：

```bash
BRIDGE_ADDRESS=0x3ecf2d23ca77510f63a44298223613e0e1ab44b0 \
SOURCE_CHAIN_ID=16 \
TRANSFER_NONCE=123456 \
TOKEN_ID=1 \
RECIPIENT_ADDRESS=0x0000000000000000000000000000000000000000 \
AMOUNT_HUMAN=99 \
npx hardhat run scripts/transfer-bridged-with-signatures.ts --network bitlayer
```

如果已经知道精确的 uint64 bridge-decimal 金额，可以改用：

```bash
AMOUNT_RAW=9900000000
```

`AMOUNT_RAW` 和 `AMOUNT_HUMAN` 二选一即可。

## 4. 可选参数

### 4.1 指定 target chain

默认情况下，脚本会读取：

```solidity
BridgeConfig.chainID()
```

作为 payload 里的 `targetChain`。

如果需要手动指定：

```bash
TARGET_CHAIN_ID=1
```

### 4.2 指定 source sender

payload 里的 source sender 是 32 字节。默认是全 0：

```text
0x0000000000000000000000000000000000000000000000000000000000000000
```

如果需要指定，可以传 20 字节 EVM 地址或 32 字节 hex：

```bash
SOURCE_SENDER=0x...
```

传 20 字节地址时，脚本会左侧补 0 到 32 字节。

## 5. dry-run 输出说明

脚本会打印：

- bridge 地址
- committee 地址
- config 地址
- submitter 地址和白名单状态
- signer 地址、恢复地址、stake、是否 blocklisted
- token 地址、是否 native、token decimal
- source-chain/token 是否启用
- 当前 `bridgeAmount`
- messageType/version/nonce/sourceChain/targetChain
- sourceSender/recipient/amount
- payload
- messageHash
- signature
- nonce 是否已处理
- `callStatic` 结果
- `estimateGas` 结果

如果 dry-run 失败，脚本会打印 revert 原因，常见情况：

```text
MessageVerifier: The caller is not the submitter
BridgeCommittee: Signer has no stake
BridgeCommittee: Insufficient stake amount
Bridge: Message already processed
Bridge: Target chain not supported
Bridge: Token is disabled
Bridge: Insufficient bridge amount
Bridge: Amount exceeds bridge limit
```

## 6. 正式广播

只有 dry-run 输出 `simulation ok` 后，再设置：

```bash
BROADCAST=true
```

完整示例：

```bash
BRIDGE_ADDRESS=0x3ecf2d23ca77510f63a44298223613e0e1ab44b0 \
SOURCE_CHAIN_ID=16 \
TRANSFER_NONCE=123456 \
TOKEN_ID=1 \
RECIPIENT_ADDRESS=0x0000000000000000000000000000000000000000 \
AMOUNT_HUMAN=99 \
BROADCAST=true \
npx hardhat run scripts/transfer-bridged-with-signatures.ts --network bitlayer
```

广播后脚本会打印：

- transaction hash
- receipt status
- block number

## 7. 金额口径

payload 里的 amount 是 `uint64`，使用的是 `BridgeConfig.tokenDecimalOf(tokenID)` 的 decimal，不一定等于 ERC20 合约本身的 decimals。

合约执行时会调用：

```solidity
BridgeUtils.convertDstToERC20Decimal(
  IERC20Metadata(tokenAddress).decimals(),
  config.tokenDecimalOf(tokenID),
  tokenTransferPayload.amount
)
```

所以：

- 用 `AMOUNT_HUMAN` 时，脚本按 `tokenDecimalOf` 自动换算
- 用 `AMOUNT_RAW` 时，需要自己保证已经是 bridge token decimal 口径
- amount 不能超过 `uint64.max`

## 8. nonce 选择

token transfer message 不要求 `message.nonce == nonces[0]`，但要求同一个 source chain 下不能重复。

合约逻辑：

- `message.chainID == 11` 时检查 `isTransferProcessed[nonce]`
- 其他 source chain 检查 `chainsIsTransferProcessed[message.chainID][nonce]`

建议使用一个明确不会和历史 bridge message 冲突的 nonce，并在 dry-run 输出中确认：

```text
processed: false
```

## 9. 安全检查清单

正式广播前确认：

- signer 地址和 dry-run 里 `recovered` 地址一致
- signer stake `>= 6666`
- submitter 白名单是 `true`
- recipient 是最终接收资金的钱包或多签
- tokenID、sourceChainID、targetChain 都正确
- amount 口径正确
- nonce 未使用
- bridgeAmount 足够
- rolling limit 足够
- vault 余额足够
- `callStatic` 成功
- `estimateGas` 成功

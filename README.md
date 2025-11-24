# Bridge EVM

A secure, upgradeable cross-chain token bridge built on Ethereum Virtual Machine (EVM) compatible chains. This bridge enables users to seamlessly transfer ERC20 tokens and native tokens across different blockchain networks with multi-signature committee verification, rate limiting, and comprehensive security features.

## Overview

Bridge EVM is a production-ready cross-chain bridge solution that facilitates token transfers between different blockchain networks. The bridge implements a modular architecture with separation of concerns for committee management, configuration, rate limiting, and asset custody.

## Features

### Core Functionality
- **Cross-Chain Token Transfer**: Support for ERC20 tokens and native tokens (via wrapped token mechanism)
- **Multi-Signature Verification**: Committee-based signature verification for secure bridge operations
- **Rate Limiting**: Built-in transfer limits to prevent abuse and ensure system stability
- **Fee Management**: Configurable fee percentages per token with fee accumulation tracking
- **Emergency Controls**: Pausable contract with emergency freeze/unfreeze capabilities

### Security Features
- **Upgradeable Contracts**: All core contracts use OpenZeppelin's UUPS proxy pattern for future upgrades
- **Reentrancy Protection**: All critical functions are protected against reentrancy attacks
- **Message Replay Prevention**: Nonce-based system prevents duplicate message processing
- **Committee Blocklist**: Support for blocking compromised committee members
- **Token State Management**: Per-chain, per-token enable/disable functionality

## Architecture

The bridge consists of five main contracts:

### 1. Bridge (`Bridge.sol`)
The main bridge contract that handles token deposits, withdrawals, and cross-chain message processing.

**Key Functions:**
- `bridgeERC20()`: Deposit ERC20 tokens for cross-chain transfer
- `bridgeNativeToken()`: Deposit native tokens (e.g., ETH) for cross-chain transfer
- `transferBridgedTokensWithSignatures()`: Claim tokens on destination chain using committee signatures

### 2. BridgeCommittee (`BridgeCommittee.sol`)
Manages committee members, their stakes, and signature verification logic.

**Key Features:**
- Committee member management with stake requirements
- Submit-only access control
- Blocklist functionality for compromised members
- Message signature verification

### 3. BridgeConfig (`BridgeConfig.sol`)
Centralized configuration management for supported tokens, chains, fees, and other parameters.

**Configuration Includes:**
- Supported token list with addresses and metadata
- Supported chain IDs
- Token fee percentages
- Minimum transfer amounts
- Chain and token decimal configurations

### 4. BridgeVault (`BridgeVault.sol`)
Secure vault contract for custody of bridged tokens.

**Features:**
- ERC20 token custody
- Native token wrapping/unwrapping support
- Owner-only transfer functions (intended for Bridge contract)

### 5. BridgeLimiter (`BridgeLimiter.sol`)
Implements rate limiting and transfer amount restrictions.

**Features:**
- Per-chain, per-token transfer limits
- Time-window based limiting (e.g., 24-hour limits)
- Transfer amount tracking

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Hardhat
- Access to an EVM-compatible blockchain (testnet or mainnet)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bitlayer-bridge-evm

# Install dependencies
npm install
```

### Configuration

1. Generate a `.env.enc` file in the root directory:

```env
# Set pw
npx env-enc set-pw

npx env-enc set
MAINNET_PRIVATE_KEY
<your-mainnet-private-key>

# Other environment variables as needed
```

2. Configure network settings in `hardhat.config.ts` for your target networks.

### Compilation

```bash
# Compile contracts
npx hardhat compile
```

### Deployment

The project includes comprehensive deployment scripts:

```bash
# Deploy all contracts
npx hardhat run scripts/cmd/deploy.ts

# Deploy specific contract
npx hardhat run scripts/cmd/contract/Bridge/deploy.ts

# Setup contracts after deployment
npx hardhat run scripts/cmd/setup.ts
```

### Testing

```bash
# Run all tests
npx hardhat test

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test
```

## Project Structure

```
bitlayer-bridge-evm/
├── contracts/           # Solidity smart contracts
│   ├── Bridge.sol       # Main bridge contract
│   ├── BridgeCommittee.sol # Committee management module
│   ├── BridgeConfig.sol # Config module
│   ├── BridgeLimiter.sol # Token limit module
│   ├── BridgeVault.sol # Vault for tokens
│   ├── interfaces/     # Contract interfaces
│   ├── token/          # Token contracts
│   └── utils/          # Utility contracts and libraries
├── scripts/            # Deployment and utility scripts
│   ├── cmd/           # Command scripts
│   │   ├── deploy.ts  # Deployment script
│   │   ├── upgrade.ts # Upgrade script
│   │   └── setup.ts   # Setup script
│   └── config/         # Configuration files
├── test/              # Test files
├── artifacts/         # Compiled contract artifacts
├── cache/             # Hardhat cache
└── typechain-types/   # TypeScript type definitions
```

## Development

### Key Dependencies

- **@openzeppelin/contracts**: ^5.0.1 - OpenZeppelin contract library
- **@openzeppelin/contracts-upgradeable**: ^5.0.1 - Upgradeable contracts
- **@openzeppelin/hardhat-upgrades**: ^3.0.1 - Hardhat upgrades plugin
- **hardhat**: ^2.22.19 - Ethereum development environment
- **@nomicfoundation/hardhat-toolbox**: ^5.0.0 - Hardhat toolbox

### Solidity Version

Contracts are written in Solidity ^0.8.20 with compiler optimizations enabled (200 runs).

### Network Configuration

The project is configured for:
- **Bitlayer Testnet**: Chain ID 200810
- **Bitlayer Mainnet**: Chain ID 200901
- **Hardhat Local Network**: For development and testing

## Security Considerations

1. **Committee Management**: Ensure committee members have secure key management
2. **Upgrade Authorization**: Upgrade functions should be carefully gated
3. **Rate Limits**: Configure appropriate limits based on vault liquidity
4. **Token State**: Regularly audit enabled/disabled token states per chain
5. **Fee Recipient**: Verify fee recipient addresses are correct

## Audit report

https://github.com/bitlayer-org/smart-contract-audits

## 📞 Contact

For questions or suggestions, please contact via GitHub Issues.

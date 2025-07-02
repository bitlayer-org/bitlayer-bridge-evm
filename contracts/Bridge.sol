// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./utils/CommitteeUpgradeable.sol";
import "./interfaces/IBridge.sol";
import "./interfaces/IBridgeVault.sol";
import "./interfaces/IBridgeLimiter.sol";
import "./interfaces/IBridgeConfig.sol";
import "./interfaces/IWBTC9.sol";

/// @title Bridge
/// @notice This contract implements a token bridge that enables users to deposit and withdraw
/// supported tokens to and from other chains. The bridge supports the transfer of Ethereum and ERC20
/// tokens. The bridge is designed to be upgradeable and can be paused in case of an emergency. 
/// The bridge also enforces limits on the amount of
/// assets that can be withdrawn to prevent abuse.
contract Bridge is IBridge, CommitteeUpgradeable, PausableUpgradeable {
    /* ========== STATE VARIABLES ========== */

    mapping(uint64 nonce => bool isProcessed) public isTransferProcessed;
    IBridgeVault public vault;
    IBridgeLimiter public limiter;

    uint8 constant MOVE_ADDRESS_LENGTH = 32;

    mapping(uint8 tokenID => uint256 accumulatedFee) public accumulatedFees;

    mapping(uint64 chainID =>mapping(uint64 nonce => bool isProcessed)) public chainsIsTransferProcessed;
    
    IWBTC9 public wbtc9;

    struct TokenInfo {
        uint256 bridgeAmount;
        bool state;
    }

    struct ChainInfo {
        mapping(uint8 => TokenInfo) tokens;
    }
    
    // allowed to/from(other) chains
    mapping(uint8 => ChainInfo) private chains;

    /* ========== INITIALIZER ========== */

    /// @notice Initializes the Bridge contract with the provided parameters.
    /// @dev this function should be called directly after deployment (see OpenZeppelin upgradeable standards).
    /// @param _committee The address of the committee contract.
    /// @param _vault The address of the bridge vault contract.
    /// @param _limiter The address of the bridge limiter contract.
    function initialize(address _committee, address _vault, address _limiter)
        external
        initializer
    {
        __CommitteeUpgradeable_init(_committee);
        __Pausable_init();
        vault = IBridgeVault(_vault);
        limiter = IBridgeLimiter(_limiter);
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    /// @notice Allows the caller to provide signatures that enable the transfer of tokens to
    /// the recipient address indicated within the message payload.
    /// @dev `message.chainID` represents the sending chain ID. Receiving chain ID needs to match
    /// this bridge's chain ID (this chain).
    /// @param signatures The array of signatures.
    /// @param message The BridgeUtils containing the transfer details.
    function transferBridgedTokensWithSignatures(
        bytes[] memory signatures,
        BridgeUtils.Message memory message // message.chainId is from chain id
    )
        external
        nonReentrant
        verifyMessageAndSignatures(message, signatures, BridgeUtils.TOKEN_TRANSFER)
        onlySupportedChain(message.chainID)
    {
        // verify that message has not been processed
        if (message.chainID == 11) {
            require(!isTransferProcessed[message.nonce], "Bridge: Message already processed");
            isTransferProcessed[message.nonce] = true;
        } else {
            require(!chainsIsTransferProcessed[message.chainID][message.nonce], "Bridge: Message already processed");
            chainsIsTransferProcessed[message.chainID][message.nonce] = true;
        }

        IBridgeConfig config = committee.config();

        BridgeUtils.TokenTransferPayload memory tokenTransferPayload =
            BridgeUtils.decodeTokenTransferPayload(message.payload);

        // verify target chain ID is this chain ID
        require(
            tokenTransferPayload.targetChain == config.chainID(), "Bridge: Invalid target chain"
        );

        address tokenAddress = config.tokenAddressOf(tokenTransferPayload.tokenID);
        if (config.tokenIsNative(tokenTransferPayload.tokenID)) {
            tokenAddress = address(wbtc9);
        }

        // convert amount to ERC20 token decimals
        uint256 erc20AdjustedAmount = BridgeUtils.convertDstToERC20Decimal(
            IERC20Metadata(tokenAddress).decimals(),
            config.tokenDecimalOf(tokenTransferPayload.tokenID),
            tokenTransferPayload.amount
        );

        require(chains[message.chainID].tokens[tokenTransferPayload.tokenID].state, "Bridge: Token is disabled");

        // update bridge amount
        updateChainTokenBridgeAmount(message.chainID, tokenTransferPayload.tokenID, erc20AdjustedAmount, false);

        _transferTokensFromVault(
            message.chainID,
            tokenTransferPayload.tokenID,
            tokenTransferPayload.recipientAddress,
            erc20AdjustedAmount
        );

        emit TokensClaimed(
            message.chainID,
            message.nonce,
            config.chainID(),
            tokenTransferPayload.tokenID,
            erc20AdjustedAmount,
            tokenTransferPayload.senderAddress,
            tokenTransferPayload.recipientAddress
        );
    }

    /// @notice Executes an emergency operation with the provided signatures and message.
    /// @dev If the given operation is to freeze and the bridge is already frozen, the operation
    /// will revert.
    /// @param signatures The array of signatures to verify.
    /// @param message The BridgeUtils containing the details of the operation.
    function executeEmergencyOpWithSignatures(
        bytes[] memory signatures,
        BridgeUtils.Message memory message
    )
        external
        nonReentrant
        verifyMessageAndSignatures(message, signatures, BridgeUtils.EMERGENCY_OP)
    {
        // decode the emergency op message
        bool isFreezing = BridgeUtils.decodeEmergencyOpPayload(message.payload);

        if (isFreezing) _pause();
        else _unpause();
        // pausing event emitted in 'PausableUpgradeable.sol'
    }

    /// @notice Enables the caller to deposit supported tokens to be bridged to a given
    /// destination chain.
    /// @dev The provided tokenID and destinationChainID must be supported. The caller must
    /// have approved this contract to transfer the given token.
    /// @param tokenID The ID of the token to be bridged.
    /// @param amount The amount of tokens to be bridged.
    /// @param recipientAddress The address on the destination chain where the tokens will be sent.
    /// @param destinationChainID The ID of the destination chain.
    function bridgeERC20(
        uint8 tokenID,
        uint256 amount,
        bytes memory recipientAddress,
        uint8 destinationChainID
    ) external whenNotPaused nonReentrant onlySupportedChain(destinationChainID) {
        // require(
        //     recipientAddress.length == MOVE_ADDRESS_LENGTH,
        //     "Bridge: Invalid recipient address length"
        // );
        require(chains[destinationChainID].tokens[tokenID].state, "Bridge: Token is disabled");

        IBridgeConfig config = committee.config();

        require(config.isTokenSupported(tokenID), "Bridge: Unsupported token");

        uint256 _tokenMinAmount = config.tokenMinAmount(tokenID);
        require(
            amount >= _tokenMinAmount,
            "Bridge: The amount must be greater than the minimum amount"
        );

        address tokenAddress = config.tokenAddressOf(tokenID);

        // check that the bridge contract has allowance to transfer the tokens
        require(
            IERC20(tokenAddress).allowance(msg.sender, address(this)) >= amount,
            "Bridge: Insufficient allowance"
        );

        // calculate old vault balance
        uint256 oldBalance = IERC20(tokenAddress).balanceOf(address(vault));

        uint256 fee = (amount * config.tokenFeePercentages(tokenID)) / 1000000;
        uint256 netAmount = amount - fee;

        // Add the fee to accumulated fees
        accumulatedFees[tokenID] += fee;

        SafeERC20.safeTransferFrom(IERC20(tokenAddress), msg.sender, config.feeRecipient(), fee);

        // Transfer the tokens from the contract to the vault
        SafeERC20.safeTransferFrom(IERC20(tokenAddress), msg.sender, address(vault), netAmount);

        // calculate new vault balance
        uint256 newBalance = IERC20(tokenAddress).balanceOf(address(vault));

        // calculate the amount transferred
        uint256 amountTransfered = newBalance - oldBalance;

        uint8 tokenID_ = tokenID;
        updateChainTokenBridgeAmount(destinationChainID, tokenID_, amountTransfered, true);
        // Adjust the amount
        uint64 dstAdjustedAmount = BridgeUtils.convertERC20ToDstDecimal(
            IERC20Metadata(tokenAddress).decimals(),
            config.tokenDecimalOf(tokenID_),
            amountTransfered
        );

        uint256 amount_ = amount;
        // Adjust the amount
        uint64 originAmount = BridgeUtils.convertERC20ToDstDecimal(
            IERC20Metadata(tokenAddress).decimals(),
            config.tokenDecimalOf(tokenID_),
            amount_
        );

        bytes memory recipientAddress_ = recipientAddress;

        emit TokensDeposited(
            config.chainID(),
            nonces[BridgeUtils.TOKEN_TRANSFER],
            destinationChainID,
            tokenID_,
            dstAdjustedAmount,
            originAmount,
            msg.sender,
            recipientAddress_
        );
        // increment token transfer nonce
        nonces[BridgeUtils.TOKEN_TRANSFER]++;
    }

    /// @notice Enables the caller to deposit supported tokens to be bridged to a given
    /// destination chain.
    /// @dev The provided tokenID and destinationChainID must be supported. The caller must
    /// have approved this contract to transfer the given token.
    /// @param tokenID The ID of the token to be bridged.
    /// @param recipientAddress The address on the destination chain where the tokens will be sent.
    /// @param destinationChainID The ID of the destination chain.
    function bridgeNativeToken(
        uint8 tokenID,
        bytes memory recipientAddress,
        uint8 destinationChainID
    ) external payable whenNotPaused nonReentrant onlySupportedChain(destinationChainID) onlyIsNativeToken(tokenID) {
        
        uint256 amount = msg.value;

        require(chains[destinationChainID].tokens[tokenID].state, "Bridge: Token is disabled");

        IBridgeConfig config = committee.config();

        require(config.isTokenSupported(tokenID), "Bridge: Unsupported token");

        uint256 _tokenMinAmount = config.tokenMinAmount(tokenID);
        require(
            amount >= _tokenMinAmount,
            "Bridge: The amount must be greater than the minimum amount"
        );

        // address tokenAddress = config.tokenAddressOf(tokenID);

        // calculate old vault balance
        uint256 oldBalance = wbtc9.balanceOf(address(vault));

        uint256 fee = (amount * config.tokenFeePercentages(tokenID)) / 1000000;

        uint256 netAmount = amount - fee;

        // Add the fee to accumulated fees
        accumulatedFees[tokenID] += fee;

        // Wrap Native Token
        wbtc9.deposit{value: netAmount}();

        (bool success, ) = config.feeRecipient().call{value: fee}("");
        require(success, "Bridge: BridgeNativeToken Fees Transfer failed");


        // Transfer the wrapped ETH back to caller
        SafeERC20.safeTransfer(wbtc9, address(vault), netAmount);

        // calculate new vault balance
        uint256 newBalance = wbtc9.balanceOf(address(vault));

        // calculate the amount transferred
        uint256 amountTransfered = newBalance - oldBalance;

        uint8 tokenID_ = tokenID;
        updateChainTokenBridgeAmount(destinationChainID, tokenID_, amountTransfered, true);
        // Adjust the amount
        address tokenAddress = address(wbtc9);
        uint64 dstAdjustedAmount = BridgeUtils.convertERC20ToDstDecimal(
            IERC20Metadata(tokenAddress).decimals(),
            config.tokenDecimalOf(tokenID_),
            amountTransfered
        );

        uint256 amount_ = amount;
        // Adjust the amount
        uint64 originAmount = BridgeUtils.convertERC20ToDstDecimal(
            IERC20Metadata(tokenAddress).decimals(),
            config.tokenDecimalOf(tokenID_),
            amount_
        );

        bytes memory recipientAddress_ = recipientAddress;

        emit TokensDeposited(
            config.chainID(),
            nonces[BridgeUtils.TOKEN_TRANSFER],
            destinationChainID,
            tokenID_,
            dstAdjustedAmount,
            originAmount,
            msg.sender,
            recipientAddress_
        );
        // increment token transfer nonce
        nonces[BridgeUtils.TOKEN_TRANSFER]++;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /// @dev Transfers tokens from the vault to a target address.
    /// @param sendingChainID The ID of the chain from which the tokens are being transferred.
    /// @param tokenID The ID of the token being transferred.
    /// @param recipientAddress The address to which the tokens are being transferred.
    /// @param amount The amount of tokens being transferred.
    function _transferTokensFromVault(
        uint8 sendingChainID,
        uint8 tokenID,
        address recipientAddress,
        uint256 amount
    ) private whenNotPaused limitNotExceeded(sendingChainID, tokenID, amount) {
        bool isNative = committee.config().tokenIsNative(tokenID);
        // is native token?
        if (isNative) {
            vault.transferERC20(address(wbtc9), address(this), amount);
            wbtc9.withdraw(amount);
            (bool success,) = recipientAddress.call{value: amount}("");
            require(success, "Bridge: NativeToken transfer failed");

        }else {
            address tokenAddress = committee.config().tokenAddressOf(tokenID);

            // Check that the token address is supported
            require(tokenAddress != address(0), "Bridge: Unsupported token");
            
            vault.transferERC20(tokenAddress, recipientAddress, amount);
        }

        // // transfer eth if token type is eth
        // if (tokenID == BridgeUtils.BTC) {
        //     vault.transferBTC(payable(recipientAddress), amount);
        // } else {
        //     // transfer tokens from vault to target address
        //     vault.transferERC20(tokenAddress, recipientAddress, amount);
        // }


        // update amount bridged
        limiter.recordBridgeTransfers(sendingChainID, tokenID, amount);
    }

    function updateChainTokenBridgeAmount(uint8 _chainID, uint8 _tokenID, uint256 _amount, bool _isBridge) private {
        TokenInfo storage tokenInfo = chains[_chainID].tokens[_tokenID];
        if (_isBridge) {
            tokenInfo.bridgeAmount += _amount;
        } else {
            require(tokenInfo.bridgeAmount >= _amount, "Bridge: Insufficient bridge amount");
            tokenInfo.bridgeAmount -= _amount;
        }
    }
    
    // Add/Edit Tokens
    /// @dev Add or edit tokeninfo.
    /// @param _chainIDs The ID of the chains.
    /// @param _tokenIDs The ID of the tokens.
    /// @param bridgeAmounts The cross-out number of bridges.
    /// @param states token enabled states.
    function addTokens(uint8[] memory _chainIDs, uint8[] memory _tokenIDs, uint256[] memory bridgeAmounts, bool[] memory states) external onlyAdmin {
        uint256 len = _tokenIDs.length;
        require(_chainIDs.length == len, "Bridge: addTokens: Lengths of chainIDs and tokenIDs must be equal");
        require(bridgeAmounts.length == len, "Bridge: addTokens: Lengths of bridgeAmounts and tokenIDs must be equal");
        require(states.length == len, "Bridge: addTokens: Lengths of states and tokenIDs must be equal");
        for (uint8 i; i < _chainIDs.length; i++) {
          _addToken(_chainIDs[i], _tokenIDs[i], bridgeAmounts[i], states[i]);
        }
    }

    // Add/Edit Token
    /// @dev Add or edit tokeninfo.
    /// @param _chainID The ID of the chain.
    /// @param _tokenID The ID of the token.
    /// @param bridgeAmount The cross-out number of bridges.
    /// @param state token enabled state.
    function addToken(uint8 _chainID, uint8 _tokenID, uint256 bridgeAmount, bool state) external onlyAdmin {
        _addToken(_chainID, _tokenID, bridgeAmount, state);
    }

    // Add/Edit Token by private
    /// @dev Add or edit tokeninfo.
    /// @param _chainID The ID of the chain.
    /// @param _tokenID The ID of the token.
    /// @param bridgeAmount The cross-out number of bridges.
    /// @param state token enabled state.
    function _addToken(uint8 _chainID, uint8 _tokenID, uint256 bridgeAmount, bool state) private {
        chains[_chainID].tokens[_tokenID] = TokenInfo(bridgeAmount, state);
        emit TokenChanged(_chainID, _tokenID, bridgeAmount, state);
    }

    
    // Add/Edit Token
    /// @dev Add or edit tokeninfo.
    /// @param _chainID The ID of the chain.
    /// @param _tokenID The ID of the token.
    /// @param newState token enabled state.
    function updateTokenState(uint8 _chainID, uint8 _tokenID, bool newState) external onlyAdmin {
        TokenInfo storage tokenInfo = chains[_chainID].tokens[_tokenID];
        tokenInfo.state = newState;
        emit TokenChanged(_chainID, _tokenID, tokenInfo.bridgeAmount, newState);
    }

    // get TokenInfo
    /// @dev get tokeninfo.
    /// @param _chainID The ID of the chain.
    /// @param _tokenID The ID of the token.
    function getTokenInfo(uint8 _chainID, uint8 _tokenID) external view returns (TokenInfo memory) {
        return chains[_chainID].tokens[_tokenID];
    }
    

    // set wbtc9
    /// @dev set wbtc9.
    /// @param _wbtc9 The wbtc9 address.
    function setWBTC9(address _wbtc9) external onlyAdmin {
        wbtc9 = IWBTC9(_wbtc9);
    }
    

    /* ========== MODIFIERS ========== */

    /// @dev Requires the amount being transferred does not exceed the bridge limit in
    /// the last 24 hours.
    /// @param amount The amount of tokens being transferred.
    modifier limitNotExceeded(uint8 chainID, uint8 tokenID, uint256 amount) {
        require(
            !limiter.willAmountExceedLimit(chainID, tokenID, amount),
            "Bridge: Amount exceeds bridge limit"
        );
        _;
    }

    /// @dev Requires the target chain ID is supported.
    /// @param targetChainID The ID of the target chain.
    modifier onlySupportedChain(uint8 targetChainID) {
        require(
            committee.config().isChainSupported(targetChainID),
            "Bridge: Target chain not supported"
        );
        _;
    }
    /// @dev Requires the token ID is native.
    /// @param tokenID The ID of the token.
    modifier onlyIsNativeToken(uint8 tokenID) {
        require(
            committee.config().tokenIsNative(tokenID),
            "Bridge: token is not native"
        );
        _;
    }

    // Modifier to restrict functions to only the admin
    modifier onlyAdmin() {
        require(msg.sender == committee.config().admin(), "Bridge: Only admin can perform this action");
        _;
    }

    modifier tokenNoDisabled(uint8 _chainID, uint8 _tokenID) {
        require(chains[_chainID].tokens[_tokenID].state, "Bridge: Token is disabled");
        _;
    }

    /// @notice receive eth sent to this contract.
    receive() external payable {
    }
}

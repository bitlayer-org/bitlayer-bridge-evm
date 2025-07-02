// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./utils/CommitteeUpgradeable.sol";
import "./interfaces/IBridgeConfig.sol";

/// @title BridgeConfig
/// @notice This contract manages a registry of supported tokens and supported chain IDs for the Bridge.
/// It also provides functions to convert token amounts to destination chain token decimal adjusted amounts and vice versa.
contract BridgeConfig is IBridgeConfig, CommitteeUpgradeable {
    /* ========== STATE VARIABLES ========== */

    uint8 public chainID;
    mapping(uint8 tokenID => Token) public supportedTokens;
    // price in USD (8 decimal precision) (e.g. 1 BTC = 2000 USD => 2000_00000000)
    mapping(uint8 tokenID => uint64 tokenPrice) public tokenPrices;
    mapping(uint8 chainId => bool isSupported) public supportedChains;
    mapping(uint8 tokenID => uint64 tokenFeePercentage) public tokenFeePercentages;
    mapping(uint8 tokenID => uint256 minAmount) public tokenMinAmount;

    address public admin;
    address public feeRecipient;

    /// @notice Constructor function for the BridgeConfig contract.
    /// @dev the provided arrays must have the same length.
    /// @param _committee The address of the BridgeCommittee contract.
    /// @param _chainID The ID of the chain this contract is deployed on.
    function initialize(
        address _committee,
        uint8 _chainID,
        address _admin,
        address _feeRecipient,
        InitializerConfigs calldata _initializerConfigs
    ) external initializer {
        __CommitteeUpgradeable_init(_committee);
        require(
            _initializerConfigs._supportedTokenAddrs.length == _initializerConfigs._supportedTokenIDs.length, "BridgeConfig: Invalid support token id"
        );
        require(
            _initializerConfigs._supportedTokenAddrs.length == _initializerConfigs._supportedTokenDecimals.length, "BridgeConfig: Invalid support token decimals"
        );
        require(
            _initializerConfigs._supportedTokenAddrs.length == _initializerConfigs._tokenFeePercentages.length, "BridgeConfig: Invalid token fee percentage"
        );
        require(
            _initializerConfigs._supportedTokenAddrs.length == _initializerConfigs._tokenMinAmounts.length, "BridgeConfig: Invalid token minimum amount"
        );

        require(_admin != address(0), "BridgeConfig: Invalid admin address");
        require(_feeRecipient != address(0), "BridgeConfig: Invalid fee recipient address");
        admin = _admin;
        feeRecipient = _feeRecipient;

        for (uint8 i; i < _initializerConfigs._supportedTokenAddrs.length; i++) {
          _addToken(_initializerConfigs._supportedTokenIDs[i], _initializerConfigs._supportedTokenAddrs[i], _initializerConfigs._supportedTokenDecimals[i], 0, false);
          _setFeePercentage(_initializerConfigs._supportedTokenIDs[i], _initializerConfigs._tokenFeePercentages[i]);
          _setTokenMinAmount(_initializerConfigs._supportedTokenIDs[i], _initializerConfigs._tokenMinAmounts[i]);
        }

        chainID = _chainID;
        emit ChainIDUpdated(_chainID);

        for (uint8 i; i < _initializerConfigs._supportedChains.length; i++) {
            _updateChainID(_initializerConfigs._supportedChains[i], true);
        }

    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice Returns the address of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return address of the provided token.
    function tokenAddressOf(uint8 tokenID) public view override returns (address) {
        return supportedTokens[tokenID].tokenAddress;
    }

    /// @notice Returns the isNative of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return isNative of the token.
    function tokenIsNative(uint8 tokenID) external override view returns (bool) {
        return supportedTokens[tokenID].native;
    }

    /// @notice Returns the token decimal places of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return amount of token decimal places of the provided token.
    function tokenDecimalOf(uint8 tokenID) public view override returns (uint8) {
        return supportedTokens[tokenID].decimal;
    }

    /// @notice Returns the price of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return price of the provided token.
    function tokenPriceOf(uint8 tokenID) public view override returns (uint64) {
        return tokenPrices[tokenID];
    }

    /// @notice Returns whether a token is supported in Bridge with the given ID.
    /// @param tokenID The ID of the token.
    /// @return true if the token is supported, false otherwise.
    function isTokenSupported(uint8 tokenID) public view override returns (bool) {
        return supportedTokens[tokenID].tokenAddress != address(0);
    }

    /// @notice Returns whether a chain is supported in Bridge with the given ID.
    /// @param chainId The ID of the chain.
    /// @return true if the chain is supported, false otherwise.
    function isChainSupported(uint8 chainId) public view override returns (bool) {
        return supportedChains[chainId];
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /// @notice Updates the token price with the provided message if the provided signatures are valid.
    /// @param signatures array of signatures to validate the message.
    /// @param message BridgeMessage containing the update token price payload.
    function updateTokenPriceWithSignatures(
        bytes[] memory signatures,
        BridgeUtils.Message memory message
    )
        external
        nonReentrant
        verifyMessageAndSignatures(message, signatures, BridgeUtils.UPDATE_TOKEN_PRICE)
    {
        // decode the update token payload
        (uint8 tokenID, uint64 price) = BridgeUtils.decodeUpdateTokenPricePayload(message.payload);

        _updateTokenPrice(tokenID, price);
    }

    function addTokensWithSignatures(bytes[] memory signatures, BridgeUtils.Message memory message)
        external
        nonReentrant
        verifyMessageAndSignatures(message, signatures, BridgeUtils.ADD_EVM_TOKENS)
    {
        // decode the update token payload
        (
            bool native,
            uint8[] memory tokenIDs,
            address[] memory tokenAddresses,
            uint8[] memory decimals,
            uint64[] memory _tokenPrices
        ) = BridgeUtils.decodeAddTokensPayload(message.payload);

        // update the token
        for (uint8 i; i < tokenIDs.length; i++) {
            _addToken(tokenIDs[i], tokenAddresses[i], decimals[i], _tokenPrices[i], native);
        }
    }

    /// @dev Function to set the supported chain ID., can only be called by the admin.
    /// @param _chainID The changed chainID.
    /// @param _isSupported Support status of chainID.
    function updateChainID(uint8 _chainID, bool _isSupported) external onlyAdmin {
        _updateChainID(_chainID, _isSupported);
    }

    /// @dev Function to set the supported chain ID., can only be called by the private.
    /// @param _chainID The changed chainID.
    /// @param _isSupported Support status of chainID.
    function _updateChainID(uint8 _chainID, bool _isSupported) private {
        require(_chainID != chainID, "BridgeConfig: Cannot support self");
        supportedChains[_chainID] = _isSupported;
        emit SupportedChainIDUpdated(_chainID, _isSupported);
    }

    /// @dev Function to set the fee percentage, can only be called by the admin.
    /// @param feePercentage The new fee percentage (with a denominator of 1000000).
    function setFeePercentage(uint8 tokenID, uint64 feePercentage) external onlyAdmin {
        _setFeePercentage(tokenID, feePercentage);
    }

    /// @dev Function to set the fee percentage, can only be called by the private.
    /// @param feePercentage The new fee percentage (with a denominator of 1000000).
    function _setFeePercentage(uint8 tokenID, uint64 feePercentage) private {
        require(feePercentage < 1000000, "BridgeConfig: Invalid fee percentage");
        tokenFeePercentages[tokenID] = feePercentage;
        emit TokenFeeUpdated(tokenID, feePercentage);
    }

    /// @dev Function to set the minimum amount, can only be called by the admin.
    /// @param minAmount The new minimum amount.
    function setTokenMinAmount(uint8 tokenID, uint256 minAmount) external onlyAdmin {
        _setTokenMinAmount(tokenID, minAmount);
    }

    /// @dev Function to set the minimum amount, can only be called by the private.
    /// @param minAmount The new minimum amount.
    function _setTokenMinAmount(uint8 tokenID, uint256 minAmount) private {
        tokenMinAmount[tokenID] = minAmount;
        emit TokenMinAmountUpdated(tokenID, minAmount);
    }

    /// @dev Function to set the fee recipient address, can only be called by the admin.
    /// @param _feeRecipient The new fee recipient address.
    function setFeeRecipient(address _feeRecipient) external onlyAdmin {
        require(_feeRecipient != address(0), "BridgeConfig: Invalid fee recipient address");
        feeRecipient = _feeRecipient;
        emit TokenFeeRecipientUpdated(_feeRecipient);
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /// @notice Updates the price of the token with the provided ID.
    /// @param tokenID The ID of the token to update.
    /// @param tokenPrice The price of the token.
    function _updateTokenPrice(uint8 tokenID, uint64 tokenPrice) private {
        require(isTokenSupported(tokenID), "BridgeConfig: Unsupported token");
        require(tokenPrice > 0, "BridgeConfig: Invalid token price");

        tokenPrices[tokenID] = tokenPrice;

        emit TokenPriceUpdated(tokenID, tokenPrice);
    }

    /// @notice Updates the token with the provided ID.
    /// @param tokenID The ID of the token to update.
    /// @param tokenAddress The address of the token.
    /// @param dstDecimal The decimal places of the token.
    /// @param tokenPrice The price of the token.
    /// @param native Whether the token is native to the chain.
    function _addToken(
        uint8 tokenID,
        address tokenAddress,
        uint8 dstDecimal,
        uint64 tokenPrice,
        bool native
    ) private {
        require(tokenAddress != address(0), "BridgeConfig: Invalid token address");
        require(dstDecimal > 0, "BridgeConfig: Invalid destination chain token decimal");

        supportedTokens[tokenID] = Token(tokenAddress, dstDecimal, native);
        tokenPrices[tokenID] = tokenPrice;

        emit TokenAdded(tokenID, tokenAddress, dstDecimal, tokenPrice);
    }

    /* ========== MODIFIERS ========== */

    /// @notice Requires the given token to be supported.
    /// @param tokenID The ID of the token to check.
    modifier tokenSupported(uint8 tokenID) {
        require(isTokenSupported(tokenID), "BridgeConfig: Unsupported token");
        _;
    }

    // Modifier to restrict functions to only the admin
    modifier onlyAdmin() {
        require(msg.sender == admin, "BridgeConfig: Only admin can perform this action");
        _;
    }
}

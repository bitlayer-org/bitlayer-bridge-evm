// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IBridgeConfig
/// @dev Interface for the BridgeConfig contract.
interface IBridgeConfig {
    /* ========== STRUCTS ========== */

    /// @notice The data struct for the supported bridge tokens.
    struct Token {
        address tokenAddress;
        uint8 decimal;
        bool native;
    }

    /// @notice The data struct for the bridge config initializer.
    struct InitializerConfigs {
        uint8[] _supportedChains;
        uint8[] _supportedTokenIDs;
        uint8[] _supportedTokenDecimals;
        uint64[] _tokenFeePercentages;
        address[] _supportedTokenAddrs;
        uint256[] _tokenMinAmounts;
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice Returns the address of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return address of the provided token.
    function tokenAddressOf(uint8 tokenID) external view returns (address);

    /// @notice Returns the isNative of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return isNative of the token.
    function tokenIsNative(uint8 tokenID) external view returns (bool);

    /// @notice Returns the token decimal places of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return amount of token decimal places of the provided token.
    function tokenDecimalOf(uint8 tokenID) external view returns (uint8);

    /// @notice Returns the price of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return price of the provided token.
    function tokenPriceOf(uint8 tokenID) external view returns (uint64);

    /// @notice Returns the supported status of the token with the given ID.
    /// @param tokenID The ID of the token.
    /// @return true if the token is supported, false otherwise.
    function isTokenSupported(uint8 tokenID) external view returns (bool);

    /// @notice Returns whether a chain is supported in Bridge with the given ID.
    /// @param chainId The ID of the chain.
    /// @return true if the chain is supported, false otherwise.
    function isChainSupported(uint8 chainId) external view returns (bool);

    /// @notice Returns the chain ID of the bridge.
    function chainID() external view returns (uint8);

    /// @notice Returns the admin of the bridge.
    function admin() external view returns (address);

    /// @notice Returns the feeRecipient of the bridge.
    function feeRecipient() external view returns (address);

    /// @notice Returns the fee percentage of the token.
    function tokenFeePercentages(uint8 tokenID) external view returns (uint64);

     /// @notice Returns the minimum amount of the token.
    function tokenMinAmount(uint8 tokenID) external view returns (uint256);

    event TokenAdded(uint8 tokenID, address tokenAddress, uint8 decimal, uint64 tokenPrice);
    event TokenPriceUpdated(uint8 tokenID, uint64 tokenPrice);
    event TokenFeeUpdated(uint8 tokenID, uint64 feePercentage);
    event TokenMinAmountUpdated(uint8 tokenID, uint256 minAmount);
    event TokenFeeRecipientUpdated(address feeRecipient);
    event ChainIDUpdated(uint8 chainID);
    event SupportedChainIDUpdated(uint8 chainID, bool isSupported);
}

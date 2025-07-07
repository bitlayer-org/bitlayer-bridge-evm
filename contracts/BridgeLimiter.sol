// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./interfaces/IBridgeLimiter.sol";
import "./interfaces/IBridgeConfig.sol";
import "./utils/CommitteeUpgradeable.sol";

/// @title BridgeLimiter
/// @notice A contract that limits the amount of tokens that can be bridged from a given chain within
/// a rolling 24-hour window. This is accomplished by storing the amount bridged from a given chain in USD
/// within a given hourly timestamp. It also provides functions to update the token prices and the total
/// limit of the given chainID measured in USD with 8 decimal precision.
/// The contract is intended to be used and owned by the Bridge contract.
contract BridgeLimiter is IBridgeLimiter, CommitteeUpgradeable, OwnableUpgradeable {
    /* ========== STATE VARIABLES ========== */

    mapping(uint256 chainTokenHourTimestamp => uint256 totalAmountBridged) public chainTokenHourlyTransferAmount;
    // total limit in USD (8 decimal precision) for each chain and token
    mapping(uint16 chainTokenID => uint256 totalLimit) public chainTokenLimits;
    mapping(uint16 chainTokenID => uint32 oldestHourTimestamp) public oldestChainTokenTimestamp;

    /* ========== INITIALIZER ========== */

    /// @notice Initializes the BridgeLimiter contract with the provided parameters.
    /// @dev this function should be called directly after deployment (see OpenZeppelin upgradeable
    /// standards).
    /// @param _committee The address of the BridgeCommittee contract.
    /// @param chainIDs An array of chain IDs to limit.
    /// @param tokenIDs An array of token IDs to limit.
    /// @param _totalLimits The total limit for the bridge (8 decimal precision).
    function initialize(address _committee, uint8[] memory chainIDs, uint8[] memory tokenIDs, uint256[] memory _totalLimits)
        external
        initializer
    {
        require(
            chainIDs.length == _totalLimits.length && tokenIDs.length == _totalLimits.length,
            "BridgeLimiter: invalid input lengths"
        );
        __CommitteeUpgradeable_init(_committee);
        __Ownable_init(msg.sender);

        for (uint256 i; i < chainIDs.length; i++) {
            require(
                committee.config().isChainSupported(chainIDs[i]),
                "BridgeLimiter: Chain not supported"
            );
            require(
                committee.config().isTokenSupported(tokenIDs[i]),
                "BridgeLimiter: Token not supported"
            );

            uint16 chainTokenID = (uint16(chainIDs[i]) << 8) | uint16(tokenIDs[i]);
            chainTokenLimits[chainTokenID] = _totalLimits[i];
            oldestChainTokenTimestamp[chainTokenID] = currentHour();
        }
    }

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice Returns whether the total amount, including the given token amount, will exceed the totalLimit.
    /// @param chainID The ID of the chain to check limit for.
    /// @param tokenID The ID of the token to check limit for.
    /// @param amount The amount of the token.
    /// @return boolean indicating whether the total amount will exceed the limit.
    function willAmountExceedLimit(uint8 chainID, uint8 tokenID, uint256 amount) public view returns (bool) {
        uint256 windowAmount = calculateWindowAmount(chainID, tokenID);
        uint16 chainTokenID = (uint16(chainID) << 8) | uint16(tokenID);
        return windowAmount + amount > chainTokenLimits[chainTokenID];
    }

    /// @dev Calculates the total transfer amount within the rolling 24-hour window for a specific chain and token.
    /// @param chainID The ID of the chain.
    /// @param tokenID The ID of the token.
    /// @return total transfer amount within the window.
    function calculateWindowAmount(uint8 chainID, uint8 tokenID) public view returns (uint256 total) {
        uint32 _currentHour = currentHour();
        // aggregate the last 24 hours
        for (uint32 i; i < 24; i++) {
            uint256 key = getChainTokenHourTimestampKey(chainID, tokenID, _currentHour - i);
            total += chainTokenHourlyTransferAmount[key];
        }
        return total;
    }

    /// @dev Clean up the dirty data window and keep the data of the last 24 hours.
    /// @param keys The ChainTokenHourTimestampKeys.
    function cleanWindowAmount(uint256[] memory keys) public onlyOwner {
        uint32 oneDay = currentHour()-24;
        for (uint32 i; i < keys.length; i++) {
            uint256 key = keys[i];
            if (uint32(key) < oneDay && chainTokenHourlyTransferAmount[key] > 0){
                delete chainTokenHourlyTransferAmount[key];
            }
        }
    }

    /// @notice Returns the current hour timestamp.
    /// @return current hour timestamp.
    function currentHour() public view returns (uint32) {
        return uint32(block.timestamp / 1 hours);
    }

    /// @notice Returns the key for the chain, token, and hour timestamp.
    /// @param chainID The ID of the chain.
    /// @param tokenID The ID of the token.
    /// @param hourTimestamp The hour timestamp.
    /// @return The key for the chain, token, and hour timestamp.
    function getChainTokenHourTimestampKey(uint8 chainID, uint8 tokenID, uint32 hourTimestamp)
        public
        pure
        returns (uint256)
    {
        return (uint256(chainID) << 40) | (uint256(tokenID) << 32) | uint256(hourTimestamp);
    }

    /* ========== EXTERNAL FUNCTIONS ========== */

    /// @notice Updates the bridge transfers for a specific token ID and amount. Only the contract
    /// owner can call this function (intended to be the Bridge contract).
    /// @dev The amount must be greater than 0 and must not exceed the rolling window limit.
    /// @param chainID The ID of the chain to record the transfer for.
    /// @param tokenID The ID of the token to record the transfer for.
    /// @param amount The amount of tokens to be transferred.
    function recordBridgeTransfers(uint8 chainID, uint8 tokenID, uint256 amount)
        external
        override
        onlyOwner
    {
        require(amount > 0, "BridgeLimiter: amount must be greater than 0");
        require(
            !willAmountExceedLimit(chainID, tokenID, amount),
            "BridgeLimiter: amount exceeds rolling window limit"
        );

        uint32 _currentHour = currentHour();

        // garbage collect most recently expired hour if possible
        uint256 key = getChainTokenHourTimestampKey(chainID, tokenID, _currentHour - 25);
        if (chainTokenHourlyTransferAmount[key] > 0) {
            delete chainTokenHourlyTransferAmount[key];
        }

        // update key to current hour
        key = getChainTokenHourTimestampKey(chainID, tokenID, _currentHour);
        // update hourly transfers
        chainTokenHourlyTransferAmount[key] += amount;
    }

    /// @notice Updates the total limit with the provided message if the provided signatures are valid.
    /// @param message The BridgeUtils containing the update limit payload.
    function updateLimit(
        BridgeUtils.Message memory message
    )
        external
        nonReentrant
    {
        require(msg.sender == committee.config().admin(), "BridgeLimiter: Only admin can perform this action");
        // decode the update limit payload
        (uint8 sourceChainID, uint8 tokenID, uint256 newLimit) =
            BridgeUtils.decodeUpdateLimitPayload(message.payload);

        require(
            committee.config().isChainSupported(sourceChainID),
            "BridgeLimiter: Source chain not supported"
        );
        
        require(
            committee.config().isTokenSupported(tokenID),
            "BridgeLimiter: Token not supported"
        );

        uint16 chainTokenID = (uint16(sourceChainID) << 8) | uint16(tokenID);
        // update the chain and token limit
        chainTokenLimits[chainTokenID] = newLimit;

        emit LimitUpdated(sourceChainID, tokenID, newLimit);
    }
}

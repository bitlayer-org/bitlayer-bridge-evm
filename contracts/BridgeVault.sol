// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IBridgeVault.sol";
import "./interfaces/IWBTC9.sol";

/// @title BridgeVault
/// @notice A contract that acts as a vault for transferring ERC20 tokens and BTC. It enables the owner
/// (intended to be the Bridge contract) to transfer tokens to a target address. It also supports
/// unwrapping WBTC (Wrapped Ether) and transferring the unwrapped BTC.
/// @dev The contract is initialized with the deployer as the owner. The ownership is intended to be
/// transferred to the Bridge contract after the bridge contract is deployed.
contract BridgeVault is Ownable, IBridgeVault, ReentrancyGuard {
    /* ========== STATE VARIABLES ========== */

    IWBTC9 public immutable wBTC;

    /* ========== CONSTRUCTOR ========== */

    /// @notice Constructor function for the BridgeVault contract.
    /// @param _wBTC The address of the Wrapped Ether (WBTC) contract.
    constructor(address _wBTC) Ownable(msg.sender) ReentrancyGuard() {
        // Set the WBTC address
        wBTC = IWBTC9(_wBTC);
    }

    /// @notice Transfers ERC20 tokens from the contract to a target address. Only the owner of
    /// the contract can call this function.
    /// @dev This function is intended to only be called by the Bridge contract.
    /// @param tokenAddress The address of the ERC20 token.
    /// @param recipientAddress The address to transfer the tokens to.
    /// @param amount The amount of tokens to transfer.
    function transferERC20(address tokenAddress, address recipientAddress, uint256 amount)
        external
        override
        onlyOwner
        nonReentrant
    {
        // Transfer the tokens from the contract to the target address
        SafeERC20.safeTransfer(IERC20(tokenAddress), recipientAddress, amount);
    }

    /// @notice Unwraps stored wrapped BTC and transfers the newly withdrawn BTC to the provided target
    /// address. Only the owner of the contract can call this function.
    /// @dev This function is intended to only be called by the Bridge contract.
    /// @param recipientAddress The address to transfer the BTC to.
    /// @param amount The amount of BTC to transfer.
    // function transferBTC(address payable recipientAddress, uint256 amount)
    //     external
    //     override
    //     onlyOwner
    //     nonReentrant
    // {
    //     // Unwrap the WBTC
    //     wBTC.withdraw(amount);

    //     // Transfer the unwrapped BTC to the target address
    //     (bool success,) = recipientAddress.call{value: amount}("");
    //     require(success, "BTC transfer failed");
    // }

    /// @notice Wraps as eth sent to this contract.
    /// @dev skip if sender is wBTC contract to avoid infinite loop.
    receive() external payable {
        if (msg.sender != address(wBTC)) {
            wBTC.deposit{value: msg.value}();
        }
    }

    /// @notice Gets the balance of a specified ERC20 token for this contract.
    /// @param tokenAddress The address of the ERC20 token.
    /// @return The balance of the specified ERC20 token for this contract.
    function getERC20Balance(address tokenAddress) external view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }
}

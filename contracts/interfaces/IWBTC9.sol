// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IWBTC9
/// @notice Interface for the WBTC9 contract.
interface IWBTC9 is IERC20 {
    /// @notice Deposit BTC to get wrapped BTC
    /// @dev This function enables users to deposit BTC and receive wrapped BTC tokens in return.
    /// @dev The amount of BTC to be deposited should be sent along with the function call.
    function deposit() external payable;

    /// @notice Withdraw wrapped BTC to get BTC
    /// @dev This function allows users to withdraw a specified amount of wrapped BTC and receive BTC in return.
    /// @param wad The amount of wrapped BTC to be withdrawn.
    function withdraw(uint256 wad) external;
}

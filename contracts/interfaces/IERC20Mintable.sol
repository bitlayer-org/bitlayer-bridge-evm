// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IERC20Mintable
/// @notice Interface for the IERC20Mintable contract.
interface IERC20Mintable is IERC20 {
    function mint(address account, uint256 value) external;
}

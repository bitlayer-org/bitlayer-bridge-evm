// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IERC20Burnable
/// @notice Interface for the IERC20Burnable contract.
interface IERC20Burnable is IERC20 {
    function burn(uint256 value) external;
    function burnFrom(address account, uint256 value) external;
}

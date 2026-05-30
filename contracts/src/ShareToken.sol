// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ShareToken — ERC-1155 fractional land shares
/// @notice Token ID == parcel ID; balance == shares owned
contract ShareToken is ERC1155, Ownable {
    mapping(address => bool) public minters;

    error NotMinter();
    error ZeroAmount();

    event MinterUpdated(address indexed minter, bool status);

    modifier onlyMinter() {
        if (!minters[msg.sender]) revert NotMinter();
        _;
    }

    constructor(string memory baseUri) ERC1155(baseUri) Ownable(msg.sender) {
        minters[msg.sender] = true;
    }

    /// @notice Add or remove a minter (Registry, Marketplace, Governance)
    function setMinter(address _minter, bool _status) external onlyOwner {
        minters[_minter] = _status;
        emit MinterUpdated(_minter, _status);
    }

    /// @notice Mint shares for a parcel to a recipient
    /// @param parcelId The parcel token ID
    /// @param to Recipient address
    /// @param amount Number of shares to mint
    function mintShares(uint256 parcelId, address to, uint256 amount) external onlyMinter {
        if (amount == 0) revert ZeroAmount();
        _mint(to, parcelId, amount, "");
    }

    /// @notice Burn shares (used by Governance squeeze-out)
    function burnShares(uint256 parcelId, address from, uint256 amount) external onlyMinter {
        if (amount == 0) revert ZeroAmount();
        _burn(from, parcelId, amount);
    }

    /// @notice Override URI to return per-parcel metadata
    function uri(uint256 parcelId) public pure override returns (string memory) {
        return string.concat(
            "https://stratafi.app/api/metadata/",
            _toString(parcelId)
        );
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

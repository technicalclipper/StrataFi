// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ShareToken.sol";
import "./ParcelRegistry.sol";

/// @title YieldSplitter — pro-rata yield distribution for parcel shareholders
/// @notice Pull-payment pattern: anyone deposits MNT yield, holders claim their share
contract YieldSplitter is ReentrancyGuard {
    ShareToken public immutable shareToken;
    ParcelRegistry public immutable registry;

    // Accumulated yield per share (scaled by 1e18 for precision)
    mapping(uint256 => uint256) public accYieldPerShare; // parcelId => accumulated
    mapping(uint256 => uint256) public totalDeposited; // parcelId => total MNT deposited

    // Per-holder tracking to prevent double claims
    mapping(uint256 => mapping(address => uint256)) public yieldDebt; // parcelId => holder => debt

    error ZeroDeposit();
    error NothingToClaim();
    error ParcelNotFound();

    event YieldDeposited(uint256 indexed parcelId, address indexed depositor, uint256 amount);
    event YieldClaimed(uint256 indexed parcelId, address indexed holder, uint256 amount);

    constructor(address _shareToken, address _registry) {
        shareToken = ShareToken(_shareToken);
        registry = ParcelRegistry(_registry);
    }

    /// @notice Deposit rental income / yield for a parcel
    /// @param parcelId The parcel to distribute yield for
    function depositYield(uint256 parcelId) external payable {
        if (msg.value == 0) revert ZeroDeposit();

        ParcelRegistry.Parcel memory parcel = registry.getParcel(parcelId);
        if (parcel.totalShares == 0) revert ParcelNotFound();

        accYieldPerShare[parcelId] += (msg.value * 1e18) / parcel.totalShares;
        totalDeposited[parcelId] += msg.value;

        emit YieldDeposited(parcelId, msg.sender, msg.value);
    }

    /// @notice Claim accrued yield for a parcel
    /// @param parcelId The parcel to claim yield from
    function claim(uint256 parcelId) external nonReentrant {
        uint256 shares = shareToken.balanceOf(msg.sender, parcelId);
        uint256 accumulated = (shares * accYieldPerShare[parcelId]) / 1e18;
        uint256 owed = accumulated - yieldDebt[parcelId][msg.sender];

        if (owed == 0) revert NothingToClaim();

        yieldDebt[parcelId][msg.sender] = accumulated;

        (bool sent,) = payable(msg.sender).call{value: owed}("");
        require(sent, "Claim transfer failed");

        emit YieldClaimed(parcelId, msg.sender, owed);
    }

    /// @notice View claimable yield for a holder
    function claimable(uint256 parcelId, address holder) external view returns (uint256) {
        uint256 shares = shareToken.balanceOf(holder, parcelId);
        uint256 accumulated = (shares * accYieldPerShare[parcelId]) / 1e18;
        return accumulated - yieldDebt[parcelId][holder];
    }

    /// @notice Update debt when shares are transferred (call after transfer)
    /// @dev Should be called by a hook or manually to keep debt in sync
    function updateDebt(uint256 parcelId, address holder) external {
        uint256 shares = shareToken.balanceOf(holder, parcelId);
        yieldDebt[parcelId][holder] = (shares * accYieldPerShare[parcelId]) / 1e18;
    }
}

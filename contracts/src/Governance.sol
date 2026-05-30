// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ShareToken.sol";
import "./ParcelRegistry.sol";

/// @title Governance — token-weighted buyout voting with squeeze-out mechanism
/// @notice A holder with >=51% can propose a buyout. If passed, remaining holders
///         are paid the declared price and their tokens transfer to the acquirer.
contract Governance is ReentrancyGuard {
    ShareToken public immutable shareToken;
    ParcelRegistry public immutable registry;

    struct Proposal {
        uint256 id;
        uint256 parcelId;
        address acquirer;
        uint256 pricePerShare; // in wei (MNT)
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        bool active;
    }

    uint256 public nextProposalId = 1;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MAJORITY_BPS = 5100; // 51% in basis points

    error InsufficientShares();
    error ProposalNotActive();
    error AlreadyVoted();
    error VotingNotEnded();
    error VotingEnded();
    error ProposalNotPassed();
    error InsufficientEscrow();
    error NotAcquirer();

    event ProposalCreated(uint256 indexed proposalId, uint256 indexed parcelId, address indexed acquirer, uint256 pricePerShare);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event BuyoutExecuted(uint256 indexed proposalId, uint256 indexed parcelId, address indexed acquirer);

    constructor(address _shareToken, address _registry) {
        shareToken = ShareToken(_shareToken);
        registry = ParcelRegistry(_registry);
    }

    /// @notice Propose a buyout — caller must hold >=51% of parcel shares
    /// @param parcelId Target parcel
    /// @param pricePerShare Price per share offered to remaining holders (in MNT wei)
    function proposeBuyout(uint256 parcelId, uint256 pricePerShare) external payable returns (uint256 proposalId) {
        ParcelRegistry.Parcel memory parcel = registry.getParcel(parcelId);
        uint256 acquirerShares = shareToken.balanceOf(msg.sender, parcelId);
        uint256 requiredShares = (parcel.totalShares * MAJORITY_BPS) / 10000;

        if (acquirerShares < requiredShares) revert InsufficientShares();

        // Acquirer must escrow enough MNT to pay remaining holders
        uint256 remainingShares = parcel.totalShares - acquirerShares;
        uint256 escrowNeeded = remainingShares * pricePerShare;
        if (msg.value < escrowNeeded) revert InsufficientEscrow();

        proposalId = nextProposalId++;
        proposals[proposalId] = Proposal({
            id: proposalId,
            parcelId: parcelId,
            acquirer: msg.sender,
            pricePerShare: pricePerShare,
            votesFor: acquirerShares, // acquirer auto-votes yes
            votesAgainst: 0,
            deadline: block.timestamp + VOTING_PERIOD,
            executed: false,
            active: true
        });

        hasVoted[proposalId][msg.sender] = true;

        // Refund excess escrow
        if (msg.value > escrowNeeded) {
            (bool refunded,) = payable(msg.sender).call{value: msg.value - escrowNeeded}("");
            require(refunded, "Refund failed");
        }

        emit ProposalCreated(proposalId, parcelId, msg.sender, pricePerShare);
    }

    /// @notice Vote on a buyout proposal (1 share = 1 vote)
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        if (!p.active) revert ProposalNotActive();
        if (block.timestamp > p.deadline) revert VotingEnded();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        uint256 weight = shareToken.balanceOf(msg.sender, p.parcelId);
        if (weight == 0) revert InsufficientShares();

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.votesFor += weight;
        } else {
            p.votesAgainst += weight;
        }

        emit Voted(proposalId, msg.sender, support, weight);
    }

    /// @notice Execute a passed buyout — squeeze out remaining holders
    /// @dev Requires manual execution after voting period ends
    /// @param proposalId The proposal to execute
    /// @param holders List of remaining holder addresses to squeeze out
    function executeBuyout(uint256 proposalId, address[] calldata holders) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        if (!p.active) revert ProposalNotActive();
        if (block.timestamp <= p.deadline) revert VotingNotEnded();
        if (msg.sender != p.acquirer) revert NotAcquirer();

        ParcelRegistry.Parcel memory parcel = registry.getParcel(p.parcelId);
        uint256 requiredVotes = (parcel.totalShares * MAJORITY_BPS) / 10000;

        if (p.votesFor < requiredVotes) revert ProposalNotPassed();

        p.executed = true;
        p.active = false;

        // Squeeze out: pay each holder and transfer their shares to acquirer
        for (uint256 i = 0; i < holders.length; i++) {
            address holder = holders[i];
            if (holder == p.acquirer) continue;

            uint256 holderShares = shareToken.balanceOf(holder, p.parcelId);
            if (holderShares == 0) continue;

            uint256 payment = holderShares * p.pricePerShare;

            // Burn holder's shares and mint to acquirer
            shareToken.burnShares(p.parcelId, holder, holderShares);
            shareToken.mintShares(p.parcelId, p.acquirer, holderShares);

            // Pay the holder
            (bool sent,) = payable(holder).call{value: payment}("");
            require(sent, "Payment to holder failed");
        }

        emit BuyoutExecuted(proposalId, p.parcelId, p.acquirer);
    }

    /// @notice View proposal details
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }
}

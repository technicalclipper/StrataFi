// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ParcelRegistry.sol";
import "../src/ShareToken.sol";
import "../src/Governance.sol";

contract GovernanceTest is Test {
    ParcelRegistry registry;
    ShareToken token;
    Governance gov;
    address seller = address(0x1);
    address acquirer = address(0x2);
    address minority1 = address(0x3);
    address minority2 = address(0x4);

    function setUp() public {
        registry = new ParcelRegistry();
        token = new ShareToken("https://stratafi.app/api/metadata/");
        gov = new Governance(address(token), address(registry));

        token.setMinter(address(this), true);
        token.setMinter(address(gov), true);

        // Register parcel with 100 shares
        registry.registerParcel(bytes32("geo"), bytes32("doc"), 95, 100, seller);

        // acquirer=55, minority1=30, minority2=15
        token.mintShares(1, acquirer, 55);
        token.mintShares(1, minority1, 30);
        token.mintShares(1, minority2, 15);

        vm.deal(acquirer, 100 ether);

        // Approve governance to move tokens
        vm.prank(minority1);
        token.setApprovalForAll(address(gov), true);
        vm.prank(minority2);
        token.setApprovalForAll(address(gov), true);
    }

    function test_proposeBuyout() public {
        // acquirer holds 55% >= 51%, can propose
        // Remaining = 45 shares, price = 1 MNT each, escrow = 45 MNT
        vm.prank(acquirer);
        uint256 proposalId = gov.proposeBuyout{value: 45 ether}(1, 1 ether);

        assertEq(proposalId, 1);
        Governance.Proposal memory p = gov.getProposal(1);
        assertEq(p.acquirer, acquirer);
        assertEq(p.votesFor, 55); // auto-voted
    }

    function test_revert_insufficientShares() public {
        vm.deal(minority1, 100 ether);
        vm.prank(minority1); // only 30%
        vm.expectRevert(Governance.InsufficientShares.selector);
        gov.proposeBuyout{value: 70 ether}(1, 1 ether);
    }

    function test_vote() public {
        vm.prank(acquirer);
        gov.proposeBuyout{value: 45 ether}(1, 1 ether);

        vm.prank(minority1);
        gov.vote(1, false); // votes against

        Governance.Proposal memory p = gov.getProposal(1);
        assertEq(p.votesFor, 55);
        assertEq(p.votesAgainst, 30);
    }

    function test_executeBuyout() public {
        vm.prank(acquirer);
        gov.proposeBuyout{value: 45 ether}(1, 1 ether);

        // Warp past voting period
        vm.warp(block.timestamp + 8 days);

        uint256 min1BalBefore = minority1.balance;
        uint256 min2BalBefore = minority2.balance;

        address[] memory holders = new address[](2);
        holders[0] = minority1;
        holders[1] = minority2;

        vm.prank(acquirer);
        gov.executeBuyout(1, holders);

        // Acquirer should now hold all 100 shares
        assertEq(token.balanceOf(acquirer, 1), 100);
        assertEq(token.balanceOf(minority1, 1), 0);
        assertEq(token.balanceOf(minority2, 1), 0);

        // Minorities should be paid
        assertEq(minority1.balance, min1BalBefore + 30 ether);
        assertEq(minority2.balance, min2BalBefore + 15 ether);
    }

    function test_revert_votingNotEnded() public {
        vm.prank(acquirer);
        gov.proposeBuyout{value: 45 ether}(1, 1 ether);

        address[] memory holders = new address[](1);
        holders[0] = minority1;

        vm.prank(acquirer);
        vm.expectRevert(Governance.VotingNotEnded.selector);
        gov.executeBuyout(1, holders);
    }

    function test_revert_alreadyVoted() public {
        vm.prank(acquirer);
        gov.proposeBuyout{value: 45 ether}(1, 1 ether);

        vm.prank(minority1);
        gov.vote(1, true);

        vm.prank(minority1);
        vm.expectRevert(Governance.AlreadyVoted.selector);
        gov.vote(1, true);
    }
}

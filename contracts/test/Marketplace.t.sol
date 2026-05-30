// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ShareToken.sol";
import "../src/Marketplace.sol";

contract MarketplaceTest is Test {
    ShareToken token;
    Marketplace market;
    address seller = address(0x1);
    address buyer = address(0x2);
    address holder = address(0x3);

    function setUp() public {
        token = new ShareToken("https://stratafi.app/api/metadata/");
        market = new Marketplace(address(token));

        // Authorize marketplace to move tokens
        token.setMinter(address(this), true);
        token.mintShares(1, seller, 200);

        // Seller approves marketplace
        vm.prank(seller);
        token.setApprovalForAll(address(market), true);

        // Fund buyer
        vm.deal(buyer, 100 ether);
        vm.deal(holder, 10 ether);
    }

    // --- Primary Sale ---
    function test_primarySale() public {
        vm.prank(seller);
        market.createPrimarySale(1, 0.5 ether);

        vm.prank(buyer);
        market.buyPrimary{value: 5 ether}(1, 10);

        assertEq(token.balanceOf(buyer, 1), 10);
        assertEq(token.balanceOf(seller, 1), 190);
    }

    function test_revert_insufficientPayment() public {
        vm.prank(seller);
        market.createPrimarySale(1, 0.5 ether);

        vm.prank(buyer);
        vm.expectRevert(Marketplace.InsufficientPayment.selector);
        market.buyPrimary{value: 0.1 ether}(1, 10);
    }

    // --- Secondary Listing ---
    function test_secondaryListing() public {
        // Seller transfers some to holder first
        vm.prank(seller);
        token.safeTransferFrom(seller, holder, 1, 50, "");

        vm.prank(holder);
        token.setApprovalForAll(address(market), true);

        vm.prank(holder);
        market.createListing(1, 20, 0.6 ether);

        vm.prank(buyer);
        market.fillListing{value: 12 ether}(1, 20);

        assertEq(token.balanceOf(buyer, 1), 20);
        assertEq(token.balanceOf(holder, 1), 30);
    }

    function test_cancelListing() public {
        vm.prank(seller);
        market.createListing(1, 10, 1 ether);

        vm.prank(seller);
        market.cancelListing(1);

        (,,,, bool active) = market.listings(1);
        assertFalse(active);
    }

    // --- Direct Offer ---
    function test_offerAccept() public {
        // Seller transfers some to holder
        vm.prank(seller);
        token.safeTransferFrom(seller, holder, 1, 50, "");

        vm.prank(holder);
        token.setApprovalForAll(address(market), true);

        uint256 holderBalBefore = holder.balance;

        vm.prank(buyer);
        market.createOffer{value: 5 ether}(1, holder, 10, 0.5 ether);

        vm.prank(holder);
        market.acceptOffer(1);

        assertEq(token.balanceOf(buyer, 1), 10);
        assertEq(token.balanceOf(holder, 1), 40);
        assertEq(holder.balance, holderBalBefore + 5 ether);
    }

    function test_offerReject() public {
        vm.prank(seller);
        token.safeTransferFrom(seller, holder, 1, 50, "");

        uint256 buyerBalBefore = buyer.balance;

        vm.prank(buyer);
        market.createOffer{value: 5 ether}(1, holder, 10, 0.5 ether);

        vm.prank(holder);
        market.rejectOffer(1);

        assertEq(buyer.balance, buyerBalBefore); // refunded
    }

    function test_offerExpiry() public {
        vm.prank(buyer);
        market.createOffer{value: 5 ether}(1, holder, 10, 0.5 ether);

        // Warp past 72h
        vm.warp(block.timestamp + 73 hours);

        uint256 buyerBalBefore = buyer.balance;
        vm.prank(buyer);
        market.claimExpiredOffer(1);

        assertEq(buyer.balance, buyerBalBefore + 5 ether);
    }
}

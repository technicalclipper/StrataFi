// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ParcelRegistry.sol";
import "../src/ShareToken.sol";
import "../src/YieldSplitter.sol";

contract YieldSplitterTest is Test {
    ParcelRegistry registry;
    ShareToken token;
    YieldSplitter yield_;
    address seller = address(0x1);
    address holder1 = address(0x2);
    address holder2 = address(0x3);
    address depositor = address(0x4);

    function setUp() public {
        registry = new ParcelRegistry();
        token = new ShareToken("https://stratafi.app/api/metadata/");
        yield_ = new YieldSplitter(address(token), address(registry));

        token.setMinter(address(this), true);

        // Register parcel with 100 shares
        registry.registerParcel(bytes32("geo"), bytes32("doc"), 90, 100, seller);

        // Distribute shares: holder1=60, holder2=40
        token.mintShares(1, holder1, 60);
        token.mintShares(1, holder2, 40);

        vm.deal(depositor, 100 ether);
    }

    function test_depositAndClaim() public {
        // Deposit 10 MNT yield
        vm.prank(depositor);
        yield_.depositYield{value: 10 ether}(1);

        // holder1 (60%) should get 6 MNT
        uint256 claimable1 = yield_.claimable(1, holder1);
        assertEq(claimable1, 6 ether);

        // holder2 (40%) should get 4 MNT
        uint256 claimable2 = yield_.claimable(1, holder2);
        assertEq(claimable2, 4 ether);

        // Claim
        uint256 bal1Before = holder1.balance;
        vm.prank(holder1);
        yield_.claim(1);
        assertEq(holder1.balance, bal1Before + 6 ether);

        // Claiming again should revert
        vm.prank(holder1);
        vm.expectRevert(YieldSplitter.NothingToClaim.selector);
        yield_.claim(1);
    }

    function test_multipleDeposits() public {
        vm.prank(depositor);
        yield_.depositYield{value: 10 ether}(1);

        // holder1 claims first deposit
        vm.prank(holder1);
        yield_.claim(1);

        // Second deposit
        vm.prank(depositor);
        yield_.depositYield{value: 5 ether}(1);

        // holder1 should only get their share of second deposit
        uint256 claimable1 = yield_.claimable(1, holder1);
        assertEq(claimable1, 3 ether); // 60% of 5

        // holder2 should get share of both deposits (never claimed)
        uint256 claimable2 = yield_.claimable(1, holder2);
        assertEq(claimable2, 6 ether); // 40% of 15
    }

    function test_revert_zeroDeposit() public {
        vm.prank(depositor);
        vm.expectRevert(YieldSplitter.ZeroDeposit.selector);
        yield_.depositYield{value: 0}(1);
    }
}

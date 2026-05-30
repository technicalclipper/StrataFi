// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ShareToken.sol";

contract ShareTokenTest is Test {
    ShareToken token;
    address owner = address(this);
    address minter = address(0x1);
    address user1 = address(0x2);
    address user2 = address(0x3);

    function setUp() public {
        token = new ShareToken("https://stratafi.app/api/metadata/");
        token.setMinter(minter, true);
    }

    function test_mintShares() public {
        vm.prank(minter);
        token.mintShares(1, user1, 100);
        assertEq(token.balanceOf(user1, 1), 100);
    }

    function test_burnShares() public {
        vm.prank(minter);
        token.mintShares(1, user1, 100);

        vm.prank(minter);
        token.burnShares(1, user1, 30);
        assertEq(token.balanceOf(user1, 1), 70);
    }

    function test_transfer() public {
        vm.prank(minter);
        token.mintShares(1, user1, 100);

        vm.prank(user1);
        token.safeTransferFrom(user1, user2, 1, 40, "");

        assertEq(token.balanceOf(user1, 1), 60);
        assertEq(token.balanceOf(user2, 1), 40);
    }

    function test_revert_notMinter() public {
        vm.prank(address(0x99));
        vm.expectRevert(ShareToken.NotMinter.selector);
        token.mintShares(1, user1, 100);
    }

    function test_revert_zeroAmount() public {
        vm.prank(minter);
        vm.expectRevert(ShareToken.ZeroAmount.selector);
        token.mintShares(1, user1, 0);
    }

    function test_uri() public view {
        assertEq(token.uri(42), "https://stratafi.app/api/metadata/42");
    }

    function test_multipleParcelIds() public {
        vm.startPrank(minter);
        token.mintShares(1, user1, 100);
        token.mintShares(2, user1, 50);
        token.mintShares(1, user2, 200);
        vm.stopPrank();

        assertEq(token.balanceOf(user1, 1), 100);
        assertEq(token.balanceOf(user1, 2), 50);
        assertEq(token.balanceOf(user2, 1), 200);
    }
}

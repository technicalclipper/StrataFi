// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ParcelRegistry.sol";

contract ParcelRegistryTest is Test {
    ParcelRegistry registry;
    address owner = address(this);
    address verifier = address(0x1);
    address seller = address(0x2);

    function setUp() public {
        registry = new ParcelRegistry();
        registry.setVerifier(verifier, true);
    }

    function test_registerParcel() public {
        vm.prank(verifier);
        uint256 id = registry.registerParcel(
            bytes32("geo123"),
            bytes32("doc456"),
            92,
            200,
            seller
        );
        assertEq(id, 1);

        ParcelRegistry.Parcel memory p = registry.getParcel(1);
        assertEq(p.seller, seller);
        assertEq(p.totalShares, 200);
        assertEq(p.confidenceScore, 92);
        assertTrue(p.verified);
    }

    function test_revert_notVerifier() public {
        vm.prank(address(0x99));
        vm.expectRevert(ParcelRegistry.NotVerifier.selector);
        registry.registerParcel(bytes32("geo"), bytes32("doc"), 80, 100, seller);
    }

    function test_revert_invalidConfidence() public {
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(ParcelRegistry.InvalidConfidence.selector, 101));
        registry.registerParcel(bytes32("geo"), bytes32("doc"), 101, 100, seller);
    }

    function test_revert_zeroShares() public {
        vm.prank(verifier);
        vm.expectRevert(ParcelRegistry.ZeroShares.selector);
        registry.registerParcel(bytes32("geo"), bytes32("doc"), 80, 0, seller);
    }

    function test_revert_parcelNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(ParcelRegistry.ParcelNotFound.selector, 999));
        registry.getParcel(999);
    }

    function test_setVerifier() public {
        address newVerifier = address(0x3);
        registry.setVerifier(newVerifier, true);
        assertTrue(registry.verifiers(newVerifier));

        registry.setVerifier(newVerifier, false);
        assertFalse(registry.verifiers(newVerifier));
    }

    function test_incrementingIds() public {
        vm.startPrank(verifier);
        uint256 id1 = registry.registerParcel(bytes32("g1"), bytes32("d1"), 80, 100, seller);
        uint256 id2 = registry.registerParcel(bytes32("g2"), bytes32("d2"), 85, 200, seller);
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
    }
}

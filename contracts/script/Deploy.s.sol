// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ParcelRegistry.sol";
import "../src/ShareToken.sol";
import "../src/Marketplace.sol";
import "../src/YieldSplitter.sol";
import "../src/Governance.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy ParcelRegistry
        ParcelRegistry registry = new ParcelRegistry();
        console.log("ParcelRegistry:", address(registry));

        // 2. Deploy ShareToken
        ShareToken token = new ShareToken("https://stratafi.app/api/metadata/");
        console.log("ShareToken:", address(token));

        // 3. Deploy Marketplace
        Marketplace marketplace = new Marketplace(address(token));
        console.log("Marketplace:", address(marketplace));

        // 4. Deploy YieldSplitter
        YieldSplitter yield_ = new YieldSplitter(address(token), address(registry));
        console.log("YieldSplitter:", address(yield_));

        // 5. Deploy Governance
        Governance governance = new Governance(address(token), address(registry));
        console.log("Governance:", address(governance));

        // 6. Configure permissions
        // Backend signer (deployer) is already a verifier on ParcelRegistry
        // Marketplace needs to be able to call safeTransferFrom (handled by user approval)
        // Governance needs minter rights for squeeze-out (burn + mint)
        token.setMinter(address(governance), true);
        // Deployer keeps minter rights for initial mints after AI approval
        // token.setMinter(deployer, true); // already set in constructor

        vm.stopBroadcast();

        console.log("---");
        console.log("Deployer:", deployer);
        console.log("---");
        console.log("Copy these to frontend/.env.local:");
        console.log(string.concat("NEXT_PUBLIC_PARCEL_REGISTRY=", vm.toString(address(registry))));
        console.log(string.concat("NEXT_PUBLIC_SHARE_TOKEN=", vm.toString(address(token))));
        console.log(string.concat("NEXT_PUBLIC_MARKETPLACE=", vm.toString(address(marketplace))));
        console.log(string.concat("NEXT_PUBLIC_YIELD_SPLITTER=", vm.toString(address(yield_))));
        console.log(string.concat("NEXT_PUBLIC_GOVERNANCE=", vm.toString(address(governance))));
    }
}

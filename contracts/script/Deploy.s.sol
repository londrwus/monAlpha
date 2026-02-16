// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SkillRegistry.sol";

contract DeploySkillRegistry is Script {
    function run() external {
        // --- Configuration ---
        address owner      = vm.envAddress("OWNER_ADDRESS");
        address foundation = vm.envAddress("FOUNDATION_ADDRESS");
        uint256 registrationFee = 10 ether; // 10 MON

        // --- Deploy ---
        vm.startBroadcast();

        SkillRegistry registry = new SkillRegistry(
            owner,
            foundation,
            registrationFee
        );

        console.log("SkillRegistry deployed at:", address(registry));
        console.log("Owner:", owner);
        console.log("Foundation:", foundation);
        console.log("Registration fee:", registrationFee / 1 ether, "MON");

        vm.stopBroadcast();
    }
}

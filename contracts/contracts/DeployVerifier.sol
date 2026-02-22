// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Verifier.sol";

/**
 * @title DeFi Score Verifier Deployment
 * @notice Helper contract for deploying the verifier
 */
contract DeployVerifier {
    Groth16Verifier public verifier;
    
    event VerifierDeployed(address indexed verifier, uint256 timestamp);
    
    constructor() {
        verifier = new Groth16Verifier();
        emit VerifierDeployed(address(verifier), block.timestamp);
    }
    
    function getVerifierAddress() external view returns (address) {
        return address(verifier);
    }
}

/**
 * Complete ZK Proof System Deployment
 * Deploys all contracts in correct order with proper configuration
 * 
 * Deployment Order:
 * 1. Verifier (auto-generated from circuit)
 * 2. DeFiScoreRegistry (with verifier)
 * 3. SecurityGuard
 * 4. CircuitVersionManager (with registry + governors)
 * 5. LendingEscrow (with registry)
 * 6. LenderIntegration (with registry)
 * 
 * Post-Deployment:
 * - Configure registry in LendingEscrow
 * - Set default threshold
 * - Transfer ownership to multi-sig
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("========================================");
  console.log("DEPLOYING COMPLETE ZK PROOF SYSTEM");
  console.log("========================================\n");

  const [deployer, governor1, governor2] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
  console.log();

  const deploymentData = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  // ============================================================================
  // STEP 1: Deploy Verifier
  // ============================================================================
  console.log("📝 Step 1: Deploying Verifier...");
  
  const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  
  console.log("✅ Verifier deployed to:", verifierAddress);
  deploymentData.contracts.verifier = verifierAddress;
  console.log();

  // ============================================================================
  // STEP 2: Deploy DeFiScoreRegistry
  // ============================================================================
  console.log("📝 Step 2: Deploying DeFiScoreRegistry...");
  
  const Registry = await hre.ethers.getContractFactory("DeFiScoreRegistry");
  const registry = await Registry.deploy(verifierAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  
  console.log("✅ DeFiScoreRegistry deployed to:", registryAddress);
  deploymentData.contracts.registry = registryAddress;
  console.log();

  // ============================================================================
  // STEP 3: Deploy SecurityGuard
  // ============================================================================
  console.log("📝 Step 3: Deploying SecurityGuard...");
  
  const SecurityGuard = await hre.ethers.getContractFactory("SecurityGuard");
  const securityGuard = await SecurityGuard.deploy();
  await securityGuard.waitForDeployment();
  const securityGuardAddress = await securityGuard.getAddress();
  
  console.log("✅ SecurityGuard deployed to:", securityGuardAddress);
  deploymentData.contracts.securityGuard = securityGuardAddress;
  console.log();

  // ============================================================================
  // STEP 4: Deploy CircuitVersionManager
  // ============================================================================
  console.log("📝 Step 4: Deploying CircuitVersionManager...");
  
  // Use deployer + 2 additional governors for multi-sig
  const governors = [deployer.address];
  if (governor1) governors.push(governor1.address);
  if (governor2) governors.push(governor2.address);
  
  const requiredApprovals = Math.max(1, Math.floor(governors.length / 2) + 1); // Majority
  
  const VersionManager = await hre.ethers.getContractFactory("CircuitVersionManager");
  const versionManager = await VersionManager.deploy(
    registryAddress,
    governors,
    requiredApprovals
  );
  await versionManager.waitForDeployment();
  const versionManagerAddress = await versionManager.getAddress();
  
  console.log("✅ CircuitVersionManager deployed to:", versionManagerAddress);
  console.log("   Governors:", governors);
  console.log("   Required approvals:", requiredApprovals);
  deploymentData.contracts.versionManager = versionManagerAddress;
  deploymentData.governance = { governors, requiredApprovals };
  console.log();

  // ============================================================================
  // STEP 5: Deploy LendingEscrow
  // ============================================================================
  console.log("📝 Step 5: Deploying LendingEscrow...");
  
  const LendingEscrow = await hre.ethers.getContractFactory("LendingEscrow");
  const lendingEscrow = await LendingEscrow.deploy();
  await lendingEscrow.waitForDeployment();
  const lendingEscrowAddress = await lendingEscrow.getAddress();
  
  console.log("✅ LendingEscrow deployed to:", lendingEscrowAddress);
  deploymentData.contracts.lendingEscrow = lendingEscrowAddress;
  console.log();

  // ============================================================================
  // STEP 6: Deploy LenderIntegration
  // ============================================================================
  console.log("📝 Step 6: Deploying LenderIntegration...");
  
  const initialThreshold = 500000; // 500 score (scaled x1000)
  
  const LenderIntegration = await hre.ethers.getContractFactory("LenderIntegration");
  const lenderIntegration = await LenderIntegration.deploy(
    registryAddress,
    initialThreshold
  );
  await lenderIntegration.waitForDeployment();
  const lenderIntegrationAddress = await lenderIntegration.getAddress();
  
  console.log("✅ LenderIntegration deployed to:", lenderIntegrationAddress);
  console.log("   Initial threshold:", initialThreshold / 1000, "score");
  deploymentData.contracts.lenderIntegration = lenderIntegrationAddress;
  console.log();

  // ============================================================================
  // STEP 7: Configure LendingEscrow
  // ============================================================================
  console.log("📝 Step 7: Configuring LendingEscrow...");
  
  console.log("   Setting score registry...");
  let tx = await lendingEscrow.setScoreRegistry(registryAddress);
  await tx.wait();
  
  console.log("   Setting default threshold...");
  tx = await lendingEscrow.setDefaultThreshold(initialThreshold);
  await tx.wait();
  
  console.log("✅ LendingEscrow configured");
  console.log();

  // ============================================================================
  // STEP 8: Verify Deployment
  // ============================================================================
  console.log("📝 Step 8: Verifying deployment...");
  
  const currentVersion = await registry.currentVersion();
  const registeredVerifier = await registry.getVerifier(currentVersion);
  const escrowRegistry = await lendingEscrow.scoreRegistry();
  const escrowThreshold = await lendingEscrow.defaultThreshold();
  
  console.log("   Registry current version:", currentVersion.toString());
  console.log("   Registry verifier:", registeredVerifier);
  console.log("   Escrow registry:", escrowRegistry);
  console.log("   Escrow threshold:", (Number(escrowThreshold) / 1000).toString(), "score");
  
  if (registeredVerifier !== verifierAddress) {
    throw new Error("Verifier mismatch in registry!");
  }
  if (escrowRegistry !== registryAddress) {
    throw new Error("Registry mismatch in escrow!");
  }
  
  console.log("✅ All verifications passed");
  console.log();

  // ============================================================================
  // STEP 9: Save Deployment Data
  // ============================================================================
  console.log("📝 Step 9: Saving deployment data...");
  
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `deployment-${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));
  console.log("✅ Deployment data saved to:", filename);
  console.log();

  // ============================================================================
  // DEPLOYMENT SUMMARY
  // ============================================================================
  console.log("========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================\n");
  
  console.log("Contract Addresses:");
  console.log("-------------------");
  console.log("Verifier:              ", verifierAddress);
  console.log("DeFiScoreRegistry:     ", registryAddress);
  console.log("SecurityGuard:         ", securityGuardAddress);
  console.log("CircuitVersionManager: ", versionManagerAddress);
  console.log("LendingEscrow:         ", lendingEscrowAddress);
  console.log("LenderIntegration:     ", lenderIntegrationAddress);
  console.log();

  console.log("Configuration:");
  console.log("--------------");
  console.log("Circuit Version:       ", currentVersion.toString());
  console.log("Default Threshold:     ", (Number(escrowThreshold) / 1000).toString(), "score");
  console.log("Governors:             ", governors.length);
  console.log("Required Approvals:    ", requiredApprovals);
  console.log();

  console.log("Next Steps:");
  console.log("-----------");
  console.log("1. Update Frontend .env with contract addresses");
  console.log("2. Update Backend .env with contract addresses");
  console.log("3. Verify contracts on block explorer (if mainnet/testnet)");
  console.log("4. Transfer ownership to multi-sig wallet (if production)");
  console.log("5. Test complete flow: proof generation → submission → verification");
  console.log();

  console.log("Frontend .env variables:");
  console.log("------------------------");
  console.log(`VITE_DEFI_SCORE_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`VITE_LENDING_ESCROW_ADDRESS=${lendingEscrowAddress}`);
  console.log(`VITE_LENDER_INTEGRATION_ADDRESS=${lenderIntegrationAddress}`);
  console.log(`VITE_SECURITY_GUARD_ADDRESS=${securityGuardAddress}`);
  console.log();

  return deploymentData;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

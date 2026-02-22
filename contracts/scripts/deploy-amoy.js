/**
 * Deploy to Polygon Amoy Testnet
 * Simple single-network deployment
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("=".repeat(80));
  console.log("DEPLOYING TO POLYGON AMOY TESTNET");
  console.log("=".repeat(80));

  const [deployer] = await hre.ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);
  
  console.log("\nDeployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "MATIC");
  
  if (balance === 0n) {
    throw new Error("Insufficient balance!");
  }

  const deploymentData = {
    network: "amoy",
    networkName: "Polygon Amoy",
    chainId: 80002,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  // Deploy Verifier
  console.log("\n📝 [1/6] Deploying Verifier...");
  const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("✅ Verifier:", verifierAddress);
  deploymentData.contracts.verifier = verifierAddress;

  // Deploy DeFiScoreRegistry
  console.log("\n📝 [2/6] Deploying DeFiScoreRegistry...");
  const Registry = await hre.ethers.getContractFactory("DeFiScoreRegistry");
  const registry = await Registry.deploy(verifierAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ DeFiScoreRegistry:", registryAddress);
  deploymentData.contracts.registry = registryAddress;

  // Deploy SecurityGuard
  console.log("\n📝 [3/6] Deploying SecurityGuard...");
  const SecurityGuard = await hre.ethers.getContractFactory("SecurityGuard");
  const securityGuard = await SecurityGuard.deploy();
  await securityGuard.waitForDeployment();
  const securityGuardAddress = await securityGuard.getAddress();
  console.log("✅ SecurityGuard:", securityGuardAddress);
  deploymentData.contracts.securityGuard = securityGuardAddress;

  // Deploy CircuitVersionManager
  console.log("\n📝 [4/6] Deploying CircuitVersionManager...");
  const governors = [deployer.address];
  const requiredApprovals = 1;
  
  const VersionManager = await hre.ethers.getContractFactory("CircuitVersionManager");
  const versionManager = await VersionManager.deploy(
    registryAddress,
    governors,
    requiredApprovals
  );
  await versionManager.waitForDeployment();
  const versionManagerAddress = await versionManager.getAddress();
  console.log("✅ CircuitVersionManager:", versionManagerAddress);
  deploymentData.contracts.versionManager = versionManagerAddress;

  // Deploy LendingEscrow
  console.log("\n📝 [5/6] Deploying LendingEscrow...");
  const LendingEscrow = await hre.ethers.getContractFactory("LendingEscrow");
  const lendingEscrow = await LendingEscrow.deploy();
  await lendingEscrow.waitForDeployment();
  const lendingEscrowAddress = await lendingEscrow.getAddress();
  console.log("✅ LendingEscrow:", lendingEscrowAddress);
  deploymentData.contracts.lendingEscrow = lendingEscrowAddress;

  // Deploy LenderIntegration
  console.log("\n📝 [6/6] Deploying LenderIntegration...");
  const initialThreshold = 500000; // 500 score
  
  const LenderIntegration = await hre.ethers.getContractFactory("LenderIntegration");
  const lenderIntegration = await LenderIntegration.deploy(
    registryAddress,
    initialThreshold
  );
  await lenderIntegration.waitForDeployment();
  const lenderIntegrationAddress = await lenderIntegration.getAddress();
  console.log("✅ LenderIntegration:", lenderIntegrationAddress);
  deploymentData.contracts.lenderIntegration = lenderIntegrationAddress;

  // Configure LendingEscrow
  console.log("\n📝 Configuring LendingEscrow...");
  let tx = await lendingEscrow.setScoreRegistry(registryAddress);
  await tx.wait();
  tx = await lendingEscrow.setDefaultThreshold(initialThreshold);
  await tx.wait();
  console.log("✅ LendingEscrow configured");

  // Save deployment data
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `amoy-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));

  console.log("\n" + "=".repeat(80));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));
  
  console.log("\nContract Addresses:");
  console.log("-------------------");
  console.log("Verifier:              ", verifierAddress);
  console.log("DeFiScoreRegistry:     ", registryAddress);
  console.log("SecurityGuard:         ", securityGuardAddress);
  console.log("CircuitVersionManager: ", versionManagerAddress);
  console.log("LendingEscrow:         ", lendingEscrowAddress);
  console.log("LenderIntegration:     ", lenderIntegrationAddress);
  
  console.log("\n📁 Deployment saved:", filename);
  
  console.log("\n" + "=".repeat(80));
  console.log("ENVIRONMENT VARIABLES");
  console.log("=".repeat(80));
  
  console.log("\n# Add to Backend/.env:");
  console.log(`DEFI_SCORE_REGISTRY_80002=${registryAddress}`);
  console.log(`SECURITY_GUARD_80002=${securityGuardAddress}`);
  console.log(`LENDING_ESCROW_80002=${lendingEscrowAddress}`);
  
  console.log("\n# Add to Frontend/.env:");
  console.log(`VITE_DEFI_SCORE_REGISTRY_80002=${registryAddress}`);
  console.log(`VITE_SECURITY_GUARD_80002=${securityGuardAddress}`);
  console.log(`VITE_LENDING_ESCROW_80002=${lendingEscrowAddress}`);
  
  console.log("\n✅ Ready to test on Polygon Amoy!");
  console.log("\nNext steps:");
  console.log("1. Update .env files with addresses above");
  console.log("2. Connect wallet to Polygon Amoy");
  console.log("3. Test ZK proof generation");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

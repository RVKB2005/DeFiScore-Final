const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYING TO ETHEREUM SEPOLIA TESTNET");
  console.log("=".repeat(80) + "\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.error("❌ Insufficient balance. Get Sepolia ETH from faucet:");
    console.error("   https://sepoliafaucet.com/");
    console.error("   https://www.alchemy.com/faucets/ethereum-sepolia");
    process.exit(1);
  }

  const deployments = {};

  // 1. Deploy Verifier
  console.log("📝 [1/6] Deploying Verifier...");
  const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  deployments.verifier = verifierAddress;
  console.log("✅ Verifier:", verifierAddress);

  // 2. Deploy DeFiScoreRegistry
  console.log("📝 [2/6] Deploying DeFiScoreRegistry...");
  const Registry = await hre.ethers.getContractFactory("DeFiScoreRegistry");
  const registry = await Registry.deploy(verifierAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  deployments.registry = registryAddress;
  console.log("✅ DeFiScoreRegistry:", registryAddress);

  // 3. Deploy SecurityGuard
  console.log("📝 [3/6] Deploying SecurityGuard...");
  const SecurityGuard = await hre.ethers.getContractFactory("SecurityGuard");
  const securityGuard = await SecurityGuard.deploy();
  await securityGuard.waitForDeployment();
  const securityGuardAddress = await securityGuard.getAddress();
  deployments.securityGuard = securityGuardAddress;
  console.log("✅ SecurityGuard:", securityGuardAddress);

  // 4. Deploy CircuitVersionManager
  console.log("📝 [4/6] Deploying CircuitVersionManager...");
  const VersionManager = await hre.ethers.getContractFactory("CircuitVersionManager");
  const versionManager = await VersionManager.deploy(
    registryAddress,
    [deployer.address], // Initial governor
    1 // Required approvals
  );
  await versionManager.waitForDeployment();
  const versionManagerAddress = await versionManager.getAddress();
  deployments.versionManager = versionManagerAddress;
  console.log("✅ CircuitVersionManager:", versionManagerAddress);

  // 5. Deploy LendingEscrow
  console.log("📝 [5/6] Deploying LendingEscrow...");
  const LendingEscrow = await hre.ethers.getContractFactory("LendingEscrow");
  const lendingEscrow = await LendingEscrow.deploy();
  await lendingEscrow.waitForDeployment();
  const lendingEscrowAddress = await lendingEscrow.getAddress();
  deployments.lendingEscrow = lendingEscrowAddress;
  console.log("✅ LendingEscrow:", lendingEscrowAddress);

  // 6. Deploy LenderIntegration
  console.log("📝 [6/6] Deploying LenderIntegration...");
  const LenderIntegration = await hre.ethers.getContractFactory("LenderIntegration");
  const lenderIntegration = await LenderIntegration.deploy(registryAddress);
  await lenderIntegration.waitForDeployment();
  const lenderIntegrationAddress = await lenderIntegration.getAddress();
  deployments.lenderIntegration = lenderIntegrationAddress;
  console.log("✅ LenderIntegration:", lenderIntegrationAddress);

  // Configure LendingEscrow
  console.log("📝 Configuring LendingEscrow...");
  const setRegistryTx = await lendingEscrow.setScoreRegistry(registryAddress);
  await setRegistryTx.wait();
  console.log("✅ LendingEscrow configured\n");

  // Save deployment info
  const deploymentData = {
    network: "sepolia",
    chainId: 11155111,
    timestamp: Date.now(),
    deployer: deployer.address,
    contracts: {
      verifier: verifierAddress,
      registry: registryAddress,
      securityGuard: securityGuardAddress,
      versionManager: versionManagerAddress,
      lendingEscrow: lendingEscrowAddress,
      lenderIntegration: lenderIntegrationAddress
    }
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `sepolia-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentData, null, 2)
  );

  console.log("=".repeat(80));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80) + "\n");
  
  console.log("Contract Addresses:");
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
  console.log("=".repeat(80) + "\n");
  
  console.log("# Add to Backend/.env:");
  console.log(`DEFI_SCORE_REGISTRY_11155111=${registryAddress}`);
  console.log(`SECURITY_GUARD_11155111=${securityGuardAddress}`);
  console.log(`LENDING_ESCROW_11155111=${lendingEscrowAddress}`);
  
  console.log("\n# Add to Frontend/.env:");
  console.log(`VITE_DEFI_SCORE_REGISTRY_11155111=${registryAddress}`);
  console.log(`VITE_SECURITY_GUARD_11155111=${securityGuardAddress}`);
  console.log(`VITE_LENDING_ESCROW_11155111=${lendingEscrowAddress}`);
  
  console.log("\n✅ Ready to test on Ethereum Sepolia!");
  console.log("\nNext steps:");
  console.log("1. Update .env files with addresses above");
  console.log("2. Connect wallet to Ethereum Sepolia");
  console.log("3. Test ZK proof generation\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

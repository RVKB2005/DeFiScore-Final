/**
 * Smart Contract Deployment Script
 * 
 * Deploys DeFiScoreRegistry and LenderIntegration contracts
 * Supports multiple networks (Polygon, Mumbai testnet)
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=".repeat(70));
  console.log("DeFi Credit Score - Contract Deployment");
  console.log("=".repeat(70) + "\n");

  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", network);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Step 1: Deploy Verifier
  console.log("📝 Step 1: Deploying Verifier contract...");
  const Verifier = await hre.ethers.getContractFactory("DeFiScoreVerifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("✓ Verifier deployed to:", verifierAddress);

  // Step 2: Deploy Registry
  console.log("\n📝 Step 2: Deploying DeFiScoreRegistry...");
  const Registry = await hre.ethers.getContractFactory("DeFiScoreRegistry");
  const registry = await Registry.deploy(verifierAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✓ Registry deployed to:", registryAddress);

  // Step 3: Deploy Lender Integration (example)
  console.log("\n📝 Step 3: Deploying LenderIntegration (example)...");
  const initialThreshold = 700000; // 700 score scaled x1000
  const Lender = await hre.ethers.getContractFactory("LenderIntegration");
  const lender = await Lender.deploy(registryAddress, initialThreshold);
  await lender.waitForDeployment();
  const lenderAddress = await lender.getAddress();
  console.log("✓ LenderIntegration deployed to:", lenderAddress);

  // Step 4: Set threshold in registry
  console.log("\n📝 Step 4: Setting lender threshold in registry...");
  const tx = await lender.setThreshold(initialThreshold);
  await tx.wait();
  console.log("✓ Threshold set:", initialThreshold / 1000);

  // Step 5: Save deployment info
  const deployment = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      verifier: verifierAddress,
      registry: registryAddress,
      lenderExample: lenderAddress
    },
    configuration: {
      initialThreshold: initialThreshold,
      proofValidityDuration: "24 hours",
      circuitVersion: 1
    }
  };

  const deploymentPath = path.join(__dirname, `../deployments/${network}.json`);
  const deploymentsDir = path.dirname(deploymentPath);
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n✓ Deployment info saved to:", deploymentPath);

  // Step 6: Verification instructions
  console.log("\n" + "=".repeat(70));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("Network:              ", network);
  console.log("Verifier:             ", verifierAddress);
  console.log("Registry:             ", registryAddress);
  console.log("Lender (Example):     ", lenderAddress);
  console.log("Initial Threshold:    ", initialThreshold / 1000);
  console.log("=".repeat(70));

  console.log("\n📋 Next Steps:");
  console.log("1. Verify contracts on block explorer:");
  console.log(`   npx hardhat verify --network ${network} ${verifierAddress}`);
  console.log(`   npx hardhat verify --network ${network} ${registryAddress} ${verifierAddress}`);
  console.log(`   npx hardhat verify --network ${network} ${lenderAddress} ${registryAddress} ${initialThreshold}`);
  console.log("\n2. Update frontend .env:");
  console.log(`   VITE_REGISTRY_CONTRACT_ADDRESS=${registryAddress}`);
  console.log("\n3. Fund lender contract for testing:");
  console.log(`   Send test ETH to: ${lenderAddress}`);
  console.log("\n4. Test proof submission:");
  console.log("   Use frontend to generate and submit proof\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

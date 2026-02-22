/**
 * Multi-Network ZK Proof System Deployment
 * Deploys complete system to all configured networks
 * 
 * Networks Supported:
 * - Ethereum Mainnet
 * - Polygon
 * - Arbitrum
 * - Optimism
 * - Base
 * - BNB Chain
 * - Avalanche
 * - All testnets
 * 
 * Usage:
 *   node scripts/deploy-all-networks.js
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

// Network configurations
const NETWORKS = {
  // Mainnets
  ethereum: { name: "Ethereum Mainnet", chainId: 1, testnet: false },
  polygon: { name: "Polygon", chainId: 137, testnet: false },
  arbitrum: { name: "Arbitrum One", chainId: 42161, testnet: false },
  optimism: { name: "Optimism", chainId: 10, testnet: false },
  base: { name: "Base", chainId: 8453, testnet: false },
  bnb: { name: "BNB Chain", chainId: 56, testnet: false },
  avalanche: { name: "Avalanche C-Chain", chainId: 43114, testnet: false },
  
  // Testnets
  sepolia: { name: "Sepolia", chainId: 11155111, testnet: true },
  amoy: { name: "Polygon Amoy", chainId: 80002, testnet: true },
  arbitrumSepolia: { name: "Arbitrum Sepolia", chainId: 421614, testnet: true },
  optimismSepolia: { name: "Optimism Sepolia", chainId: 11155420, testnet: true },
  baseSepolia: { name: "Base Sepolia", chainId: 84532, testnet: true },
  bscTestnet: { name: "BSC Testnet", chainId: 97, testnet: true },
  avalancheFuji: { name: "Avalanche Fuji", chainId: 43113, testnet: true }
};

async function deployToNetwork(networkName, networkConfig) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`DEPLOYING TO: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
  console.log("=".repeat(80));

  try {
    // Switch to network
    await hre.changeNetwork(networkName);
    
    const [deployer] = await hre.ethers.getSigners();
    const balance = await deployer.provider.getBalance(deployer.address);
    
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${hre.ethers.formatEther(balance)} ${networkConfig.testnet ? 'Test' : ''} tokens`);
    
    // Check if balance is sufficient
    if (balance === 0n) {
      console.log(`⚠️  SKIPPED: Zero balance on ${networkConfig.name}`);
      return null;
    }

    const deploymentData = {
      network: networkName,
      networkName: networkConfig.name,
      chainId: networkConfig.chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: {}
    };

    // Deploy Verifier
    console.log("\n📝 Deploying Verifier...");
    const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log(`✅ Verifier: ${verifierAddress}`);
    deploymentData.contracts.verifier = verifierAddress;

    // Deploy DeFiScoreRegistry
    console.log("\n📝 Deploying DeFiScoreRegistry...");
    const Registry = await hre.ethers.getContractFactory("DeFiScoreRegistry");
    const registry = await Registry.deploy(verifierAddress);
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log(`✅ DeFiScoreRegistry: ${registryAddress}`);
    deploymentData.contracts.registry = registryAddress;

    // Deploy SecurityGuard
    console.log("\n📝 Deploying SecurityGuard...");
    const SecurityGuard = await hre.ethers.getContractFactory("SecurityGuard");
    const securityGuard = await SecurityGuard.deploy();
    await securityGuard.waitForDeployment();
    const securityGuardAddress = await securityGuard.getAddress();
    console.log(`✅ SecurityGuard: ${securityGuardAddress}`);
    deploymentData.contracts.securityGuard = securityGuardAddress;

    // Deploy CircuitVersionManager
    console.log("\n📝 Deploying CircuitVersionManager...");
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
    console.log(`✅ CircuitVersionManager: ${versionManagerAddress}`);
    deploymentData.contracts.versionManager = versionManagerAddress;

    // Deploy LendingEscrow
    console.log("\n📝 Deploying LendingEscrow...");
    const LendingEscrow = await hre.ethers.getContractFactory("LendingEscrow");
    const lendingEscrow = await LendingEscrow.deploy();
    await lendingEscrow.waitForDeployment();
    const lendingEscrowAddress = await lendingEscrow.getAddress();
    console.log(`✅ LendingEscrow: ${lendingEscrowAddress}`);
    deploymentData.contracts.lendingEscrow = lendingEscrowAddress;

    // Deploy LenderIntegration
    console.log("\n📝 Deploying LenderIntegration...");
    const initialThreshold = 500000; // 500 score
    
    const LenderIntegration = await hre.ethers.getContractFactory("LenderIntegration");
    const lenderIntegration = await LenderIntegration.deploy(
      registryAddress,
      initialThreshold
    );
    await lenderIntegration.waitForDeployment();
    const lenderIntegrationAddress = await lenderIntegration.getAddress();
    console.log(`✅ LenderIntegration: ${lenderIntegrationAddress}`);
    deploymentData.contracts.lenderIntegration = lenderIntegrationAddress;

    // Configure LendingEscrow
    console.log("\n📝 Configuring LendingEscrow...");
    let tx = await lendingEscrow.setScoreRegistry(registryAddress);
    await tx.wait();
    tx = await lendingEscrow.setDefaultThreshold(initialThreshold);
    await tx.wait();
    console.log(`✅ LendingEscrow configured`);

    console.log(`\n✅ ${networkConfig.name} deployment complete!`);
    
    return deploymentData;

  } catch (error) {
    console.error(`\n❌ Deployment failed on ${networkConfig.name}:`, error.message);
    return null;
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("MULTI-NETWORK ZK PROOF SYSTEM DEPLOYMENT");
  console.log("=".repeat(80));
  console.log("\nThis will deploy to ALL configured networks with sufficient balance.");
  console.log("Networks with zero balance will be skipped.\n");

  const allDeployments = {};
  const successful = [];
  const failed = [];
  const skipped = [];

  // Deploy to each network
  for (const [networkName, networkConfig] of Object.entries(NETWORKS)) {
    try {
      const deployment = await deployToNetwork(networkName, networkConfig);
      
      if (deployment) {
        allDeployments[networkName] = deployment;
        successful.push(networkConfig.name);
      } else {
        skipped.push(networkConfig.name);
      }
    } catch (error) {
      console.error(`Error on ${networkConfig.name}:`, error.message);
      failed.push(networkConfig.name);
    }
  }

  // Save all deployments
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `all-networks-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(allDeployments, null, 2));

  // Generate environment variables
  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(80));
  console.log(`\n✅ Successful: ${successful.length}`);
  successful.forEach(name => console.log(`   - ${name}`));
  
  if (skipped.length > 0) {
    console.log(`\n⚠️  Skipped (zero balance): ${skipped.length}`);
    skipped.forEach(name => console.log(`   - ${name}`));
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach(name => console.log(`   - ${name}`));
  }

  console.log(`\n📁 Deployment data saved: ${filename}`);

  // Generate .env updates
  console.log("\n" + "=".repeat(80));
  console.log("ENVIRONMENT VARIABLE UPDATES");
  console.log("=".repeat(80));
  
  console.log("\n# Add to Backend/.env:");
  for (const [networkName, deployment] of Object.entries(allDeployments)) {
    const chainId = deployment.chainId;
    console.log(`DEFI_SCORE_REGISTRY_${chainId}=${deployment.contracts.registry}`);
    console.log(`SECURITY_GUARD_${chainId}=${deployment.contracts.securityGuard}`);
    console.log(`LENDING_ESCROW_${chainId}=${deployment.contracts.lendingEscrow}`);
  }

  console.log("\n# Add to Frontend/.env:");
  for (const [networkName, deployment] of Object.entries(allDeployments)) {
    const chainId = deployment.chainId;
    console.log(`VITE_DEFI_SCORE_REGISTRY_${chainId}=${deployment.contracts.registry}`);
    console.log(`VITE_SECURITY_GUARD_${chainId}=${deployment.contracts.securityGuard}`);
    console.log(`VITE_LENDING_ESCROW_${chainId}=${deployment.contracts.lendingEscrow}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("NEXT STEPS");
  console.log("=".repeat(80));
  console.log("\n1. Update .env files with addresses above");
  console.log("2. System will auto-detect user's wallet network");
  console.log("3. ZK proofs will be generated on the connected network");
  console.log("4. Test on each network before production use");
  console.log("\n✅ Multi-network deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

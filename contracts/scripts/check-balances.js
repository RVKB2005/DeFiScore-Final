/**
 * Check Deployer Balances on All Networks
 * Shows which networks you can deploy to
 */

const hre = require("hardhat");
require('dotenv').config();

const NETWORKS = {
  // Testnets
  sepolia: { name: "Ethereum Sepolia", chainId: 11155111, rpc: "https://eth-sepolia.g.alchemy.com/v2/demo" },
  amoy: { name: "Polygon Amoy", chainId: 80002, rpc: "https://rpc-amoy.polygon.technology" },
  arbitrumSepolia: { name: "Arbitrum Sepolia", chainId: 421614, rpc: "https://sepolia-rollup.arbitrum.io/rpc" },
  optimismSepolia: { name: "Optimism Sepolia", chainId: 11155420, rpc: "https://sepolia.optimism.io" },
  baseSepolia: { name: "Base Sepolia", chainId: 84532, rpc: "https://sepolia.base.org" },
  bscTestnet: { name: "BSC Testnet", chainId: 97, rpc: "https://data-seed-prebsc-1-s1.binance.org:8545" },
  avalancheFuji: { name: "Avalanche Fuji", chainId: 43113, rpc: "https://api.avax-test.network/ext/bc/C/rpc" }
};

async function checkBalance(networkName, networkConfig) {
  try {
    const provider = new hre.ethers.JsonRpcProvider(networkConfig.rpc);
    const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = hre.ethers.formatEther(balance);
    
    const status = balance > 0n ? "✅ READY" : "❌ NEED FUNDS";
    const color = balance > 0n ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    
    console.log(`${color}${status}${reset} ${networkConfig.name.padEnd(25)} ${balanceEth.padStart(15)} tokens`);
    
    return balance > 0n;
  } catch (error) {
    console.log(`⚠️  ERROR  ${networkConfig.name.padEnd(25)} ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("TESTNET BALANCE CHECK");
  console.log("=".repeat(80));
  
  const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`\nDeployer Address: ${wallet.address}\n`);
  
  console.log("Checking balances on all testnets...\n");
  
  let readyCount = 0;
  let needFundsCount = 0;
  
  for (const [networkName, networkConfig] of Object.entries(NETWORKS)) {
    const hasBalance = await checkBalance(networkName, networkConfig);
    if (hasBalance) {
      readyCount++;
    } else {
      needFundsCount++;
    }
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Ready to deploy: ${readyCount} networks`);
  console.log(`❌ Need funds: ${needFundsCount} networks`);
  
  if (readyCount > 0) {
    console.log(`\n✅ You can deploy to ${readyCount} network(s)!`);
    console.log("\nRun: node scripts/deploy-all-networks.js");
  } else {
    console.log("\n❌ No testnet funds found!");
    console.log("\nGet FREE testnet tokens from faucets:");
    console.log("  - Polygon Amoy: https://faucet.polygon.technology/");
    console.log("  - Base Sepolia: https://www.alchemy.com/faucets/base-sepolia");
    console.log("  - Arbitrum Sepolia: https://www.alchemy.com/faucets/arbitrum-sepolia");
    console.log("  - Optimism Sepolia: https://www.alchemy.com/faucets/optimism-sepolia");
    console.log("  - Ethereum Sepolia: https://www.alchemy.com/faucets/ethereum-sepolia");
    console.log("  - BSC Testnet: https://testnet.bnbchain.org/faucet-smart");
    console.log("  - Avalanche Fuji: https://core.app/tools/testnet-faucet/");
  }
  
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

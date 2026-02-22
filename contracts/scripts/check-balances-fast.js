/**
 * Fast Balance Check with Timeout
 */

const hre = require("hardhat");
require('dotenv').config();

const NETWORKS = {
  amoy: { name: "Polygon Amoy", rpc: "https://rpc-amoy.polygon.technology" },
  baseSepolia: { name: "Base Sepolia", rpc: "https://sepolia.base.org" },
  arbitrumSepolia: { name: "Arbitrum Sepolia", rpc: "https://sepolia-rollup.arbitrum.io/rpc" },
  optimismSepolia: { name: "Optimism Sepolia", rpc: "https://sepolia.optimism.io" },
  sepolia: { name: "Ethereum Sepolia", rpc: "https://rpc.sepolia.org" },
  bscTestnet: { name: "BSC Testnet", rpc: "https://data-seed-prebsc-1-s1.binance.org:8545" },
  avalancheFuji: { name: "Avalanche Fuji", rpc: "https://api.avax-test.network/ext/bc/C/rpc" }
};

async function checkBalanceWithTimeout(networkName, networkConfig, timeoutMs = 5000) {
  return Promise.race([
    checkBalance(networkName, networkConfig),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}

async function checkBalance(networkName, networkConfig) {
  const provider = new hre.ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  const balanceEth = hre.ethers.formatEther(balance);
  
  return {
    network: networkConfig.name,
    balance: balanceEth,
    hasBalance: balance > 0n,
    raw: balance
  };
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("TESTNET BALANCE CHECK (FAST)");
  console.log("=".repeat(80));
  
  const wallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
  console.log(`\nDeployer: ${wallet.address}\n`);
  console.log("Checking balances (5s timeout per network)...\n");
  
  const results = [];
  
  for (const [networkName, networkConfig] of Object.entries(NETWORKS)) {
    try {
      const result = await checkBalanceWithTimeout(networkName, networkConfig);
      
      const status = result.hasBalance ? "✅ READY" : "❌ EMPTY";
      const color = result.hasBalance ? "\x1b[32m" : "\x1b[31m";
      const reset = "\x1b[0m";
      
      console.log(`${color}${status}${reset} ${result.network.padEnd(25)} ${result.balance.padStart(15)} tokens`);
      results.push(result);
    } catch (error) {
      console.log(`⚠️  SKIP   ${networkConfig.name.padEnd(25)} (${error.message})`);
    }
  }
  
  const readyCount = results.filter(r => r.hasBalance).length;
  const emptyCount = results.filter(r => !r.hasBalance).length;
  
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Ready: ${readyCount} networks`);
  console.log(`❌ Empty: ${emptyCount} networks`);
  
  if (readyCount > 0) {
    console.log(`\n✅ You can deploy to ${readyCount} network(s)!`);
    console.log("\nNext step:");
    console.log("  node scripts/deploy-all-networks.js");
  } else {
    console.log("\n❌ No funds found on any testnet!");
    console.log("\nGet FREE testnet tokens:");
    console.log("  Polygon Amoy:    https://faucet.polygon.technology/");
    console.log("  Base Sepolia:    https://www.alchemy.com/faucets/base-sepolia");
    console.log("  Arbitrum Sepolia: https://www.alchemy.com/faucets/arbitrum-sepolia");
    console.log("\nPaste your address: " + wallet.address);
  }
  
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

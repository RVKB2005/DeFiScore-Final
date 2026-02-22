const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying LendingEscrow contract...");

  // Get the contract factory
  const LendingEscrow = await hre.ethers.getContractFactory("LendingEscrow");
  
  // Deploy the contract
  const lendingEscrow = await LendingEscrow.deploy();
  await lendingEscrow.deployed();

  console.log("LendingEscrow deployed to:", lendingEscrow.address);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: lendingEscrow.address,
    deployer: (await hre.ethers.getSigners())[0].address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  // Save to file
  const deploymentPath = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentPath, `lending-escrow-${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to:", path.join(deploymentPath, `lending-escrow-${hre.network.name}.json`));

  // Save ABI
  const artifact = await hre.artifacts.readArtifact("LendingEscrow");
  fs.writeFileSync(
    path.join(__dirname, "../artifacts/LendingEscrow.json"),
    JSON.stringify({
      contractName: "LendingEscrow",
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      address: lendingEscrow.address,
      network: hre.network.name
    }, null, 2)
  );

  console.log("Contract ABI saved");

  // Verify on Etherscan (if not localhost)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await lendingEscrow.deployTransaction.wait(6);
    
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: lendingEscrow.address,
        constructorArguments: [],
      });
      console.log("Contract verified on Etherscan");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  console.log("\n=== Deployment Summary ===");
  console.log("Contract Address:", lendingEscrow.address);
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deploymentInfo.deployer);
  console.log("Block Number:", deploymentInfo.blockNumber);
  console.log("\nAdd this to your .env file:");
  console.log(`LENDING_ESCROW_ADDRESS=${lendingEscrow.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { ethers } = hre;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔗 InklessAudit — Sepolia Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const [deployer] = await ethers.getSigners();
  console.log(`\n📬 Deployer address : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Deployer balance : ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.01")) {
    throw new Error(
      "Insufficient balance. Get Sepolia ETH from https://sepoliafaucet.com"
    );
  }

  // Deploy
  console.log("\n🚀 Deploying InklessAudit...");
  const InklessAudit = await ethers.getContractFactory("InklessAudit");
  const contract = await InklessAudit.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log(`\n✅ Contract deployed!`);
  console.log(`   Address  : ${contractAddress}`);
  console.log(`   Tx Hash  : ${deployTx.hash}`);
  console.log(`   Network  : Sepolia (chainId: 11155111)`);
  console.log(
    `   Explorer : https://sepolia.etherscan.io/address/${contractAddress}`
  );

  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: 11155111,
    contractName: "InklessAudit",
    contractAddress,
    deployerAddress: deployer.address,
    txHash: deployTx.hash,
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://sepolia.etherscan.io/address/${contractAddress}`,
  };

  const deployDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });

  const outPath = path.join(deployDir, "sepolia.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: deployments/sepolia.json`);

  // Also write ABI for frontend
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/InklessAudit.sol/InklessAudit.json"
  );
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiPath = path.join(deployDir, "InklessAudit.abi.json");
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`📄 ABI saved to        : deployments/InklessAudit.abi.json`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Next steps:");
  console.log(
    "  1. Verify contract: npx hardhat verify --network sepolia " +
      contractAddress
  );
  console.log(
    "  2. Copy contractAddress to your frontend .env.local:"
  );
  console.log(
    `     NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`
  );
  console.log(
    "     NEXT_PUBLIC_CHAIN_ID=11155111"
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});

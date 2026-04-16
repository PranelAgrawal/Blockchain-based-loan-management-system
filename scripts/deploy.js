const { ethers } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const initialLiquidity = ethers.parseEther(process.env.INITIAL_LIQUIDITY_ETH || "100");

  console.log("Deploying loan management contracts");
  console.log(`Deployer: ${deployer.address}`);

  const BlockManager = await ethers.getContractFactory("BlockManager");
  const blockManager = await BlockManager.deploy();
  await blockManager.waitForDeployment();

  const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
  const kycRegistry = await KYCRegistry.deploy();
  await kycRegistry.waitForDeployment();

  const CreditScore = await ethers.getContractFactory("CreditScore");
  const creditScore = await CreditScore.deploy();
  await creditScore.waitForDeployment();

  const CollateralManager = await ethers.getContractFactory("CollateralManager");
  const collateralManager = await CollateralManager.deploy();
  await collateralManager.waitForDeployment();

  const LoanManager = await ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManager.deploy(
    await kycRegistry.getAddress(),
    await creditScore.getAddress(),
    await collateralManager.getAddress(),
    await blockManager.getAddress()
  );
  await loanManager.waitForDeployment();

  await (await collateralManager.setAdmin(await loanManager.getAddress())).wait();
  await (await creditScore.setLoanManager(await loanManager.getAddress())).wait();
  await (await loanManager.connect(deployer).depositLiquidity({ value: initialLiquidity })).wait();

  const deployment = {
    network: "localhost",
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    blockManager: await blockManager.getAddress(),
    kycRegistry: await kycRegistry.getAddress(),
    creditScore: await creditScore.getAddress(),
    collateralManager: await collateralManager.getAddress(),
    loanManager: await loanManager.getAddress(),
    initialLiquidityEth: ethers.formatEther(initialLiquidity),
    deployedAt: new Date().toISOString(),
  };
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, "localhost.json"),
    `${JSON.stringify(deployment, null, 2)}\n`
  );

  console.log("");
  console.log("Contracts deployed and configured");
  console.log(`BLOCK_MANAGER_ADDRESS=${deployment.blockManager}`);
  console.log(`KYC_REGISTRY_ADDRESS=${deployment.kycRegistry}`);
  console.log(`CREDIT_SCORE_ADDRESS=${deployment.creditScore}`);
  console.log(`COLLATERAL_MANAGER_ADDRESS=${deployment.collateralManager}`);
  console.log(`LOAN_MANAGER_ADDRESS=${deployment.loanManager}`);
  console.log(`INITIAL_LIQUIDITY_ETH=${deployment.initialLiquidityEth}`);
  console.log("Saved deployment to deployments/localhost.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

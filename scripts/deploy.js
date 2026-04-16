const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

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

  console.log("");
  console.log("Contracts deployed and configured");
  console.log(`BLOCK_MANAGER_ADDRESS=${await blockManager.getAddress()}`);
  console.log(`KYC_REGISTRY_ADDRESS=${await kycRegistry.getAddress()}`);
  console.log(`CREDIT_SCORE_ADDRESS=${await creditScore.getAddress()}`);
  console.log(`COLLATERAL_MANAGER_ADDRESS=${await collateralManager.getAddress()}`);
  console.log(`LOAN_MANAGER_ADDRESS=${await loanManager.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

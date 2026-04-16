const { ethers } = require("hardhat");

// Replace these placeholders with your deployed contract addresses, or set the
// matching environment variables before running the script.
const CONTRACT_ADDRESSES = {
  loanManager:
    process.env.LOAN_MANAGER_ADDRESS || "0x0000000000000000000000000000000000000000",
  collateralManager:
    process.env.COLLATERAL_MANAGER_ADDRESS || "0x0000000000000000000000000000000000000000",
  creditScore:
    process.env.CREDIT_SCORE_ADDRESS || "0x0000000000000000000000000000000000000000",
  kycRegistry:
    process.env.KYC_REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000",
};

const LOAN_TYPE = {
  Personal: 0,
  Home: 1,
  Business: 2,
};

let transactionCount = 0;

function requireConfiguredAddress(name, address) {
  if (!ethers.isAddress(address) || address === ethers.ZeroAddress) {
    throw new Error(
      `${name} is not configured. Replace it in scripts/simulate.js or set the matching environment variable.`
    );
  }
}

async function waitForTx(label, tx) {
  const receipt = await tx.wait();
  const hash = receipt.hash ?? receipt.transactionHash ?? tx.hash;
  transactionCount += 1;
  console.log(`[tx ${transactionCount}] ${label}`);
  console.log(`        hash: ${hash}`);
  return receipt;
}

async function getLatestLoanId(loanManager) {
  return await loanManager.loanCounter();
}

async function getTotalRepayment(loanManager, loanId) {
  const loan = await loanManager.getLoan(loanId);
  return loan.totalRepayment ?? loan[10];
}

async function runBorrowerLoanFlow({
  borrower,
  borrowerName,
  loanManager,
  collateralManager,
  loanType,
  loanAmount,
  durationSeconds,
  collateralAmount,
}) {
  await waitForTx(
    `${borrowerName} requested loan`,
    await loanManager.connect(borrower).requestLoan(loanType, loanAmount, durationSeconds)
  );

  const loanId = await getLatestLoanId(loanManager);
  console.log(`        ${borrowerName} loan id: ${loanId.toString()}`);

  if (collateralAmount > 0n) {
    await waitForTx(
      `${borrowerName} deposited collateral`,
      await collateralManager
        .connect(borrower)
        .depositCollateral(loanId, { value: collateralAmount })
    );
  }

  await waitForTx(
    `${borrowerName} loan approved by owner`,
    await loanManager.approveLoan(loanId)
  );

  const totalRepayment = await getTotalRepayment(loanManager, loanId);

  await waitForTx(
    `${borrowerName} repaid loan on time`,
    await loanManager.connect(borrower).repayLoan(loanId, { value: totalRepayment })
  );

  console.log(
    `        ${borrowerName} repayment amount: ${ethers.formatEther(totalRepayment)} ETH`
  );
}

async function main() {
  for (const [name, address] of Object.entries(CONTRACT_ADDRESSES)) {
    requireConfiguredAddress(name, address);
  }

  const [deployer, user1, user2] = await ethers.getSigners();

  console.log("Starting loan management simulation");
  console.log(`Owner/Admin: ${deployer.address}`);
  console.log(`User1:       ${user1.address}`);
  console.log(`User2:       ${user2.address}`);
  console.log("");

  const loanManager = await ethers.getContractAt(
    "LoanManager",
    CONTRACT_ADDRESSES.loanManager,
    deployer
  );
  const collateralManager = await ethers.getContractAt(
    "CollateralManager",
    CONTRACT_ADDRESSES.collateralManager,
    deployer
  );
  const creditScore = await ethers.getContractAt(
    "CreditScore",
    CONTRACT_ADDRESSES.creditScore,
    deployer
  );
  const kycRegistry = await ethers.getContractAt(
    "KYCRegistry",
    CONTRACT_ADDRESSES.kycRegistry,
    deployer
  );

  // 1-2: Initial setup transactions.
  await waitForTx(
    "Set LoanManager address in CreditScore",
    await creditScore.setLoanManager(CONTRACT_ADDRESSES.loanManager)
  );

  await waitForTx(
    "Set LoanManager as CollateralManager admin",
    await collateralManager.setAdmin(CONTRACT_ADDRESSES.loanManager)
  );

  // KYCRegistry admin is assumed to be the deployer, because KYCRegistry sets
  // admin = msg.sender in its constructor and does not expose an admin setter.

  const user1KycHash = ethers.keccak256(ethers.toUtf8Bytes("dummy-kyc-user-1"));
  const user2KycHash = ethers.keccak256(ethers.toUtf8Bytes("dummy-kyc-user-2"));

  // 3-4: KYC verification transactions.
  await waitForTx(
    "KYC verified for User1",
    await kycRegistry.verifyUser(user1.address, user1KycHash)
  );

  await waitForTx(
    "KYC verified for User2",
    await kycRegistry.verifyUser(user2.address, user2KycHash)
  );

  // 5-6: Credit score setup transactions.
  await waitForTx(
    "Credit score set for User1",
    await creditScore.updateScore(user1.address, 720)
  );

  await waitForTx(
    "Credit score set for User2",
    await creditScore.updateScore(user2.address, 680)
  );

  // 7: Owner deposits enough liquidity to fund both loans.
  await waitForTx(
    "Owner deposited liquidity into LoanManager",
    await loanManager.depositLiquidity({ value: ethers.parseEther("20") })
  );

  // 8-11: User1 home loan flow. Home loans require 50% collateral by default.
  await runBorrowerLoanFlow({
    borrower: user1,
    borrowerName: "User1",
    loanManager,
    collateralManager,
    loanType: LOAN_TYPE.Home,
    loanAmount: ethers.parseEther("5"),
    durationSeconds: 180,
    collateralAmount: ethers.parseEther("2.5"),
  });

  // 12-15: User2 business loan flow. Business loans require 30% collateral by default.
  await runBorrowerLoanFlow({
    borrower: user2,
    borrowerName: "User2",
    loanManager,
    collateralManager,
    loanType: LOAN_TYPE.Business,
    loanAmount: ethers.parseEther("3"),
    durationSeconds: 120,
    collateralAmount: ethers.parseEther("0.9"),
  });

  console.log("");
  console.log(`Simulation complete. Total transactions: ${transactionCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

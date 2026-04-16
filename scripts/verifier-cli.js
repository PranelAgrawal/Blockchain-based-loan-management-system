const { ethers } = require("hardhat");
const {
  createRl,
  getContracts,
  getPendingKycRequests,
  loadDeployment,
  shortAddress,
  updateKycStatus,
  waitForTx,
} = require("./lib/workflow-utils");

const LIQUIDITY_BUFFER_MULTIPLIER = 2n;

async function getAdminSigner() {
  const deployment = loadDeployment();
  const signers = await ethers.getSigners();
  const admin = signers.find(
    (signer) => signer.address.toLowerCase() === deployment.deployer.toLowerCase()
  );

  if (!admin) {
    throw new Error(`Admin/deployer account ${deployment.deployer} is not available in this Hardhat node.`);
  }

  return admin;
}

async function verifyPendingKyc({ rl, verifier, contracts }) {
  const pending = getPendingKycRequests();
  if (pending.length === 0) {
    console.log("No pending KYC requests.");
    return;
  }

  console.log("Pending KYC requests:");
  pending.forEach((record, index) => {
    console.log(`${index + 1}. ${record.address} Aadhaar=${record.adhaarNumber}`);
  });

  const answer = await rl.question("Choose request number to verify: ");
  const index = Number(answer) - 1;
  const record = pending[index];
  if (!record) {
    console.log("Invalid request.");
    return;
  }

  const scoreAnswer = await rl.question("Initial credit score [700]: ");
  const score = scoreAnswer.trim() === "" ? 700 : Number(scoreAnswer);
  if (!Number.isInteger(score) || score < 300 || score > 850) {
    console.log("Credit score must be between 300 and 850.");
    return;
  }

  const kycReceipt = await waitForTx(
    `KYC verified for ${shortAddress(record.address)}`,
    await contracts.kycRegistry.connect(verifier).verifyUser(record.address, record.documentHash)
  );
  await waitForTx(
    `Credit score set for ${shortAddress(record.address)}`,
    await contracts.creditScore.connect(verifier).updateScore(record.address, score)
  );

  updateKycStatus({
    address: record.address,
    status: "verified",
    txHash: kycReceipt.hash,
    creditScore: score,
  });
  console.log("MongoDB KYC status updated to verified.");
}

async function approveLoan({ rl, verifier, contracts }) {
  const loanCounter = await contracts.loanManager.loanCounter();
  const pendingLoans = [];
  for (let i = 1n; i <= loanCounter; i++) {
    const loan = await contracts.loanManager.getLoan(i);
    if (loan.borrower !== ethers.ZeroAddress && !loan.approved && !loan.repaid && !loan.defaulted) {
      pendingLoans.push({ id: i, loan });
    }
  }

  if (pendingLoans.length === 0) {
    console.log("No pending loans to approve.");
    return;
  }

  console.log("Pending loans:");
  for (const item of pendingLoans) {
    console.log(
      `${item.id}. borrower=${item.loan.borrower} amount=${ethers.formatEther(item.loan.amount)} ETH duration=${item.loan.duration} seconds`
    );
  }

  const answer = await rl.question("Enter loan id to approve: ");
  const loanId = BigInt(answer);
  const selected = pendingLoans.find((item) => item.id === loanId);
  if (!selected) {
    console.log("Invalid loan id.");
    return;
  }

  const currentLiquidity = await contracts.loanManager.totalLiquidity();
  const targetLiquidity = selected.loan.amount * LIQUIDITY_BUFFER_MULTIPLIER;
  if (currentLiquidity < targetLiquidity) {
    const topUp = targetLiquidity - currentLiquidity;
    await waitForTx(
      `Liquidity topped up by ${ethers.formatEther(topUp)} ETH before approving loan ${loanId}`,
      await contracts.loanManager.connect(verifier).depositLiquidity({ value: topUp })
    );
  }

  console.log(
    `Approving loan ${loanId} with pool liquidity ${ethers.formatEther(await contracts.loanManager.totalLiquidity())} ETH`
  );

  await waitForTx(
    `Loan ${loanId} approved`,
    await contracts.loanManager.connect(verifier).approveLoan(loanId)
  );
}

async function finalizePendingBlock({ contracts }) {
  const pending = await contracts.blockManager.getPendingTransactions();
  if (pending === 0n) {
    console.log("No pending loan-chain transactions.");
    return;
  }

  await waitForTx(
    `Finalized block with ${pending.toString()} pending transactions`,
    await contracts.blockManager.createBlock()
  );
}

async function markOverdueLoanDefaulted({ rl, contracts }) {
  const loanCounter = await contracts.loanManager.loanCounter();
  const overdueLoans = [];
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = BigInt(latestBlock.timestamp);

  for (let i = 1n; i <= loanCounter; i++) {
    const loan = await contracts.loanManager.getLoan(i);
    if (
      loan.borrower !== ethers.ZeroAddress &&
      loan.approved &&
      !loan.repaid &&
      !loan.defaulted &&
      now > loan.dueDate
    ) {
      overdueLoans.push({ id: i, loan, secondsOverdue: now - loan.dueDate });
    }
  }

  if (overdueLoans.length === 0) {
    console.log("No overdue loans available to mark as defaulted.");
    return;
  }

  console.log("Overdue loans:");
  for (const item of overdueLoans) {
    console.log(
      `${item.id}. borrower=${item.loan.borrower} amount=${ethers.formatEther(item.loan.amount)} ETH overdue=${item.secondsOverdue.toString()} seconds`
    );
  }

  const answer = await rl.question("Enter loan id to mark as defaulted: ");
  const loanId = BigInt(answer);
  const selected = overdueLoans.find((item) => item.id === loanId);
  if (!selected) {
    console.log("Invalid loan id.");
    return;
  }

  await waitForTx(
    `Loan ${loanId} marked as defaulted`,
    await contracts.loanManager.markLoanDefaulted(loanId)
  );
}

async function main() {
  const rl = createRl();
  try {
    const verifier = await getAdminSigner();
    const contracts = await getContracts(verifier);
    const kycAdmin = await contracts.kycRegistry.admin();
    const loanOwner = await contracts.loanManager.owner();

    if (verifier.address.toLowerCase() !== kycAdmin.toLowerCase()) {
      throw new Error(`Selected verifier ${verifier.address} is not KYC admin ${kycAdmin}. Redeploy contracts with npm run deploy.`);
    }

    if (verifier.address.toLowerCase() !== loanOwner.toLowerCase()) {
      throw new Error(`Selected verifier ${verifier.address} is not LoanManager owner ${loanOwner}. Redeploy contracts with npm run deploy.`);
    }

    console.log(`Using KYC verifier/admin account: ${verifier.address}`);

    while (true) {
      console.log("");
      console.log("KYC Verifier / Admin Terminal");
      console.log("1. Verify pending KYC");
      console.log("2. Approve pending loan");
      console.log("3. Mark overdue loan as defaulted");
      console.log("4. Finalize pending loan block");
      console.log("5. Exit");
      const choice = await rl.question("Choose option: ");

      if (choice === "1") await verifyPendingKyc({ rl, verifier, contracts });
      else if (choice === "2") await approveLoan({ rl, verifier, contracts });
      else if (choice === "3") await markOverdueLoanDefaulted({ rl, contracts });
      else if (choice === "4") await finalizePendingBlock({ contracts });
      else if (choice === "5") break;
      else console.log("Invalid option.");
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

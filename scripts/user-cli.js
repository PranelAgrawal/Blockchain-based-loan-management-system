const { ethers } = require("hardhat");
const {
  MIN_CREDIT_SCORE,
  askForLoanRequest,
  chooseSigner,
  createRl,
  getAadhaarDocumentHash,
  getContracts,
  getKycRequest,
  isValidAadhaar,
  normalizeAadhaar,
  saveKycRequest,
  shortAddress,
  waitForTx,
} = require("./lib/workflow-utils");

async function submitKycRequest({ rl, signer }) {
  while (true) {
    const answer = await rl.question(`Enter Aadhaar number for ${shortAddress(signer.address)}: `);
    const aadhaarNumber = normalizeAadhaar(answer);
    if (!isValidAadhaar(aadhaarNumber)) {
      console.log("Invalid Aadhaar. Enter a 12-digit Aadhaar that passes checksum validation.");
      continue;
    }

    const documentHash = getAadhaarDocumentHash(signer.address, aadhaarNumber);
    saveKycRequest({ address: signer.address, aadhaarNumber, documentHash });
    console.log("KYC request sent to verifier.");
    console.log(`MongoDB users record: { address: "${signer.address.toLowerCase()}", adhaarNumber: "${aadhaarNumber}" }`);
    console.log("Ask the KYC verifier to run: npm run verifier");
    return;
  }
}

async function requestLoan({ rl, signer, contracts }) {
  const { kycRegistry, creditScore, collateralManager, loanManager } = contracts;
  const verified = await kycRegistry.isVerified(signer.address);
  if (!verified) {
    console.log("KYC is not verified yet. Submit Aadhaar first, then ask verifier to approve KYC.");
    return;
  }

  const score = await creditScore.getScore(signer.address);
  console.log(`Credit score: ${score.toString()}`);
  if (score < MIN_CREDIT_SCORE) {
    console.log(`Loan rejected: credit score must be at least ${MIN_CREDIT_SCORE.toString()}.`);
    return;
  }

  const blockedByOverdue = await loanManager.hasOverdueOrDefaultedLoan(signer.address);
  if (blockedByOverdue) {
    console.log("New loan blocked: this account already has an overdue or defaulted loan.");
    console.log("Repay the overdue loan, or ask verifier/admin to mark it as defaulted for the demo.");
    return;
  }

  const loanRequest = await askForLoanRequest(rl, "current user", loanManager);

  await waitForTx(
    "Loan requested",
    await loanManager
      .connect(signer)
      .requestLoan(loanRequest.loanType, loanRequest.amount, loanRequest.durationSeconds)
  );

  const loanId = await loanManager.loanCounter();
  if (loanRequest.requiredCollateral > 0n) {
    console.log(`Collateral required: ${ethers.formatEther(loanRequest.requiredCollateral)} ETH`);
    await waitForTx(
      `Collateral deposited for loan ${loanId}`,
      await collateralManager
        .connect(signer)
        .depositCollateral(loanId, { value: loanRequest.requiredCollateral })
    );
  }

  console.log(`Loan ${loanId.toString()} is ready for verifier/admin approval.`);
  console.log("Ask verifier/admin to approve it from npm run verifier.");
}

async function repayLoan({ rl, signer, contracts }) {
  const { loanManager } = contracts;
  const loanId = await rl.question("Enter loan id to repay: ");
  const loan = await loanManager.getLoan(loanId);
  if (loan.borrower.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("This loan does not belong to the selected account.");
    return;
  }
  if (!loan.approved) {
    console.log("Loan is not approved yet.");
    return;
  }
  if (loan.repaid) {
    console.log("Loan is already repaid.");
    return;
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const totalRepayment = loan.totalRepayment;
  if (now > loan.dueDate) {
    await waitForTx(
      `Late repayment sent for loan ${loanId}`,
      await loanManager.connect(signer).repayLoanLate(loanId, { value: totalRepayment })
    );
  } else {
    await waitForTx(
      `On-time repayment sent for loan ${loanId}`,
      await loanManager.connect(signer).repayLoan(loanId, { value: totalRepayment })
    );
  }

  console.log("Credit score updates automatically in the smart contract after repayment.");
}

async function showStatus({ signer, contracts }) {
  const { kycRegistry, creditScore, loanManager } = contracts;
  const mongoRecord = getKycRequest(signer.address);
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = BigInt(latestBlock.timestamp);
  console.log(`Wallet: ${signer.address}`);
  console.log(`Mongo KYC status: ${mongoRecord?.kycStatus || "not submitted"}`);
  console.log(`On-chain KYC verified: ${await kycRegistry.isVerified(signer.address)}`);
  console.log(`Credit score: ${(await creditScore.getScore(signer.address)).toString()}`);

  const loanCounter = await loanManager.loanCounter();
  for (let i = 1n; i <= loanCounter; i++) {
    const loan = await loanManager.getLoan(i);
    if (loan.borrower.toLowerCase() === signer.address.toLowerCase()) {
      const secondsUntilDue = loan.dueDate > now ? loan.dueDate - now : 0n;
      const secondsOverdue = now > loan.dueDate ? now - loan.dueDate : 0n;
      console.log(
        `Loan ${i}: principal=${ethers.formatEther(loan.amount)} ETH totalRepayment=${ethers.formatEther(loan.totalRepayment)} ETH duration=${loan.duration} sec approved=${loan.approved} repaid=${loan.repaid} defaulted=${loan.defaulted}`
      );
      if (!loan.repaid) {
        if (secondsOverdue > 0n) {
          console.log(`        overdue by ${secondsOverdue.toString()} seconds`);
        } else {
          console.log(`        due in ${secondsUntilDue.toString()} seconds`);
        }
      }
    }
  }
}

async function main() {
  const rl = createRl();
  try {
    const defaultIndex = Number(process.env.USER_INDEX || 1);
    const { signer } = await chooseSigner(rl, defaultIndex);
    const contracts = await getContracts(signer);

    while (true) {
      console.log("");
      console.log("User Terminal");
      console.log("1. Submit Aadhaar KYC request");
      console.log("2. Request loan");
      console.log("3. Repay loan");
      console.log("4. Show status");
      console.log("5. Exit");
      const choice = await rl.question("Choose option: ");

      if (choice === "1") await submitKycRequest({ rl, signer });
      else if (choice === "2") await requestLoan({ rl, signer, contracts });
      else if (choice === "3") await repayLoan({ rl, signer, contracts });
      else if (choice === "4") await showStatus({ signer, contracts });
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

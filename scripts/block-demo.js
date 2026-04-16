const { ethers } = require("hardhat");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { spawnSync } = require("node:child_process");

const LOAN_TYPE = {
  Personal: 0,
  Home: 1,
  Business: 2,
};

const LOAN_EVENTS_PER_USER = Number(process.env.LOAN_EVENTS_PER_USER || 30);
const USERS_TO_SIMULATE = Number(process.env.USERS_TO_SIMULATE || 2);
const MONGODB_DB = process.env.MONGODB_DB || "blockchainLoan";
const AADHAAR_COLLECTION = process.env.AADHAAR_COLLECTION || "aadhaarUsers";

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash) {
  return `${hash.slice(0, 18)}...${hash.slice(-8)}`;
}

function formatBlockTime(timestamp) {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

function normalizeAadhaar(aadhaarNumber) {
  return aadhaarNumber.replace(/[\s-]/g, "");
}

function isValidAadhaar(aadhaarNumber) {
  const normalized = normalizeAadhaar(aadhaarNumber);
  if (!/^[2-9][0-9]{11}$/.test(normalized)) {
    return false;
  }

  let checksum = 0;
  const reversedDigits = normalized.split("").reverse().map(Number);

  for (let i = 0; i < reversedDigits.length; i++) {
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[i % 8][reversedDigits[i]]];
  }

  return checksum === 0;
}

function getAadhaarDocumentHash(walletAddress, aadhaarNumber) {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["address", "string"],
      [walletAddress, normalizeAadhaar(aadhaarNumber)]
    )
  );
}

async function askForAadhaar(rl, userLabel, walletAddress) {
  const envKey = `AADHAAR_${userLabel.toUpperCase()}`;
  const configuredAadhaar = process.env[envKey];

  if (configuredAadhaar) {
    if (!isValidAadhaar(configuredAadhaar)) {
      throw new Error(`${envKey} is not a valid Aadhaar number.`);
    }
    console.log(`${userLabel} Aadhaar loaded from ${envKey}`);
    return normalizeAadhaar(configuredAadhaar);
  }

  while (true) {
    const answer = await rl.question(
      `Enter Aadhaar number for ${userLabel} (${shortAddress(walletAddress)}): `
    );
    const normalized = normalizeAadhaar(answer);

    if (isValidAadhaar(normalized)) {
      return normalized;
    }

    console.log("Invalid Aadhaar number. Enter a 12-digit Aadhaar that passes checksum validation.");
  }
}

function storeAadhaarInMongo(walletAddress, aadhaarNumber) {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in .env. Add your MongoDB Compass connection URL first.");
  }

  const mongoScript = `
    const targetDb = db.getSiblingDB(${JSON.stringify(MONGODB_DB)});
    targetDb.getCollection(${JSON.stringify(AADHAAR_COLLECTION)}).updateOne(
      { address: ${JSON.stringify(walletAddress.toLowerCase())} },
      { $set: { address: ${JSON.stringify(walletAddress.toLowerCase())}, adhaarNumber: ${JSON.stringify(aadhaarNumber)} } },
      { upsert: true }
    );
  `;

  const result = spawnSync("mongosh", [process.env.MONGODB_URI, "--quiet", "--eval", mongoScript], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`MongoDB insert failed: ${result.stderr || result.stdout}`);
  }
}

async function waitForTx(label, tx, blockManager) {
  const receipt = await tx.wait();
  console.log(`live tx | ${label}`);
  console.log(`        | hash ${receipt.hash}`);
  console.log(`        | hardhat block ${receipt.blockNumber}`);

  for (const log of receipt.logs) {
    try {
      const parsed = blockManager.interface.parseLog(log);
      if (parsed.name === "TransactionAdded") {
        console.log(
          `        | loan-chain tx #${parsed.args.txId} ${parsed.args.txType} ${ethers.formatEther(parsed.args.amount)} ETH user ${shortAddress(parsed.args.user)}`
        );
      }

      if (parsed.name === "BlockCreated") {
        console.log(
          `        | BLOCK CREATED #${parsed.args.blockNumber} hash ${shortHash(parsed.args.blockHash)} txs ${parsed.args.txCount}`
        );
      }
    } catch (_) {
      // This receipt also contains logs from other contracts.
    }
  }

  return receipt;
}

async function deploySystem() {
  const [owner, ...users] = await ethers.getSigners();

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

  return {
    owner,
    users,
    blockManager,
    kycRegistry,
    creditScore,
    collateralManager,
    loanManager,
  };
}

async function prepareUsers({ owner, users, kycRegistry, creditScore, loanManager, blockManager }) {
  const selectedUsers = users.slice(0, USERS_TO_SIMULATE);
  const rl = readline.createInterface({ input, output });

  try {
    for (const [index, user] of selectedUsers.entries()) {
      const userLabel = `User${index + 1}`;
      const aadhaarNumber = await askForAadhaar(rl, userLabel, user.address);
      const docHash = getAadhaarDocumentHash(user.address, aadhaarNumber);

      storeAadhaarInMongo(user.address, aadhaarNumber);
      console.log(
        `MongoDB saved ${userLabel}: { address, adhaarNumber } in ${MONGODB_DB}.${AADHAAR_COLLECTION}`
      );

      await waitForTx(
        `verify KYC for ${userLabel}`,
        await kycRegistry.connect(owner).verifyUser(user.address, docHash),
        blockManager
      );
      await waitForTx(
        `set credit score for ${userLabel}`,
        await creditScore.connect(owner).updateScore(user.address, 760 - index * 20),
        blockManager
      );
    }
  } finally {
    rl.close();
  }

  await waitForTx(
    "deposit 100 ETH liquidity",
    await loanManager.connect(owner).depositLiquidity({ value: ethers.parseEther("100") }),
    blockManager
  );

  return selectedUsers;
}

async function createLoanEventsForUser({ user, userLabel, loanManager, blockManager }) {
  if (LOAN_EVENTS_PER_USER % 3 !== 0) {
    throw new Error("LOAN_EVENTS_PER_USER must be divisible by 3 because each loan has request + approval + repayment.");
  }

  const loanCount = LOAN_EVENTS_PER_USER / 3;

  for (let i = 0; i < loanCount; i++) {
    const amount = ethers.parseEther((0.5 + i * 0.05).toFixed(2));
    const durationDays = 20 + i;

    // STEP 1: Request Loan
    await waitForTx(
      `${userLabel} request personal loan ${i + 1}/${loanCount}`,
      await loanManager.connect(user).requestLoan(LOAN_TYPE.Personal, amount, durationDays),
      blockManager
    );

    const loanId = await loanManager.loanCounter();

    // STEP 2: Approve Loan
    await waitForTx(
      `${userLabel} approve loan ${loanId}`,
      await loanManager.approveLoan(loanId),
      blockManager
    );

    // Get loan details for repayment amount
    const loanData = await loanManager.getLoan(loanId);
    const repayAmount = loanData[10]; // totalRepayment is at index 10

    // STEP 3: Repay Loan
    await waitForTx(
      `${userLabel} repay loan ${loanId}`,
      await loanManager.connect(user).repayLoan(loanId, { value: repayAmount }),
      blockManager
    );
  }
}

async function displayLoanBlocks(blockManager) {
  const totalBlocks = await blockManager.getTotalBlocks();
  const pendingCount = await blockManager.getPendingTransactions();

  if (pendingCount > 0n) {
    await waitForTx("finalize remaining pending loan-chain transactions", await blockManager.createBlock(), blockManager);
  }

  const finalizedBlocks = await blockManager.getTotalBlocks();

  console.log("");
  console.log("========== LOAN BLOCKCHAIN ==========");
  console.log(`Blocks finalized: ${finalizedBlocks}`);
  console.log(`Block size:       ${await blockManager.TXS_PER_BLOCK()} loan events`);
  console.log("");

  for (let blockNum = 0n; blockNum < finalizedBlocks; blockNum++) {
    const blockData = await blockManager.getBlock(blockNum);
    const txs = await blockManager.getBlockTransactions(blockNum, 0, blockData._txCount);

    console.log("------------------------------------------------------------");
    console.log(`BLOCK #${blockData._blockNumber}`);
    console.log(`hash:      ${blockData._blockHash}`);
    console.log(`previous:  ${blockData._previousHash}`);
    console.log(`time:      ${formatBlockTime(blockData._timestamp)}`);
    console.log(`tx count:  ${blockData._txCount}`);
    console.log("");

    for (const [index, loanTx] of txs.entries()) {
      console.log(
        `${String(index + 1).padStart(2, "0")}. ${loanTx.txType.padEnd(13)} | ${shortAddress(loanTx.user)} | ${ethers.formatEther(loanTx.amount).padStart(6)} ETH | ${loanTx.description}`
      );
    }
    console.log("");
  }

  const isValid = await blockManager.verifyBlockchain();
  console.log("========== SUMMARY ==========");
  console.log(`Loan-chain blocks:       ${finalizedBlocks}`);
  console.log(`Loan-chain transactions: ${LOAN_EVENTS_PER_USER * USERS_TO_SIMULATE}`);
  console.log(`Users simulated:         ${USERS_TO_SIMULATE}`);
  console.log(`Integrity check:         ${isValid ? "VALID" : "BROKEN"}`);
  console.log(`Pending transactions:    ${await blockManager.getPendingTransactions()}`);

  if (totalBlocks !== finalizedBlocks) {
    console.log("Note: pending transactions were finalized into the last block.");
  }
}

async function main() {
  console.log("========== DEPLOYING LOAN BLOCKCHAIN SYSTEM ==========");
  const system = await deploySystem();

  console.log(`Owner:        ${system.owner.address}`);
  console.log(`BlockManager: ${await system.blockManager.getAddress()}`);
  console.log(`LoanManager:  ${await system.loanManager.getAddress()}`);
  console.log("");

  const selectedUsers = await prepareUsers(system);

  console.log("");
  console.log("========== CREATING LOAN EVENTS ==========");
  console.log(`Users: ${USERS_TO_SIMULATE}`);
  console.log(`Loan-chain transactions per user: ${LOAN_EVENTS_PER_USER}`);
  console.log("");

  for (const [index, user] of selectedUsers.entries()) {
    await createLoanEventsForUser({
      user,
      userLabel: `User${index + 1}`,
      loanManager: system.loanManager,
      blockManager: system.blockManager,
    });
  }

  await displayLoanBlocks(system.blockManager);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

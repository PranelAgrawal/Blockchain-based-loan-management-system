const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { spawnSync } = require("node:child_process");
const { ethers } = require("hardhat");

const LOAN_TYPE = {
  Personal: 0,
  Home: 1,
  Business: 2,
};

const LOAN_TYPE_LABELS = ["Personal", "Home", "Business"];
const MONGODB_DB = process.env.MONGODB_DB || "blockchainLoan";
const AADHAAR_COLLECTION = process.env.AADHAAR_COLLECTION || "users";
const BPS_DENOMINATOR = 10_000n;
const MIN_CREDIT_SCORE = 600n;

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

function createRl() {
  return readline.createInterface({ input, output });
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeAadhaar(aadhaarNumber) {
  return aadhaarNumber.replace(/[\s-]/g, "");
}

function isValidAadhaar(aadhaarNumber) {
  const normalized = normalizeAadhaar(aadhaarNumber);
  if (!/^[2-9][0-9]{11}$/.test(normalized)) return false;

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

function normalizeLoanType(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized === "personal") return LOAN_TYPE.Personal;
  if (normalized === "1" || normalized === "home") return LOAN_TYPE.Home;
  if (normalized === "2" || normalized === "business") return LOAN_TYPE.Business;
  return null;
}

function formatLoanTypeOptions() {
  return LOAN_TYPE_LABELS.map((label, index) => `${index}=${label}`).join(", ");
}

function loadDeployment() {
  const deploymentPath = path.join(__dirname, "..", "..", "deployments", "localhost.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Missing deployments/localhost.json. Run npm run deploy first.");
  }
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

async function getContracts(signer) {
  const deployment = loadDeployment();
  return {
    deployment,
    blockManager: await ethers.getContractAt("BlockManager", deployment.blockManager, signer),
    kycRegistry: await ethers.getContractAt("KYCRegistry", deployment.kycRegistry, signer),
    creditScore: await ethers.getContractAt("CreditScore", deployment.creditScore, signer),
    collateralManager: await ethers.getContractAt("CollateralManager", deployment.collateralManager, signer),
    loanManager: await ethers.getContractAt("LoanManager", deployment.loanManager, signer),
  };
}

async function chooseSigner(rl, defaultIndex = 1) {
  const signers = await ethers.getSigners();
  console.log("Available local Hardhat accounts:");
  for (const [index, signer] of signers.entries()) {
    console.log(`  ${index}: ${signer.address}`);
  }

  const answer = await rl.question(`Choose account index [${defaultIndex}]: `);
  const index = answer.trim() === "" ? defaultIndex : Number(answer);
  if (!Number.isInteger(index) || !signers[index]) {
    throw new Error("Invalid account index.");
  }
  return { signer: signers[index], index };
}

function runMongo(script) {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in .env.");
  }

  const result = spawnSync("mongosh", [process.env.MONGODB_URI, "--quiet", "--eval", script], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`MongoDB command failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

function saveKycRequest({ address, aadhaarNumber, documentHash }) {
  const normalizedAddress = address.toLowerCase();
  const script = `
    const targetDb = db.getSiblingDB(${JSON.stringify(MONGODB_DB)});
    const users = targetDb.getCollection(${JSON.stringify(AADHAAR_COLLECTION)});
    for (const indexName of ["email_1", "userId_1"]) {
      try { users.dropIndex(indexName); } catch (error) {
        if (error.codeName !== "IndexNotFound") throw error;
      }
    }
    users.updateMany(
      {
        address: { $type: "string" },
        $or: [{ addressLower: { $exists: false } }, { addressLower: null }]
      },
      [{ $set: { addressLower: { $toLower: "$address" } } }]
    );
    users.createIndex(
      { addressLower: 1 },
      {
        unique: true,
        partialFilterExpression: { addressLower: { $type: "string" } }
      }
    );
    users.replaceOne(
      {
        $or: [
          { addressLower: ${JSON.stringify(normalizedAddress)} },
          { address: ${JSON.stringify(address)} },
          { address: ${JSON.stringify(normalizedAddress)} }
        ]
      },
      {
        address: ${JSON.stringify(address)},
        addressLower: ${JSON.stringify(normalizedAddress)},
        adhaarNumber: ${JSON.stringify(aadhaarNumber)},
        documentHash: ${JSON.stringify(documentHash)},
        kycStatus: "pending",
        requestedAt: new Date()
      },
      { upsert: true }
    );
  `;
  runMongo(script);
}

function updateKycStatus({ address, status, txHash, creditScore }) {
  const normalizedAddress = address.toLowerCase();
  const script = `
    const targetDb = db.getSiblingDB(${JSON.stringify(MONGODB_DB)});
    targetDb.getCollection(${JSON.stringify(AADHAAR_COLLECTION)}).updateOne(
      {
        $or: [
          { addressLower: ${JSON.stringify(normalizedAddress)} },
          { address: ${JSON.stringify(address)} },
          { address: ${JSON.stringify(normalizedAddress)} }
        ]
      },
      {
        $set: {
          address: ${JSON.stringify(address)},
          addressLower: ${JSON.stringify(normalizedAddress)},
          kycStatus: ${JSON.stringify(status)},
          kycTxHash: ${JSON.stringify(txHash)},
          creditScore: ${Number(creditScore)},
          verifiedAt: new Date()
        }
      }
    );
  `;
  runMongo(script);
}

function getPendingKycRequests() {
  const script = `
    const targetDb = db.getSiblingDB(${JSON.stringify(MONGODB_DB)});
    const rows = targetDb.getCollection(${JSON.stringify(AADHAAR_COLLECTION)})
      .find({ kycStatus: "pending" }, { projection: { _id: 0 } })
      .toArray();
    print(JSON.stringify(rows));
  `;
  const output = runMongo(script);
  return output ? JSON.parse(output) : [];
}

function getKycRequest(address) {
  const normalizedAddress = address.toLowerCase();
  const script = `
    const targetDb = db.getSiblingDB(${JSON.stringify(MONGODB_DB)});
    const row = targetDb.getCollection(${JSON.stringify(AADHAAR_COLLECTION)})
      .findOne(
        {
          $or: [
            { addressLower: ${JSON.stringify(normalizedAddress)} },
            { address: ${JSON.stringify(address)} },
            { address: ${JSON.stringify(normalizedAddress)} }
          ]
        },
        { projection: { _id: 0 } }
      );
    print(JSON.stringify(row));
  `;
  const output = runMongo(script);
  return output && output !== "null" ? JSON.parse(output) : null;
}

async function waitForTx(label, tx) {
  const receipt = await tx.wait();
  console.log(`${label}`);
  console.log(`  hash: ${receipt.hash}`);
  console.log(`  block: ${receipt.blockNumber}`);
  return receipt;
}

async function askForLoanRequest(rl, userLabel, loanManager) {
  while (true) {
    const loanTypeAnswer = await rl.question(
      `Enter loan type for ${userLabel} (${formatLoanTypeOptions()}): `
    );
    const loanType = normalizeLoanType(loanTypeAnswer);
    if (loanType === null) {
      console.log(`Invalid loan type. Use one of: ${formatLoanTypeOptions()}`);
      continue;
    }

    const config = await loanManager.loanConfigs(loanType);
    if (!config.enabled) {
      console.log(`${LOAN_TYPE_LABELS[loanType]} loans are disabled.`);
      continue;
    }

    const amountAnswer = await rl.question(`Enter loan amount in ETH for ${userLabel}: `);
    let amount;
    try {
      amount = ethers.parseEther(amountAnswer.trim());
    } catch (_) {
      console.log("Invalid amount. Enter a positive ETH value like 1 or 1.5");
      continue;
    }
    if (amount <= 0n) {
      console.log("Loan amount must be greater than 0.");
      continue;
    }

    const durationAnswer = await rl.question(`Enter loan duration in seconds for ${userLabel}: `);
    const durationSeconds = Number(durationAnswer);
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      console.log("Duration must be a positive whole number of seconds.");
      continue;
    }
    if (BigInt(durationSeconds) > config.maxDurationSeconds) {
      console.log(`Max duration for ${LOAN_TYPE_LABELS[loanType]} is ${config.maxDurationSeconds.toString()} seconds.`);
      continue;
    }

    const requiredCollateral = (amount * config.collateralRatioBps) / BPS_DENOMINATOR;
    return { loanType, amount, durationSeconds, requiredCollateral };
  }
}

module.exports = {
  AADHAAR_COLLECTION,
  BPS_DENOMINATOR,
  LOAN_TYPE_LABELS,
  MIN_CREDIT_SCORE,
  askForLoanRequest,
  chooseSigner,
  createRl,
  getAadhaarDocumentHash,
  getContracts,
  getKycRequest,
  getPendingKycRequests,
  isValidAadhaar,
  loadDeployment,
  normalizeAadhaar,
  saveKycRequest,
  shortAddress,
  updateKycStatus,
  waitForTx,
};

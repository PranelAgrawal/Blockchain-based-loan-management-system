# Hardhat Console Testing Guide - Complete Workflow

## Prerequisites

1. **Update your .env file with contract addresses:**
```
KYC_CONTRACT_ADDRESS=0xaddA928DF917fF16f6A97Ffdb9DbC71D824CcA05
CREDIT_CONTRACT_ADDRESS=0x1F213500B35cDd1A41Af623913307aFC5f8Ca94A
LOAN_CONTRACT_ADDRESS=0x6CF53e293E770023360aB4e3b096de3aAE38A604
COLLATERAL_CONTRACT_ADDRESS=0xe8288e3cd939a5c91d743711bC8e3e8fc9c62959
```

2. **Start hardhat console connected to Sepolia:**
```bash
npx hardhat console --network sepolia
```

## Setup Phase (Copy-Paste All at Once)

```javascript
// Load environment variables
require('dotenv').config();
const ethers = hre.ethers;

// Contract ABIs
const KYC_ABI = [
  "function verifyUser(address user, bytes32 documentHash) external",
  "function isVerified(address user) external view returns (bool)",
  "function verifiedUsers(address) external view returns (bool)",
  "function kycDocumentHashes(address) external view returns (bytes32)"
];

const CREDIT_ABI = [
  "function updateScore(address user, uint256 score) external",
  "function getScore(address user) external view returns (uint256)"
];

const COLLATERAL_ABI = [
  "function depositCollateral(uint256 loanId) external payable",
  "function releaseCollateral(uint256 loanId, address borrower) external",
  "function seizeCollateral(uint256 loanId, address recipient) external",
  "function collateralAmount(uint256 loanId) external view returns (uint256)",
  "function loanBorrowers(uint256 loanId) external view returns (address)",
  "function registerLoan(uint256 loanId, address borrower) external"
];

const LOAN_ABI = [
  "function requestLoan(uint8 loanType, uint256 amount, uint256 duration) external returns (uint256)",
  "function approveLoan(uint256 loanId) external",
  "function repayLoan(uint256 loanId) external payable",
  "function markLoanDefaulted(uint256 loanId) external",
  "function depositLiquidity() external payable",
  "function getLoan(uint256 loanId) external view returns (uint256, address, uint8, uint256, uint256, bool, bool, bool, uint256, uint256, uint256, bool)",
  "function loanCounter() external view returns (uint256)",
  "function totalLiquidity() external view returns (uint256)"
];

// Contract addresses from deployment
const KYC_ADDRESS = process.env.KYC_CONTRACT_ADDRESS;
const CREDIT_ADDRESS = process.env.CREDIT_CONTRACT_ADDRESS;
const LOAN_ADDRESS = process.env.LOAN_CONTRACT_ADDRESS;
const COLLATERAL_ADDRESS = process.env.COLLATERAL_CONTRACT_ADDRESS;

console.log("📋 Contracts loaded:");
console.log(`  KYC: ${KYC_ADDRESS}`);
console.log(`  Credit: ${CREDIT_ADDRESS}`);
console.log(`  Loan: ${LOAN_ADDRESS}`);
console.log(`  Collateral: ${COLLATERAL_ADDRESS}`);

// Get signers
const [deployer] = await ethers.getSigners();
console.log(`\n👤 Current account: ${deployer.address}`);

// Get account balance
const balance = await ethers.provider.getBalance(deployer.address);
console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

// Connect to contracts
const kycContract = new ethers.Contract(KYC_ADDRESS, KYC_ABI, deployer);
const creditContract = new ethers.Contract(CREDIT_ADDRESS, CREDIT_ABI, deployer);
const collateralContract = new ethers.Contract(COLLATERAL_ADDRESS, COLLATERAL_ABI, deployer);
const loanContract = new ethers.Contract(LOAN_ADDRESS, LOAN_ABI, deployer);

console.log("\n✅ All contracts connected successfully!");
```

---

## Test Step 1: KYC Verification

```javascript
console.log("\n========== TEST 1: KYC VERIFICATION ==========");

// Create a document hash (simulating uploaded KYC documents)
const documentHash = ethers.id("kyc_document_2024");
console.log(`📄 Document hash: ${documentHash}`);

// Verify the borrower (you need to be admin for this - deployer is admin)
const verifTx = await kycContract.verifyUser(deployer.address, documentHash);
console.log(`⏳ Verify transaction sent: ${verifTx.hash}`);
const verifReceipt = await verifTx.wait();
console.log(`✅ Verified! Block: ${verifReceipt.blockNumber}`);

// Check if verified
const isVerified = await kycContract.isVerified(deployer.address);
console.log(`🔍 Is account verified? ${isVerified}`);
```

---

## Test Step 2: Set Credit Score

```javascript
console.log("\n========== TEST 2: CREDIT SCORE SETUP ==========");

// Set a good credit score (between 300-850)
const creditScore = 750; // Good score
const scoreTx = await creditContract.updateScore(deployer.address, creditScore);
console.log(`⏳ Score update sent: ${scoreTx.hash}`);
const scoreReceipt = await scoreTx.wait();
console.log(`✅ Score updated! Block: ${scoreReceipt.blockNumber}`);

// Verify score was set
const currentScore = await creditContract.getScore(deployer.address);
console.log(`🎯 Current credit score: ${currentScore}`);
```

---

## Test Step 3: Deposit Liquidity (Admin Only)

```javascript
console.log("\n========== TEST 3: DEPOSIT LIQUIDITY (ADMIN) ==========");

// Admin deposits liquidity into the loan pool
const liquidityAmount = ethers.parseEther("0.01"); // 0.01 ETH
console.log(`💷 Depositing liquidity: ${ethers.formatEther(liquidityAmount)} ETH`);

const liquidityTx = await loanContract.depositLiquidity({ value: liquidityAmount });
console.log(`⏳ Liquidity deposit sent: ${liquidityTx.hash}`);
const liquidityReceipt = await liquidityTx.wait();
console.log(`✅ Liquidity deposited! Block: ${liquidityReceipt.blockNumber}`);

// Check total liquidity
const totalLiquidity = await loanContract.totalLiquidity();
console.log(`💰 Total pool liquidity: ${ethers.formatEther(totalLiquidity)} ETH`);
```

---

## Test Step 4: Request a Loan

```javascript
console.log("\n========== TEST 4: REQUEST LOAN ==========");

// Loan parameters
// Loan types: 0 = Personal, 1 = Home, 2 = Business
const loanType = 0; // Personal loan (no collateral required)
const loanAmount = ethers.parseEther("0.005"); // 0.005 ETH
const loanDuration = 180; // 180 days

console.log(`📋 Requesting loan:`);
console.log(`   Type: ${["Personal", "Home", "Business"][loanType]}`);
console.log(`   Amount: ${ethers.formatEther(loanAmount)} ETH`);
console.log(`   Duration: ${loanDuration} days`);

const requestTx = await loanContract.requestLoan(loanType, loanAmount, loanDuration);
console.log(`⏳ Request sent: ${requestTx.hash}`);
const requestReceipt = await requestTx.wait();
console.log(`✅ Risk created! Block: ${requestReceipt.blockNumber}`);

// Get the loan ID from event logs
const currentLoanCounter = await loanContract.loanCounter();
const loanId = currentLoanCounter;
console.log(`🆔 New Loan ID: ${loanId}`);
```

---

## Test Step 5: Get Loan Details (Before Approval)

```javascript
console.log("\n========== TEST 5: VIEW LOAN DETAILS (BEFORE APPROVAL) ==========");

const loanDetails = await loanContract.getLoan(loanId);
console.log(`📊 Loan Details:`);
console.log(`   ID: ${loanDetails[0]}`);
console.log(`   Borrower: ${loanDetails[1]}`);
console.log(`   Type: ${["Personal", "Home", "Business"][loanDetails[2]]}`);
console.log(`   Principal: ${ethers.formatEther(loanDetails[3])} ETH`);
console.log(`   Duration: ${loanDetails[4]} days`);
console.log(`   Collateral Required: ${loanDetails[5]}`);
console.log(`   Approved: ${loanDetails[6]}`);
console.log(`   Repaid: ${loanDetails[7]}`);
console.log(`   Interest Rate: ${loanDetails[8] / 100}% APR`);
console.log(`   Due Date (timestamp): ${loanDetails[9]}`);
console.log(`   Total Repayment: ${ethers.formatEther(loanDetails[10])} ETH`);
console.log(`   Defaulted: ${loanDetails[11]}`);
```

---

## Test Step 6: Approve the Loan (Admin/Owner)

```javascript
console.log("\n========== TEST 6: APPROVE LOAN (ADMIN) ==========");

console.log(`⏳ Approving loan ${loanId}...`);
const approveTx = await loanContract.approveLoan(loanId);
console.log(`   Transaction: ${approveTx.hash}`);
const approveReceipt = await approveTx.wait();
console.log(`✅ Loan approved! Block: ${approveReceipt.blockNumber}`);

// Check updated liquidity
const newLiquidity = await loanContract.totalLiquidity();
console.log(`💰 Pool liquidity after approval: ${ethers.formatEther(newLiquidity)} ETH`);
```

---

## Test Step 7: Get Loan Details (After Approval)

```javascript
console.log("\n========== TEST 7: VIEW LOAN DETAILS (AFTER APPROVAL) ==========");

const updatedLoan = await loanContract.getLoan(loanId);
console.log(`📊 Updated Loan Status:`);
console.log(`   Approved: ${updatedLoan[6]} ✅`);
console.log(`   Repaid: ${updatedLoan[7]}`);
console.log(`   Total to repay: ${ethers.formatEther(updatedLoan[10])} ETH`);
console.log(`   Defaulted: ${updatedLoan[11]}`);
```

---

## Test Step 8: Repay the Loan

```javascript
console.log("\n========== TEST 8: REPAY LOAN ==========");

const loanToRepay = await loanContract.getLoan(loanId);
const repaymentAmount = loanToRepay[10]; // Total repayment (principal + interest)

console.log(`💵 Repaying loan:`);
console.log(`   Loan ID: ${loanId}`);
console.log(`   Amount due: ${ethers.formatEther(repaymentAmount)} ETH`);

const repayTx = await loanContract.repayLoan(loanId, { value: repaymentAmount });
console.log(`⏳ Repayment sent: ${repayTx.hash}`);
const repayReceipt = await repayTx.wait();
console.log(`✅ Loan repaid! Block: ${repayReceipt.blockNumber}`);

// Check final liquidity
const finalLiquidity = await loanContract.totalLiquidity();
console.log(`💰 Final pool liquidity: ${ethers.formatEther(finalLiquidity)} ETH`);
```

---

## Test Step 9: Get Loan Details (After Repayment)

```javascript
console.log("\n========== TEST 9: VIEW LOAN DETAILS (AFTER REPAYMENT) ==========");

const finalLoan = await loanContract.getLoan(loanId);
console.log(`📊 Final Loan Status:`);
console.log(`   Approved: ${finalLoan[6]}`);
console.log(`   Repaid: ${finalLoan[7]} ✅`);
console.log(`   Defaulted: ${finalLoan[11]}`);
console.log(`\n✅ Loan lifecycle complete!`);
```

---

## TEST Step 10: Test with Collateral (Home Loan)

```javascript
console.log("\n========== TEST 10: HOME LOAN WITH COLLATERAL ==========");

// Home loan requires collateral
const homeLoanType = 1; // Home
const homeLoanAmount = ethers.parseEther("0.02"); // 0.02 ETH
const homeLoanDuration = 365; // 1 year

console.log(`📋 Requesting home loan with collateral:`);
console.log(`   Amount: ${ethers.formatEther(homeLoanAmount)} ETH`);
console.log(`   Duration: ${homeLoanDuration} days`);

const homeLoanTx = await loanContract.requestLoan(homeLoanType, homeLoanAmount, homeLoanDuration);
const homeLoanReceipt = await homeLoanTx.wait();
const homeLoanId = await loanContract.loanCounter();
console.log(`🆔 Home Loan ID: ${homeLoanId}`);

// Check loan details
const homeLoan = await loanContract.getLoan(homeLoanId);
console.log(`📊 Home Loan Details:`);
console.log(`   Type: Home`);
console.log(`   Principal: ${ethers.formatEther(homeLoan[3])} ETH`);
console.log(`   Collateral Required: ${homeLoan[5]}`);
console.log(`   Total to repay: ${ethers.formatEther(homeLoan[10])} ETH`);
```

---

## Test Step 11: Deposit Collateral

```javascript
console.log("\n========== TEST 11: DEPOSIT COLLATERAL ==========");

// Home loan requires 50% collateral ratio
// Loan amount = 0.02 ETH, so need 0.01 ETH collateral
const collateralAmount = ethers.parseEther("0.01");
console.log(`💎 Depositing collateral for loan ${homeLoanId}:`);
console.log(`   Amount: ${ethers.formatEther(collateralAmount)} ETH`);

const collateralTx = await collateralContract.depositCollateral(homeLoanId, { value: collateralAmount });
console.log(`⏳ Collateral deposit sent: ${collateralTx.hash}`);
const collateralReceipt = await collateralTx.wait();
console.log(`✅ Collateral deposited! Block: ${collateralReceipt.blockNumber}`);

// Verify collateral was deposited
const depositedCollateral = await collateralContract.collateralAmount(homeLoanId);
console.log(`🔍 Collateral on hold: ${ethers.formatEther(depositedCollateral)} ETH`);
```

---

## Test Step 12: Approve Home Loan

```javascript
console.log("\n========== TEST 12: APPROVE HOME LOAN (ADMIN) ==========");

console.log(`⏳ Approving home loan ${homeLoanId}...`);
const homeApproveTx = await loanContract.approveLoan(homeLoanId);
console.log(`   Transaction: ${homeApproveTx.hash}`);
const homeApproveReceipt = await homeApproveTx.wait();
console.log(`✅ Home loan approved! Block: ${homeApproveReceipt.blockNumber}`);
```

---

## Test Step 13: Repay Home Loan (Collateral Released)

```javascript
console.log("\n========== TEST 13: REPAY HOME LOAN (COLLATERAL RELEASED) ==========");

const homeRepayLoan = await loanContract.getLoan(homeLoanId);
const homeRepaymentAmount = homeRepayLoan[10];

console.log(`💵 Repaying home loan:`);
console.log(`   Loan ID: ${homeLoanId}`);
console.log(`   Amount due: ${ethers.formatEther(homeRepaymentAmount)} ETH`);

const homeRepayTx = await loanContract.repayLoan(homeLoanId, { value: homeRepaymentAmount });
console.log(`⏳ Repayment sent: ${homeRepayTx.hash}`);
const homeRepayReceipt = await homeRepayTx.wait();
console.log(`✅ Home loan repaid! Block: ${homeRepayReceipt.blockNumber}`);

// Verify collateral was released (should be 0 now)
const finalCollateral = await collateralContract.collateralAmount(homeLoanId);
console.log(`🔍 Collateral remaining: ${ethers.formatEther(finalCollateral)} ETH`);
console.log(`✅ Collateral released to borrower!`);
```

---

## Test Step 14: View All Loans Summary

```javascript
console.log("\n========== TEST 14: LOANS SUMMARY ==========");

const totalLoans = await loanContract.loanCounter();
console.log(`📊 Total loans created: ${totalLoans}\n`);

for (let i = 1; i <= totalLoans; i++) {
  const loan = await loanContract.getLoan(i);
  console.log(`Loan #${i}:`);
  console.log(`  Borrower: ${loan[1]}`);
  console.log(`  Type: ${["Personal", "Home", "Business"][loan[2]]}`);
  console.log(`  Principal: ${ethers.formatEther(loan[3])} ETH`);
  console.log(`  Status: ${loan[6] ? "Approved" : "Pending"} | Repaid: ${loan[7]} | Defaulted: ${loan[11]}`);
  console.log("");
}
```

---

## Advanced: Test Default Scenario (Optional)

```javascript
console.log("\n========== TEST 15: LOAN DEFAULT (ADVANCED) ==========");
console.log("⚠️  NOTE: Defaults can only occur when loan is overdue (past dueDate)");
console.log("   To test this properly, you would need to:");
console.log("   1. Move blockchain time forward (not possible on live Sepolia)");
console.log("   2. Request a loan with short duration");
console.log("   3. Wait for due date to pass");
console.log("   4. Call markLoanDefaulted()");
console.log("   5. Collateral would be seized by contract owner");
console.log("\n   For now, this is documented for your professor");
```

---

## Step-by-Step Execution Guide

**In your terminal:**

```bash
# 1. Navigate to project
cd c:\Users\Pranel\Documents\projects\blockchain-loan-system

# 2. Open hardhat console on Sepolia
npx hardhat console --network sepolia

# 3. Copy-paste the SETUP PHASE section (all the variable declarations)
# 4. Copy-paste each TEST section one at a time
# 5. Watch the output and verify each step

# 6. When done, exit with: .exit
```

---

## Expected Output Summary

After running all tests, you should see:
- ✅ KYC verification successful
- ✅ Credit score set to 750
- ✅ Liquidity deposited to pool
- ✅ Personal loan requested and repaid
- ✅ Home loan requested, collateral deposited, and repaid
- ✅ Collateral released to borrower
- ✅ All transactions recorded on Sepolia blockchain

---

## MongoDB Verification

Once tests are complete, start your backend and check MongoDB:

```javascript
// In MongoDB Compass or mongosh:
db.transactions.find().pretty()

// You should see all loan transactions recorded with:
// - transactionHash
// - blockNumber
// - transactionType (loanRequest, loanApproval, repayment)
// - status (confirmed)
// - gasUsed and gasPrice
// - eventData with full loan details
```

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `Error: insufficient funds` | Make sure your account has enough Sepolia ETH (need ~0.05+ ETH) |
| `Error: KYCRegistry: Only admin can perform this action` | You need to call with deployer account (admin) |
| `Error: LoanManager: User must be KYC verified` | Verify the account first in Test Step 1 |
| `Error: LoanManager: Credit score must be at least 600` | Set credit score first in Test Step 2 |
| `Error: LoanManager: Insufficient liquidity` | Deposit liquidity first in Test Step 3 |
| `Error: User denied transaction` | Check MetaMask for error details |

---

## Next Steps After Testing

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Connect to MongoDB and verify transactions:**
   ```javascript
   db.transactions.count()  // Should match number of test transactions
   db.transactions.findOne()  // See full transaction details
   ```

3. **Show professor:**
   - Sepolia addresses and contracts on Etherscan
   - MongoDB transaction records
   - Source code and architecture

---

## Useful Commands in Hardhat Console

```javascript
// Get current block number
await ethers.provider.getBlockNumber()

// Get transaction receipt
await ethers.provider.getTransactionReceipt("0x...")

// Check account balance
await ethers.provider.getBalance(deployer.address)

// Get all signers
await ethers.getSigners()

// Exit console
.exit
```

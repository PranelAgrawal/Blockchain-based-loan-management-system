// ========================================
// HARDHAT CONSOLE TEST CODE - COPY & PASTE
// ========================================
// Paste this entire block into hardhat console --network sepolia

require('dotenv').config();
const ethers = hre.ethers;

// Load environment
console.log('\n🔧 Setup phase...\n');

const KYC_ABI = ["function verifyUser(address user, bytes32 documentHash) external", "function isVerified(address user) external view returns (bool)"];
const CREDIT_ABI = ["function updateScore(address user, uint256 score) external", "function getScore(address user) external view returns (uint256)"];
const COLLATERAL_ABI = ["function depositCollateral(uint256 loanId) external payable", "function collateralAmount(uint256 loanId) external view returns (uint256)", "function loanBorrowers(uint256 loanId) external view returns (address)"];
const LOAN_ABI = ["function requestLoan(uint8 loanType, uint256 amount, uint256 duration) external returns (uint256)", "function approveLoan(uint256 loanId) external", "function repayLoan(uint256 loanId) external payable", "function getLoan(uint256 loanId) external view returns (uint256, address, uint8, uint256, uint256, bool, bool, bool, uint256, uint256, uint256, bool)", "function loanCounter() external view returns (uint256)", "function totalLiquidity() external view returns (uint256)", "function depositLiquidity() external payable"];

const KYC_ADDRESS = "0xaddA928DF917fF16f6A97Ffdb9DbC71D824CcA05";
const CREDIT_ADDRESS = "0x1F213500B35cDd1A41Af623913307aFC5f8Ca94A";
const COLLATERAL_ADDRESS = "0xe8288e3cd939a5c91d743711bC8e3e8fc9c62959";
const LOAN_ADDRESS = "0x6CF53e293E770023360aB4e3b096de3aAE38A604";

const [owner] = await ethers.getSigners();

const kyc = new ethers.Contract(KYC_ADDRESS, KYC_ABI, owner);
const credit = new ethers.Contract(CREDIT_ADDRESS, CREDIT_ABI, owner);
const collateral = new ethers.Contract(COLLATERAL_ADDRESS, COLLATERAL_ABI, owner);
const loan = new ethers.Contract(LOAN_ADDRESS, LOAN_ABI, owner);

console.log('✅ Connected to all Sepolia contracts');
console.log(`📍 Account: ${owner.address}\n`);

// ========================================
// TEST 1: KYC VERIFICATION
// ========================================
console.log('========== TEST 1: KYC ==========\n');
const docHash = ethers.id("kyc_document_2024");
console.log('Document hash:', docHash);
console.log('\nChecking if already verified...');
const isVerified1 = await kyc.isVerified(owner.address);
console.log('Verified?', isVerified1);

if (!isVerified1) {
  console.log('\nVerifying account...');
  const tx1 = await kyc.verifyUser(owner.address, docHash);
  console.log('Transaction:', tx1.hash);
  const receipt1 = await tx1.wait();
  console.log('✅ Verified! Block:', receipt1.blockNumber);
} else {
  console.log('✅ Already verified');
}

const isVerified2 = await kyc.isVerified(owner.address);
console.log('\nFinal status - Verified?', isVerified2, '\n');

// ========================================
// TEST 2: CREDIT SCORE
// ========================================
console.log('========== TEST 2: CREDIT SCORE ==========\n');
const currentScore = await credit.getScore(owner.address);
console.log('Current score:', currentScore.toString());

if (currentScore.toString() === '0') {
  console.log('\nSetting score to 750...');
  const tx2 = await credit.updateScore(owner.address, 750);
  console.log('Transaction:', tx2.hash);
  const receipt2 = await tx2.wait();
  console.log('✅ Updated! Block:', receipt2.blockNumber);
} else {
  console.log('✅ Score already set to:', currentScore.toString());
}

const finalScore = await credit.getScore(owner.address);
console.log('\nFinal score:', finalScore.toString(), '\n');

// ========================================
// TEST 3: LIQUIDITY DEPOSIT
// ========================================
console.log('========== TEST 3: LIQUIDITY ==========\n');
const liquidity1 = await loan.totalLiquidity();
console.log('Current pool liquidity:', ethers.formatEther(liquidity1), 'ETH');

if (liquidity1 < ethers.parseEther('0.01')) {
  console.log('\nPool too low, depositing 0.05 ETH...');
  const tx3 = await loan.depositLiquidity({ value: ethers.parseEther('0.05') });
  console.log('Transaction:', tx3.hash);
  const receipt3 = await tx3.wait();
  console.log('✅ Deposited! Block:', receipt3.blockNumber);
} else {
  console.log('✅ Pool has enough liquidity');
}

const liquidity2 = await loan.totalLiquidity();
console.log('\nFinal pool liquidity:', ethers.formatEther(liquidity2), 'ETH\n');

// ========================================
// TEST 4: REQUEST LOAN
// ========================================
console.log('========== TEST 4: REQUEST LOAN ==========\n');
const loanAmount = ethers.parseEther('0.01'); // 0.01 ETH
const loanDuration = 30; // 30 days

console.log('Requesting loan:');
console.log('  Amount: 0.01 ETH');
console.log('  Duration: 30 days');
console.log('  Type: Personal (0)');

const tx4 = await loan.requestLoan(0, loanAmount, loanDuration);
console.log('\nTransaction:', tx4.hash);
const receipt4 = await tx4.wait();
console.log('✅ Loan created! Block:', receipt4.blockNumber);

const loanId = await loan.loanCounter();
console.log('\nNew Loan ID:', loanId.toString());

const loanData = await loan.getLoan(loanId);
console.log('\nLoan Details:');
console.log('  Principal:', ethers.formatEther(loanData[3]), 'ETH');
console.log('  Duration:', loanData[4].toString(), 'days');
console.log('  Approved?', loanData[6]);
console.log('  Repaid?', loanData[7]);
console.log('  Total to repay:', ethers.formatEther(loanData[10]), 'ETH\n');

// ========================================
// TEST 5: APPROVE LOAN
// ========================================
console.log('========== TEST 5: APPROVE LOAN ==========\n');
console.log('Approving loan', loanId.toString(), '...');

const tx5 = await loan.approveLoan(loanId);
console.log('Transaction:', tx5.hash);
const receipt5 = await tx5.wait();
console.log('✅ Approved! Block:', receipt5.blockNumber);

const approvedLoan = await loan.getLoan(loanId);
console.log('\nAfter approval:');
console.log('  Approved?', approvedLoan[6]);
console.log('  You received:', ethers.formatEther(approvedLoan[3]), 'ETH\n');

// ========================================
// TEST 6: CHECK BALANCE
// ========================================
console.log('========== TEST 6: BALANCE CHECK ==========\n');
const balance = await ethers.provider.getBalance(owner.address);
console.log('Your current balance:', ethers.formatEther(balance), 'ETH\n');

// ========================================
// TEST 7: REPAY LOAN
// ========================================
console.log('========== TEST 7: REPAY LOAN ==========\n');
const repaymentAmount = approvedLoan[10];
console.log('Amount to repay:', ethers.formatEther(repaymentAmount), 'ETH');

const tx6 = await loan.repayLoan(loanId, { value: repaymentAmount });
console.log('\nTransaction:', tx6.hash);
const receipt6 = await tx6.wait();
console.log('✅ Repaid! Block:', receipt6.blockNumber);

const repaidLoan = await loan.getLoan(loanId);
console.log('\nAfter repayment:');
console.log('  Repaid?', repaidLoan[7]);
console.log('  Status: COMPLETE ✅\n');

// ========================================
// TEST 8: VIEW ALL LOANS
// ========================================
console.log('========== TEST 8: ALL LOANS ==========\n');
const totalLoans = await loan.loanCounter();
console.log('Total loans created:', totalLoans.toString(), '\n');

for (let i = 1; i <= Math.min(totalLoans, 3); i++) {
  const l = await loan.getLoan(i);
  console.log(`Loan #${i}:`);
  console.log(`  Amount: ${ethers.formatEther(l[3])} ETH`);
  console.log(`  Approved: ${l[6]} | Repaid: ${l[7]} | Defaulted: ${l[11]}`);
  console.log('');
}

console.log('========== ALL TESTS COMPLETE ✅ ==========\n');
console.log('Next step: Start backend');
console.log('  cd backend && npm run dev\n');

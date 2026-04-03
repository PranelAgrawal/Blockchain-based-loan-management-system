/**
 * Blockchain Service
 * Interacts with smart contracts using ethers.js
 */
const { ethers } = require('ethers');
const blockchainConfig = require('../config/blockchain');

// Contract ABIs (minimal interface for required functions)
const KYCRegistryABI = [
  'function verifyUser(address user, bytes32 documentHash) external',
  'function isVerified(address user) external view returns (bool)',
  'function kycDocumentHashes(address user) external view returns (bytes32)',
];

const CreditScoreABI = [
  'function updateScore(address user, uint256 score) external',
  'function getScore(address user) external view returns (uint256)',
];

const CollateralManagerABI = [
  'function depositCollateral(uint256 loanId) external payable',
  'function releaseCollateral(uint256 loanId, address borrower) external',
  'function registerLoan(uint256 loanId, address borrower) external',
  'function collateralAmount(uint256 loanId) external view returns (uint256)',
];

const LoanManagerABI = [
  'function requestLoan(uint8 loanType, uint256 amount, uint256 duration) external returns (uint256)',
  'function approveLoan(uint256 loanId) external',
  'function repayLoan(uint256 loanId) external payable',
  'function markLoanDefaulted(uint256 loanId) external',
  'function getLoan(uint256 loanId) external view returns (uint256, address, uint8, uint256, uint256, bool, bool, bool, uint256, uint256, uint256, bool)',
  'function loanCounter() external view returns (uint256)',
  'function depositLiquidity() external payable',
  'function withdrawLiquidity(uint256 amount) external',
  'event LoanRequested(uint256 indexed loanId, address indexed borrower, uint8 loanType, uint256 amount, uint256 duration, bool collateralRequired)',
  'event LoanApproved(uint256 indexed loanId, address indexed borrower)',
  'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestPaid)',
  'event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 timestamp)',
];

/**
 * Creates a provider for read-only operations
 */
const getProvider = () => new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);

/**
 * Creates a provider and signer for blockchain interactions
 */
const getProviderAndSigner = () => {
  const provider = getProvider();
  if (!blockchainConfig.privateKey) {
    throw new Error('Private key not configured for blockchain transactions');
  }
  const signer = new ethers.Wallet(blockchainConfig.privateKey, provider);
  return { provider, signer };
};

/**
 * Verifies a user on the KYC Registry contract
 * @param {string} walletAddress - User's Ethereum address
 * @returns {Promise<string>} Transaction hash
 */
const verifyUser = async (walletAddress, documentHash) => {
  const { signer } = getProviderAndSigner();
  const contract = new ethers.Contract(
    blockchainConfig.contracts.kycRegistry,
    KYCRegistryABI,
    signer
  );
  const tx = await contract.verifyUser(walletAddress, documentHash);
  const receipt = await tx.wait();
  return receipt.hash;
};

/**
 * Updates credit score on the blockchain
 * @param {string} walletAddress - User's Ethereum address
 * @param {number} score - Credit score (300-850)
 * @returns {Promise<string>} Transaction hash
 */
const updateScore = async (walletAddress, score) => {
  const { signer } = getProviderAndSigner();
  const contract = new ethers.Contract(
    blockchainConfig.contracts.creditScore,
    CreditScoreABI,
    signer
  );
  const tx = await contract.updateScore(walletAddress, Math.floor(score));
  const receipt = await tx.wait();
  return receipt.hash;
};

/**
 * Parses a transaction receipt to extract loanId from LoanRequested event
 * Used when user submits tx from frontend (MetaMask)
 * @param {string} txHash - Transaction hash
 * @returns {Promise<number|null>} Loan ID or null
 */
const parseLoanIdFromTransaction = async (txHash) => {
  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || !receipt.logs) return null;
  const iface = new ethers.Interface([
    'event LoanRequested(uint256 indexed loanId, address indexed borrower, uint8 loanType, uint256 amount, uint256 duration, bool collateralRequired)',
  ]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === 'LoanRequested') {
        return Number(parsed.args.loanId);
      }
    } catch (_) {
      continue;
    }
  }
  const contract = new ethers.Contract(
    blockchainConfig.contracts.loanManager,
    LoanManagerABI,
    provider
  );
  return Number(await contract.loanCounter());
};

/**
 * Approves a loan (admin only)
 * @param {number} loanId - Loan ID to approve
 * @returns {Promise<string>} Transaction hash
 */
const approveLoan = async (loanId) => {
  const { signer } = getProviderAndSigner();
  const contract = new ethers.Contract(
    blockchainConfig.contracts.loanManager,
    LoanManagerABI,
    signer
  );
  const tx = await contract.approveLoan(loanId);
  const receipt = await tx.wait();
  return receipt.hash;
};

/**
 * Deposits collateral for a loan (user must sign - this is called from frontend)
 * Backend provides the interface for checking collateral status
 * @param {number} loanId - Loan ID
 * @param {string} amountWei - Amount in wei
 * @param {string} userPrivateKey - User's private key (for signing) - In production use MetaMask
 */
const depositCollateral = async (loanId, amountWei, userPrivateKey) => {
  const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
  const signer = new ethers.Wallet(userPrivateKey, provider);
  const contract = new ethers.Contract(
    blockchainConfig.contracts.collateralManager,
    CollateralManagerABI,
    signer
  );
  const tx = await contract.depositCollateral(loanId, { value: amountWei });
  const receipt = await tx.wait();
  return receipt.hash;
};

/**
 * Gets loan details from blockchain
 * @param {number} loanId - Loan ID
 * @returns {Promise<Object>} Loan details
 */
const getLoanFromBlockchain = async (loanId) => {
  const provider = getProvider();
  const contract = new ethers.Contract(
    blockchainConfig.contracts.loanManager,
    LoanManagerABI,
    provider
  );
  const loan = await contract.getLoan(loanId);
  const loanTypes = ['Personal', 'Home', 'Business'];
  return {
    loanId: Number(loan[0]),
    borrower: loan[1],
    loanType: loanTypes[Number(loan[2])],
    amount: loan[3].toString(),
    duration: Number(loan[4]),
    collateralRequired: loan[5],
    approved: loan[6],
    repaid: loan[7],
    interestRateBps: Number(loan[8]),
    dueDate: Number(loan[9]),
    totalRepayment: loan[10].toString(),
    defaulted: loan[11],
  };
};

/**
 * Requests a loan directly from the backend signer (optional flow)
 * @param {number} loanTypeEnum - 0 = Personal, 1 = Home, 2 = Business
 * @param {string} amountWei - amount in wei
 * @param {number} durationDays - duration in days
 * @returns {Promise<{txHash: string, loanId: number|null}>}
 */
const requestLoanOnChain = async (loanTypeEnum, amountWei, durationDays) => {
  const { signer } = getProviderAndSigner();
  const contract = new ethers.Contract(
    blockchainConfig.contracts.loanManager,
    LoanManagerABI,
    signer
  );
  const tx = await contract.requestLoan(loanTypeEnum, amountWei, durationDays);
  const receipt = await tx.wait();
  const iface = new ethers.Interface(LoanManagerABI);
  let loanId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === 'LoanRequested') {
        loanId = Number(parsed.args.loanId);
        break;
      }
    } catch (_) {
      continue;
    }
  }
  if (!loanId) {
    loanId = Number(await contract.loanCounter());
  }
  return { txHash: receipt.hash, loanId };
};

/**
 * Repays a loan directly from the backend signer (optional/testing flow)
 */
const repayLoanOnChain = async (loanId, amountWei) => {
  const { signer } = getProviderAndSigner();
  const contract = new ethers.Contract(
    blockchainConfig.contracts.loanManager,
    LoanManagerABI,
    signer
  );
  const tx = await contract.repayLoan(loanId, { value: amountWei });
  const receipt = await tx.wait();
  return receipt.hash;
};

/**
 * Checks if user is KYC verified on blockchain
 * @param {string} walletAddress - User's address
 * @returns {Promise<boolean>}
 */
const isUserVerified = async (walletAddress) => {
  const provider = getProvider();
  const contract = new ethers.Contract(
    blockchainConfig.contracts.kycRegistry,
    KYCRegistryABI,
    provider
  );
  return contract.isVerified(walletAddress);
};

/**
 * Gets credit score from blockchain
 * @param {string} walletAddress - User's address
 * @returns {Promise<number>}
 */
const getCreditScoreFromBlockchain = async (walletAddress) => {
  const provider = getProvider();
  const contract = new ethers.Contract(
    blockchainConfig.contracts.creditScore,
    CreditScoreABI,
    provider
  );
  const score = await contract.getScore(walletAddress);
  return Number(score);
};

module.exports = {
  verifyUser,
  updateScore,
  approveLoan,
  depositCollateral,
  getLoanFromBlockchain,
  isUserVerified,
  getCreditScoreFromBlockchain,
  parseLoanIdFromTransaction,
  requestLoanOnChain,
  repayLoanOnChain,
  ethers,
};

/**
 * Credit Score Service
 * Calculates credit score based on user factors and syncs with blockchain
 */
const User = require('../models/User');
const Loan = require('../models/Loan');
const blockchainService = require('./blockchainService');

/**
 * Calculates credit score using the formula:
 * score = 300 + (incomeFactor * 150) + (repaymentHistory * 250) + (assetFactor * 150) + (loanHistory * 150)
 * Total max: 300 + 150 + 250 + 150 + 150 = 1000, capped at 850
 * @param {Object} user - User document
 * @param {Array} loans - User's loan history
 * @returns {number} Credit score between 300 and 850
 */
const calculateCreditScore = (user, loans) => {
  const baseScore = 300;

  // Income factor (0-1): Higher income = higher score
  const incomeFactor = Math.min(user.income / 100000, 1) * 1;

  // Repayment history (0-1): Based on repaid vs total loans
  const repaidLoans = loans.filter((l) => l.status === 'repaid').length;
  const totalApprovedLoans = loans.filter((l) => l.status === 'repaid' || l.status === 'approved').length;
  const repaymentHistory = totalApprovedLoans > 0 ? (repaidLoans / totalApprovedLoans) * 1 : 0.5;

  // Asset factor (0-1): Based on collateral and loan amounts
  const hasCollateral = loans.some((l) => l.collateralAmount > 0);
  const assetFactor = hasCollateral ? 1 : 0.5;

  // Loan history (0-1): More successful loans = better score
  const successfulLoans = Math.min(loans.filter((l) => l.status === 'repaid').length, 5);
  const loanHistory = (successfulLoans / 5) * 1;

  const rawScore =
    baseScore +
    incomeFactor * 150 +
    repaymentHistory * 250 +
    assetFactor * 150 +
    loanHistory * 150;

  return Math.min(Math.max(Math.round(rawScore), 300), 850);
};

/**
 * Updates user's credit score in MongoDB and on blockchain
 * @param {string} userId - User ID
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<{score: number, txHash?: string}>}
 */
const updateUserCreditScore = async (userId, walletAddress) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const loans = await Loan.find({ userId });
  const score = calculateCreditScore(user, loans);

  user.creditScore = score;
  await user.save();

  let txHash = null;
  if (walletAddress && blockchainService.ethers.isAddress(walletAddress)) {
    try {
      txHash = await blockchainService.updateScore(walletAddress, score);
    } catch (err) {
      console.error('Blockchain credit score update failed:', err.message);
    }
  }

  return { score, txHash };
};

/**
 * Gets credit score for a user (from MongoDB)
 * @param {string} userId - User ID
 * @returns {Promise<number>}
 */
const getCreditScore = async (userId) => {
  const user = await User.findById(userId).select('creditScore');
  return user?.creditScore ?? 300;
};

module.exports = {
  calculateCreditScore,
  updateUserCreditScore,
  getCreditScore,
};

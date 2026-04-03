/**
 * Credit Score Controller
 * Handles credit score calculation and updates
 */
const creditScoreService = require('../services/creditScoreService');
const User = require('../models/User');

/**
 * @route   GET /api/credit-score
 * @desc    Get current user's credit score
 */
exports.getScore = async (req, res, next) => {
  try {
    const score = await creditScoreService.getCreditScore(req.user._id);
    res.json({
      success: true,
      data: { creditScore: score },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/credit-score/update
 * @desc    Recalculate and update credit score
 */
exports.updateScore = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address required for blockchain sync',
      });
    }
    const result = await creditScoreService.updateUserCreditScore(req.user._id, user.walletAddress);
    res.json({
      success: true,
      data: { score: result.score, txHash: result.txHash },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PUT /api/credit-score/income
 * @desc    Update user income (affects credit score calculation)
 */
exports.updateIncome = async (req, res, next) => {
  try {
    const income = typeof req.body.income === 'number' ? req.body.income : parseFloat(req.body.income);
    if (isNaN(income) || income < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid income value is required',
      });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { income },
      { new: true }
    );
    res.json({
      success: true,
      data: { income: user.income },
    });
  } catch (err) {
    next(err);
  }
};

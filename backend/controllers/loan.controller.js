/**
 * Loan Controller
 * Handles loan requests, approvals, and repayments
 */
const Loan = require('../models/Loan');
const User = require('../models/User');
const blockchainService = require('../services/blockchainService');
const creditScoreService = require('../services/creditScoreService');
const { ethers } = require('ethers');

/**
 * @route   POST /api/loan/request
 * @desc    Validate user and prepare loan request (user submits tx via MetaMask)
 */
exports.requestLoan = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { amount, duration, loanType, txHash } = req.body;

    if (!amount || !duration || !loanType) {
      return res.status(400).json({
        success: false,
        message: 'Amount, duration, and loanType are required',
      });
    }

    const validTypes = ['Personal', 'Home', 'Business'];
    if (!validTypes.includes(loanType)) {
      return res.status(400).json({
        success: false,
        message: 'Loan type must be Personal, Home, or Business',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.kycVerified) {
      return res.status(400).json({
        success: false,
        message: 'KYC verification required before applying for a loan',
      });
    }
    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address required. Connect MetaMask and update profile.',
      });
    }
    if (user.creditScore < 600) {
      return res.status(400).json({
        success: false,
        message: 'Credit score must be at least 600 to apply for a loan',
      });
    }

    const amountNum = parseFloat(amount);
    const durationNum = parseInt(duration, 10);
    if (amountNum <= 0 || durationNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount and duration must be positive',
      });
    }

    if (txHash) {
      const loanId = await blockchainService.parseLoanIdFromTransaction(txHash);
      if (!loanId) {
        return res.status(400).json({
          success: false,
          message: 'Could not parse loan from transaction',
        });
      }

      const blockchainLoan = await blockchainService.getLoanFromBlockchain(loanId);
      const loan = await Loan.create({
        loanId,
        userId,
        walletAddress: user.walletAddress.toLowerCase(),
        amount: ethers.formatEther(blockchainLoan.amount),
        duration: blockchainLoan.duration,
        loanType: blockchainLoan.loanType,
        status: blockchainLoan.approved ? 'approved' : 'pending',
        collateralRequired: blockchainLoan.collateralRequired,
        collateralAmount: 0,
        interestRateBps: blockchainLoan.interestRateBps,
        totalRepayment: Number(ethers.formatEther(blockchainLoan.totalRepayment)),
        dueDate: new Date(blockchainLoan.dueDate * 1000),
        txHash,
      });

      return res.status(201).json({
        success: true,
        data: loan,
      });
    }

    res.json({
      success: true,
      message: 'Validation passed. Submit transaction via MetaMask and send txHash to confirm.',
      data: {
        amount: amountNum,
        duration: durationNum,
        loanType,
        collateralRequired: loanType === 'Home',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/loan/:id
 * @desc    Get loan by ID
 */
exports.getLoan = async (req, res, next) => {
  try {
    const loan = await Loan.findOne({ loanId: parseInt(req.params.id, 10) }).populate('userId', 'name email walletAddress');
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    if (req.user.role !== 'admin' && loan.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, data: loan });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/loan/user/:userId
 * @desc    Get loans for a user
 */
exports.getUserLoans = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (req.user.role !== 'admin' && targetUserId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const loans = await Loan.find({ userId: targetUserId }).sort({ createdAt: -1 });
    res.json({ success: true, data: loans });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/loan/approve
 * @desc    Approve a loan (admin only)
 */
exports.approveLoan = async (req, res, next) => {
  try {
    const { loanId } = req.body;
    if (!loanId) {
      return res.status(400).json({
        success: false,
        message: 'Loan ID is required',
      });
    }

    const txHash = await blockchainService.approveLoan(parseInt(loanId, 10));
    await Loan.findOneAndUpdate(
      { loanId: parseInt(loanId, 10) },
      { status: 'approved' }
    );

    res.json({
      success: true,
      data: { loanId, txHash },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/loan/repay
 * @desc    Record repayment (user repays via MetaMask, backend updates MongoDB)
 */
exports.recordRepayment = async (req, res, next) => {
  try {
    const { loanId, txHash } = req.body;
    if (!loanId) {
      return res.status(400).json({
        success: false,
        message: 'Loan ID is required',
      });
    }

    const loan = await Loan.findOne({ loanId: parseInt(loanId, 10) });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    if (loan.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const blockchainLoan = await blockchainService.getLoanFromBlockchain(parseInt(loanId, 10));
    if (!blockchainLoan.repaid) {
      return res.status(400).json({
        success: false,
        message: 'Loan not yet repaid on blockchain. Complete repayment via MetaMask first.',
      });
    }

    loan.status = 'repaid';
    loan.repaidAt = new Date();
    if (txHash) loan.txHash = txHash;
    await loan.save();

    await creditScoreService.updateUserCreditScore(loan.userId, loan.walletAddress);

    res.json({
      success: true,
      data: loan,
    });
  } catch (err) {
    next(err);
  }
};

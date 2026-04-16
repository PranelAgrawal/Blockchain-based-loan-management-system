/**
 * Transaction Model
 * MongoDB schema for tracking blockchain transactions
 * Stores all on-chain activities (loan requests, approvals, repayments, etc.)
 */
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    transactionHash: {
      type: String,
      required: [true, 'Transaction hash is required'],
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    from: {
      type: String,
      required: [true, 'From address is required'],
      trim: true,
      lowercase: true,
    },
    to: {
      type: String,
      required: [true, 'Contract address is required'],
      trim: true,
      lowercase: true,
    },
    blockNumber: {
      type: Number,
      required: [true, 'Block number is required'],
    },
    blockHash: {
      type: String,
      trim: true,
    },
    transactionType: {
      type: String,
      enum: [
        'loanRequest',
        'loanApproval',
        'loanRepayment',
        'loanDefaulted',
        'kycVerification',
        'creditScoreUpdate',
        'collateralDeposit',
        'collateralRelease',
        'liquidityDeposit',
        'liquidityWithdraw',
      ],
      required: [true, 'Transaction type is required'],
    },
    related: {
      loanId: Number,
      userId: mongoose.Schema.Types.ObjectId,
      walletAddress: String,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending',
    },
    gasUsed: Number,
    gasPrice: String, // Store as string to handle large numbers
    value: String, // ETH value transferred, stored as string (wei)
    eventData: {},
    errorMessage: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: Date,
    failedAt: Date,
  },
  {
    timestamps: true,
    indexes: [
      { from: 1, timestamp: -1 },
      { transactionType: 1, status: 1 },
      { 'related.loanId': 1 },
      { 'related.userId': 1 },
    ],
  }
);

// Indexes for efficient querying
transactionSchema.index({ blockNumber: -1 });
transactionSchema.index({ status: 1, timestamp: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);

/**
 * Loan Model
 * MongoDB schema for loan records (mirrors blockchain state)
 */
const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    loanId: {
      type: Number,
      required: [true, 'Loan ID is required'],
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    walletAddress: {
      type: String,
      required: [true, 'Wallet address is required'],
      trim: true,
      lowercase: true,
    },
    amount: {
      type: Number,
      required: [true, 'Loan amount is required'],
      min: [0.0001, 'Amount must be greater than 0'],
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 day'],
    },
    loanType: {
      type: String,
      enum: ['Personal', 'Home', 'Business'],
      required: [true, 'Loan type is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'repaid', 'defaulted'],
      default: 'pending',
    },
    collateralRequired: {
      type: Boolean,
      default: false,
    },
    collateralAmount: {
      type: Number,
      default: 0,
    },
    interestRateBps: {
      type: Number,
    },
    totalRepayment: {
      type: Number,
    },
    dueDate: {
      type: Date,
    },
    txHash: {
      type: String,
      trim: true,
    },
    repaidAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
loanSchema.index({ loanId: 1 }, { unique: true });
loanSchema.index({ userId: 1 });
loanSchema.index({ walletAddress: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ createdAt: -1 });
loanSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Loan', loanSchema);

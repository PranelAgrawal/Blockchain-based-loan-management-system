/**
 * KYC Model
 * MongoDB schema for KYC verification documents and status
 */
const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    documentUrl: {
      type: String,
      trim: true,
    },
    documentType: {
      type: String,
      enum: ['passport', 'id_card', 'drivers_license'],
      default: 'id_card',
    },
    aadhaarNumber: {
      type: String,
      required: [true, 'Aadhaar number is required'],
      unique: true,
      sparse: true, // Allow existing records without it initially if needed, but we'll enforce it for new ones
      trim: true,
      match: [/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'],
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verifiedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    blockchainVerified: {
      type: Boolean,
      default: false,
    },
    txHash: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
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
kycSchema.index({ userId: 1 }, { unique: true });
kycSchema.index({ status: 1 });
kycSchema.index({ createdAt: -1 });

module.exports = mongoose.model('KYC', kycSchema);

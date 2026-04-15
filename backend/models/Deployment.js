/**
 * Deployment Model
 * MongoDB schema for tracking smart contract deployments across networks
 * Useful for managing multiple deployments (testnet, mainnet, etc.)
 */
const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema(
  {
    network: {
      type: String,
      required: [true, 'Network name is required'],
      enum: ['localhost', 'sepolia', 'mainnet', 'arbitrum', 'polygon'],
    },
    chainId: {
      type: Number,
      required: [true, 'Chain ID is required'],
    },
    deployer: {
      type: String,
      required: [true, 'Deployer address is required'],
      trim: true,
      lowercase: true,
    },
    contracts: {
      kycRegistry: {
        address: String,
        deploymentHash: String,
        deploymentBlock: Number,
      },
      creditScore: {
        address: String,
        deploymentHash: String,
        deploymentBlock: Number,
      },
      loanManager: {
        address: String,
        deploymentHash: String,
        deploymentBlock: Number,
      },
      collateralManager: {
        address: String,
        deploymentHash: String,
        deploymentBlock: Number,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending',
    },
    deploymentTime: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: Date,
    failedAt: Date,
    failureReason: String,
    notes: String,
  },
  {
    timestamps: true,
    indexes: [
      { network: 1, chainId: 1 },
      { deployer: 1 },
      { status: 1 },
      { deploymentTime: -1 },
    ],
  }
);

// Ensure only one active deployment per network
deploymentSchema.index({ network: 1, status: 1 }, { sparse: true });

module.exports = mongoose.model('Deployment', deploymentSchema);

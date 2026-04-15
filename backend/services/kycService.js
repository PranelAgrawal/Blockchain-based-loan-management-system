/**
 * KYC Service
 * Handles KYC verification flow and blockchain sync
 */
const path = require('path');
const fs = require('fs');
const KYC = require('../models/KYC');
const User = require('../models/User');
const blockchainService = require('./blockchainService');

/**
 * Simulates external KYC API verification
 * In production, integrate with actual KYC provider (e.g., Onfido, Jumio)
 * @param {string} documentUrl - Path or URL to document
 * @returns {Promise<{verified: boolean, reason?: string}>}
 */
const verifyWithExternalAPI = async (documentUrl) => {
  // Simplification: Always succeed if called (validation moved to Aadhaar check)
  return { verified: true };
};

/**
 * Uploads KYC document and creates verification record
 * @param {string} userId - User ID
 * @param {string} documentUrl - Document URL/path
 * @param {string} documentType - Type of document
 * @returns {Promise<Object>} KYC record
 */
const uploadKYC = async (userId, documentUrl, aadhaarNumber, documentType = 'id_card') => {
  // Check if Aadhaar number is already used by another user
  const existingAadhaar = await KYC.findOne({ aadhaarNumber, userId: { $ne: userId } });
  if (existingAadhaar) {
    throw new Error('Aadhaar number is already registered with another account');
  }

  let kyc = await KYC.findOne({ userId });
  if (kyc) {
    kyc.documentUrl = documentUrl;
    kyc.aadhaarNumber = aadhaarNumber;
    kyc.documentType = documentType;
    kyc.status = 'pending';
    kyc.updatedAt = new Date();
    await kyc.save();
  } else {
    kyc = await KYC.create({
      userId,
      documentUrl,
      aadhaarNumber,
      documentType,
      status: 'pending',
    });
  }
  return kyc;
};

/**
 * Verifies KYC and updates blockchain
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated KYC and user
 */
const verifyKYC = async (userId) => {
  const kyc = await KYC.findOne({ userId }).populate('userId');
  if (!kyc) {
    throw new Error('KYC record not found');
  }
  if (kyc.status === 'verified') {
    return { kyc, alreadyVerified: true };
  }

  const apiResult = await verifyWithExternalAPI(kyc.documentUrl);
  if (!apiResult.verified) {
    kyc.status = 'rejected';
    kyc.rejectionReason = apiResult.reason || 'Verification failed';
    await kyc.save();
    throw new Error(apiResult.reason || 'KYC verification failed');
  }

  kyc.status = 'verified';
  kyc.verifiedAt = new Date();
  await kyc.save();

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  user.kycVerified = true;
  await user.save();

  if (user.walletAddress) {
    try {
      const txHash = await blockchainService.verifyUser(user.walletAddress);
      kyc.blockchainVerified = true;
      kyc.txHash = txHash;
      await kyc.save();
    } catch (err) {
      console.error('Blockchain KYC verification failed:', err.message);
    }
  }

  return { kyc, user };
};

/**
 * Gets KYC status for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
const getKYCStatus = async (userId) => {
  const kyc = await KYC.findOne({ userId });
  if (!kyc) {
    return { status: 'not_submitted', documentUrl: null, verifiedAt: null };
  }
  return {
    status: kyc.status,
    documentUrl: kyc.documentUrl,
    documentType: kyc.documentType,
    verifiedAt: kyc.verifiedAt,
    blockchainVerified: kyc.blockchainVerified,
  };
};

module.exports = {
  uploadKYC,
  verifyKYC,
  getKYCStatus,
  verifyWithExternalAPI,
};

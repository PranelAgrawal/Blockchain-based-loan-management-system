/**
 * KYC Controller
 * Handles KYC document upload and verification
 */
const kycService = require('../services/kycService');
const path = require('path');
const fs = require('fs');

/**
 * @route   POST /api/kyc/upload
 * @desc    Upload KYC document
 */
exports.upload = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { aadhaarNumber, documentType } = req.body;
    
    if (!aadhaarNumber) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar number is required',
      });
    }

    if (!/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Aadhaar format. Must be 12 digits.',
      });
    }

    const kyc = await kycService.uploadKYC(userId, null, aadhaarNumber, documentType || 'id_card');
    res.status(201).json({
      success: true,
      data: {
        status: kyc.status,
        aadhaarNumber: kyc.aadhaarNumber,
        documentType: kyc.documentType,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/kyc/verify
 * @desc    Trigger KYC verification (admin or automated)
 */
exports.verify = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user._id.toString();
    const targetUserId = userId || currentUserId;

    // Fix: Allow users to verify themselves OR admins to verify anyone
    if (req.user.role !== 'admin' && targetUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to verify this user',
      });
    }

    const result = await kycService.verifyKYC(targetUserId);
    res.json({
      success: true,
      data: {
        kyc: result.kyc,
        user: result.user,
        alreadyVerified: result.alreadyVerified,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/kyc/status
 * @desc    Get KYC status for current user
 */
exports.getStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const status = await kycService.getKYCStatus(userId);
    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

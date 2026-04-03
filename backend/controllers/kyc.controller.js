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
    const { documentUrl, documentType } = req.body;

    if (!documentUrl) {
      return res.status(400).json({
        success: false,
        message: 'Document URL is required',
      });
    }

    const kyc = await kycService.uploadKYC(userId, documentUrl, documentType || 'id_card');
    res.status(201).json({
      success: true,
      data: {
        status: kyc.status,
        documentUrl: kyc.documentUrl,
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
    const targetUserId = userId || req.user._id;

    if (req.user.role !== 'admin' && targetUserId !== req.user._id.toString()) {
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

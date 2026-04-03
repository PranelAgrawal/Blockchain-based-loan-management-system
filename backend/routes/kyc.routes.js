/**
 * KYC Routes
 */
const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kyc.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/upload', protect, kycController.upload);
router.post('/verify', protect, kycController.verify);
router.get('/status', protect, kycController.getStatus);

module.exports = router;

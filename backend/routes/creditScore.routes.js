/**
 * Credit Score Routes
 */
const express = require('express');
const router = express.Router();
const creditScoreController = require('../controllers/creditScore.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, creditScoreController.getScore);
router.post('/update', protect, creditScoreController.updateScore);
router.put('/income', protect, creditScoreController.updateIncome);

module.exports = router;

/**
 * Loan Routes
 */
const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loan.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/request', protect, loanController.requestLoan);
router.get('/:id', protect, loanController.getLoan);
router.get('/user/:userId', protect, loanController.getUserLoans);
router.post('/approve', protect, adminOnly, loanController.approveLoan);
router.post('/repay', protect, loanController.recordRepayment);

module.exports = router;

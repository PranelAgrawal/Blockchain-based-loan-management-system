/**
 * Blockchain Loan System - Backend Server
 * Express server with MongoDB and blockchain integration
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const kycRoutes = require('./routes/kyc.routes');
const loanRoutes = require('./routes/loan.routes');
const creditScoreRoutes = require('./routes/creditScore.routes');
const { startLoanEventListener } = require('./services/loanEventListener');

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/credit-score', creditScoreRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Blockchain Loan System API is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start background blockchain event listeners
  startLoanEventListener();
});

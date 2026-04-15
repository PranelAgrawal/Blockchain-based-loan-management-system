/**
 * Blockchain Loan System - Backend Server
 * Express server with MongoDB and blockchain integration
 * Sepolia Testnet Support
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error.middleware');
const blockchainConfig = require('./config/blockchain');

// Routes
const authRoutes = require('./routes/auth.routes');
const kycRoutes = require('./routes/kyc.routes');
const loanRoutes = require('./routes/loan.routes');
const creditScoreRoutes = require('./routes/creditScore.routes');

// Event listeners (use new enhanced event listener)
const { startEventListener } = require('./services/eventListener');

// Connect to MongoDB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/credit-score', creditScoreRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Blockchain Loan System API is running',
    network: blockchainConfig.chainId === 11155111 ? 'Sepolia' : 'Unknown',
    contracts: blockchainConfig.contracts,
  });
});

// Blockchain status endpoint
app.get('/api/blockchain/status', (req, res) => {
  const configured = !!(
    blockchainConfig.contracts.loanManager &&
    blockchainConfig.rpcUrl
  );
  res.json({
    configured,
    network: blockchainConfig.chainId,
    rpcUrl: blockchainConfig.rpcUrl?.substring(0, 50) + '...',
    contracts: blockchainConfig.contracts,
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log('\n========== BACKEND SERVER STARTED ==========');
  console.log(`Server running on port ${PORT}`);
  console.log(`Network: ${blockchainConfig.chainId === 11155111 ? 'Sepolia' : 'Localhost'}`);
  console.log(`Chain ID: ${blockchainConfig.chainId}`);

  // Start blockchain event listener
  if (blockchainConfig.contracts.loanManager && blockchainConfig.rpcUrl) {
    console.log('\nInitializing blockchain event listener...');
    try {
      await startEventListener();
      console.log('✓ Event listener initialized successfully');
    } catch (error) {
      console.error('✗ Failed to start event listener:', error.message);
    }
  } else {
    console.warn('⚠ Event listener not started: Missing contract addresses or RPC URL');
    console.warn('   Please set contract addresses in .env file after deployment');
  }

  console.log('=========================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});


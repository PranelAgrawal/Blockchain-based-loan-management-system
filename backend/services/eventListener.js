/**
 * Enhanced Event Listener Service
 * Monitors blockchain events and syncs with MongoDB
 * Supports Sepolia and other networks
 * Tracks all transaction types (loans, KYC, credit scores, collateral, etc.)
 */
const { ethers } = require('ethers');
const Loan = require('../models/Loan');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const blockchainConfig = require('../config/blockchain');
const creditScoreService = require('./creditScoreService');

// Event signatures for all contracts
const EventSignatures = {
  LoanRequested: 'event LoanRequested(uint256 indexed loanId, address indexed borrower, uint8 loanType, uint256 amount, uint256 duration, bool collateralRequired)',
  LoanApproved: 'event LoanApproved(uint256 indexed loanId, address indexed borrower)',
  LoanRepaid: 'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestPaid)',
  LoanDefaulted: 'event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 timestamp)',
  CollateralDeposited: 'event CollateralDeposited(uint256 indexed loanId, address indexed borrower, uint256 amount)',
  CollateralReleased: 'event CollateralReleased(uint256 indexed loanId, address indexed borrower, uint256 amount)',
};

let eventListenerActive = false;
let lastProcessedBlock = null;

/**
 * Create provider for Sepolia
 */
const getProvider = () => {
  return new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
};

/**
 * Record transaction in database
 */
const recordTransaction = async (txData) => {
  try {
    const transaction = new Transaction({
      transactionHash: txData.hash.toLowerCase(),
      from: txData.from.toLowerCase(),
      to: txData.to.toLowerCase(),
      blockNumber: txData.blockNumber,
      blockHash: txData.blockHash,
      transactionType: txData.type,
      related: txData.related || {},
      status: 'confirmed',
      gasUsed: txData.gasUsed,
      gasPrice: txData.gasPrice.toString(),
      value: txData.value.toString(),
      eventData: txData.eventData || {},
      confirmedAt: new Date(),
    });

    await transaction.save();
    return transaction;
  } catch (error) {
    console.error('Error recording transaction:', error);
  }
};

/**
 * Handle LoanRequested event
 */
const handleLoanRequested = async (args, txData) => {
  try {
    const loanId = Number(args.loanId);
    const borrower = args.borrower.toLowerCase();
    const loanTypes = ['Personal', 'Home', 'Business'];
    const loanType = loanTypes[Number(args.loanType)] || 'Personal';
    const amountEth = parseFloat(ethers.formatEther(args.amount));
    const durationDays = Number(args.duration);
    const collateralRequired = Boolean(args.collateralRequired);

    // Find user
    const user = await User.findOne({ walletAddress: borrower });
    if (!user) {
      console.warn(`User not found for wallet: ${borrower}`);
      return;
    }

    // Create or update loan
    const loan = await Loan.findOneAndUpdate(
      { loanId },
      {
        loanId,
        userId: user._id,
        walletAddress: borrower,
        amount: amountEth,
        duration: durationDays,
        loanType,
        status: 'pending',
        collateralRequired,
        txHash: txData.hash,
      },
      { upsert: true, new: true }
    );

    // Record transaction
    await recordTransaction({
      hash: txData.hash,
      from: borrower,
      to: blockchainConfig.contracts.loanManager,
      blockNumber: txData.blockNumber,
      blockHash: txData.blockHash,
      type: 'loanRequest',
      gasUsed: txData.gasUsed,
      gasPrice: txData.gasPrice,
      value: args.amount,
      related: {
        loanId: loanId,
        userId: user._id,
        walletAddress: borrower,
      },
      eventData: {
        loanType,
        amount: amountEth,
        duration: durationDays,
        collateralRequired,
      },
    });

    console.log(`✓ Loan requested: ID=${loanId}, Borrower=${borrower}, Amount=${amountEth} ETH`);
  } catch (error) {
    console.error('Error handling LoanRequested event:', error);
  }
};

/**
 * Handle LoanApproved event
 */
const handleLoanApproved = async (args, txData) => {
  try {
    const loanId = Number(args.loanId);
    const approver = args.approver?.toLowerCase() || 'admin';

    const loan = await Loan.findOneAndUpdate(
      { loanId },
      { status: 'approved' },
      { new: true }
    );

    if (loan) {
      await recordTransaction({
        hash: txData.hash,
        from: approver,
        to: blockchainConfig.contracts.loanManager,
        blockNumber: txData.blockNumber,
        blockHash: txData.blockHash,
        type: 'loanApproval',
        gasUsed: txData.gasUsed,
        gasPrice: txData.gasPrice,
        value: BigInt(0),
        related: {
          loanId: loanId,
          userId: loan.userId,
          walletAddress: loan.walletAddress,
        },
      });

      console.log(`✓ Loan approved: ID=${loanId}`);
    }
  } catch (error) {
    console.error('Error handling LoanApproved event:', error);
  }
};

/**
 * Handle LoanRepaid event
 */
const handleLoanRepaid = async (args, txData) => {
  try {
    const loanId = Number(args.loanId);
    const borrower = args.borrower.toLowerCase();
    const amountEth = parseFloat(ethers.formatEther(args.amount));
    const interestEth = parseFloat(ethers.formatEther(args.interestPaid));

    const loan = await Loan.findOneAndUpdate(
      { loanId },
      {
        status: 'repaid',
        repaidAt: new Date(),
        totalRepayment: amountEth,
        txHash: txData.hash,
      },
      { new: true }
    );

    if (loan) {
      await recordTransaction({
        hash: txData.hash,
        from: borrower,
        to: blockchainConfig.contracts.loanManager,
        blockNumber: txData.blockNumber,
        blockHash: txData.blockHash,
        type: 'loanRepayment',
        gasUsed: txData.gasUsed,
        gasPrice: txData.gasPrice,
        value: args.amount,
        related: {
          loanId: loanId,
          userId: loan.userId,
          walletAddress: borrower,
        },
        eventData: {
          principal: amountEth,
          interest: interestEth,
        },
      });

      // Update credit score
      await creditScoreService.updateUserCreditScore(loan.userId, borrower);
      console.log(`✓ Loan repaid: ID=${loanId}, Amount=${amountEth} ETH, Interest=${interestEth} ETH`);
    }
  } catch (error) {
    console.error('Error handling LoanRepaid event:', error);
  }
};

/**
 * Handle LoanDefaulted event
 */
const handleLoanDefaulted = async (args, txData) => {
  try {
    const loanId = Number(args.loanId);
    const borrower = args.borrower.toLowerCase();

    const loan = await Loan.findOneAndUpdate(
      { loanId },
      { status: 'defaulted' },
      { new: true }
    );

    if (loan) {
      await recordTransaction({
        hash: txData.hash,
        from: 'admin',
        to: blockchainConfig.contracts.loanManager,
        blockNumber: txData.blockNumber,
        blockHash: txData.blockHash,
        type: 'loanDefaulted',
        gasUsed: txData.gasUsed,
        gasPrice: txData.gasPrice,
        value: BigInt(0),
        related: {
          loanId: loanId,
          userId: loan.userId,
          walletAddress: borrower,
        },
      });

      // Update credit score
      await creditScoreService.updateUserCreditScore(loan.userId, borrower);
      console.log(`✓ Loan defaulted: ID=${loanId}`);
    }
  } catch (error) {
    console.error('Error handling LoanDefaulted event:', error);
  }
};

/**
 * Process events from blockchain
 */
const processEvents = async (logs, txHash, blockNumber, blockHash) => {
  const provider = getProvider();
  const tx = await provider.getTransaction(txHash);
  if (!tx) return;

  // Get transaction receipt for gas info
  const receipt = await provider.getTransactionReceipt(txHash);

  const iface = new ethers.Interface([
    EventSignatures.LoanRequested,
    EventSignatures.LoanApproved,
    EventSignatures.LoanRepaid,
    EventSignatures.LoanDefaulted,
  ]);

  for (const log of logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (!parsed) continue;

      const txData = {
        hash: txHash,
        from: tx.from,
        to: tx.to,
        blockNumber,
        blockHash,
        gasUsed: receipt?.gasUsed || BigInt(0),
        gasPrice: tx.gasPrice || BigInt(0),
        value: tx.value || BigInt(0),
      };

      switch (parsed.name) {
        case 'LoanRequested':
          await handleLoanRequested(parsed.args, txData);
          break;
        case 'LoanApproved':
          await handleLoanApproved(parsed.args, txData);
          break;
        case 'LoanRepaid':
          await handleLoanRepaid(parsed.args, txData);
          break;
        case 'LoanDefaulted':
          await handleLoanDefaulted(parsed.args, txData);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error parsing event log:', error);
    }
  }
};

/**
 * Start monitoring events
 */
const startEventListener = async () => {
  if (eventListenerActive) {
    console.log('Event listener already active');
    return;
  }

  if (!blockchainConfig.contracts.loanManager || !blockchainConfig.rpcUrl) {
    console.warn('Event listener not started: contract address or RPC URL missing');
    return;
  }

  const provider = getProvider();
  eventListenerActive = true;

  console.log('✓ Event listener started on', blockchainConfig.rpcUrl);
  console.log('✓ Monitoring LoanManager at', blockchainConfig.contracts.loanManager);

  // Filter for LoanManager contract events
  const filter = {
    address: blockchainConfig.contracts.loanManager,
    topics: [
      null, // Match any event
    ],
  };

  // Listen for new events in real-time
  provider.on(filter, async (log) => {
    try {
      await processEvents([log], log.transactionHash, log.blockNumber, log.blockHash);
    } catch (error) {
      console.error('Error in event listener:', error);
    }
  });

  console.log('Successfully subscribed to LoanManager events');
};

/**
 * Stop monitoring events
 */
const stopEventListener = () => {
  eventListenerActive = false;
  console.log('Event listener stopped');
};

/**
 * Fetch historical events
 */
const fetchHistoricalEvents = async (fromBlock = 0, toBlock = 'latest') => {
  try {
    const provider = getProvider();

    const filter = {
      address: blockchainConfig.contracts.loanManager,
      fromBlock,
      toBlock,
    };

    console.log(`Fetching historical events from block ${fromBlock} to ${toBlock}`);
    const logs = await provider.getLogs(filter);
    console.log(`Found ${logs.length} events`);

    for (const log of logs) {
      await processEvents([log], log.transactionHash, log.blockNumber, log.blockHash);
    }
  } catch (error) {
    console.error('Error fetching historical events:', error);
  }
};

module.exports = {
  startEventListener,
  stopEventListener,
  fetchHistoricalEvents,
  recordTransaction,
};

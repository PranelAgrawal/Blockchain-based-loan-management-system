/**
 * Loan Event Listener
 * Listens to LoanManager events and keeps MongoDB in sync with on-chain state.
 */
const Loan = require('../models/Loan');
const User = require('../models/User');
const creditScoreService = require('./creditScoreService');
const blockchainConfig = require('../config/blockchain');
const { ethers } = require('./blockchainService');

const startLoanEventListener = () => {
  if (!blockchainConfig.contracts.loanManager || !blockchainConfig.rpcUrl) {
    console.warn('Loan event listener not started: contract address or RPC URL missing');
    return;
  }

  const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);

  const loanManagerInterface = new ethers.Interface([
    'event LoanRequested(uint256 indexed loanId, address indexed borrower, uint8 loanType, uint256 amount, uint256 duration, bool collateralRequired)',
    'event LoanApproved(uint256 indexed loanId, address indexed borrower)',
    'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestPaid)',
    'event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 timestamp)',
  ]);

  provider.on(
    {
      address: blockchainConfig.contracts.loanManager,
      topics: [],
    },
    async (log) => {
      try {
        const parsed = loanManagerInterface.parseLog({ topics: log.topics, data: log.data });
        if (!parsed) return;

        const { name, args } = parsed;

        if (name === 'LoanRequested') {
          const loanId = Number(args.loanId);
          const borrower = (args.borrower || '').toLowerCase();
          const loanTypes = ['Personal', 'Home', 'Business'];
          const loanType = loanTypes[Number(args.loanType)] || 'Personal';
          const amountEth = parseFloat(ethers.formatEther(args.amount));
          const durationDays = Number(args.duration);
          const collateralRequired = Boolean(args.collateralRequired);

          const user = await User.findOne({ walletAddress: borrower });
          if (!user) return;

          await Loan.findOneAndUpdate(
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
              txHash: log.transactionHash,
            },
            { upsert: true, new: true }
          );
        }

        if (name === 'LoanApproved') {
          const loanId = Number(args.loanId);
          await Loan.findOneAndUpdate(
            { loanId },
            { status: 'approved' },
            { new: true }
          );
        }

        if (name === 'LoanRepaid') {
          const loanId = Number(args.loanId);
          const amountEth = parseFloat(ethers.formatEther(args.amount));

          const loan = await Loan.findOneAndUpdate(
            { loanId },
            { status: 'repaid', repaidAt: new Date(), totalRepayment: amountEth, txHash: log.transactionHash },
            { new: true }
          );

          if (loan) {
            await creditScoreService.updateUserCreditScore(loan.userId, loan.walletAddress);
          }
        }

        if (name === 'LoanDefaulted') {
          const loanId = Number(args.loanId);
          const loan = await Loan.findOneAndUpdate(
            { loanId },
            { status: 'defaulted' },
            { new: true }
          );

          if (loan) {
            await creditScoreService.updateUserCreditScore(loan.userId, loan.walletAddress);
          }
        }
      } catch (err) {
        console.error('Error processing loan event:', err);
      }
    }
  );

  console.log('Loan event listener started for contract', blockchainConfig.contracts.loanManager);
};

module.exports = {
  startLoanEventListener,
};


# Implementation Guide: Critical Fixes

This document provides production-ready code samples for the most critical architectural issues.

---

## 1. MULTI-PARTY VALIDATOR CONSENSUS

### File: `smart-contracts/ValidatorQuorum.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ValidatorQuorum
 * @dev Implements 2-of-3 consensus for critical operations
 * Validators: Regulatory Authority, Credit Rating Agency, Tax Authority
 */
contract ValidatorQuorum is Ownable, ReentrancyGuard {
    
    // Proposal states
    enum ProposalStatus { PENDING, APPROVED, REJECTED, EXECUTED }
    
    // Proposal types
    enum ProposalType { 
        APPROVE_LOAN, 
        VERIFY_KYC, 
        MARK_DEFAULT, 
        UPDATE_PARAMS
    }
    
    // Validator role
    enum ValidatorRole { 
        REGULATORY_AUTH, 
        CREDIT_AGENCY, 
        TAX_AUTHORITY 
    }
    
    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        address initiator;
        uint256 targetId; // loanId, userId, etc.
        address targetAddress;
        bytes encodedData; // Additional data
        
        // Voting
        mapping(address => bool) voted;
        mapping(address => bool) approval;
        uint256 approvalsCount;
        uint256 rejectionsCount;
        
        // Status
        ProposalStatus status;
        uint256 createdAt;
        uint256 votingDeadline; // 24 hours
        uint256 executedAt;
    }
    
    // Validator registry
    struct Validator {
        address nodeAddress;
        ValidatorRole role;
        bool active;
        uint256 slashableStake;
    }
    
    // Storage
    mapping(uint256 => Proposal) public proposals;
    mapping(address => Validator) public validators;
    address[] public validatorList;
    uint256 public proposalCounter;
    
    // Configuration
    uint256 public constant VOTING_PERIOD = 24 hours;
    uint256 public constant REQUIRED_APPROVALS = 2; // 2-of-3
    
    // External contract references
    address public loanManagerAddress;
    address public kycRegistryAddress;
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId, 
        ProposalType proposalType, 
        uint256 targetId,
        address initiator
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed validator,
        bool approval,
        ValidatorRole role
    );
    
    event ProposalFinalized(
        uint256 indexed proposalId,
        ProposalStatus status,
        uint256 approvalsCount,
        uint256 rejectionsCount
    );
    
    event ProposalExecuted(
        uint256 indexed proposalId,
        ProposalType proposalType
    );
    
    event ValidatorSlashed(
        address indexed validator,
        uint256 amount,
        string reason
    );
    
    // Modifiers
    modifier onlyValidator() {
        require(validators[msg.sender].active, "Only validators can call");
        _;
    }
    
    modifier proposalExists(uint256 proposalId) {
        require(proposals[proposalId].id > 0, "Proposal does not exist");
        _;
    }
    
    modifier proposalPending(uint256 proposalId) {
        require(
            proposals[proposalId].status == ProposalStatus.PENDING,
            "Proposal is not pending"
        );
        _;
    }
    
    // Constructor
    constructor(
        address _regulatoryAuth,
        address _creditAgency,
        address _taxAuthority
    ) {
        require(
            _regulatoryAuth != address(0) && 
            _creditAgency != address(0) && 
            _taxAuthority != address(0),
            "Invalid validator addresses"
        );
        
        // Register validators
        _registerValidator(_regulatoryAuth, ValidatorRole.REGULATORY_AUTH);
        _registerValidator(_creditAgency, ValidatorRole.CREDIT_AGENCY);
        _registerValidator(_taxAuthority, ValidatorRole.TAX_AUTHORITY);
    }
    
    // ==================== VALIDATOR MANAGEMENT ====================
    
    function _registerValidator(address nodeAddress, ValidatorRole role) internal {
        require(!validators[nodeAddress].active, "Already registered");
        validators[nodeAddress] = Validator({
            nodeAddress: nodeAddress,
            role: role,
            active: true,
            slashableStake: 0
        });
        validatorList.push(nodeAddress);
    }
    
    function deactivateValidator(address nodeAddress) external onlyOwner {
        require(validators[nodeAddress].active, "Already inactive");
        validators[nodeAddress].active = false;
    }
    
    function reactivateValidator(address nodeAddress) external onlyOwner {
        require(!validators[nodeAddress].active, "Already active");
        validators[nodeAddress].active = true;
    }
    
    // ==================== PROPOSAL CREATION ====================
    
    function proposeApproveLoan(
        address _loanManager,
        uint256 loanId,
        bytes memory encodedData
    ) external onlyValidator proposalPending(proposalCounter) returns (uint256) {
        require(_loanManager != address(0), "Invalid loan manager");
        return _createProposal(
            ProposalType.APPROVE_LOAN,
            loanId,
            _loanManager,
            encodedData
        );
    }
    
    function proposeVerifyKYC(
        address _kycRegistry,
        address userAddress,
        bytes memory encodedData
    ) external onlyValidator returns (uint256) {
        require(_kycRegistry != address(0), "Invalid KYC registry");
        return _createProposal(
            ProposalType.VERIFY_KYC,
            0,
            userAddress,
            encodedData
        );
    }
    
    function proposeMarkDefault(
        address _loanManager,
        uint256 loanId,
        bytes memory encodedData
    ) external onlyValidator returns (uint256) {
        return _createProposal(
            ProposalType.MARK_DEFAULT,
            loanId,
            _loanManager,
            encodedData
        );
    }
    
    function _createProposal(
        ProposalType proposalType,
        uint256 targetId,
        address targetAddress,
        bytes memory encodedData
    ) internal returns (uint256) {
        proposalCounter++;
        uint256 newProposalId = proposalCounter;
        
        Proposal storage proposal = proposals[newProposalId];
        proposal.id = newProposalId;
        proposal.proposalType = proposalType;
        proposal.initiator = msg.sender;
        proposal.targetId = targetId;
        proposal.targetAddress = targetAddress;
        proposal.encodedData = encodedData;
        proposal.status = ProposalStatus.PENDING;
        proposal.createdAt = block.timestamp;
        proposal.votingDeadline = block.timestamp + VOTING_PERIOD;
        
        emit ProposalCreated(newProposalId, proposalType, targetId, msg.sender);
        return newProposalId;
    }
    
    // ==================== VOTING ====================
    
    function voteOnProposal(
        uint256 proposalId,
        bool approval
    ) 
        external 
        onlyValidator 
        proposalExists(proposalId) 
        proposalPending(proposalId) 
        nonReentrant 
    {
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.votingDeadline, "Voting period ended");
        require(!proposal.voted[msg.sender], "Already voted");
        
        // Record vote
        proposal.voted[msg.sender] = true;
        proposal.approval[msg.sender] = approval;
        
        if (approval) {
            proposal.approvalsCount++;
        } else {
            proposal.rejectionsCount++;
        }
        
        emit VoteCast(
            proposalId,
            msg.sender,
            approval,
            validators[msg.sender].role
        );
        
        // Check if voting is complete
        _finalizeProposalIfReady(proposalId);
    }
    
    function _finalizeProposalIfReady(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        
        // If we have 2 approvals, mark approved
        if (proposal.approvalsCount >= REQUIRED_APPROVALS) {
            proposal.status = ProposalStatus.APPROVED;
            emit ProposalFinalized(
                proposalId,
                ProposalStatus.APPROVED,
                proposal.approvalsCount,
                proposal.rejectionsCount
            );
        }
        
        // If we have rejections that prevent approval, mark rejected
        if (proposal.rejectionsCount > (validatorList.length - REQUIRED_APPROVALS)) {
            proposal.status = ProposalStatus.REJECTED;
            emit ProposalFinalized(
                proposalId,
                ProposalStatus.REJECTED,
                proposal.approvalsCount,
                proposal.rejectionsCount
            );
        }
        
        // If voting period ended, finalize
        if (block.timestamp > proposal.votingDeadline) {
            if (proposal.status == ProposalStatus.PENDING) {
                if (proposal.approvalsCount >= REQUIRED_APPROVALS) {
                    proposal.status = ProposalStatus.APPROVED;
                } else {
                    proposal.status = ProposalStatus.REJECTED;
                }
                emit ProposalFinalized(
                    proposalId,
                    proposal.status,
                    proposal.approvalsCount,
                    proposal.rejectionsCount
                );
            }
        }
    }
    
    // ==================== EXECUTION ====================
    
    function executeProposal(uint256 proposalId) 
        external 
        nonReentrant 
        returns (bool) 
    {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.id > 0, "Proposal does not exist");
        require(
            proposal.status == ProposalStatus.APPROVED,
            "Proposal not approved"
        );
        require(proposal.executedAt == 0, "Already executed");
        
        proposal.executedAt = block.timestamp;
        proposal.status = ProposalStatus.EXECUTED;
        
        emit ProposalExecuted(proposalId, proposal.proposalType);
        
        return true;
    }
    
    // ==================== QUERY FUNCTIONS ====================
    
    function getProposal(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId)
        returns (
            uint256 id,
            ProposalType proposalType,
            address initiator,
            uint256 targetId,
            address targetAddress,
            uint256 approvalsCount,
            uint256 rejectionsCount,
            ProposalStatus status,
            uint256 votingDeadline,
            bool votingActive
        ) 
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.id,
            p.proposalType,
            p.initiator,
            p.targetId,
            p.targetAddress,
            p.approvalsCount,
            p.rejectionsCount,
            p.status,
            p.votingDeadline,
            block.timestamp <= p.votingDeadline && p.status == ProposalStatus.PENDING
        );
    }
    
    function getValidators() external view returns (address[] memory) {
        return validatorList;
    }
    
    function isValidator(address nodeAddress) external view returns (bool) {
        return validators[nodeAddress].active;
    }
    
    function hasVoted(uint256 proposalId, address validator) 
        external 
        view 
        proposalExists(proposalId)
        returns (bool) 
    {
        return proposals[proposalId].voted[validator];
    }
    
    function getValidatorVote(uint256 proposalId, address validator) 
        external 
        view 
        proposalExists(proposalId)
        returns (bool approval) 
    {
        require(proposals[proposalId].voted[validator], "No vote from validator");
        return proposals[proposalId].approval[validator];
    }
}
```

### Integration with LoanManager

```solidity
// smart-contracts/LoanManager.sol (Modified)
pragma solidity ^0.8.20;

import "./ValidatorQuorum.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LoanManager is ReentrancyGuard {
    
    ValidatorQuorum public validatorQuorum;
    
    constructor(
        address _validatorQuorum,
        address _kycRegistry,
        address _creditScore,
        address _collateralManager
    ) {
        validatorQuorum = ValidatorQuorum(_validatorQuorum);
        // ... other initializations
    }
    
    /**
     * @dev Approve loan (requires validator consensus)
     * Flow:
     * 1. Validator creates proposal via ValidatorQuorum
     * 2. Other validators vote
     * 3. After 2+ approvals, anyone can execute
     * 4. This function called with proposalId
     */
    function approveLoanWithConsensus(uint256 proposalId) 
        external 
        nonReentrant 
    {
        require(
            validatorQuorum.executeProposal(proposalId),
            "Proposal not approved by consensus"
        );
        
        // Get proposal details
        (
            uint256 loanId,
            ,
            ,
            ,
            ,
            ,
            ,
            ProposalStatus status,
            ,
        
        ) = validatorQuorum.getProposal(proposalId);
        
        require(status == ProposalStatus.EXECUTED, "Proposal not executed");
        
        // Now safe to execute loan approval
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "Loan does not exist");
        require(!loan.approved, "Already approved");
        
        loan.approved = true;
        totalLiquidity -= loan.amount;
        
        (bool success, ) = payable(loan.borrower).call{value: loan.amount}("");
        require(success, "Transfer failed");
        
        emit LoanApproved(loanId, loan.borrower);
    }
}
```

---

## 2. BLOCKCHAIN-DATABASE RECONCILIATION SERVICE

### File: `backend/services/reconciliationService.js`

```javascript
/**
 * Blockchain Reconciliation Service
 * Ensures MongoDB stays in sync with on-chain state
 * Runs periodically and detects divergences
 */

const Loan = require('../models/Loan');
const User = require('../models/User');
const blockchainService = require('./blockchainService');
const logger = require('../utils/logger');

/**
 * Reconciliation state tracker
 * Prevents duplicate reconciliation attempts
 */
class ReconciliationState {
    constructor() {
        this.isRunning = false;
        this.lastFullSync = null;
        this.lastSyncedBlockNumber = 0;
    }
}

const state = new ReconciliationState();

/**
 * Main reconciliation job
 * Should run every hour
 */
async function runFullReconciliation() {
    if (state.isRunning) {
        logger.warn('Reconciliation already running, skipping...');
        return;
    }
    
    state.isRunning = true;
    const startTime = Date.now();
    
    try {
        logger.info('Starting full blockchain reconciliation...');
        
        // Get all loans from blockchain
        const loanCounter = await blockchainService.getLoanCounter();
        for (let loanId = 1; loanId <= loanCounter; loanId++) {
            await reconcileLoanState(loanId);
        }
        
        state.lastFullSync = new Date();
        logger.info(
            `Full reconciliation complete. Duration: ${Date.now() - startTime}ms`
        );
        
    } catch (error) {
        logger.error('Reconciliation failed:', {
            error: error.message,
            stack: error.stack
        });
        // Don't throw - let next cycle retry
    } finally {
        state.isRunning = false;
    }
}

/**
 * Reconcile a single loan's state
 * @param {number} loanId - Loan ID
 */
async function reconcileLoanState(loanId) {
    try {
        // Get authoritative state from blockchain
        const blockchainLoan = await blockchainService.getLoanFromBlockchain(loanId);
        
        if (!blockchainLoan || !blockchainLoan.borrower || 
            blockchainLoan.borrower === '0x0000000000000000000000000000000000000000') {
            // Loan doesn't exist on blockchain
            logger.debug(`Loan ${loanId} not found on blockchain`);
            return;
        }
        
        // Get DB state
        let dbLoan = await Loan.findOne({ loanId });
        
        // Derive authoritative status from blockchain
        const authoritativeStatus = deriveStatusFromBlockchain(blockchainLoan);
        
        if (!dbLoan) {
            // Loan exists on chain but not in DB
            // Create it
            logger.warn(`Loan ${loanId} exists on blockchain but not in DB, creating...`);
            
            const user = await User.findOne({
                walletAddress: blockchainLoan.borrower.toLowerCase()
            });
            
            if (!user) {
                logger.error(
                    `Cannot reconcile loan ${loanId}: User not found for wallet ${blockchainLoan.borrower}`
                );
                return;
            }
            
            dbLoan = await Loan.create({
                loanId,
                userId: user._id,
                walletAddress: blockchainLoan.borrower.toLowerCase(),
                amount: parseFloat(ethers.formatEther(blockchainLoan.amount)),
                duration: blockchainLoan.duration,
                loanType: getLoanTypeName(blockchainLoan.loanType),
                status: authoritativeStatus,
                collateralRequired: blockchainLoan.collateralRequired,
                interestRateBps: blockchainLoan.interestRateBps,
                totalRepayment: parseFloat(
                    ethers.formatEther(blockchainLoan.totalRepayment)
                ),
                dueDate: new Date(blockchainLoan.dueDate * 1000),
            });
            
            logger.info(`Loan ${loanId} reconciled (created in DB)`);
            return;
        }
        
        // Check for divergence
        const actualStatus = dbLoan.status;
        
        if (actualStatus !== authoritativeStatus) {
            logger.warn(
                `Loan ${loanId} state divergence detected: ` +
                `DB="${actualStatus}", Blockchain="${authoritativeStatus}"`
            );
            
            // Update to blockchain state
            await Loan.updateOne(
                { loanId },
                { status: authoritativeStatus }
            );
            
            // Track this for audit
            await ReconciliationLog.create({
                loanId,
                divergenceType: 'STATUS_MISMATCH',
                dbState: actualStatus,
                blockchainState: authoritativeStatus,
                resolvedTo: authoritativeStatus,
                resolvedAt: new Date(),
                timestamp: new Date()
            });
        }
        
        // Check collateral amount
        const blockchainCollateral = await blockchainService
            .getCollateralAmount(loanId);
        
        if (blockchainCollateral !== dbLoan.collateralAmount) {
            logger.warn(
                `Loan ${loanId} collateral divergence: ` +
                `DB="${dbLoan.collateralAmount}", Blockchain="${blockchainCollateral}"`
            );
            
            await Loan.updateOne(
                { loanId },
                { collateralAmount: blockchainCollateral }
            );
        }
        
    } catch (error) {
        logger.error(`Failed to reconcile loan ${loanId}:`, error);
        // Continue with next loan on error
    }
}

/**
 * Derive loan status from blockchain state
 */
function deriveStatusFromBlockchain(blockchainLoan) {
    if (blockchainLoan.defaulted) {
        return 'defaulted';
    }
    if (blockchainLoan.repaid) {
        return 'repaid';
    }
    if (blockchainLoan.approved) {
        return 'approved';
    }
    return 'pending';
}

/**
 * Get loan type name from enum
 */
function getLoanTypeName(loanType) {
    const types = ['Personal', 'Home', 'Business'];
    return types[loanType] || 'Personal';
}

/**
 * Incremental sync (for block range)
 * More efficient than full sync
 */
async function runIncrementalReconciliation(fromBlock, toBlock) {
    try {
        logger.info(`Running incremental reconciliation from block ${fromBlock} to ${toBlock}`);
        
        // Get all loan events in this range
        const provider = blockchainService.getProvider();
        const loanManagerAddress = blockchainConfig.contracts.loanManager;
        
        const logs = await provider.getLogs({
            address: loanManagerAddress,
            fromBlock: fromBlock,
            toBlock: toBlock,
            topics: [
                // LoanRequested, LoanApproved, LoanRepaid, LoanDefaulted
            ]
        });
        
        const uniqueLoanIds = new Set();
        for (const log of logs) {
            // Parse log and extract loanId
            const loanId = parseLoanIdFromLog(log);
            if (loanId) uniqueLoanIds.add(loanId);
        }
        
        // Reconcile each affected loan
        for (const loanId of uniqueLoanIds) {
            await reconcileLoanState(loanId);
        }
        
        logger.info(`Incremental reconciliation complete. ${uniqueLoanIds.size} loans verified`);
        
    } catch (error) {
        logger.error('Incremental reconciliation failed:', error);
    }
}

/**
 * Schedule reconciliation jobs
 */
function startReconciliationScheduler() {
    // Full sync every hour
    setInterval(runFullReconciliation, 60 * 60 * 1000);
    
    // Run immediately on startup
    runFullReconciliation().catch(err => {
        logger.error('Initial reconciliation failed:', err);
    });
    
    logger.info('Reconciliation scheduler started');
}

/**
 * Reconciliation log model for audit trail
 * File: backend/models/ReconciliationLog.js
 */
const reconciliationLogSchema = new mongoose.Schema({
    loanId: {
        type: Number,
        required: true,
        index: true
    },
    divergenceType: {
        type: String,
        enum: ['STATUS_MISMATCH', 'COLLATERAL_MISMATCH', 'MISSING_ON_CHAIN', 'MISSING_IN_DB'],
        required: true
    },
    dbState: {},
    blockchainState: {},
    resolvedTo: String,
    resolvedAt: Date,
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

module.exports = {
    startReconciliationScheduler,
    runFullReconciliation,
    reconcileLoanState,
    runIncrementalReconciliation
};
```

---

## 3. IMPROVED LOAN REQUEST HANDLING (Race Condition Fix)

### File: `backend/controllers/loan.controller.js` (Refactored)

```javascript
/**
 * Loan Controller - Improved
 * Handles race conditions and transaction monitoring
 */

const Loan = require('../models/Loan');
const User = require('../models/User');
const blockchainService = require('../services/blockchainService');
const transactionMonitor = require('../services/transactionMonitor');
const { ethers } = require('ethers');

/**
 * Step 1: Validate user and prepare loan
 * - Returns transaction payload to be signed
 * 
 * @route   POST /api/loan/prepare-request
 * @desc    Prepare loan request (before MetaMask signing)
 */
exports.prepareRequestLoan = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { amount, duration, loanType } = req.body;
        
        // Validation
        if (!amount || !duration || !loanType) {
            return res.status(400).json({
                success: false,
                message: 'Amount, duration, and loanType are required'
            });
        }
        
        const validTypes = ['Personal', 'Home', 'Business'];
        if (!validTypes.includes(loanType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid loan type'
            });
        }
        
        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Pre-flight checks
        if (!user.kycVerified) {
            return res.status(400).json({
                success: false,
                message: 'KYC verification required'
            });
        }
        
        if (!user.walletAddress) {
            return res.status(400).json({
                success: false,
                message: 'Wallet address not found. Connect MetaMask first.'
            });
        }
        
        if (user.creditScore < 600) {
            return res.status(400).json({
                success: false,
                message: `Credit score too low (${user.creditScore} < 600)`
            });
        }
        
        // Numeric validation
        const amountNum = parseFloat(amount);
        const durationNum = parseInt(duration, 10);
        
        if (amountNum <= 0 || durationNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount and duration must be positive'
            });
        }
        
        // Generate transaction payload
        try {
            const txData = await blockchainService.generateRequestLoanTx(
                loanType,
                ethers.parseEther(amount.toString()),
                durationNum
            );
            
            // Return transaction data for user to sign
            res.json({
                success: true,
                data: {
                    to: txData.to,
                    data: txData.data,
                    from: user.walletAddress,
                    value: '0',
                    message: 'Sign this transaction with MetaMask'
                },
                nextStep: {
                    instruction: 'Sign with MetaMask and submit the txHash to /api/loan/confirm-request',
                    endpoint: '/api/loan/confirm-request',
                    method: 'POST',
                    payload: {
                        txHash: 'Hash returned by MetaMask after signing'
                    }
                }
            });
        } catch (err) {
            logger.error('Failed to generate tx:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to generate transaction'
            });
        }
        
    } catch (error) {
        next(error);
    }
};

/**
 * Step 2: Confirm loan request
 * - Monitor transaction
 * - Extract loanId
 * - Create DB record
 * 
 * @route   POST /api/loan/confirm-request
 * @desc    Confirm loan after transaction is signed/broadcast
 */
exports.confirmRequestLoan = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { txHash } = req.body;
        
        if (!txHash) {
            return res.status(400).json({
                success: false,
                message: 'txHash is required'
            });
        }
        
        if (!ethers.isHash(txHash)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transaction hash format'
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Monitor transaction with timeout
        let receipt;
        try {
            receipt = await transactionMonitor.waitForTransaction(
                txHash,
                12, // Require 12 confirmations
                60000 // 60 second timeout
            );
        } catch (err) {
            if (err.code === 'TIMEOUT') {
                return res.status(202).json({
                    success: false,
                    status: 'PENDING',
                    message: 'Transaction still pending. Check MetaMask status.',
                    txHash: txHash
                });
            }
            throw err;
        }
        
        if (receipt.status === 0) {
            return res.status(400).json({
                success: false,
                message: 'Transaction reverted on-chain'
            });
        }
        
        // Transaction confirmed! Now extract loanId
        let loanId;
        try {
            loanId = await blockchainService.parseLoanIdFromTransaction(txHash);
            if (!loanId) {
                throw new Error('Could not parse loanId from transaction');
            }
        } catch (err) {
            logger.error('Failed to parse loanId:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to extract loan ID from transaction'
            });
        }
        
        // Get loan details from blockchain
        let blockchainLoan;
        try {
            blockchainLoan = await blockchainService.getLoanFromBlockchain(loanId);
        } catch (err) {
            logger.error('Failed to fetch loan from blockchain:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch loan from blockchain'
            });
        }
        
        // Create or update DB record (idempotent)
        const loan = await Loan.findOneAndUpdate(
            { loanId },
            {
                $set: {
                    loanId,
                    userId,
                    walletAddress: user.walletAddress.toLowerCase(),
                    amount: parseFloat(ethers.formatEther(blockchainLoan.amount)),
                    duration: blockchainLoan.duration,
                    loanType: getLoanTypeName(blockchainLoan.loanType),
                    status: blockchainLoan.approved ? 'approved' : 'pending',
                    collateralRequired: blockchainLoan.collateralRequired,
                    interestRateBps: blockchainLoan.interestRateBps,
                    totalRepayment: parseFloat(
                        ethers.formatEther(blockchainLoan.totalRepayment)
                    ),
                    dueDate: new Date(blockchainLoan.dueDate * 1000),
                    txHash: txHash
                }
            },
            { upsert: true, new: true }
        );
        
        // Log successful creation
        logger.info(`Loan ${loanId} created for user ${userId}`, {
            amount: loan.amount,
            txHash: txHash
        });
        
        res.status(201).json({
            success: true,
            data: {
                loanId: loan.loanId,
                status: loan.status,
                amount: loan.amount,
                duration: loan.duration,
                totalRepayment: loan.totalRepayment,
                dueDate: loan.dueDate
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Get user's loans
 * @route   GET /api/loan/my-loans
 */
exports.getMyLoans = async (req, res, next) => {
    try {
        const userId = req.user._id;
        
        const loans = await Loan.find({ userId })
            .sort({ createdAt: -1 })
            .select('-txHash'); // Don't expose txHash to frontend
        
        res.json({
            success: true,
            count: loans.length,
            data: loans
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get specific loan
 * @route   GET /api/loan/:loanId
 */
exports.getLoan = async (req, res, next) => {
    try {
        const { loanId } = req.params;
        const userId = req.user._id;
        
        const loan = await Loan.findOne({ 
            loanId, 
            userId 
        });
        
        if (!loan) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }
        
        res.json({
            success: true,
            data: loan
        });
    } catch (error) {
        next(error);
    }
};

function getLoanTypeName(loanType) {
    const types = ['Personal', 'Home', 'Business'];
    return types[loanType] || 'Personal';
}

module.exports = exports;
```

---

## 4. IMPROVED KYC WITH EXPIRY

### File: `smart-contracts/KYCRegistry.sol` (Enhanced)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KYCRegistry
 * @dev Enhanced KYC with expiry, history, and multiple verifiers
 */
contract KYCRegistry {
    
    enum KYCStatus { UNVERIFIED, PENDING, VERIFIED, EXPIRED, REJECTED }
    
    struct KYCRecord {
        address user;
        bytes32 documentHash;
        address verifiedBy;
        uint256 verificationDate;
        uint256 expiryDate;
        KYCStatus status;
    }
    
    struct KYCHistory {
        KYCRecord[] records;
        uint256 latestIndex;
    }
    
    // Main storage
    mapping(address => KYCHistory) private kycHistory;
    mapping(address => KYCStatus) public currentStatus;
    
    // Authorized verifiers
    address[] public authorizedVerifiers;
    mapping(address => bool) public isVerifier;
    
    // Configuration
    uint256 public constant KYC_EXPIRY_PERIOD = 365 days;
    address public owner;
    
    // Events
    event KYCRequested(address indexed user, bytes32 documentHash);
    event KYCVerified(
        address indexed user, 
        address indexed verifiedBy, 
        uint256 expiryDate
    );
    event KYCExpired(address indexed user);
    event KYCRejected(address indexed user, address indexed rejectedBy);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyVerifier() {
        require(isVerifier[msg.sender], "Only authorized verifiers");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    // ==================== VERIFIER MANAGEMENT ====================
    
    function addVerifier(address verifierAddress) external onlyOwner {
        require(verifierAddress != address(0), "Invalid address");
        require(!isVerifier[verifierAddress], "Already verifier");
        
        isVerifier[verifierAddress] = true;
        authorizedVerifiers.push(verifierAddress);
        
        emit VerifierAdded(verifierAddress);
    }
    
    function removeVerifier(address verifierAddress) external onlyOwner {
        require(isVerifier[verifierAddress], "Not a verifier");
        
        isVerifier[verifierAddress] = false;
        // Don't remove from array to preserve history indices
        
        emit VerifierRemoved(verifierAddress);
    }
    
    // ==================== KYC SUBMISSION ====================
    
    function submitKYC(bytes32 documentHash) external {
        require(documentHash != bytes32(0), "Invalid document hash");
        
        KYCHistory storage history = kycHistory[msg.sender];
        
        // Create new record
        KYCRecord memory record = KYCRecord({
            user: msg.sender,
            documentHash: documentHash,
            verifiedBy: address(0),
            verificationDate: 0,
            expiryDate: 0,
            status: KYCStatus.PENDING
        });
        
        history.records.push(record);
        history.latestIndex = history.records.length - 1;
        currentStatus[msg.sender] = KYCStatus.PENDING;
        
        emit KYCRequested(msg.sender, documentHash);
    }
    
    // ==================== KYC VERIFICATION ====================
    
    function verifyUser(address user, bytes32 documentHash) 
        external 
        onlyVerifier 
    {
        require(user != address(0), "Invalid user address");
        require(documentHash != bytes32(0), "Invalid document hash");
        
        KYCHistory storage history = kycHistory[user];
        require(history.records.length > 0, "No KYC record found");
        
        // Get latest record
        KYCRecord storage latest = history.records[history.latestIndex];
        require(latest.status == KYCStatus.PENDING, "Not in pending state");
        require(latest.documentHash == documentHash, "Document hash mismatch");
        
        // Mark as verified
        latest.verifiedBy = msg.sender;
        latest.verificationDate = block.timestamp;
        latest.expiryDate = block.timestamp + KYC_EXPIRY_PERIOD;
        latest.status = KYCStatus.VERIFIED;
        
        currentStatus[user] = KYCStatus.VERIFIED;
        
        emit KYCVerified(user, msg.sender, latest.expiryDate);
    }
    
    function rejectKYC(address user, bytes32 documentHash) 
        external 
        onlyVerifier 
    {
        require(user != address(0), "Invalid user address");
        
        KYCHistory storage history = kycHistory[user];
        require(history.records.length > 0, "No KYC record found");
        
        KYCRecord storage latest = history.records[history.latestIndex];
        require(latest.status == KYCStatus.PENDING, "Not in pending state");
        
        latest.status = KYCStatus.REJECTED;
        currentStatus[user] = KYCStatus.REJECTED;
        
        emit KYCRejected(user, msg.sender);
    }
    
    // ==================== STATUS CHECKS ====================
    
    function isVerified(address user) external view returns (bool) {
        KYCStatus status = currentStatus[user];
        
        if (status != KYCStatus.VERIFIED) {
            return false;
        }
        
        // Check expiry
        KYCHistory storage history = kycHistory[user];
        if (history.records.length == 0) {
            return false;
        }
        
        KYCRecord storage latest = history.records[history.latestIndex];
        if (block.timestamp > latest.expiryDate) {
            return false;
        }
        
        return true;
    }
    
    function getKYCStatus(address user) 
        external 
        view 
        returns (
            KYCStatus status,
            uint256 expiryDate,
            bool isExpired,
            address verifiedBy
        ) 
    {
        KYCHistory storage history = kycHistory[user];
        
        if (history.records.length == 0) {
            return (KYCStatus.UNVERIFIED, 0, false, address(0));
        }
        
        KYCRecord storage latest = history.records[history.latestIndex];
        bool expired = block.timestamp > latest.expiryDate && latest.status == KYCStatus.VERIFIED;
        
        return (
            latest.status,
            latest.expiryDate,
            expired,
            latest.verifiedBy
        );
    }
    
    function getKYCHistory(address user) 
        external 
        view 
        returns (KYCRecord[] memory) 
    {
        return kycHistory[user].records;
    }
    
    // ==================== VERIFIER QUERIES ====================
    
    function getVerifiers() external view returns (address[] memory) {
        return authorizedVerifiers;
    }
}
```

---

## 5. TRANSACTION MONITOR UTILITY

### File: `backend/services/transactionMonitor.js`

```javascript
/**
 * Transaction Monitor
 * Monitors Ethereum transactions for confirmation
 * Handles timeouts and failure cases
 */

const blockchainService = require('./blockchainService');
const logger = require('../utils/logger');
const { ethers } = require('ethers');

class TransactionTimeout extends Error {
    constructor(txHash, maxWaitTime) {
        super(`Transaction ${txHash} did not confirm within ${maxWaitTime}ms`);
        this.code = 'TX_TIMEOUT';
        this.txHash = txHash;
    }
}

class TransactionFailed extends Error {
    constructor(txHash, reason) {
        super(`Transaction ${txHash} failed: ${reason}`);
        this.code = 'TX_FAILED';
        this.txHash = txHash;
        this.reason = reason;
    }
}

/**
 * Wait for transaction to be confirmed
 * @param {string} txHash - Transaction hash
 * @param {number} requiredConfirmations - Number of confirmations needed
 * @param {number} maxWaitTime - Maximum wait time in milliseconds
 * @returns {Promise<Object>} Transaction receipt
 */
async function waitForTransaction(
    txHash,
    requiredConfirmations = 12,
    maxWaitTime = 60000
) {
    const provider = blockchainService.getProvider();
    const startTime = Date.now();
    let receipt = null;
    let checkCount = 0;
    
    logger.info(`Monitoring transaction ${txHash} for ${requiredConfirmations} confirmations`);
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            checkCount++;
            receipt = await provider.getTransactionReceipt(txHash);
            
            if (!receipt) {
                // Not yet mined
                await delay(3000);
                continue;
            }
            
            // Transaction mined, check status
            if (receipt.status === 0) {
                throw new TransactionFailed(txHash, 'Transaction reverted');
            }
            
            if (receipt.status === null) {
                // Can't determine status yet, wait
                await delay(3000);
                continue;
            }
            
            // Check confirmations
            const currentBlock = await provider.getBlockNumber();
            const txBlock = receipt.blockNumber;
            const confirmations = currentBlock - txBlock + 1;
            
            logger.debug(
                `Transaction ${txHash} confirmations: ${confirmations}/${requiredConfirmations}`
            );
            
            if (confirmations >= requiredConfirmations) {
                logger.info(
                    `Transaction ${txHash} confirmed with ${confirmations} confirmations`
                );
                return receipt;
            }
            
            // Not enough confirmations yet
            await delay(3000);
            
        } catch (err) {
            if (err instanceof TransactionFailed) {
                throw err;
            }
            
            logger.warn(`Error checking transaction ${txHash}:`, err.message);
            
            // Network error, continue trying
            await delay(5000);
        }
    }
    
    // Timeout reached
    logger.warn(
        `Transaction ${txHash} did not confirm within ${maxWaitTime}ms after ${checkCount} checks`
    );
    
    throw new TransactionTimeout(txHash, maxWaitTime);
}

/**
 * Get transaction details
 */
async function getTransactionDetails(txHash) {
    const provider = blockchainService.getProvider();
    
    try {
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (!tx) {
            return null;
        }
        
        const currentBlock = await provider.getBlockNumber();
        const confirmations = receipt 
            ? currentBlock - receipt.blockNumber + 1 
            : 0;
        
        return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value.toString(),
            gasPrice: tx.gasPrice.toString(),
            gasLimit: tx.gasLimit.toString(),
            data: tx.data,
            nonce: tx.nonce,
            status: receipt?.status ?? null,
            blockNumber: receipt?.blockNumber ?? null,
            confirmations,
            transactionIndex: receipt?.transactionIndex ?? null,
            gasUsed: receipt?.gasUsed.toString() ?? null,
            cumulativeGasUsed: receipt?.cumulativeGasUsed.toString() ?? null,
            logs: receipt?.logs ?? []
        };
    } catch (err) {
        logger.error(`Failed to get transaction details:`, err);
        return null;
    }
}

/**
 * Cancel/replace a pending transaction (requires nonce management)
 */
async function replacePendingTransaction(
    originalTxHash,
    newGasPrice,
    privateKey
) {
    const provider = blockchainService.getProvider();
    const signer = new ethers.Wallet(privateKey, provider);
    
    try {
        const tx = await provider.getTransaction(originalTxHash);
        
        if (!tx) {
            throw new Error('Transaction not found');
        }
        
        // Send replacement with higher gas price
        const newTx = await signer.sendTransaction({
            to: tx.to,
            data: tx.data,
            value: tx.value,
            gasPrice: newGasPrice,
            nonce: tx.nonce // Same nonce replaces original
        });
        
        logger.info(
            `Replacement transaction sent: ${newTx.hash} (replacing ${originalTxHash})`
        );
        
        return newTx.hash;
        
    } catch (err) {
        logger.error('Failed to replace transaction:', err);
        throw err;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    waitForTransaction,
    TransactionTimeout,
    TransactionFailed,
    getTransactionDetails,
    replacePendingTransaction
};
```

---

## 6. Setup Instructions

### Install ValidatorQuorum

1. Deploy ValidatorQuorum first:
```bash
npx hardhat run scripts/deploy-validator-quorum.js --network testnet
```

2. Update configuration:
```javascript
// backend/config/blockchain.js
module.exports = {
    rpcUrl: process.env.RPC_URL,
    privateKey: process.env.PRIVATE_KEY,
    contracts: {
        validatorQuorum: '0x...', // newly deployed
        kycRegistry: '0x...',
        creditScore: '0x...',
        loanManager: '0x...',
        collateralManager: '0x...'
    }
};
```

3. Start reconciliation service in `backend/server.js`:
```javascript
const { startReconciliationScheduler } = require('./services/reconciliationService');
startReconciliationScheduler();
```

---

**Next Steps:**
- Test validator voting workflow
- Deploy to testnet
- Run comprehensive integration tests
- Monitor reconciliation logs

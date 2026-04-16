// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./KYCRegistry.sol";
import "./CreditScore.sol";
import "./CollateralManager.sol";
import "./BlockManager.sol";

/**
 * @title LoanManager
 * @dev Core contract for managing loan requests, approvals, repayments, and defaults
 */
contract LoanManager is Ownable, ReentrancyGuard {
    // Loan type enumeration
    enum LoanType {
        Personal,
        Home,
        Business
    }

    // Configuration for each loan type
    struct LoanConfig {
        uint256 interestRateBps; // annual interest rate in basis points (1% = 100 bps)
        uint256 collateralRatioBps; // required collateral as a percentage of loan amount (in bps)
        uint256 maxDurationSeconds; // maximum allowed duration in seconds
        bool enabled;
    }

    // Loan structure
    struct Loan {
        uint256 loanId;
        address borrower;
        LoanType loanType;
        uint256 amount;
        uint256 duration;
        bool collateralRequired;
        bool approved;
        bool repaid;
        uint256 collateralAmount;
        uint256 interestRateBps;
        uint256 dueDate;
        uint256 totalRepayment;
        bool defaulted;
    }

    // Storage
    mapping(uint256 => Loan) public loans;
    uint256 public loanCounter;

    // Liquidity pool (optional lender deposits)
    mapping(address => uint256) public lenderBalances;
    uint256 public totalLiquidity;

    // Contract references
    KYCRegistry public kycRegistry;
    CreditScore public creditScore;
    CollateralManager public collateralManager;
    BlockManager public blockManager;

    // Minimum credit score for loan eligibility
    uint256 public constant MIN_CREDIT_SCORE = 600;

    // Basis points denominator
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant ON_TIME_REPAYMENT_REWARD = 10;

    // Loan type specific configuration
    mapping(LoanType => LoanConfig) public loanConfigs;

    // Events
    event LoanRequested(uint256 indexed loanId, address indexed borrower, LoanType loanType, uint256 amount, uint256 duration, bool collateralRequired);
    event LoanApproved(uint256 indexed loanId, address indexed borrower);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestPaid);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 timestamp);
    event LiquidityDeposited(address indexed lender, uint256 amount);
    event LiquidityWithdrawn(address indexed lender, uint256 amount);

    constructor(address _kycRegistry, address _creditScore, address _collateralManager, address _blockManager) {
        kycRegistry = KYCRegistry(_kycRegistry);
        creditScore = CreditScore(_creditScore);
        collateralManager = CollateralManager(_collateralManager);
        blockManager = BlockManager(_blockManager);

        // Set some sane defaults for loan configs (can be updated by owner)
        loanConfigs[LoanType.Personal] = LoanConfig({
            interestRateBps: 800, // 8% APR
            collateralRatioBps: 0,
            maxDurationSeconds: 3600,
            enabled: true
        });

        loanConfigs[LoanType.Home] = LoanConfig({
            interestRateBps: 500, // 5% APR
            collateralRatioBps: 5000, // 50%
            maxDurationSeconds: 7200,
            enabled: true
        });

        loanConfigs[LoanType.Business] = LoanConfig({
            interestRateBps: 1000, // 10% APR
            collateralRatioBps: 3000, // 30%
            maxDurationSeconds: 5400,
            enabled: true
        });
    }

    /**
     * @dev Owner can update configuration for a loan type
     */
    function setLoanConfig(
        LoanType loanType,
        uint256 interestRateBps,
        uint256 collateralRatioBps,
        uint256 maxDurationSeconds,
        bool enabled
    ) external onlyOwner {
        require(collateralRatioBps <= BPS_DENOMINATOR, "LoanManager: Invalid collateral ratio");
        loanConfigs[loanType] = LoanConfig({
            interestRateBps: interestRateBps,
            collateralRatioBps: collateralRatioBps,
            maxDurationSeconds: maxDurationSeconds,
            enabled: enabled
        });
    }

    /**
     * @dev Optional liquidity deposit from lenders
     */
    function depositLiquidity() external payable nonReentrant {
        require(msg.value > 0, "LoanManager: Amount must be greater than 0");
        lenderBalances[msg.sender] += msg.value;
        totalLiquidity += msg.value;
        emit LiquidityDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw liquidity by lenders
     */
    function withdrawLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0, "LoanManager: Amount must be greater than 0");
        require(lenderBalances[msg.sender] >= amount, "LoanManager: Insufficient balance");
        require(totalLiquidity >= amount, "LoanManager: Insufficient pool liquidity");

        lenderBalances[msg.sender] -= amount;
        totalLiquidity -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "LoanManager: Withdraw transfer failed");

        emit LiquidityWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Request a new loan
     * @param loanType Type of loan (Personal, Home, Business)
     * @param amount Loan amount in wei
     * @param duration Loan duration in seconds
     */
    function requestLoan(LoanType loanType, uint256 amount, uint256 duration) external returns (uint256) {
        require(kycRegistry.isVerified(msg.sender), "LoanManager: User must be KYC verified");
        require(creditScore.getScore(msg.sender) >= MIN_CREDIT_SCORE, "LoanManager: Credit score must be at least 600");
        require(amount > 0, "LoanManager: Loan amount must be greater than 0");
        require(duration > 0, "LoanManager: Duration must be greater than 0");
        
        // Check if user has any active overdue or defaulted loans
        require(!hasOverdueOrDefaultedLoan(msg.sender), "LoanManager: Cannot request new loan while having overdue/defaulted loan");
        
        LoanConfig memory cfg = loanConfigs[loanType];
        require(cfg.enabled, "LoanManager: Loan type disabled");
        require(duration <= cfg.maxDurationSeconds, "LoanManager: Duration exceeds maximum for this loan type");

        bool collateralRequired = cfg.collateralRatioBps > 0;

        // Simple interest prorated by seconds over a 365-day year.
        uint256 interest = (amount * cfg.interestRateBps * duration) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
        uint256 totalRepayment = amount + interest;

        uint256 dueDate = block.timestamp + duration;

        loanCounter++;
        uint256 newLoanId = loanCounter;

        loans[newLoanId] = Loan({
            loanId: newLoanId,
            borrower: msg.sender,
            loanType: loanType,
            amount: amount,
            duration: duration,
            collateralRequired: collateralRequired,
            approved: false,
            repaid: false,
            collateralAmount: 0,
            interestRateBps: cfg.interestRateBps,
            dueDate: dueDate,
            totalRepayment: totalRepayment,
            defaulted: false
        });

        if (collateralRequired) {
            collateralManager.registerLoan(newLoanId, msg.sender);
        }

        // Log transaction to blockchain
        blockManager.addTransaction(msg.sender, "LoanRequest", amount, "Loan requested");

        emit LoanRequested(newLoanId, msg.sender, loanType, amount, duration, collateralRequired);
        return newLoanId;
    }

    /**
     * @dev Approve a loan (admin only)
     * @param loanId The ID of the loan to approve
     */
    function approveLoan(uint256 loanId) external onlyOwner nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "LoanManager: Loan does not exist");
        require(!loan.approved, "LoanManager: Loan already approved");
        require(!loan.repaid, "LoanManager: Loan already repaid");
        require(!loan.defaulted, "LoanManager: Loan is defaulted");

        LoanConfig memory cfg = loanConfigs[loan.loanType];
        if (loan.collateralRequired) {
            uint256 requiredCollateral = (loan.amount * cfg.collateralRatioBps) / BPS_DENOMINATOR;
            require(collateralManager.collateralAmount(loanId) >= requiredCollateral, "LoanManager: Insufficient collateral");
        }

        // ensure pool has enough liquidity to fund the loan, if using pool
        require(totalLiquidity >= loan.amount, "LoanManager: Insufficient liquidity");

        loan.approved = true;

        // transfer principal to borrower from pool
        totalLiquidity -= loan.amount;
        (bool success, ) = payable(loan.borrower).call{value: loan.amount}("");
        require(success, "LoanManager: Principal transfer failed");

        // Log transaction to blockchain
        blockManager.addTransaction(loan.borrower, "LoanApproval", loan.amount, "Loan approved");

        emit LoanApproved(loanId, loan.borrower);
    }

    /**
     * @dev Repay a loan
     * @param loanId The ID of the loan to repay
     */
    function repayLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "LoanManager: Only borrower can repay");
        require(loan.approved, "LoanManager: Loan must be approved first");
        require(!loan.repaid, "LoanManager: Loan already repaid");
        require(!loan.defaulted, "LoanManager: Loan is defaulted");
        require(msg.value >= loan.totalRepayment, "LoanManager: Insufficient repayment amount");

        loan.repaid = true;

        if (loan.collateralRequired) {
            collateralManager.releaseCollateral(loanId, loan.borrower);
        }

        // add repayment (principal + interest) back into liquidity pool
        totalLiquidity += msg.value;

        // Log transaction to blockchain
        blockManager.addTransaction(msg.sender, "LoanRepayment", msg.value, "Loan repaid on time");
        creditScore.increaseScore(loan.borrower, ON_TIME_REPAYMENT_REWARD);

        uint256 interestPaid = loan.totalRepayment - loan.amount;
        emit LoanRepaid(loanId, msg.sender, loan.totalRepayment, interestPaid);
    }

    /**
     * @dev Mark a loan as defaulted if overdue. Can be called by anyone.
     * Collateral (if any) is seized by the contract owner.
     * Credit score is penalized based on seconds overdue for demo-friendly timing.
     */
    function markLoanDefaulted(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower != address(0), "LoanManager: Loan does not exist");
        require(loan.approved, "LoanManager: Loan must be approved");
        require(!loan.repaid, "LoanManager: Loan already repaid");
        require(!loan.defaulted, "LoanManager: Loan already defaulted");
        require(block.timestamp > loan.dueDate, "LoanManager: Loan not overdue yet");

        loan.defaulted = true;

        if (loan.collateralRequired) {
            collateralManager.seizeCollateral(loanId, owner());
        }

        // Penalize credit score by 1 point per overdue second, with a minimum penalty of 10.
        uint256 secondsOverdue = block.timestamp - loan.dueDate;
        uint256 penalty = 10 + secondsOverdue;
        
        creditScore.decreaseScore(loan.borrower, penalty);

        // Log transaction to blockchain
        blockManager.addTransaction(loan.borrower, "LoanDefaulted", loan.amount, "Loan marked as defaulted");

        emit LoanDefaulted(loanId, loan.borrower, block.timestamp);
    }

    /**
     * @dev Repay a loan after due date with late payment penalty
     * @param loanId The ID of the loan to repay late
     */
    function repayLoanLate(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "LoanManager: Only borrower can repay");
        require(loan.approved, "LoanManager: Loan must be approved first");
        require(!loan.repaid, "LoanManager: Loan already repaid");
        require(block.timestamp > loan.dueDate, "LoanManager: Use repayLoan for on-time payments");
        require(msg.value >= loan.totalRepayment, "LoanManager: Insufficient repayment amount");

        // Penalize credit score by 1 point per late second, with a minimum penalty of 10.
        uint256 secondsLate = block.timestamp - loan.dueDate;
        uint256 penalty = 10 + secondsLate;
        creditScore.decreaseScore(loan.borrower, penalty);

        // Mark as repaid
        loan.repaid = true;

        // Clear defaulted status since loan is now repaid
        loan.defaulted = false;

        if (loan.collateralRequired) {
            collateralManager.releaseCollateral(loanId, loan.borrower);
        }

        // Add repayment back into liquidity pool
        totalLiquidity += msg.value;

        blockManager.addTransaction(msg.sender, "LoanRepayment", msg.value, "Loan repaid late");

        uint256 interestPaid = loan.totalRepayment - loan.amount;
        emit LoanRepaid(loanId, msg.sender, loan.totalRepayment, interestPaid);
    }

    /**
     * @dev Check if user has any active overdue or defaulted loans
     * @param borrower The address to check
     * @return bool True if user has overdue/defaulted loans
     */
    function hasOverdueOrDefaultedLoan(address borrower) public view returns (bool) {
        for (uint256 i = 1; i <= loanCounter; i++) {
            Loan memory loan = loans[i];
            if (loan.borrower == borrower) {
                // Check if loan is approved but not repaid and is overdue or defaulted
                if (loan.approved && !loan.repaid && (loan.defaulted || block.timestamp > loan.dueDate)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @dev Get loan details
     * @param loanId The ID of the loan
     */
    function getLoan(uint256 loanId) external view returns (
        uint256 _loanId,
        address borrower,
        LoanType loanType,
        uint256 amount,
        uint256 duration,
        bool collateralRequired,
        bool approved,
        bool repaid,
        uint256 interestRateBps,
        uint256 dueDate,
        uint256 totalRepayment,
        bool defaulted
    ) {
        Loan memory loan = loans[loanId];
        return (
            loan.loanId,
            loan.borrower,
            loan.loanType,
            loan.amount,
            loan.duration,
            loan.collateralRequired,
            loan.approved,
            loan.repaid,
            loan.interestRateBps,
            loan.dueDate,
            loan.totalRepayment,
            loan.defaulted
        );
    }
}

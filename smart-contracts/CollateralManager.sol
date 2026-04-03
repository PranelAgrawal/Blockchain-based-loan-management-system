// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CollateralManager
 * @dev Manages collateral deposits, releases, and seizures for loans
 */
contract CollateralManager is ReentrancyGuard {
    // Mapping of loan ID to collateral amount in wei
    mapping(uint256 => uint256) public collateralAmount;

    // Mapping of loan ID to borrower address
    mapping(uint256 => address) public loanBorrowers;

    // Admin address (LoanManager contract)
    address public admin;

    // Event emitted when collateral is deposited
    event CollateralDeposited(uint256 indexed loanId, address indexed borrower, uint256 amount);

    // Event emitted when collateral is released
    event CollateralReleased(uint256 indexed loanId, address indexed borrower, uint256 amount);

    // Modifier to restrict functions to admin only
    modifier onlyAdmin() {
        require(msg.sender == admin, "CollateralManager: Only admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Sets the admin address (typically the LoanManager contract)
     * @param _admin The new admin address
     */
    function setAdmin(address _admin) external {
        require(msg.sender == admin, "CollateralManager: Only admin can set admin");
        require(_admin != address(0), "CollateralManager: Invalid admin address");
        admin = _admin;
    }

    /**
     * @dev Registers a loan for collateral (called by LoanManager)
     * @param loanId The ID of the loan
     * @param borrower The address of the borrower
     */
    function registerLoan(uint256 loanId, address borrower) external onlyAdmin {
        loanBorrowers[loanId] = borrower;
    }

    /**
     * @dev Deposits collateral for a loan
     * @param loanId The ID of the loan
     */
    function depositCollateral(uint256 loanId) external payable nonReentrant {
        require(loanBorrowers[loanId] == msg.sender, "CollateralManager: Only borrower can deposit");
        require(msg.value > 0, "CollateralManager: Collateral amount must be greater than 0");
        collateralAmount[loanId] += msg.value;
        emit CollateralDeposited(loanId, msg.sender, msg.value);
    }

    /**
     * @dev Releases collateral to the borrower after loan repayment
     * @param loanId The ID of the loan
     * @param borrower The address to receive the collateral
     */
    function releaseCollateral(uint256 loanId, address borrower) external onlyAdmin nonReentrant {
        uint256 amount = collateralAmount[loanId];
        require(amount > 0, "CollateralManager: No collateral to release");
        require(loanBorrowers[loanId] == borrower, "CollateralManager: Invalid borrower");
        collateralAmount[loanId] = 0;
        (bool success, ) = payable(borrower).call{value: amount}("");
        require(success, "CollateralManager: Transfer failed");
        emit CollateralReleased(loanId, borrower, amount);
    }

    /**
     * @dev Seizes collateral for a defaulted loan and sends it to a recipient (e.g., protocol or liquidity pool owner)
     * @param loanId The ID of the loan
     * @param recipient Address that will receive the seized collateral
     */
    function seizeCollateral(uint256 loanId, address recipient) external onlyAdmin nonReentrant {
        uint256 amount = collateralAmount[loanId];
        require(amount > 0, "CollateralManager: No collateral to seize");
        require(recipient != address(0), "CollateralManager: Invalid recipient");
        collateralAmount[loanId] = 0;
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "CollateralManager: Seize transfer failed");
        emit CollateralReleased(loanId, recipient, amount);
    }
}

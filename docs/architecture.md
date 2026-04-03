# Blockchain Loan Management System - Architecture

## System Overview

The Blockchain-Based Loan Management System is a decentralized lending platform that combines traditional backend services with Ethereum smart contracts for transparent, immutable loan management.

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                        │
│  • MetaMask Integration  • Tailwind UI  • React Router           │
└───────────────────────────────┬─────────────────────────────────┘
                                 │ HTTP / Web3
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Node.js Backend (Express)                       │
│  • JWT Auth  • REST API  • ethers.js  • Mongoose                 │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                              │
                ▼                              ▼
┌───────────────────────────┐    ┌─────────────────────────────────┐
│   MongoDB Database        │    │   Ethereum Smart Contracts       │
│  • Users  • Loans  • KYC  │    │  • KYCRegistry  • CreditScore    │
└───────────────────────────┘    │  • LoanManager  • CollateralMgr  │
                                 └─────────────────────────────────┘
```

## Web3 Integration Model

### Frontend → Blockchain
- **MetaMask**: Users sign transactions (requestLoan, repayLoan, depositCollateral)
- **ethers.js**: Contract interaction, transaction signing
- **Read operations**: Can use provider without signer

### Backend → Blockchain
- **ethers.js Wallet**: Backend uses private key for admin operations
- **Operations**: verifyUser, updateScore, approveLoan
- **Read operations**: getLoan, isVerified, getScore

### Data Flow
1. User actions trigger MetaMask for user-signed transactions
2. Backend validates and syncs state with MongoDB
3. Admin operations (approve, verify) use backend signer
4. MongoDB stores off-chain state; blockchain is source of truth for loans

## MongoDB Schema Relationships

```
User (1) ──────< (N) Loan
  │
  └────── (1) KYC
```

### User
- `walletAddress`: Links to blockchain identity
- `creditScore`: Cached from blockchain
- `kycVerified`: Synced with KYCRegistry contract

### Loan
- `loanId`: Matches blockchain LoanManager
- `userId`: Reference to User
- `status`: pending | approved | repaid | rejected

### KYC
- `userId`: Reference to User
- `documentUrl`: Stored document path/URL
- `blockchainVerified`: True when verifyUser() succeeded

## Smart Contract Interaction Flow

### KYC Verification
1. User uploads document → Backend stores in KYC
2. Admin/automation verifies → Backend calls `KYCRegistry.verifyUser(walletAddress)`
3. User.kycVerified = true

### Credit Score
1. Backend calculates score (income, repayment history, etc.)
2. Backend calls `CreditScore.updateScore(walletAddress, score)`
3. User.creditScore updated in MongoDB

### Loan Request
1. Frontend validates with backend (KYC, credit score)
2. User signs `LoanManager.requestLoan()` via MetaMask
3. Frontend sends txHash to backend
4. Backend parses loanId from tx, stores in MongoDB

### Loan Approval
1. Admin calls `POST /api/loan/approve` with loanId
2. Backend calls `LoanManager.approveLoan(loanId)`
3. MongoDB status = approved

### Loan Repayment
1. User signs `LoanManager.repayLoan(loanId)` via MetaMask with value
2. Frontend sends txHash to backend
3. Backend verifies on-chain, updates MongoDB, recalculates credit score

## Security Considerations

- **Private keys**: Backend admin key must be secured; never expose
- **JWT**: Use strong secret, short expiry for sensitive operations
- **Input validation**: All API endpoints validate input
- **KYC documents**: Store securely; use signed URLs in production
- **Rate limiting**: Implement for auth and loan endpoints
- **CORS**: Restrict origins in production

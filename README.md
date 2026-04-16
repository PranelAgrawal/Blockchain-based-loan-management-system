# Blockchain-Based Loan Management System

A production-grade decentralized lending platform with user registration, KYC verification, credit scoring, and loan management via Ethereum smart contracts.

## Features

- **User Management**: Register, login, JWT authentication
- **KYC Verification**: Document upload, verification, blockchain sync
- **Credit Score**: Calculated from income, repayment history, assets (300-850)
- **Loan Lifecycle**: Request → Approve → Repay via smart contracts
- **MetaMask Integration**: User-signed transactions for loans
- **Collateral**: Home loans require collateral deposit

## Project Structure

```
blockchain-loan-system/
├── smart-contracts/       # Solidity contracts
│   ├── KYCRegistry.sol
│   ├── CreditScore.sol
│   ├── CollateralManager.sol
│   └── LoanManager.sol
├── backend/               # Node.js API
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── middleware/
│   ├── config/
│   └── server.js
├── frontend/              # React + Vite
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── context/
│       └── services/
├── docs/
│   ├── architecture.md
│   ├── api-spec.md
│   └── sequence-flows.md
└── .env.example
```

## Prerequisites

- Node.js 18+
- MongoDB
- MetaMask browser extension
- Local Ethereum node (Hardhat, Ganache) or testnet

## Deployment Instructions

### 1. Deploy Smart Contracts

**Option A: Using Hardhat (recommended for local)**

```bash
# Install root deps
npm install

# Start local node (in separate terminal)
npx hardhat node

# Deploy contracts
npx hardhat run scripts/deploy.js --network localhost
```

Copy the printed addresses to your `.env` files.

### 2. Display Loan Blocks Locally

The project includes a runnable block demo for the loan blockchain. It asks for Aadhaar numbers for each simulated user, validates them, stores `{ address, adhaarNumber }` in MongoDB, verifies KYC on-chain using an Aadhaar-based document hash, then creates loan-chain transactions. By default it creates 30 loan-chain transactions per user for 2 users. `BlockManager` groups every 10 loan-chain transactions into a block, then prints each block hash, previous hash, timestamp, transaction list, and integrity status.

```bash
# Terminal 1: start Hardhat with live RPC/transaction logs
npm run node

# Terminal 2: deploy a demo system, create transactions, and display blocks
npm run blocks
```

For a quick one-terminal run on Hardhat's in-memory network:

```bash
npm run blocks:local
```

You can adjust the demo size:

```bash
LOAN_EVENTS_PER_USER=20 USERS_TO_SIMULATE=2 npm run blocks:local
```

For repeat runs without typing Aadhaar numbers each time, add valid test Aadhaar numbers through environment variables:

```bash
AADHAAR_USER1=234567890124 AADHAAR_USER2=345678901238 npm run blocks:local
```

**Option B: Using Remix**

1. Open [Remix IDE](https://remix.ethereum.org)
2. Create files and paste contract code from `smart-contracts/`
3. Compile with Solidity ^0.8.20
4. Deploy in order: BlockManager → KYCRegistry → CreditScore → CollateralManager → LoanManager (with 4 constructor args)
5. Call `CollateralManager.setAdmin(LoanManager address)`
6. Copy all contract addresses

### 3. Run Backend

```bash
cd backend
cp ../.env.example .env
# Edit .env with your MongoDB URI, JWT secret, RPC URL, private key, and contract addresses
npm install
npm run dev
```

Backend runs on `http://localhost:5000`

### 4. Run Frontend

```bash
cd frontend
cp .env.example .env
# Add VITE_LOAN_CONTRACT_ADDRESS and VITE_COLLATERAL_CONTRACT_ADDRESS
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

### 5. Connect MetaMask

1. Install MetaMask
2. Add local network: RPC `http://127.0.0.1:8545`, Chain ID `31337`
3. Import test account from Hardhat/Ganache
4. Connect wallet in the app

### 6. Create Admin User

Register a user, then in MongoDB:

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)
```

## Quick Start (Local Development)

```bash
# Terminal 1: Start MongoDB (if not running)
mongod

# Terminal 2: Start local blockchain (e.g. Hardhat)
npx hardhat node

# Terminal 3: Backend
cd backend && npm install && npm run dev

# Terminal 4: Frontend
cd frontend && npm install && npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get profile (auth) |
| POST | /api/kyc/upload | Upload KYC doc (auth) |
| GET | /api/kyc/status | KYC status (auth) |
| POST | /api/loan/request | Request/confirm loan (auth) |
| GET | /api/loan/:id | Get loan (auth) |
| GET | /api/loan/user/:userId | User loans (auth) |
| POST | /api/loan/approve | Approve loan (admin) |
| POST | /api/loan/repay | Record repayment (auth) |

See `docs/api-spec.md` for full specification.

## Documentation

- [Architecture](docs/architecture.md) - System design, layers, data flow
- [API Spec](docs/api-spec.md) - All endpoints with request/response
- [Sequence Flows](docs/sequence-flows.md) - Step-by-step flows

## License

MIT

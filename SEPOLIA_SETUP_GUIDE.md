# Blockchain Loan System - Sepolia Deployment Guide

This guide walks you through deploying your blockchain loan system to the Sepolia testnet and setting up the backend to track transactions on-chain.

## Prerequisites

- MetaMask wallet browser extension installed
- Node.js v18+ installed
- 0.05 Sepolia ETH (which you already have!)

## Phase 1: MetaMask Setup

### 1.1 Add Sepolia Network to MetaMask

1. Open MetaMask
2. Click the network dropdown (currently showing your network)
3. Click "Add a custom network"
4. Fill in the details:

```
Network Name: Sepolia
RPC URL: https://eth-sepolia.g.alchemy.com/v2/demo
Chain ID: 11155111
Currency Symbol: ETH
Block Explorer URL: https://sepolia.etherscan.io
```

5. Click "Save"

You should now see "Sepolia" in your MetaMask network dropdown.

### 1.2 Verify Your Sepolia ETH Balance

- Switch to Sepolia network in MetaMask
- You should see 0.05 ETH (your test ETH)

## Phase 2: Get Alchemy RPC URL (for production deployment)

> **Note:** For testing, you can use the demo URL. For production, get your own free Alchemy key.

1. Go to https://www.alchemy.com/
2. Sign up (free account)
3. Create a new app:
   - Select "Ethereum" as the blockchain
   - Select "Sepolia" as the network
4. Copy your API key/RPC URL

It will look like:
```
https://eth-sepolia.g.alchemy.com/v2/YOUR_ACTUAL_KEY_HERE
```

## Phase 3: Configure Your Backend

### 3.1 Create .env File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 3.2 Update .env with Your Details

Open `.env` and fill in:

```env
# IMPORTANT: Your private key - NEVER commit this!
SEPOLIA_PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Backend will use these same values
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
PRIVATE_KEY=your_private_key_here
CHAIN_ID=11155111

# MongoDB (should already be configured)
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
```

### 3.3 Get Your Private Key from MetaMask

1. Open MetaMask
2. Click the three dots menu → "Account details"
3. Click "Export Private Key"
4. Enter your password
5. Copy the key (it starts with 0x and is 64 hex characters)
6. **IMPORTANT:** Never share this or commit it to git!
7. Paste it in `.env` as `SEPOLIA_PRIVATE_KEY` and `PRIVATE_KEY`

## Phase 4: Deploy Smart Contracts

### 4.1 Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 4.2 Deploy Contracts to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

This will:
1. Deploy all 4 contracts (KYCRegistry, CreditScore, CollateralManager, LoanManager)
2. Print the contract addresses
3. Automatically update your `.env` file
4. Create a timestamped deployment record in `deployments/` folder

**Example output:**
```
========== CONTRACT DEPLOYMENT ==========
Deploying with account: 0x123...
Network: sepolia
Chain ID: 11155111
Account balance: 0.05 ETH

Deploying KYCRegistry...
✓ KYCRegistry deployed at: 0xA1B2C3D4E5F6...
Deploying CreditScore...
✓ CreditScore deployed at: 0xF6E5D4C3B2A1...
... (more contracts)

========== ADD TO .env FILE ==========
KYC_CONTRACT_ADDRESS=0xA1B2C3D4E5F6...
...
```

### 4.3 Verify Deployment

Check that your `.env` now has contract addresses:

```bash
grep CONTRACT_ADDRESS .env
```

You should see:
```
KYC_CONTRACT_ADDRESS=0x...
CREDIT_CONTRACT_ADDRESS=0x...
LOAN_CONTRACT_ADDRESS=0x...
COLLATERAL_CONTRACT_ADDRESS=0x...
```

## Phase 5: Start the Backend

### 5.1 Start Backend Server

```bash
cd backend
npm run dev
```

You should see:

```
========== BACKEND SERVER STARTED ==========
Server running on port 5000
Network: Sepolia
Chain ID: 11155111

Initializing blockchain event listener...
✓ Event listener initialized successfully
✓ Event listener started on https://eth-sepolia.g.alchemy.com/v2/...
✓ Monitoring LoanManager at 0x...
=========================================
```

### 5.2 Test the Backend

In another terminal:

```bash
curl http://localhost:5000/api/health
```

Response:
```json
{
  "success": true,
  "message": "Blockchain Loan System API is running",
  "network": "Sepolia",
  "contracts": { ... }
}
```

## Phase 6: How It Works Now

### Transaction Flow

1. **User Action** (via MetaMask)
   - User calls contract function through MetaMask
   - MetaMask signs the transaction with user's private key
   - Transaction sent to Sepolia network

2. **Blockchain Recording**
   - Transaction is mined on Sepolia
   - Smart contract event is emitted
   - Gas is consumed (from your 0.05 ETH)

3. **Backend Sync**
   - Event listener detects the on-chain event
   - Parses event data
   - Records transaction in MongoDB (`Transaction` collection)
   - Updates loan status in MongoDB (`Loan` collection)
   - Updates user credit score if applicable

### Database Collections

Your MongoDB now tracks:

- **Loans**: Loan applications and their status
- **Transactions**: All on-chain transactions with full details
- **Deployments**: Contract deployment records on each network

```javascript
// Example: View recent transactions
db.transactions.find({}).sort({ timestamp: -1 }).limit(10)

// Example: View transactions for a specific loan
db.transactions.find({ 'related.loanId': 1 })
```

## Phase 7: Monitor On-Chain Transactions

### View Transaction History

1. **In Backend Console**
   - You'll see logs like: `✓ Loan requested: ID=1, Borrower=0x..., Amount=1.5 ETH`

2. **Sepolia Etherscan**
   - Go to https://sepolia.etherscan.io
   - Search for your wallet address or contract address
   - View all transactions with full details

3. **In MongoDB**
   - Query the `Transaction` collection
   - All events are stored with timestamps, gas info, and event data

### Example Query to Check Transactions

```javascript
// Find all loan requests to your system
db.transactions.find({ transactionType: 'loanRequest' })

// Find all repayments
db.transactions.find({ transactionType: 'loanRepayment' })

// Get transaction costs (for budget planning)
db.transactions.aggregate([
  {
    $project: {
      type: '$transactionType',
      gasUsed: 1,
      gasPrice: 1,
    }
  }
])
```

## Common Issues & Solutions

### "Insufficient funds" Error During Deployment

Your 0.05 ETH might not be enough if you already deployed once. Get more test ETH:

1. Go to https://www.alchemy.com/faucets/ethereum-sepolia
2. Enter your wallet address
3. Request more test ETH (you may need to do this multiple times)

### "Contract address not found" Error

Make sure:
1. Your `.env` has the correct contract addresses (without spaces)
2. The addresses match between hardhat deployment and your .env
3. Contract addresses start with `0x`

### Event Listener Not Working

Check:
1. `.env` has `RPC_URL` and contract addresses
2. Contract addresses are correct (verify on Etherscan)
3. Backend can reach Sepolia RPC URL
4. Check backend logs for specific errors

### "Network error"

Verify:
1. Alchemy RPC key is valid
2. You're using the Sepolia RPC URL (not mainnet)
3. Your internet connection

## Next Steps

1. **Create Frontend Integration** - Connect frontend to deployed contracts
2. **Set Up Admin Panel** - Monitor all loans and transactions
3. **Implement KYC Verification** - Store KYC documents on-chain
4. **Multiple Deployments** - Deploy to other testnets (Goerli) or mainnet

## File Structure Summary

```
blockchain-loan-system/
├── hardhat.config.js              # Configured for Sepolia
├── scripts/deploy.js              # Deploy script (creates deployment records)
├── deployments/                   # Deployment history
│   └── deployment-sepolia-*.json
├── backend/
│   ├── .env                       # Your config (GITIGNORED)
│   ├── server.js                  # Updated for Sepolia
│   ├── models/
│   │   ├── Transaction.js         # NEW: Transaction tracking
│   │   ├── Deployment.js          # NEW: Deployment tracking
│   │   └── Loan.js                # Updated
│   ├── services/
│   │   ├── eventListener.js       # NEW: Sepolia event listener
│   │   └── blockchainService.js   # Backend blockchain interactions
│   └── config/
│       └── blockchain.js          # Blockchain config (uses .env)
└── smart-contracts/
    └── *.sol                       # Smart contracts
```

## Monitoring & Debugging

### Check Contract Function Calls

```bash
# See what functions your contracts have
npx hardhat console --network sepolia
> const loan = await ethers.getContractAt('LoanManager', '0x...')
> await loan.loanCounter() // Check how many loans have been created
```

### Monitor Gas Usage

All transactions include gas usage data:

```javascript
// Check average gas spent
db.transactions.aggregate([
  {
    $group: {
      _id: '$transactionType',
      avgGas: { $avg: '$gasUsed' },
      totalTxs: { $sum: 1 }
    }
  }
])
```

### Verify User Transactions

```javascript
// See what user 0x123...abc has done
db.transactions.find({ from: '0x123...abc' })
```

---

## Summary

You now have:
- ✓ Sepolia network configured in MetaMask
- ✓ Smart contracts deployed to Sepolia 
- ✓ Backend configured to listen to blockchainEvents
- ✓ MongoDB tracking all transactions
- ✓ Event listener automatically syncing on-chain data

All your transaction records are now stored **both on-chain (immutable) and in your database (queryable)**.

Good luck! Your professor will see all transaction records in your database! 🚀

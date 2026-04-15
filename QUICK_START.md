# Quick Start Guide - Sepolia Deployment

## Quick Reference

### 1. First Time Setup
```bash
# Install Alchemy RPC URL from https://www.alchemy.com/

# Copy and fill .env file
cp .env.example .env
# Edit .env and add: SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, RPC_URL, PRIVATE_KEY

# Install dependencies
npm install
cd backend && npm install && cd ..
```

### 2. Deploy Contracts to Sepolia
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
✓ Contracts deployed  
✓ Addresses auto-saved to .env  
✓ Deployment recorded in deployments/ folder

### 3. Start Backend
```bash
cd backend
npm run dev
# Should show: "✓ Event listener initialized successfully"
```

### 4. Monitor Transactions
- Backend logs → See all on-chain events in terminal
- Sepolia Etherscan → https://sepolia.etherscan.io/ (search your wallet)
- MongoDB → Query `Transaction` collection

## Network Info

| Property | Value |
|----------|-------|
| Network | Sepolia |
| Chain ID | 11155111 |
| RPC URL | https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY |
| Faucet | https://www.alchemy.com/faucets/ethereum-sepolia |
| Block Explorer | https://sepolia.etherscan.io |

## Daily Workflow

### Before You Start
```bash
# Check you have test ETH
# MetaMask → Sepolia → Check balance > 0.01 ETH
```

### Deploy Once
```bash
# One-time deployment to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Verify in .env - should have contract addresses
grep CONTRACT_ADDRESS .env
```

### Start Backend (Every Time)
```bash
cd backend
npm run dev

# You'll see: ✓ Event listener initialized
# This means it's listening for blockchain events
```

### Test the System
```bash
# In another terminal
curl http://localhost:5000/api/health
```

## What Gets Recorded?

### On Blockchain (Sepolia)
✓ User loan requests  
✓ Admin approvals  
✓ Loan repayments  
✓ Loan defaults  
✓ KYC verifications  
✓ Credit score updates  

### In MongoDB Database
✓ Transaction hash  
✓ From/To addresses  
✓ Block number  
✓ Gas used  
✓ Transaction type  
✓ Related loan ID  
✓ Event data  
✓ Timestamp  

## Your Professor Will See

1. **On Sepolia Etherscan**
   - All your transactions
   - Gas costs
   - Smart contract interactions
   - User addresses

2. **In Your MongoDB**
   - Structured records of every transaction
   - Easy to query and analyze
   - Proof of on-chain recording

## Emergency: Out of Test ETH?

```bash
# 1. Go to Alchemy faucet
# https://www.alchemy.com/faucets/ethereum-sepolia

# 2. Enter your wallet address
# 3. Click "Send Me ETH"

# 4. Wait 1-2 minutes, check balance in MetaMask
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Insufficient funds" | Get more test ETH from faucet |
| Event listener not starting | Check contract addresses in `.env` |
| "Cannot read property gasPrice" | Wait a minute for transaction to confirm |
| No transactions showing | Check `.env` has correct RPC URL |
| MongoDB not recording | Check Deployment collection - maybe chainId mismatch |

## Files You Modified

```
✓ hardhat.config.js         - Added Sepolia network
✓ .env.example              - Sepolia config template
✓ scripts/deploy.js         - Enhanced deployment script
✓ backend/server.js         - Event listener integration
✓ backend/models/           - Added Transaction.js, Deployment.js
✓ backend/services/         - Added eventListener.js
```

## Deployed Contracts

After running `deploy.js`, you'll have in `.env`:

```
KYC_CONTRACT_ADDRESS=0x...
CREDIT_CONTRACT_ADDRESS=0x...
LOAN_CONTRACT_ADDRESS=0x...
COLLATERAL_CONTRACT_ADDRESS=0x...
```

Save these! They're your contract addresses on Sepolia.

## Database Queries

### Check all transactions
```javascript
db.transactions.find().limit(10)
```

### Check loan requests only
```javascript
db.transactions.find({ transactionType: 'loanRequest' })
```

### Check by user wallet
```javascript
db.transactions.find({ from: '0x...' })
```

## Success Indicators

✓ Backend shows "✓ Event listener initialized"  
✓ `.env` has all 4 contract addresses  
✓ You can query `db.transactions.find()` in MongoDB  
✓ Sepolia.etherscan.io shows your transactions  

---

**Remember:** *Every transaction is saved twice - once on the blockchain (immutable), once in your database (queryable).*

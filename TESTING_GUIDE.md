# Full Project Testing Guide

Follow these steps to test the entire Blockchain-based Loan Management System from start to finish.

## 📋 Prerequisites
1. **MetaMask Installed**: Browser extension is required.
2. **Sepolia Network**: Ensure MetaMask is set to the Sepolia Test Network.
3. **Test ETH**: You need at least 0.05 Sepolia ETH. Get it from the [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia).

---

## 🚀 Step-by-Step Testing Flow

### 1. User Registration
1. Open [http://localhost:3000](http://localhost:3000).
2. Click **Register** in the sidebar.
3. Fill in your Name, Email, and Password.
4. Once registered, you will be automatically logged in.

### 2. Profile Setup (Connect Wallet)
1. Go to the **Dashboard**.
2. Click **Connect Wallet** (top right or in the prompt).
3. MetaMask will ask you to connect; approve it.
4. Your wallet address is now linked to your account.

### 3. KYC Verification (Aadhaar Only)
1. Go to **Upload KYC** in the sidebar.
2. Enter a **12-digit Aadhaar Number** (e.g., `123412341234`).
3. Click **Upload Aadhaar**.
4. Once uploaded, click **Verify KYC**. 
   *   *Note: This simulates the verification process and triggers the on-chain KYC update.*
5. Success state: You should see "KYC Verified".

### 4. Manage Credit Score (For Testing)
*Users need a credit score of **600+** to apply for loans.*
1. Go to the **Dashboard**.
2. You will see your current Credit Score (defaults to 300).
3. **To Update Score**: Since this is a test environment, you can use the admin tools or manually update your score in MongoDB.
   *   Open a terminal and run:
     ```bash
     # Example: Set score to 750 for your user
     # In MongoDB Shell:
     db.users.updateOne({ email: "your@email.com" }, { $set: { creditScore: 750 } })
     ```
4. Refresh the page to see the updated score.

### 5. Loan Application
1. Go to **Apply Loan**.
2. Choose a **Loan Type** (Personal, Home, or Business).
3. Enter an **Amount** (e.g., `0.001 ETH`).
4. Enter **Duration** (e.g., `30` days).
5. Click **Request Loan**.
6. **MetaMask Popup**: Sign the transaction.
7. Wait for the success message: `Loan requested and recorded on-chain!`.

### 6. Admin Approval
*Loans must be approved before they are funded.*
1. Make your account an Admin (if not already):
   ```bash
   # In MongoDB Shell:
   db.users.updateOne({ email: "your@email.com" }, { $set: { role: "admin" } })
   ```
2. Go to the **Dashboard** or **Loan Status**.
3. You will see your pending loan. Click **Approve**.
4. **MetaMask Popup**: Sign the approval transaction.
5. The status will change to **Approved**.

### 7. Loan Repayment
1. Go to **Dashboard**.
2. Find your approved loan. Click **Repay**.
3. **MetaMask Popup**: Sign the repayment transaction (this sends the ETH back to the contract).
4. Status will change to **Repaid**.
5. Your credit score will automatically increase on-chain!

---

## 🔍 Verification Checklist
- [ ] **On-Chain**: Search your wallet address on [Sepolia Etherscan](https://sepolia.etherscan.io) to see the contract interactions.
- [ ] **Off-Chain**: Check your MongoDB `loans` and `transactions` collections to see the records.
- [ ] **Sync**: Ensure the status in the Dashboard matches the status on Etherscan.

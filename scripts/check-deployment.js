#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Check if your Sepolia deployment is properly configured
 * Usage: node scripts/check-deployment.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('\n🔍 Checking Blockchain Loan System Sepolia Configuration...\n');

let allGood = true;

// Check 1: .env file
console.log('1️⃣  Checking .env file...');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✓ .env file exists');
} else {
  console.log('   ✗ .env file NOT found!');
  console.log('     → Run: cp .env.example .env');
  allGood = false;
}

// Check 2: Environment variables
console.log('\n2️⃣  Checking environment variables...');
const requiredVars = [
  'SEPOLIA_PRIVATE_KEY',
  'SEPOLIA_RPC_URL',
  'RPC_URL',
  'PRIVATE_KEY',
  'CHAIN_ID',
  'MONGODB_URI',
];

let envVarsOk = true;
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value && varName !== 'SEPOLIA_PRIVATE_KEY' && varName !== 'PRIVATE_KEY') {
    console.log(`   ✓ ${varName} is set`);
  } else if (value) {
    console.log(`   ✓ ${varName} is set (private, not showing)`);
  } else {
    console.log(`   ✗ ${varName} is NOT set`);
    envVarsOk = false;
    allGood = false;
  }
}

// Check 3: Smart contract addresses
console.log('\n3️⃣  Checking smart contract addresses...');
const contractVars = [
  'KYC_CONTRACT_ADDRESS',
  'CREDIT_CONTRACT_ADDRESS',
  'LOAN_CONTRACT_ADDRESS',
  'COLLATERAL_CONTRACT_ADDRESS',
];

let contractsOk = true;
for (const varName of contractVars) {
  const address = process.env[varName];
  if (address && address.startsWith('0x') && address.length === 42) {
    console.log(`   ✓ ${varName}: ${address.substring(0, 10)}...`);
  } else if (address && address === '0x') {
    console.log(`   ⚠ ${varName}: Address not filled (still placeholder)`);
    contractsOk = false;
  } else {
    console.log(`   ✗ ${varName}: NOT SET`);
    contractsOk = false;
  }
}

if (!contractsOk) {
  console.log('\n   ⚠️  No contract addresses found!');
  console.log('      → Run: npx hardhat run scripts/deploy.js --network sepolia');
  allGood = false;
}

// Check 4: Chain ID
console.log('\n4️⃣  Checking chain ID...');
const chainId = parseInt(process.env.CHAIN_ID || '0', 10);
if (chainId === 11155111) {
  console.log('   ✓ Chain ID is correct (11155111 = Sepolia)');
} else {
  console.log(`   ✗ Chain ID is wrong: ${chainId} (should be 11155111 for Sepolia)`);
  allGood = false;
}

// Check 5: Hardhat config
console.log('\n5️⃣  Checking hardhat.config.js...');
const hardhatPath = path.join(__dirname, '..', 'hardhat.config.js');
if (fs.existsSync(hardhatPath)) {
  const config = fs.readFileSync(hardhatPath, 'utf8');
  if (config.includes('sepolia')) {
    console.log('   ✓ Sepolia network configured in hardhat.config.js');
  } else {
    console.log('   ✗ Sepolia network NOT found in hardhat.config.js');
    allGood = false;
  }
} else {
  console.log('   ✗ hardhat.config.js not found');
  allGood = false;
}

// Check 6: Backend files
console.log('\n6️⃣  Checking backend models and services...');
const filesToCheck = [
  'backend/models/Transaction.js',
  'backend/models/Deployment.js',
  'backend/services/eventListener.js',
];

for (const file of filesToCheck) {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✓ ${file} exists`);
  } else {
    console.log(`   ✗ ${file} NOT found`);
    allGood = false;
  }
}

// Check 7: Deployments history
console.log('\n7️⃣  Checking deployment history...');
const deploymentsDir = path.join(__dirname, '..', 'deployments');
if (fs.existsSync(deploymentsDir)) {
  const files = fs.readdirSync(deploymentsDir);
  if (files.length > 0) {
    console.log(`   ✓ Found ${files.length} deployment record(s)`);
    files.forEach((f) => {
      console.log(`     - ${f}`);
    });
  } else {
    console.log('   ⚠ Deployments folder is empty');
    console.log('     → Run: npx hardhat run scripts/deploy.js --network sepolia');
  }
} else {
  console.log('   ⚠ No deployments folder yet (will be created on first deploy)');
}

// Summary
console.log('\n' + '='.repeat(50));
if (allGood && contractsOk) {
  console.log('✅ Everything looks good! Ready to deploy or run backend.');
  console.log('\nNext steps:');
  console.log('  1. Deploy: npx hardhat run scripts/deploy.js --network sepolia');
  console.log('  2. Backend: cd backend && npm run dev');
} else if (allGood && !contractsOk) {
  console.log('⚠️  Configuration looks good, but contracts not deployed yet.');
  console.log('\nNext step:');
  console.log('  npx hardhat run scripts/deploy.js --network sepolia');
} else {
  console.log('❌ Some issues found. Please fix them above.');
  console.log('\nCommon fixes:');
  console.log('  1. Copy .env.example: cp .env.example .env');
  console.log('  2. Update .env with your keys');
  console.log('  3. Deploy contracts: npx hardhat run scripts/deploy.js --network sepolia');
}
console.log('='.repeat(50) + '\n');

process.exit(allGood && contractsOk ? 0 : 1);

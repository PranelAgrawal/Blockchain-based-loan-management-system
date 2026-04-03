/**
 * Deployment script for Blockchain Loan System contracts
 * Run: npx hardhat run scripts/deploy.js --network localhost
 */
const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const KYCRegistry = await hre.ethers.getContractFactory('KYCRegistry');
  const kyc = await KYCRegistry.deploy();
  await kyc.waitForDeployment();
  const kycAddr = await kyc.getAddress();
  console.log('KYCRegistry:', kycAddr);

  const CreditScore = await hre.ethers.getContractFactory('CreditScore');
  const credit = await CreditScore.deploy();
  await credit.waitForDeployment();
  const creditAddr = await credit.getAddress();
  console.log('CreditScore:', creditAddr);

  const CollateralManager = await hre.ethers.getContractFactory('CollateralManager');
  const collateral = await CollateralManager.deploy();
  await collateral.waitForDeployment();
  const collateralAddr = await collateral.getAddress();
  console.log('CollateralManager:', collateralAddr);

  const LoanManager = await hre.ethers.getContractFactory('LoanManager');
  const loan = await LoanManager.deploy(kycAddr, creditAddr, collateralAddr);
  await loan.waitForDeployment();
  const loanAddr = await loan.getAddress();
  console.log('LoanManager:', loanAddr);

  const collateralContract = await hre.ethers.getContractAt('CollateralManager', collateralAddr);
  await collateralContract.setAdmin(loanAddr);
  console.log('CollateralManager admin set to LoanManager');

  console.log('\n--- Add to .env ---');
  console.log(`KYC_CONTRACT_ADDRESS=${kycAddr}`);
  console.log(`CREDIT_CONTRACT_ADDRESS=${creditAddr}`);
  console.log(`LOAN_CONTRACT_ADDRESS=${loanAddr}`);
  console.log(`COLLATERAL_CONTRACT_ADDRESS=${collateralAddr}`);
  console.log(`VITE_LOAN_CONTRACT_ADDRESS=${loanAddr}`);
  console.log(`VITE_COLLATERAL_CONTRACT_ADDRESS=${collateralAddr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Deployment script for Blockchain Loan System contracts
 * Run: npx hardhat run scripts/deploy.js --network sepolia
 * 
 * On successful deployment, the script will:
 * 1. Log contract addresses to console
 * 2. Save addresses to .env file
 * 3. Create deployment-addresses.json with timestamped record
 */
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('\n========== CONTRACT DEPLOYMENT ==========');
  console.log('Deploying with account:', deployer.address);
  console.log('Network:', hre.network.name);
  console.log('Chain ID:', (await hre.ethers.provider.getNetwork()).chainId);

  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', hre.ethers.formatEther(balance), 'ETH\n');

  try {
    // Deploy KYCRegistry
    console.log('Deploying KYCRegistry...');
    const KYCRegistry = await hre.ethers.getContractFactory('KYCRegistry');
    const kyc = await KYCRegistry.deploy();
    await kyc.waitForDeployment();
    const kycAddr = await kyc.getAddress();
    console.log('✓ KYCRegistry deployed at:', kycAddr);

    // Deploy CreditScore
    console.log('Deploying CreditScore...');
    const CreditScore = await hre.ethers.getContractFactory('CreditScore');
    const credit = await CreditScore.deploy();
    await credit.waitForDeployment();
    const creditAddr = await credit.getAddress();
    console.log('✓ CreditScore deployed at:', creditAddr);

    // Deploy CollateralManager
    console.log('Deploying CollateralManager...');
    const CollateralManager = await hre.ethers.getContractFactory('CollateralManager');
    const collateral = await CollateralManager.deploy();
    await collateral.waitForDeployment();
    const collateralAddr = await collateral.getAddress();
    console.log('✓ CollateralManager deployed at:', collateralAddr);

    // Deploy LoanManager
    console.log('Deploying LoanManager...');
    const LoanManager = await hre.ethers.getContractFactory('LoanManager');
    const loan = await LoanManager.deploy(kycAddr, creditAddr, collateralAddr);
    await loan.waitForDeployment();
    const loanAddr = await loan.getAddress();
    console.log('✓ LoanManager deployed at:', loanAddr);

    // Set admin
    console.log('Setting CollateralManager admin...');
    const collateralContract = await hre.ethers.getContractAt('CollateralManager', collateralAddr);
    await collateralContract.setAdmin(loanAddr);
    console.log('✓ CollateralManager admin set to LoanManager\n');

    // Prepare output
    const addresses = {
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      contracts: {
        kycRegistry: kycAddr,
        creditScore: creditAddr,
        loanManager: loanAddr,
        collateralManager: collateralAddr,
      },
    };

    // Save to JSON file
    const deploymentDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    const filename = path.join(
      deploymentDir,
      `deployment-${hre.network.name}-${Date.now()}.json`
    );
    fs.writeFileSync(filename, JSON.stringify(addresses, null, 2));
    console.log('✓ Deployment saved to:', filename);

    // Display for .env
    console.log('\n========== ADD TO .env FILE ==========');
    console.log(`KYC_CONTRACT_ADDRESS=${kycAddr}`);
    console.log(`CREDIT_CONTRACT_ADDRESS=${creditAddr}`);
    console.log(`LOAN_CONTRACT_ADDRESS=${loanAddr}`);
    console.log(`COLLATERAL_CONTRACT_ADDRESS=${collateralAddr}`);
    console.log('=====================================\n');

    // Optional: Auto-update .env file
    try {
      const envPath = path.join(__dirname, '..', '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Update or add variables
      const updateEnv = (content, key, value) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
          return content.replace(regex, `${key}=${value}`);
        }
        return content + `\n${key}=${value}`;
      };

      envContent = updateEnv(envContent, 'KYC_CONTRACT_ADDRESS', kycAddr);
      envContent = updateEnv(envContent, 'CREDIT_CONTRACT_ADDRESS', creditAddr);
      envContent = updateEnv(envContent, 'LOAN_CONTRACT_ADDRESS', loanAddr);
      envContent = updateEnv(envContent, 'COLLATERAL_CONTRACT_ADDRESS', collateralAddr);

      fs.writeFileSync(envPath, envContent);
      console.log('✓ .env file updated with contract addresses');
    } catch (err) {
      console.warn('Note: Could not auto-update .env file. Please manually update it.');
    }
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

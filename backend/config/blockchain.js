/**
 * Blockchain Configuration
 * Contract addresses and network settings
 */
module.exports = {
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  privateKey: process.env.PRIVATE_KEY || '',
  chainId: parseInt(process.env.CHAIN_ID || '31337', 10),
  contracts: {
    kycRegistry: process.env.KYC_CONTRACT_ADDRESS || '',
    creditScore: process.env.CREDIT_CONTRACT_ADDRESS || '',
    loanManager: process.env.LOAN_CONTRACT_ADDRESS || '',
    collateralManager: process.env.COLLATERAL_CONTRACT_ADDRESS || '',
  },
};

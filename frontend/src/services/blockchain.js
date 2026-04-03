/**
 * Blockchain Service
 * MetaMask integration and smart contract interactions
 */
import { ethers } from 'ethers';

const LOAN_MANAGER_ABI = [
  'function requestLoan(uint8 loanType, uint256 amount, uint256 duration) external returns (uint256)',
  'function approveLoan(uint256 loanId) external',
  'function repayLoan(uint256 loanId) external payable',
  'function markLoanDefaulted(uint256 loanId) external',
  'function getLoan(uint256 loanId) external view returns (uint256, address, uint8, uint256, uint256, bool, bool, bool, uint256, uint256, uint256, bool)',
  'event LoanRequested(uint256 indexed loanId, address indexed borrower, uint8 loanType, uint256 amount, uint256 duration, bool collateralRequired)',
  'event LoanApproved(uint256 indexed loanId, address indexed borrower)',
  'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestPaid)',
  'event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 timestamp)',
];

const COLLATERAL_MANAGER_ABI = [
  'function depositCollateral(uint256 loanId) external payable',
  'function collateralAmount(uint256 loanId) external view returns (uint256)',
];

const CONTRACT_ADDRESSES = {
  loanManager: import.meta.env.VITE_LOAN_CONTRACT_ADDRESS || '',
  collateralManager: import.meta.env.VITE_COLLATERAL_CONTRACT_ADDRESS || '',
};

export function getContractAddresses() {
  return CONTRACT_ADDRESSES;
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

export function getProvider() {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = getProvider();
  return provider.getSigner();
}

export async function requestLoan(loanType, amountWei, duration) {
  const signer = await getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESSES.loanManager, LOAN_MANAGER_ABI, signer);
  const tx = await contract.requestLoan(loanType, amountWei, duration);
  const receipt = await tx.wait();
  const iface = new ethers.Interface(LOAN_MANAGER_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === 'LoanRequested') return { txHash: receipt.hash, loanId: Number(parsed.args.loanId) };
    } catch (_) {}
  }
  return { txHash: receipt.hash, loanId: null };
}

export async function repayLoan(loanId, amountWei) {
  const signer = await getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESSES.loanManager, LOAN_MANAGER_ABI, signer);
  const tx = await contract.repayLoan(loanId, { value: amountWei });
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function depositCollateral(loanId, amountWei) {
  const signer = await getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESSES.collateralManager, COLLATERAL_MANAGER_ABI, signer);
  const tx = await contract.depositCollateral(loanId, { value: amountWei });
  const receipt = await tx.wait();
  return receipt.hash;
}

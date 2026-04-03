import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import api from '../services/api';
import { requestLoan, depositCollateral } from '../services/blockchain';
import { ethers } from 'ethers';
import { CreditCard, Loader2 } from 'lucide-react';

const LOAN_TYPES = [
  { value: 'Personal', label: 'Personal', type: 0 },
  { value: 'Home', label: 'Home', type: 1 },
  { value: 'Business', label: 'Business', type: 2 },
];

export default function ApplyLoan() {
  const { user } = useAuth();
  const { address } = useWallet();
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('30');
  const [loanType, setLoanType] = useState('Personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);
  const [createdLoanId, setCreatedLoanId] = useState(null);

  const collateralRequired = loanType === 'Home';

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const amountWei = ethers.parseEther(amount);
      const typeConfig = LOAN_TYPES.find((t) => t.value === loanType);
      const { txHash } = await requestLoan(typeConfig.type, amountWei.toString(), parseInt(duration, 10));
      const res = await api.post('/loan/request', {
        amount: parseFloat(amount),
        duration: parseInt(duration, 10),
        loanType,
        txHash,
      });
      if (res.data?.loanId) setCreatedLoanId(res.data.loanId);
      setSuccess('Loan requested successfully!');
      setStep(collateralRequired ? 2 : 3);
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDepositCollateral = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loanId = createdLoanId || 1;
      const collateralAmount = (parseFloat(amount) * 0.5).toString();
      const amountWei = ethers.parseEther(collateralAmount);
      await depositCollateral(loanId, amountWei.toString());
      setSuccess('Collateral deposited!');
      setStep(3);
    } catch (err) {
      setError(err.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  if (!user?.kycVerified) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-amber-900/50 bg-amber-900/20 p-6">
        <p className="text-amber-300">Please complete KYC verification before applying for a loan.</p>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-amber-900/50 bg-amber-900/20 p-6">
        <p className="text-amber-300">Please connect MetaMask to apply for a loan.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Apply for Loan</h1>
        <p className="mt-1 text-slate-400">Request a loan on the blockchain</p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 p-3 text-sm text-red-300">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-900/30 p-3 text-sm text-green-300">{success}</div>
        )}

        {step === 1 && (
          <form onSubmit={handleRequest} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300">Loan Type</label>
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {LOAN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {collateralRequired && (
                <p className="mt-2 text-sm text-amber-400">Home loans require collateral (50% of amount)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Amount (ETH)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0.1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Duration (days)</label>
              <input
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Confirm in MetaMask...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  Request Loan
                </>
              )}
            </button>
          </form>
        )}

        {step === 2 && collateralRequired && (
          <div>
            <p className="mb-4 text-slate-300">Deposit collateral for your home loan.</p>
            <button
              onClick={handleDepositCollateral}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-3 font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Confirm in MetaMask...
                </>
              ) : (
                'Deposit Collateral'
              )}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <p className="text-green-400">Your loan request has been submitted. Wait for admin approval.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import api from '../services/api';
import { repayLoan } from '../services/blockchain';
import { ethers } from 'ethers';
import LoanCard from '../components/LoanCard';
import { Loader2 } from 'lucide-react';

export default function LoanStatus() {
  const { user } = useAuth();
  const { address } = useWallet();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [repayingId, setRepayingId] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/loan/user/${user._id}`);
        setLoans(res.data || []);
      } catch (_) {
        setLoans([]);
      } finally {
        setLoading(false);
      }
    };
    if (user?._id) fetch();
  }, [user?._id]);

  const handleRepay = async (loan) => {
    if (!address) {
      alert('Connect MetaMask to repay');
      return;
    }
    setRepayingId(loan.loanId);
    try {
      const amountWei = ethers.parseEther(loan.amount.toString());
      const txHash = await repayLoan(loan.loanId, amountWei.toString());
      await api.post('/loan/repay', { loanId: loan.loanId, txHash });
      setLoans((prev) =>
        prev.map((l) => (l.loanId === loan.loanId ? { ...l, status: 'repaid' } : l))
      );
    } catch (err) {
      alert(err.message || 'Repayment failed');
    } finally {
      setRepayingId(null);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">My Loans</h1>
        <p className="mt-1 text-slate-400">View and manage your loan applications</p>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : loans.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-12 text-center">
          <p className="text-slate-400">No loans yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loans.map((loan) => (
            <div key={loan._id}>
              <LoanCard loan={loan} />
              {loan.status === 'approved' && !loan.repaidAt && (
                <button
                  onClick={() => handleRepay(loan)}
                  disabled={repayingId === loan.loanId || !address}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
                >
                  {repayingId === loan.loanId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirm in MetaMask...
                    </>
                  ) : (
                    'Repay Loan'
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

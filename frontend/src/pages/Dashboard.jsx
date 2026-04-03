import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import api from '../services/api';
import CreditScoreCard from '../components/CreditScoreCard';
import LoanCard from '../components/LoanCard';
import { FileCheck, CreditCard, ArrowRight, Wallet } from 'lucide-react';

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const { address, connect } = useWallet();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingScore, setUpdatingScore] = useState(false);

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

  const handleUpdateWallet = async () => {
    if (!address) {
      try {
        await connect();
      } catch (_) {}
      return;
    }
    try {
      await api.put('/auth/wallet', { walletAddress: address });
      updateUser({ walletAddress: address });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateScore = async () => {
    setUpdatingScore(true);
    try {
      const res = await api.post('/credit-score/update');
      updateUser({ creditScore: res.data.score });
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingScore(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-slate-400">Welcome back, {user?.name}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CreditScoreCard
          score={user?.creditScore ?? 300}
          onUpdate={handleUpdateScore}
        />
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-700/50 p-3">
              <Wallet className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Wallet</p>
              <p className="font-mono text-sm text-white">
                {user?.walletAddress || address || 'Not connected'}
              </p>
            </div>
            {address && !user?.walletAddress && (
              <button
                onClick={handleUpdateWallet}
                className="ml-auto rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500"
              >
                Link Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Link
            to="/kyc"
            className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/50 p-4 transition hover:border-primary-500/50 hover:bg-slate-800/50"
          >
            <FileCheck className="h-8 w-8 text-primary-400" />
            <div>
              <p className="font-medium text-white">KYC Verification</p>
              <p className="text-xs text-slate-500">{user?.kycVerified ? 'Verified' : 'Complete verification'}</p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-slate-500" />
          </Link>
          <Link
            to="/apply"
            className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/50 p-4 transition hover:border-primary-500/50 hover:bg-slate-800/50"
          >
            <CreditCard className="h-8 w-8 text-primary-400" />
            <div>
              <p className="font-medium text-white">Apply for Loan</p>
              <p className="text-xs text-slate-500">Request a new loan</p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-slate-500" />
          </Link>
          <Link
            to="/loans"
            className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/50 p-4 transition hover:border-primary-500/50 hover:bg-slate-800/50"
          >
            <CreditCard className="h-8 w-8 text-primary-400" />
            <div>
              <p className="font-medium text-white">My Loans</p>
              <p className="text-xs text-slate-500">{loans.length} loans</p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-slate-500" />
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">Recent Loans</h2>
        {loading ? (
          <p className="mt-4 text-slate-400">Loading...</p>
        ) : loans.length === 0 ? (
          <p className="mt-4 text-slate-400">No loans yet. <Link to="/apply" className="text-primary-400 hover:underline">Apply for a loan</Link>.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loans.slice(0, 6).map((loan) => (
              <LoanCard key={loan._id} loan={loan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { Wallet, LogOut, LayoutDashboard, FileCheck, CreditCard, FileText } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { address, shortAddress, loading, connect, disconnect } = useWallet();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    disconnect();
    navigate('/login');
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-mono text-xl font-semibold text-primary-400">
            <CreditCard className="h-6 w-6" />
            LoanChain
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link to="/dashboard" className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link to="/kyc" className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <FileCheck className="h-4 w-4" />
                  KYC
                </Link>
                <Link to="/apply" className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <FileText className="h-4 w-4" />
                  Apply
                </Link>
                <Link to="/loans" className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <FileText className="h-4 w-4" />
                  Loans
                </Link>
                <button
                  onClick={address ? disconnect : connect}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  <Wallet className="h-4 w-4" />
                  {address ? shortAddress : 'Connect MetaMask'}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300 hover:bg-red-900/70"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-4 py-2 text-slate-300 hover:text-white">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-500"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

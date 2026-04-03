import { TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';

const statusConfig = {
  pending: { color: 'text-amber-400', icon: Clock, label: 'Pending' },
  approved: { color: 'text-blue-400', icon: CheckCircle, label: 'Approved' },
  repaid: { color: 'text-green-400', icon: CheckCircle, label: 'Repaid' },
  rejected: { color: 'text-red-400', icon: XCircle, label: 'Rejected' },
};

export default function LoanCard({ loan }) {
  const config = statusConfig[loan.status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 transition hover:border-slate-600">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm text-slate-400">Loan #{loan.loanId}</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {parseFloat(loan.amount).toFixed(4)} ETH
          </p>
          <p className="mt-1 text-sm text-slate-400">{loan.loanType} • {loan.duration} days</p>
        </div>
        <span className={`flex items-center gap-1 text-sm font-medium ${config.color}`}>
          <Icon className="h-4 w-4" />
          {config.label}
        </span>
      </div>
      {loan.collateralRequired && (
        <p className="mt-3 text-xs text-amber-400">Collateral required</p>
      )}
      {loan.txHash && (
        <a
          href={`https://etherscan.io/tx/${loan.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block truncate text-xs text-primary-400 hover:underline"
        >
          {loan.txHash.slice(0, 20)}...
        </a>
      )}
    </div>
  );
}

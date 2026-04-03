import { TrendingUp } from 'lucide-react';

function getScoreColor(score) {
  if (score >= 750) return 'text-green-400';
  if (score >= 650) return 'text-blue-400';
  if (score >= 600) return 'text-amber-400';
  return 'text-red-400';
}

export default function CreditScoreCard({ score, onUpdate }) {
  const color = getScoreColor(score);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-700/50 p-3">
            <TrendingUp className="h-6 w-6 text-primary-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Credit Score</p>
            <p className={`text-3xl font-bold ${color}`}>{score}</p>
          </div>
        </div>
        {onUpdate && (
          <button
            onClick={onUpdate}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            Update
          </button>
        )}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 750 ? 'bg-green-500' : score >= 650 ? 'bg-blue-500' : score >= 600 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${((score - 300) / 550) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">Range: 300 - 850</p>
    </div>
  );
}

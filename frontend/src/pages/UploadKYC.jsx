import { useState, useEffect } from 'react';
import api from '../services/api';
import { FileCheck, Upload, CheckCircle } from 'lucide-react';

export default function UploadKYC() {
  const { refreshUser } = useAuth();
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/kyc/status')
      .then((res) => setStatus(res.data.data))
      .catch(() => setStatus({ status: 'not_submitted' }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{12}$/.test(aadhaarNumber)) {
      setError('Aadhaar number must be exactly 12 digits');
      return;
    }

    setLoading(true);
    try {
      await api.post('/kyc/upload', { aadhaarNumber, documentType: 'id_card' });
      setStatus({ status: 'pending', aadhaarNumber });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/kyc/verify');
      // Sync global user state so Apply page knows we are verified
      await refreshUser();
      setStatus((s) => ({ ...s, status: 'verified' }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">KYC Verification</h1>
        <p className="mt-1 text-slate-400">Enter your Aadhaar number to verify your account</p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8">
        {status?.status === 'verified' ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-green-500/20 p-4">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">KYC Verified</h2>
            <p className="text-slate-400">Your identity has been verified. You can now apply for loans.</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-900/30 p-3 text-sm text-red-300">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300">Aadhaar Number (12 Digits)</label>
                <input
                  type="text"
                  maxLength="12"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="123456789012"
                  required
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-500 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {loading ? 'Submitting...' : 'Upload Aadhaar'}
                </button>
                {status?.status === 'pending' && (
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-3 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    <FileCheck className="h-4 w-4" />
                    Verify KYC
                  </button>
                )}
              </div>
            </form>
            {status?.status === 'pending' && (
              <p className="mt-4 text-sm text-amber-400">
                Document uploaded. Click "Verify KYC" to complete verification (simulated for local testing).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

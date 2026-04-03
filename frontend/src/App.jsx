import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import UploadKYC from './pages/UploadKYC';
import ApplyLoan from './pages/ApplyLoan';
import LoanStatus from './pages/LoanStatus';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WalletProvider>
          <div className="min-h-screen bg-slate-950">
            <Navbar />
            <main className="container mx-auto px-4 py-8">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/dashboard"
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/kyc"
                  element={
                    <PrivateRoute>
                      <UploadKYC />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/apply"
                  element={
                    <PrivateRoute>
                      <ApplyLoan />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/loans"
                  element={
                    <PrivateRoute>
                      <LoanStatus />
                    </PrivateRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>
          </div>
        </WalletProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

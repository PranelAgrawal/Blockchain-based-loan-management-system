/**
 * Router configuration
 * Centralized route definitions
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import UploadKYC from '../pages/UploadKYC';
import ApplyLoan from '../pages/ApplyLoan';
import LoanStatus from '../pages/LoanStatus';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export const routes = [
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    path: '/dashboard',
    element: (
      <PrivateRoute>
        <Dashboard />
      </PrivateRoute>
    ),
  },
  {
    path: '/kyc',
    element: (
      <PrivateRoute>
        <UploadKYC />
      </PrivateRoute>
    ),
  },
  {
    path: '/apply',
    element: (
      <PrivateRoute>
        <ApplyLoan />
      </PrivateRoute>
    ),
  },
  {
    path: '/loans',
    element: (
      <PrivateRoute>
        <LoanStatus />
      </PrivateRoute>
    ),
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
];

export const router = createBrowserRouter([
  {
    path: '/',
    children: routes,
  },
]);

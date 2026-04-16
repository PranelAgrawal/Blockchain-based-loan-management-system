import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api
        .get('/auth/me')
        .then((res) => {
          // Backend returns { success: true, data: user }
          const userData = res.data.data || res.data;
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const userData = res.data.data || res.data;
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    // axios response might be res.data
    const responseData = res.data || res;
    if (!responseData.success) {
      throw new Error(responseData.message || 'Login failed');
    }
    const { token, ...userData } = responseData.data;
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password, walletAddress) => {
    const res = await api.post('/auth/register', { name, email, password, walletAddress });
    const responseData = res.data || res;
    if (!responseData.success) {
      throw new Error(responseData.message || 'Registration failed');
    }
    const { token, ...userData } = responseData.data;
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateUser = (data) => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

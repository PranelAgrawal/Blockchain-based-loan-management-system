import { createContext, useContext, useState, useEffect } from 'react';
import { connectWallet, getContractAddresses } from '../services/blockchain';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      if (window.ethereum) {
        const chain = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(chain);
      }
      return addr;
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setChainId(null);
    setError(null);
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        setAddress(accounts[0] || null);
      });
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
  }, []);

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  return (
    <WalletContext.Provider
      value={{
        address,
        shortAddress,
        chainId,
        loading,
        error,
        connect,
        disconnect,
        contractAddresses: getContractAddresses(),
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

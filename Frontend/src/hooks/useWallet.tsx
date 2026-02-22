import { useState, useCallback, createContext, useContext, ReactNode, useEffect } from 'react';
import { walletConnector, WalletConnection, WalletType } from '@/services/walletConnector';
import { authService } from '@/services/authService';
import type { User, WalletAsset } from '@/types';
import { toast } from 'sonner';

interface WalletContextType {
  isConnected: boolean;
  isAuthenticating: boolean;
  user: User | null;
  walletAssets: WalletAsset[];
  connect: (walletType: WalletType) => Promise<void>;
  connectByAddress: (targetAddress: string) => Promise<void>;
  disconnect: () => void;
  address: string | null;
  token: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const TOKEN_KEY = 'defi_access_token';
const ADDRESS_KEY = 'defi_wallet_address';
const WALLET_TYPE_KEY = 'defi_wallet_type';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [walletAssets, setWalletAssets] = useState<WalletAsset[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(null);

  const loadUserData = useCallback((walletAddress: string) => {
    // Set basic user data - wallet assets will be loaded from API
    const userData: User = {
      address: walletAddress,
      name: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${walletAddress}`,
      totalBalance: 0,
      portfolioValue: 0,
      portfolioChange24h: 0,
    };
    setUser(userData);
    setWalletAssets([]);
  }, []);

  // Load saved session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedAddress = localStorage.getItem(ADDRESS_KEY);
    const savedWalletType = localStorage.getItem(WALLET_TYPE_KEY) as WalletType | null;

    if (savedToken && savedAddress && savedWalletType) {
      // Verify token is still valid BEFORE restoring session
      authService.getUserInfo(savedToken)
        .then(async () => {
          // Token is valid, now reconnect to the SAME wallet type user chose initially
          console.log(`Restoring session for ${savedAddress} using ${savedWalletType}`);
          
          setIsAuthenticating(true);
          
          try {
            // Reconnect to the same wallet type (MetaMask or Coinbase)
            let connection: WalletConnection;
            
            if (savedWalletType === 'metamask') {
              connection = await walletConnector.connectMetaMask();
            } else if (savedWalletType === 'coinbase') {
              connection = await walletConnector.connectCoinbase();
            } else {
              throw new Error('Unsupported wallet type');
            }

            const walletAddress = connection.address;
            setWalletConnection(connection);
            
            // Request nonce and sign
            const nonceResponse = await authService.requestNonce(walletAddress);
            const signature = await walletConnector.signMessage(connection.signer, nonceResponse.message);
            
            // Verify signature
            const authResponse = await authService.verifySignature(
              walletAddress,
              nonceResponse.message,
              signature
            );

            // Update session
            localStorage.setItem(TOKEN_KEY, authResponse.access_token);
            localStorage.setItem(ADDRESS_KEY, authResponse.wallet_address);
            localStorage.setItem(WALLET_TYPE_KEY, savedWalletType);

            setToken(authResponse.access_token);
            setAddress(authResponse.wallet_address);
            setIsConnected(true);
            loadUserData(authResponse.wallet_address);
            
            console.log(`Session restored successfully with ${savedWalletType}`);
            toast.success('Wallet reconnected', { duration: 2000 });
          } catch (error: any) {
            console.error('Failed to reconnect wallet:', error);
            // If wallet connection fails, still restore the session data
            setToken(savedToken);
            setAddress(savedAddress);
            setIsConnected(true);
            loadUserData(savedAddress);
            
            // Show a toast asking user to reconnect
            toast.info(`Please reconnect your ${savedWalletType === 'metamask' ? 'MetaMask' : 'Coinbase Wallet'} to continue`, { duration: 5000 });
          } finally {
            setIsAuthenticating(false);
          }
        })
        .catch(() => {
          // Token expired or invalid, silently clear
          console.log('Saved token is invalid or expired');
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ADDRESS_KEY);
          localStorage.removeItem(WALLET_TYPE_KEY);
        });
    }
  }, [loadUserData]); // Removed 'connect' from dependencies to avoid circular reference

  // Setup wallet event listeners
  useEffect(() => {
    if (walletConnection) {
      walletConnector.setupAccountChangeListener((accounts) => {
        if (accounts.length === 0) {
          // Account disconnected
          toast.info('Wallet disconnected. Please reconnect.');
          // Manually clear state instead of calling disconnect to avoid circular dependency
          setIsConnected(false);
          setUser(null);
          setWalletAssets([]);
          setAddress(null);
          setToken(null);
          setWalletConnection(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ADDRESS_KEY);
        } else if (accounts[0].toLowerCase() !== address?.toLowerCase()) {
          // Account changed, need to re-authenticate
          toast.info('Account changed. Please reconnect to authenticate with the new wallet.');
          // Manually clear state instead of calling disconnect to avoid circular dependency
          setIsConnected(false);
          setUser(null);
          setWalletAssets([]);
          setAddress(null);
          setToken(null);
          setWalletConnection(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ADDRESS_KEY);
          localStorage.removeItem(WALLET_TYPE_KEY);
        }
      });

      walletConnector.setupChainChangeListener(() => {
        toast.info('Network changed. Please reconnect.');
        // Manually clear state instead of calling disconnect to avoid circular dependency
        setIsConnected(false);
        setUser(null);
        setWalletAssets([]);
        setAddress(null);
        setToken(null);
        setWalletConnection(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ADDRESS_KEY);
      });

      return () => {
        walletConnector.removeListeners();
      };
    }
  }, [walletConnection, address]);

  const connect = useCallback(async (walletType: WalletType) => {
    setIsAuthenticating(true);
    
    try {
      // Step 1: Connect wallet
      let connection: WalletConnection;
      
      if (walletType === 'metamask') {
        connection = await walletConnector.connectMetaMask();
      } else if (walletType === 'coinbase') {
        connection = await walletConnector.connectCoinbase();
      } else {
        throw new Error(`Wallet type ${walletType} not yet implemented`);
      }

      const walletAddress = connection.address;
      setWalletConnection(connection);
      
      // Step 2: Request nonce from backend
      toast.loading('Requesting authentication...', { id: 'auth' });
      const nonceResponse = await authService.requestNonce(walletAddress);

      // Step 3: Sign message with wallet
      toast.loading('Please sign the message in your wallet...', { id: 'auth' });
      const signature = await walletConnector.signMessage(connection.signer, nonceResponse.message);

      // Step 4: Verify signature and get JWT token
      toast.loading('Verifying signature...', { id: 'auth' });
      const authResponse = await authService.verifySignature(
        walletAddress,
        nonceResponse.message,
        signature
      );

      // Step 5: Save session WITH wallet type for future auto-reconnection
      localStorage.setItem(TOKEN_KEY, authResponse.access_token);
      localStorage.setItem(ADDRESS_KEY, authResponse.wallet_address);
      localStorage.setItem(WALLET_TYPE_KEY, walletType); // Remember which wallet was used

      setToken(authResponse.access_token);
      setAddress(authResponse.wallet_address);
      setIsConnected(true);

      // Load user data
      loadUserData(authResponse.wallet_address);

      toast.success('Authentication successful!', { id: 'auth' });

      // Step 6: Start background data ingestion AFTER authentication
      toast.loading('Starting data ingestion...', { id: 'ingestion', duration: 3000 });
      
      // Trigger background ingestion (non-blocking)
      authService.startDataIngestion(authResponse.wallet_address, authResponse.access_token)
        .then(() => {
          toast.success('Data ingestion started in background', { id: 'ingestion' });
        })
        .catch((error) => {
          console.error('Ingestion error:', error);
          toast.info('Data ingestion will continue in background', { id: 'ingestion' });
        });

    } catch (error: any) {
      console.error('Wallet connection error:', error);
      
      if (error.message.includes('User rejected')) {
        toast.error('Connection cancelled', { id: 'auth' });
      } else if (error.message.includes('not installed')) {
        toast.error(error.message, { id: 'auth' });
      } else {
        toast.error('Failed to connect wallet: ' + error.message, { id: 'auth' });
      }
      
      // Clean up on error
      setWalletConnection(null);
      setAddress(null);
      setToken(null);
      setIsConnected(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [loadUserData]);

  const connectByAddress = useCallback(async (targetAddress: string) => {
    setIsAuthenticating(true);
    
    try {
      // Step 1: Find and connect to wallet containing the target address
      toast.loading('Finding wallet with your address...', { id: 'auth' });
      const connection = await walletConnector.connectByAddress(targetAddress);
      
      const walletAddress = connection.address;
      setWalletConnection(connection);
      
      toast.success(`Connected to ${connection.walletType === 'metamask' ? 'MetaMask' : 'Coinbase Wallet'}`, { id: 'auth', duration: 2000 });

      // Step 2: Request nonce from backend
      toast.loading('Requesting authentication...', { id: 'auth' });
      const nonceResponse = await authService.requestNonce(walletAddress);

      // Step 3: Sign message with wallet
      toast.loading('Please sign the message in your wallet...', { id: 'auth' });
      const signature = await walletConnector.signMessage(connection.signer, nonceResponse.message);

      // Step 4: Verify signature and get JWT token
      toast.loading('Verifying signature...', { id: 'auth' });
      const authResponse = await authService.verifySignature(
        walletAddress,
        nonceResponse.message,
        signature
      );

      // Step 5: Save session
      localStorage.setItem(TOKEN_KEY, authResponse.access_token);
      localStorage.setItem(ADDRESS_KEY, authResponse.wallet_address);

      setToken(authResponse.access_token);
      setAddress(authResponse.wallet_address);
      setIsConnected(true);

      // Load user data
      loadUserData(authResponse.wallet_address);

      toast.success('Authentication successful!', { id: 'auth' });

      // Step 6: Start background data ingestion
      toast.loading('Starting data ingestion...', { id: 'ingestion', duration: 3000 });
      
      authService.startDataIngestion(authResponse.wallet_address, authResponse.access_token)
        .then(() => {
          toast.success('Data ingestion started in background', { id: 'ingestion' });
        })
        .catch((error) => {
          console.error('Ingestion error:', error);
          toast.info('Data ingestion will continue in background', { id: 'ingestion' });
        });

    } catch (error: any) {
      console.error('Wallet connection error:', error);
      
      if (error.message.includes('User rejected')) {
        toast.error('Connection cancelled', { id: 'auth' });
      } else if (error.message.includes('not found in any')) {
        toast.error(error.message, { id: 'auth', duration: 5000 });
      } else {
        toast.error('Failed to connect wallet: ' + error.message, { id: 'auth' });
      }
      
      // Clean up on error
      setWalletConnection(null);
      setAddress(null);
      setToken(null);
      setIsConnected(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [loadUserData]);

  const disconnect = useCallback(async () => {
    try {
      if (token) {
        await authService.logout(token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state
      setIsConnected(false);
      setUser(null);
      setWalletAssets([]);
      setAddress(null);
      setToken(null);
      setWalletConnection(null);

      // Clear storage (including wallet type)
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADDRESS_KEY);
      localStorage.removeItem(WALLET_TYPE_KEY);

      // Remove listeners
      walletConnector.removeListeners();

      // Only show toast if user manually disconnected (not on page refresh)
      if (typeof window !== 'undefined' && document.visibilityState === 'visible') {
        toast.success('Wallet disconnected');
      }
    }
  }, [token]);

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isAuthenticating,
        user,
        walletAssets,
        connect,
        connectByAddress,
        disconnect,
        address,
        token,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

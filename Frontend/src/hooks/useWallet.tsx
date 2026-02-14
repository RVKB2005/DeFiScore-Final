import { useState, useCallback, createContext, useContext, ReactNode, useEffect } from 'react';
import { walletConnector, WalletConnection, WalletType } from '@/services/walletConnector';
import { authService } from '@/services/authService';
import { mockUser, mockWalletAssets } from '@/mock/user';
import type { User, WalletAsset } from '@/types';
import { toast } from 'sonner';

interface WalletContextType {
  isConnected: boolean;
  isAuthenticating: boolean;
  user: User | null;
  walletAssets: WalletAsset[];
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  address: string | null;
  accessToken: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const TOKEN_KEY = 'defi_access_token';
const ADDRESS_KEY = 'defi_wallet_address';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [walletAssets, setWalletAssets] = useState<WalletAsset[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(null);

  // Load saved session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedAddress = localStorage.getItem(ADDRESS_KEY);

    if (savedToken && savedAddress) {
      // Verify token is still valid
      authService.getUserInfo(savedToken)
        .then(() => {
          setAccessToken(savedToken);
          setAddress(savedAddress);
          setIsConnected(true);
          // Load user data
          loadUserData(savedAddress);
        })
        .catch(() => {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ADDRESS_KEY);
        });
    }
  }, []);

  // Setup wallet event listeners
  useEffect(() => {
    if (walletConnection) {
      walletConnector.setupAccountChangeListener((accounts) => {
        if (accounts.length === 0) {
          disconnect();
        } else if (accounts[0].toLowerCase() !== address?.toLowerCase()) {
          // Account changed, need to re-authenticate
          toast.info('Account changed. Please reconnect.');
          disconnect();
        }
      });

      walletConnector.setupChainChangeListener(() => {
        toast.info('Network changed. Please reconnect.');
        disconnect();
      });

      return () => {
        walletConnector.removeListeners();
      };
    }
  }, [walletConnection, address]);

  const loadUserData = useCallback((walletAddress: string) => {
    // For now, use mock data but with real wallet address
    const userData = {
      ...mockUser,
      address: walletAddress,
    };
    setUser(userData);
    setWalletAssets(mockWalletAssets);
  }, []);

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
      
      toast.success(`Wallet connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);

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

      setAccessToken(authResponse.access_token);
      setAddress(authResponse.wallet_address);
      setIsConnected(true);

      // Load user data
      loadUserData(authResponse.wallet_address);

      toast.success('Authentication successful!', { id: 'auth' });

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
      setAccessToken(null);
      setIsConnected(false);
    } finally {
      setIsAuthenticating(false);
    }
  }, [loadUserData]);

  const disconnect = useCallback(async () => {
    try {
      if (accessToken) {
        await authService.logout(accessToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state
      setIsConnected(false);
      setUser(null);
      setWalletAssets([]);
      setAddress(null);
      setAccessToken(null);
      setWalletConnection(null);

      // Clear storage
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADDRESS_KEY);

      // Remove listeners
      walletConnector.removeListeners();

      toast.success('Wallet disconnected');
    }
  }, [accessToken]);

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isAuthenticating,
        user,
        walletAssets,
        connect,
        disconnect,
        address,
        accessToken,
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

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { apiService } from '@/services/apiService';

interface UserDataContextType {
  // Wallet data
  walletBalance: any | null;
  userStats: any | null;
  protocolPositions: any | null;
  
  // Supply data
  supplierStats: any | null;
  supplierIntents: any[];
  matchedBorrowRequests: any[];
  
  // Borrow data
  myBorrowRequests: any[];
  availableSuppliers: any[];
  
  // Loading states
  loading: boolean;
  
  // Refetch function
  refetch: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { isConnected, token, address } = useWallet();
  
  // Wallet data
  const [walletBalance, setWalletBalance] = useState<any | null>(null);
  const [userStats, setUserStats] = useState<any | null>(null);
  const [protocolPositions, setProtocolPositions] = useState<any | null>(null);
  
  // Supply data
  const [supplierStats, setSupplierStats] = useState<any | null>(null);
  const [supplierIntents, setSupplierIntents] = useState<any[]>([]);
  const [matchedBorrowRequests, setMatchedBorrowRequests] = useState<any[]>([]);
  
  // Borrow data
  const [myBorrowRequests, setMyBorrowRequests] = useState<any[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (!isConnected || !token) {
      // Clear data when disconnected
      setWalletBalance(null);
      setUserStats(null);
      setProtocolPositions(null);
      setSupplierStats(null);
      setSupplierIntents([]);
      setMatchedBorrowRequests([]);
      setMyBorrowRequests([]);
      return;
    }

    setLoading(true);
    
    try {
      // Fetch ALL user data in parallel for maximum speed
      const [
        balance,
        stats,
        positions,
        suppStats,
        suppIntents,
        borrowReqs,
        suppliers
      ] = await Promise.all([
        // Wallet data
        apiService.getWalletBalance(token).catch(() => null),
        apiService.getUserStats(token).catch(() => null),
        apiService.getProtocolPositions(token).catch(() => null),
        
        // Supply data
        apiService.getSupplierStats(token).catch(() => null),
        apiService.getSupplierIntents(token).catch(() => []),
        apiService.getMyBorrowRequests(token).catch(() => []),
        
        // Borrow data (public endpoint) - EXCLUDE current user's address to prevent self-borrowing
        apiService.getPublicSupplierIntents(undefined, address || undefined).catch(() => [])
      ]);
      
      setWalletBalance(balance);
      setUserStats(stats);
      setProtocolPositions(positions);
      setSupplierStats(suppStats);
      setSupplierIntents(suppIntents);
      setMyBorrowRequests(borrowReqs);
      setAvailableSuppliers(suppliers);
      
      // Load matched requests if user has supply intents
      if (suppIntents && suppIntents.length > 0) {
        const firstIntent = suppIntents[0];
        const matched = await apiService.getMatchedBorrowRequests(token, firstIntent.currency).catch(() => []);
        setMatchedBorrowRequests(matched);
      }
      
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  }, [isConnected, token, address]);

  // Load all data when wallet connects
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return (
    <UserDataContext.Provider
      value={{
        walletBalance,
        userStats,
        protocolPositions,
        supplierStats,
        supplierIntents,
        matchedBorrowRequests,
        myBorrowRequests,
        availableSuppliers,
        loading,
        refetch: fetchAllData
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  const context = useContext(UserDataContext);
  if (context === undefined) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
}

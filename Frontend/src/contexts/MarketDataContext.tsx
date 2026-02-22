import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { apiService, type MarketStats, type Asset, type ChartDataPoint } from '@/services/apiService';

interface MarketDataContextType {
  marketStats: MarketStats | null;
  topAssets: Asset[];
  marketCapData: ChartDataPoint[];
  tvlData: ChartDataPoint[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastFetched: number | null;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [topAssets, setTopAssets] = useState<Asset[]>([]);
  const [marketCapData, setMarketCapData] = useState<ChartDataPoint[]>([]);
  const [tvlData, setTvlData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const isFetching = useRef(false);

  const fetchMarketData = async (force = false) => {
    // If already fetching, don't fetch again
    if (isFetching.current) {
      return;
    }

    // If data exists and not forcing, don't refetch
    if (!force && topAssets.length > 0 && marketStats) {
      return;
    }

    try {
      isFetching.current = true;
      setLoading(true);
      setError(null);
      
      // Fetch all data in parallel for maximum speed
      const [stats, assets, marketCapChart, tvlChart] = await Promise.all([
        apiService.getMarketStats(),
        apiService.getTopAssets(10),
        apiService.getMarketChartData('marketCap', 30),
        apiService.getMarketChartData('tvl', 30)
      ]);
      
      setMarketStats(stats);
      setTopAssets(assets);
      setMarketCapData(marketCapChart.data);
      setTvlData(tvlChart.data);
      setLastFetched(Date.now());
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setError('Failed to load market data');
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchMarketData();
  }, []);

  return (
    <MarketDataContext.Provider
      value={{
        marketStats,
        topAssets,
        marketCapData,
        tvlData,
        loading,
        error,
        refetch: () => fetchMarketData(true),
        lastFetched
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (context === undefined) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
}

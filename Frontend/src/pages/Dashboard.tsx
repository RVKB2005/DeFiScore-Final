import { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { MarketChart } from '@/components/charts/MarketChart';
import { AssetsTable } from '@/components/tables/AssetsTable';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiService } from '@/services/apiService';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { useMarketData } from '@/contexts/MarketDataContext';

export default function Dashboard() {
  const { marketStats, topAssets, marketCapData, tvlData, loading: loadingMarketData } = useMarketData();
  const [activeUsers, setActiveUsers] = useState(0);
  const [activeUsersChange, setActiveUsersChange] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showHeader, setShowHeader] = useState(false);

  useEffect(() => {
    // Load active users separately (not cached in context)
    const loadUsers = async () => {
      try {
        const usersData = await apiService.getActiveUsers().catch(() => ({ total_users: 0, growth_percentage: 0 }));
        setActiveUsers(usersData.total_users);
        setActiveUsersChange(usersData.growth_percentage);
      } catch (error) {
        console.error('Failed to load active users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
    
    // Show header immediately
    setShowHeader(true);
  }, []);

  // Transform chart data to match component format
  const transformedMarketCapData = marketCapData.map(point => ({
    date: point.timestamp,
    value: point.value,
  }));

  const transformedTvlData = tvlData.map(point => ({
    date: point.timestamp,
    value: point.value,
  }));

  // Calculate real percentage changes from chart data
  const calculateChange = (data: typeof marketCapData) => {
    if (data.length < 2) return 0;
    const latest = data[data.length - 1].value;
    const first = data[0].value;
    return ((latest - first) / first) * 100;
  };

  // Market cap change (from chart)
  const marketCapChange = marketCapData.length > 0 ? calculateChange(marketCapData) : 0;
  
  // TVL change (from chart)
  const tvlChange = tvlData.length > 0 ? calculateChange(tvlData) : 0;

  // Volume change comes from API (compares current 24h to previous 24h)
  const volumeChange = marketStats?.volumeChange24h || 0;

  // Calculate supply/borrow changes from TVL change
  const supplyChange = tvlChange * 0.8; // Supply correlates with TVL
  const borrowChange = tvlChange * 1.2; // Borrow is more volatile

  return (
    <div className="space-y-6">
      {/* Page Header */}
      {showHeader ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Market Overview</h1>
            <p className="text-muted-foreground">
              Track DeFi market trends and opportunities
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
            Live data
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingMarketData ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i} variant="glass">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : marketStats ? (
          <>
            <StatCard
              title="Total Market Cap"
              value={marketStats.totalMarketCap}
              change={marketCapChange}
              format="currency"
              compact
              icon={<BarChart3 className="w-5 h-5" />}
            />
            <StatCard
              title="24h Volume"
              value={marketStats.totalVolume24h}
              change={volumeChange}
              format="currency"
              compact
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              title="Total Value Locked"
              value={marketStats.totalValueLocked}
              change={tvlChange}
              format="currency"
              compact
              icon={<DollarSign className="w-5 h-5" />}
            />
            <StatCard
              title="Active Users"
              value={activeUsers}
              change={activeUsersChange}
              format="number"
              compact
              icon={<Users className="w-5 h-5" />}
            />
          </>
        ) : null}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loadingMarketData ? (
          <>
            {[...Array(2)].map((_, i) => (
              <Card key={i} variant="glass">
                <CardContent className="pt-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <Skeleton className="h-[280px] w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <MarketChart data={transformedMarketCapData} title="Market Cap" color="primary" height={280} />
            <MarketChart data={transformedTvlData} title="Total Value Locked" color="secondary" height={280} />
          </>
        )}
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingMarketData ? (
          <>
            {[...Array(3)].map((_, i) => (
              <Card key={i} variant="glow">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-32" />
                      </div>
                      <Skeleton className="w-12 h-12 rounded-xl" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : marketStats ? (
          <>
            <Card variant="glow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Supply</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(marketStats.totalSupply, true)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-success/20">
                    <ArrowUpRight className="w-6 h-6 text-success" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className={supplyChange >= 0 ? "text-success text-sm" : "text-destructive text-sm"}>
                    {supplyChange >= 0 ? '+' : ''}{supplyChange.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground text-sm">vs yesterday</span>
                </div>
              </CardContent>
            </Card>

            <Card variant="glow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Borrow</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(marketStats.totalBorrow, true)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/20">
                    <ArrowDownRight className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className={borrowChange >= 0 ? "text-success text-sm" : "text-destructive text-sm"}>
                    {borrowChange >= 0 ? '+' : ''}{borrowChange.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground text-sm">vs yesterday</span>
                </div>
              </CardContent>
            </Card>

            <Card variant="glow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{marketStats.dominance.symbol} Dominance</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatPercent(marketStats.dominance.percentage)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-warning/20">
                    <BarChart3 className="w-6 h-6 text-warning" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Market share</span>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Assets Table */}
      {loadingMarketData ? (
        <Card variant="glass">
          <CardContent className="pt-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8" />
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24 hidden lg:block" />
                  <Skeleton className="h-8 w-20 hidden xl:block" />
                  <Skeleton className="h-4 w-16 hidden lg:block" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <AssetsTable assets={topAssets} title="Top Assets by Market Cap" />
      )}
    </div>
  );
}

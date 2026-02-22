import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Eye, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { useMarketData } from '@/contexts/MarketDataContext';
import { useUserData } from '@/contexts/UserDataContext';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Link } from 'react-router-dom';

interface UserDashboardProps {
  onWalletClick?: () => void;
}

export default function UserDashboard({ onWalletClick }: UserDashboardProps) {
  const { isConnected } = useWallet();
  const { topAssets } = useMarketData();
  const { walletBalance, userStats, protocolPositions, loading } = useUserData();
  const [assetsToSupply, setAssetsToSupply] = useState<any[]>([]);
  const [assetsToBorrow, setAssetsToBorrow] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    if (isConnected) {
      // Simulate progress for visual feedback
      if (loading) {
        const interval = setInterval(() => {
          setLoadingProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              return 100;
            }
            return prev + 33;
          });
        }, 300);
        return () => clearInterval(interval);
      } else {
        setLoadingProgress(100);
      }
    }
  }, [isConnected, loading]);

  // Update assets when market data changes
  useEffect(() => {
    if (topAssets.length > 0) {
      updateAssetLists();
    }
  }, [topAssets]);

  const updateAssetLists = () => {
    // Ensure topAssets is available
    if (!topAssets || topAssets.length === 0) {
      return;
    }

    // Use cached market data for supply/borrow assets
    const supplyAssets = topAssets
      .filter(a => a.supplyApy != null && a.supplyApy > 0)
      .sort((a, b) => (b.supplyApy || 0) - (a.supplyApy || 0))
      .slice(0, 3)
      .map(asset => ({
        id: asset.id,
        symbol: asset.symbol,
        icon: asset.icon,
        liquidity: formatLargeNumber(asset.marketCap),
        liquidityUsd: formatCurrency(asset.marketCap, true),
        apy: asset.supplyApy
      }));

    const borrowAssets = topAssets
      .filter(a => a.supplyApy != null && a.supplyApy > 0)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 3)
      .map(asset => ({
        id: asset.id,
        symbol: asset.symbol,
        icon: asset.icon,
        available: formatLargeNumber(asset.volume24h),
        availableUsd: formatCurrency(asset.volume24h, true),
        apy: asset.borrowApy || asset.supplyApy
      }));

    setAssetsToSupply(supplyAssets);
    setAssetsToBorrow(borrowAssets);
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          {/* Ghost/Wallet Illustration */}
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [-10, 0, -10] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mb-8"
          >
            <div className="relative inline-block">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              
              {/* Ghost/Wallet Icon */}
              <div className="relative w-32 h-32 mx-auto">
                <svg viewBox="0 0 120 120" className="w-full h-full">
                  {/* Ghost body */}
                  <path
                    d="M60 20 C40 20, 25 35, 25 55 L25 95 L35 85 L45 95 L55 85 L65 95 L75 85 L85 95 L95 85 L95 55 C95 35, 80 20, 60 20 Z"
                    fill="currentColor"
                    className="text-muted-foreground/30"
                  />
                  {/* Eyes */}
                  <circle cx="45" cy="50" r="5" fill="currentColor" className="text-foreground/60" />
                  <circle cx="75" cy="50" r="5" fill="currentColor" className="text-foreground/60" />
                  {/* Wallet on head */}
                  <rect x="50" y="15" width="20" height="15" rx="2" fill="currentColor" className="text-primary/60" />
                  <rect x="65" y="20" width="3" height="6" rx="1" fill="currentColor" className="text-primary" />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-3xl font-bold">Please, connect your wallet</h2>
            <p className="text-muted-foreground text-lg">
              Please connect your wallet to see your supplies, borrowings, and open positions.
            </p>
          </motion.div>

          {/* Connect Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <Button
              variant="default"
              size="lg"
              className="text-lg px-8 py-6"
              onClick={onWalletClick}
            >
              Connect wallet
            </Button>
          </motion.div>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>Secure • Privacy-First • Decentralized</span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">Fetching Wallet Data</h3>
            <p className="text-sm text-muted-foreground">Loading your portfolio and positions...</p>
          </div>
          
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-purple-500"
                initial={{ width: "0%" }}
                animate={{ width: `${loadingProgress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {Math.round(loadingProgress)}% complete
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold">User Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage your assets and check your privacy-first credit score.
        </p>
      </motion.div>

      {/* Top Section - Credit Score Card + Wallet Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Credit Score Card - Takes 2 columns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card variant="glass" className="h-full">
            <CardContent className="p-8">
              <div className="space-y-4">
                <span className="text-xs font-semibold tracking-widest text-primary uppercase">
                  Creditworthiness
                </span>
                <h2 className="text-2xl font-bold">Your Web3 Credit Score</h2>
                <p className="text-muted-foreground max-w-lg">
                  Unlock lower collateral ratios and better borrow rates by verifying your on-chain history without revealing your identity.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link to="/score">
                    <Button className="gap-2">
                      <Eye className="w-4 h-4" />
                      View My Wallet Credit Score
                    </Button>
                  </Link>
                  <Button variant="secondary">
                    Learn More
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Wallet Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="glass" className="h-full">
            <CardContent className="p-6">
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      My Wallet Balance
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold">
                        {walletBalance?.amount?.toFixed(4) || '0.0000'}
                      </span>
                      <span className="text-xl font-semibold">{walletBalance?.symbol || 'ETH'}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      ≈ {formatCurrency(walletBalance?.usd_value || 0)}
                    </p>
                    {!walletBalance?.has_data && !loading && (
                      <p className="text-xs text-muted-foreground mt-2">
                        No transaction history
                      </p>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <span className="text-cyan-400 text-lg">⟠</span>
                  </div>
                </div>

                {/* Supply / Borrow Buttons */}
                <div className="flex gap-3">
                  <Link to="/supply" className="flex-1">
                    <Button className="w-full gap-2" size="lg">
                      <ArrowUp className="w-4 h-4" />
                      Supply
                    </Button>
                  </Link>
                  <Link to="/borrow" className="flex-1">
                    <Button variant="secondary" className="w-full gap-2" size="lg">
                      <ArrowDown className="w-4 h-4" />
                      Borrow
                    </Button>
                  </Link>
                </div>

                {/* Stats */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Net APY</span>
                    <span className="text-sm font-medium text-success">
                      {protocolPositions?.net_apy ? `+${formatPercent(protocolPositions.net_apy)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Health Factor</span>
                    <span className={`text-sm font-medium ${
                      protocolPositions?.health_factor > 2 ? 'text-success' : 
                      protocolPositions?.health_factor > 1.5 ? 'text-warning' : 'text-destructive'
                    }`}>
                      {protocolPositions?.health_factor ? protocolPositions.health_factor.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Assets Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets to Supply */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card variant="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Assets to Supply</CardTitle>
              <Link to="/supply">
                <Button variant="link" className="text-primary p-0 h-auto text-sm">
                  VIEW ALL
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Asset
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Liquidity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        APY
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetsToSupply.map((asset, index) => (
                      <motion.tr
                        key={asset.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.05 }}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {typeof asset.icon === 'string' && asset.icon.startsWith('http') ? (
                              <img src={asset.icon} alt={asset.symbol} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-base">
                                {asset.icon}
                              </div>
                            )}
                            <span className="font-medium">{asset.symbol}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium">{asset.liquidity}</p>
                            <p className="text-xs text-muted-foreground">{asset.liquidityUsd}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-primary font-medium">{formatPercent(asset.apy)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link to="/supply">
                            <Button variant="outline" size="sm" className="text-xs">
                              Supply
                            </Button>
                          </Link>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Assets to Borrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card variant="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Assets to Borrow</CardTitle>
              <Link to="/borrow">
                <Button variant="link" className="text-primary p-0 h-auto text-sm">
                  VIEW ALL
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Asset
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Available
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        APY
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetsToBorrow.map((asset, index) => (
                      <motion.tr
                        key={asset.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.05 }}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {typeof asset.icon === 'string' && asset.icon.startsWith('http') ? (
                              <img src={asset.icon} alt={asset.symbol} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-base">
                                {asset.icon}
                              </div>
                            )}
                            <span className="font-medium">{asset.symbol}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium">{asset.available}</p>
                            <p className="text-xs text-muted-foreground">{asset.availableUsd}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-primary font-medium">{formatPercent(asset.apy)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link to="/borrow">
                            <Button variant="secondary" size="sm" className="text-xs">
                              Borrow
                            </Button>
                          </Link>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Link } from 'react-router-dom';

// Mock data for the dashboard
const walletBalance = {
  amount: 12.50,
  symbol: 'ETH',
  usdValue: 28450.00,
  netApy: 4.25,
  healthFactor: 2.45,
};

const assetsToSupply = [
  { id: '1', symbol: 'ETH', icon: '⟠', liquidity: '1.4M', liquidityUsd: '$3.2B', apy: 2.84 },
  { id: '2', symbol: 'USDC', icon: '💵', liquidity: '450M', liquidityUsd: '$450M', apy: 5.12 },
  { id: '3', symbol: 'WBTC', icon: '₿', liquidity: '12.5k', liquidityUsd: '$840M', apy: 1.25 },
];

const assetsToBorrow = [
  { id: '1', symbol: 'GHO', icon: '👻', available: '12.2M', availableUsd: '$12.2M', apy: 3.50 },
  { id: '2', symbol: 'USDT', icon: '💰', available: '210M', availableUsd: '$210M', apy: 6.85 },
  { id: '3', symbol: 'LINK', icon: '⛓️', available: '1.2M', availableUsd: '$22M', apy: 4.10 },
];

export default function UserDashboard() {
  const { isConnected } = useWallet();

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
                      <span className="text-3xl font-bold">{walletBalance.amount}</span>
                      <span className="text-xl font-semibold">{walletBalance.symbol}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      ≈ {formatCurrency(walletBalance.usdValue)}
                    </p>
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
                      +{formatPercent(walletBalance.netApy)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Health Factor</span>
                    <span className="text-sm font-medium text-success">
                      {walletBalance.healthFactor.toFixed(2)}
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
                            <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-base">
                              {asset.icon}
                            </div>
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
                            <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-base">
                              {asset.icon}
                            </div>
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

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="pt-12 border-t border-border/50"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">D</span>
            </div>
            <span className="font-semibold text-sm">DeFiScore</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-foreground transition-colors">Documentation</a>
            <a href="#" className="hover:text-foreground transition-colors">API</a>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2024 DeFiScore. All rights reserved.
          </p>
        </div>
      </motion.footer>
    </div>
  );
}

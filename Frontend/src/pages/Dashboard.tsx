import { motion } from 'framer-motion';
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { mockAssets } from '@/mock/assets';
import { mockMarketStats, mockMarketChartData, mockTVLChartData } from '@/mock/market';
import { formatCurrency, formatPercent } from '@/utils/formatters';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
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
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Market Cap"
          value={mockMarketStats.totalMarketCap}
          change={2.5}
          format="currency"
          compact
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <StatCard
          title="24h Volume"
          value={mockMarketStats.totalVolume24h}
          change={-1.2}
          format="currency"
          compact
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Total Value Locked"
          value={mockMarketStats.totalValueLocked}
          change={3.8}
          format="currency"
          compact
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Active Users"
          value={125420}
          change={5.2}
          format="number"
          compact
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarketChart data={mockMarketChartData} title="Market Cap" color="primary" height={280} />
        <MarketChart data={mockTVLChartData} title="Total Value Locked" color="secondary" height={280} />
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="glow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Supply</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(mockMarketStats.totalSupply, true)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-success/20">
                <ArrowUpRight className="w-6 h-6 text-success" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-success text-sm">+12.5%</span>
              <span className="text-muted-foreground text-sm">vs last week</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="glow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Borrow</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(mockMarketStats.totalBorrow, true)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary/20">
                <ArrowDownRight className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-primary text-sm">+8.3%</span>
              <span className="text-muted-foreground text-sm">vs last week</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="glow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">BTC Dominance</p>
                <p className="text-2xl font-bold mt-1">
                  {formatPercent(mockMarketStats.dominance.percentage)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-warning/20">
                <BarChart3 className="w-6 h-6 text-warning" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">-0.8% from yesterday</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <AssetsTable assets={mockAssets} title="Top Assets by Market Cap" />
    </div>
  );
}

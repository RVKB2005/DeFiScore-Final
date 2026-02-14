import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, ExternalLink, Wallet, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/StatCard';
import { PriceChart } from '@/components/charts/PriceChart';
import { getAssetBySymbol } from '@/mock/assets';
import { generatePriceHistory } from '@/mock/market';
import { formatCurrency, formatPercent, formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export default function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const asset = getAssetBySymbol(symbol || '');

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-muted-foreground">Asset not found</p>
        <Link to="/" className="mt-4">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const priceHistory = generatePriceHistory(asset.price);
  const priceChangeColor = asset.priceChange24h >= 0 ? 'text-success' : 'text-destructive';

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </motion.div>

      {/* Asset Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-3xl">
            {asset.icon}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{asset.name}</h1>
              <span className="px-3 py-1 rounded-lg bg-muted text-muted-foreground text-sm">
                {asset.symbol}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-2xl font-semibold">{formatCurrency(asset.price)}</span>
              <span className={cn('flex items-center gap-1', priceChangeColor)}>
                {asset.priceChange24h >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {formatPercent(Math.abs(asset.priceChange24h))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="glow" className="gap-2">
            <Wallet className="w-4 h-4" />
            Supply {asset.symbol}
          </Button>
          <Button variant="outline" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Borrow {asset.symbol}
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Market Cap"
          value={asset.marketCap}
          format="currency"
          compact
        />
        <StatCard
          title="24h Volume"
          value={asset.volume24h}
          format="currency"
          compact
        />
        <StatCard
          title="Supply APY"
          value={asset.supplyApy || 0}
          format="percent"
          icon={<TrendingUp className="w-5 h-5 text-success" />}
        />
        <StatCard
          title="Borrow APY"
          value={asset.borrowApy || 0}
          format="percent"
          icon={<TrendingDown className="w-5 h-5 text-destructive" />}
        />
      </div>

      {/* Price Chart */}
      <PriceChart data={priceHistory} title="Price History (7d)" height={350} />

      {/* Additional Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Supply Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-3 border-b border-border/50">
              <span className="text-muted-foreground">Circulating Supply</span>
              <span className="font-medium">
                {formatNumber(asset.circulatingSupply, { compact: true })} {asset.symbol}
              </span>
            </div>
            <div className="flex justify-between py-3 border-b border-border/50">
              <span className="text-muted-foreground">Total Supply</span>
              <span className="font-medium">
                {formatNumber(asset.totalSupply, { compact: true })} {asset.symbol}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Supply Ratio</span>
              <span className="font-medium">
                {formatPercent((asset.circulatingSupply / asset.totalSupply) * 100)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Lending Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-3 border-b border-border/50">
              <span className="text-muted-foreground">Total Supplied</span>
              <span className="font-medium">{formatCurrency(asset.marketCap * 0.15, true)}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-border/50">
              <span className="text-muted-foreground">Total Borrowed</span>
              <span className="font-medium">{formatCurrency(asset.marketCap * 0.08, true)}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Utilization Rate</span>
              <span className="font-medium text-primary">{formatPercent(53.3)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

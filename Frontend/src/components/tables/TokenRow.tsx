import { TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, formatNumber } from '@/utils/formatters';
import type { Asset } from '@/types';

interface TokenRowProps {
  asset: Asset;
  index: number;
  showSparkline?: boolean;
}

export function TokenRow({ asset, index, showSparkline = true }: TokenRowProps) {
  const priceChangeColor = asset.priceChange24h >= 0 ? 'text-success' : 'text-destructive';
  const PriceChangeIcon = asset.priceChange24h >= 0 ? TrendingUp : TrendingDown;

  // Simple sparkline visualization
  const renderSparkline = () => {
    if (!showSparkline || !asset.sparklineData || asset.sparklineData.length === 0) return null;

    const min = Math.min(...asset.sparklineData);
    const max = Math.max(...asset.sparklineData);
    const range = max - min || 1;
    const height = 32;
    const width = 80;

    const points = asset.sparklineData
      .map((value, i) => {
        const x = (i / (asset.sparklineData.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="inline-block">
        <polyline
          points={points}
          fill="none"
          stroke={asset.priceChange24h >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      {/* Rank */}
      <td className="px-4 py-4 text-muted-foreground">{index + 1}</td>

      {/* Asset */}
      <td className="px-4 py-4">
        <Link
          to={`/asset/${asset.symbol.toLowerCase()}`}
          className="flex items-center gap-3 hover:text-primary transition-colors"
        >
          {asset.icon && asset.icon.startsWith('http') ? (
            <img 
              src={asset.icon} 
              alt={asset.name}
              className="w-10 h-10 rounded-full"
              onError={(e) => {
                // Fallback to gradient circle if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div 
            className={cn(
              "w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-lg",
              asset.icon && asset.icon.startsWith('http') ? 'hidden' : ''
            )}
          >
            {!asset.icon || !asset.icon.startsWith('http') ? asset.icon || asset.symbol.charAt(0) : ''}
          </div>
          <div>
            <p className="font-semibold">{asset.name}</p>
            <p className="text-sm text-muted-foreground">{asset.symbol}</p>
          </div>
        </Link>
      </td>

      {/* Price */}
      <td className="px-4 py-4 font-medium">{formatCurrency(asset.price)}</td>

      {/* 24h Change */}
      <td className={cn('px-4 py-4', priceChangeColor)}>
        <div className="flex items-center gap-1">
          <PriceChangeIcon className="w-4 h-4" />
          {formatPercent(Math.abs(asset.priceChange24h))}
        </div>
      </td>

      {/* Market Cap */}
      <td className="px-4 py-4 text-muted-foreground">
        {formatCurrency(asset.marketCap, true)}
      </td>

      {/* Volume */}
      <td className="px-4 py-4 text-muted-foreground hidden lg:table-cell">
        {formatCurrency(asset.volume24h, true)}
      </td>

      {/* Sparkline (7d) */}
      <td className="px-4 py-4 hidden xl:table-cell">{renderSparkline()}</td>

      {/* APY */}
      <td className="px-4 py-4 hidden lg:table-cell">
        {asset.supplyApy != null && asset.supplyApy > 0 ? (
          <span className="text-success font-medium">
            {formatPercent(asset.supplyApy)}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </td>
    </tr>
  );
}

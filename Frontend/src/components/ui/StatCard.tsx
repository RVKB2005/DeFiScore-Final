import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent, formatNumber } from '@/utils/formatters';

interface StatCardProps {
  title: string;
  value: number;
  change?: number;
  prefix?: string;
  suffix?: string;
  format?: 'currency' | 'percent' | 'number';
  compact?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  prefix,
  suffix,
  format = 'currency',
  compact = false,
  icon,
  className,
}: StatCardProps) {
  const formattedValue = (() => {
    switch (format) {
      case 'currency':
        return formatCurrency(value, compact);
      case 'percent':
        return formatPercent(value);
      case 'number':
        return formatNumber(value, { compact, prefix, suffix });
      default:
        return value.toString();
    }
  })();

  const changeColor = change
    ? change > 0
      ? 'text-success'
      : change < 0
      ? 'text-destructive'
      : 'text-muted-foreground'
    : undefined;

  const ChangeIcon = change
    ? change > 0
      ? TrendingUp
      : change < 0
      ? TrendingDown
      : Minus
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card variant="stat" className={cn('p-5', className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold stat-number">{formattedValue}</p>
            {change !== undefined && (
              <div className={cn('flex items-center gap-1 text-sm', changeColor)}>
                {ChangeIcon && <ChangeIcon className="w-4 h-4" />}
                <span>{formatPercent(Math.abs(change))}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

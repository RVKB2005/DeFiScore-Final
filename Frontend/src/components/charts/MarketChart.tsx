import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/utils/formatters';
import type { ChartDataPoint } from '@/types';

interface MarketChartProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
  color?: 'primary' | 'secondary' | 'success';
}

const colorMap = {
  primary: { stroke: 'hsl(258, 90%, 66%)', fill: 'primaryGradient' },
  secondary: { stroke: 'hsl(190, 90%, 50%)', fill: 'secondaryGradient' },
  success: { stroke: 'hsl(142, 76%, 36%)', fill: 'successGradient' },
};

export function MarketChart({
  data,
  title,
  height = 300,
  color = 'primary',
}: MarketChartProps) {
  const { stroke, fill } = colorMap[color];

  const formatXAxis = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            {new Date(label).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-lg font-semibold">{formatCurrency(payload[0].value, true)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass">
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={!title ? 'pt-6' : ''}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(258, 90%, 66%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(258, 90%, 66%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="secondaryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(190, 90%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(190, 90%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(222, 30%, 20%)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              stroke="hsl(215, 20%, 65%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value, true)}
              stroke="hsl(215, 20%, 65%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${fill})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

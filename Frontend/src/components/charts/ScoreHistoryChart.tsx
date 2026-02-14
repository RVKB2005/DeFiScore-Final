import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { CreditScoreHistory } from '@/types';

interface ScoreHistoryChartProps {
  data: CreditScoreHistory[];
  title?: string;
  height?: number;
}

export function ScoreHistoryChart({
  data,
  title = 'Score History',
  height = 200,
}: ScoreHistoryChartProps) {
  const formatXAxis = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short' });
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
          <p className="text-lg font-semibold text-primary">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass">
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={!title ? 'pt-6' : ''}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(258, 90%, 66%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(258, 90%, 66%)" stopOpacity={0} />
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
              domain={[600, 850]}
              stroke="hsl(215, 20%, 65%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(258, 90%, 66%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(258, 90%, 66%)', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: 'hsl(258, 90%, 66%)', stroke: 'hsl(222, 47%, 11%)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

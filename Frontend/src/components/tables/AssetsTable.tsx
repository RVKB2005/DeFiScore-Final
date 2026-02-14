import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TokenRow } from './TokenRow';
import type { Asset } from '@/types';

interface AssetsTableProps {
  assets: Asset[];
  title?: string;
  showSparkline?: boolean;
}

export function AssetsTable({ assets, title = 'Top Assets', showSparkline = true }: AssetsTableProps) {
  return (
    <Card variant="glass">
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={!title ? 'pt-6' : ''}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Asset
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  24h
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Market Cap
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
                  Volume
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden xl:table-cell">
                  7d
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
                  APY
                </th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, index) => (
                <TokenRow
                  key={asset.id}
                  asset={asset}
                  index={index}
                  showSparkline={showSparkline}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

import { motion } from 'framer-motion';
import { Settings, Plus, Minus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockSupplyPositions } from '@/mock/supply';
import { formatCurrency, formatPercent } from '@/utils/formatters';

export default function ManageSupply() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" />Manage Supply</h1>
        <p className="text-muted-foreground">Adjust your supply positions</p>
      </motion.div>

      <div className="grid gap-4">
        {mockSupplyPositions.map((pos, i) => (
          <motion.div key={pos.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card variant="glass">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xl">{pos.asset.icon}</div>
                    <div>
                      <p className="font-semibold">{pos.asset.name}</p>
                      <p className="text-sm text-muted-foreground">{pos.amount} {pos.asset.symbol} • {formatCurrency(pos.value)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-success font-semibold">{formatPercent(pos.apy)} APY</p>
                      <p className="text-xs text-muted-foreground">+{formatCurrency(pos.earnings)} earned</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1"><Minus className="w-4 h-4" />Withdraw</Button>
                      <Button variant="glow" size="sm" className="gap-1"><Plus className="w-4 h-4" />Add</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

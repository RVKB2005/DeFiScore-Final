import { motion } from 'framer-motion';
import { 
  Clock, 
  CreditCard, 
  History, 
  Layers, 
  Search 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const creditFactors = [
  {
    name: 'Transaction History',
    icon: Clock,
  },
  {
    name: 'Protocol Usage',
    icon: CreditCard,
  },
  {
    name: 'Wallet Age',
    icon: History,
  },
  {
    name: 'Asset Diversity',
    icon: Layers,
  },
  {
    name: 'Liquidation Risk',
    icon: Search,
  },
];

export function CreditFactorsList() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Credit Factors</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {creditFactors.map((factor, index) => (
            <motion.div
              key={factor.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/20 border border-border/30 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-default"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <factor.icon className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-center text-foreground">
                {factor.name}
              </p>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

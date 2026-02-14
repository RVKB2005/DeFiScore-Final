import { motion } from 'framer-motion';
import { FileText, ArrowRight, Clock, Percent, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockLoanOffers } from '@/mock/borrow';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Link } from 'react-router-dom';

export default function LoanOffers() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Loan Offers
        </h1>
        <p className="text-muted-foreground">
          Browse available lending pools and their rates
        </p>
      </motion.div>

      {/* Loan Offers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockLoanOffers.map((offer, index) => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card variant="glow" className="h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-2xl">
                      {offer.asset.icon}
                    </div>
                    <div>
                      <CardTitle>{offer.asset.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{offer.asset.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {formatPercent(offer.interestRate)}
                    </p>
                    <p className="text-xs text-muted-foreground">APR</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Loan Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Percent className="w-4 h-4" />
                      <span className="text-xs">Max LTV</span>
                    </div>
                    <p className="font-semibold">{formatPercent(offer.ltv)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">Duration</span>
                    </div>
                    <p className="font-semibold">{offer.duration} days</p>
                  </div>
                </div>

                {/* Amount Range */}
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">Borrow Amount</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      Min: {offer.minAmount} {offer.asset.symbol}
                    </span>
                    <span className="text-sm">
                      Max: {offer.maxAmount.toLocaleString()} {offer.asset.symbol}
                    </span>
                  </div>
                </div>

                {/* Accepted Collateral */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Accepted Collateral
                  </p>
                  <div className="flex gap-2">
                    {offer.collateralTypes.map((collateral) => (
                      <div
                        key={collateral.id}
                        className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 flex items-center gap-2"
                      >
                        <span>{collateral.icon}</span>
                        <span className="text-sm font-medium">{collateral.symbol}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <Link to="/borrow">
                  <Button variant="glow" className="w-full gap-2">
                    Borrow {offer.asset.symbol}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

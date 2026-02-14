import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface BorrowRequest {
  id: string;
  borrower: string;
  asset: string;
  assetIcon: string;
  assetColor: string;
  amount: number;
  collateralPercent: number;
  apy: number;
}

interface BorrowerEligibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: BorrowRequest | null;
  onConfirmOffer: () => void;
}

export function BorrowerEligibleModal({
  isOpen,
  onClose,
  request,
  onConfirmOffer,
}: BorrowerEligibleModalProps) {
  const [interestRate, setInterestRate] = useState('');
  const [repaymentPeriod, setRepaymentPeriod] = useState('90');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCopyWallet = () => {
    if (request) {
      navigator.clipboard.writeText(request.borrower);
      toast.success('Wallet address copied');
    }
  };

  const handleConfirmOffer = async () => {
    if (!interestRate) {
      toast.error('Please enter an interest rate');
      return;
    }
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    toast.success('Offer confirmed successfully!');
    onConfirmOffer();
  };

  if (!request) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-2xl my-4"
            >
              {/* Breadcrumb */}
              <div className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                <span className="hover:text-foreground cursor-pointer" onClick={onClose}>Borrowers</span>
                <span className="mx-2">›</span>
                <span className="text-foreground">Verification Result</span>
              </div>

              {/* Success Icon */}
              <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-success/20 flex items-center justify-center mb-3 sm:mb-4">
                  <Check className="w-6 h-6 sm:w-8 sm:h-8 text-success" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold mb-2">Borrower is Eligible</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Verification successful. You can now propose your lending terms.
                </p>
              </div>

              {/* Request Details Card */}
              <Card variant="glass" className="mb-4 sm:mb-6">
                <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
                  <h3 className="text-primary text-xs sm:text-sm font-semibold mb-3 sm:mb-4 tracking-wide">REQUEST DETAILS</h3>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-border/30">
                      <span className="text-xs sm:text-sm text-muted-foreground">Borrower Wallet</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm">{request.borrower}</span>
                        <button onClick={handleCopyWallet} className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-border/30">
                      <span className="text-xs sm:text-sm text-muted-foreground">Requested Asset</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs"
                          style={{ backgroundColor: request.assetColor }}
                        >
                          {request.assetIcon}
                        </div>
                        <span className="font-semibold text-sm">{request.asset}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Amount</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl sm:text-2xl font-bold">{request.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">{request.asset}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Interest Rate Input */}
              <div className="mb-3 sm:mb-4">
                <label className="text-xs sm:text-sm font-medium mb-2 block">Enter Interest Rate (%)</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="0.00"
                    className="h-12 sm:h-14 text-base sm:text-lg bg-muted/50 border-border pr-10 sm:pr-12"
                    step="0.1"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">Market average: 8.5% - 12.0%</p>
              </div>

              {/* Repayment Period Select */}
              <div className="mb-4 sm:mb-6">
                <label className="text-xs sm:text-sm font-medium mb-2 block">Select Repayment Time Period</label>
                <Select value={repaymentPeriod} onValueChange={setRepaymentPeriod}>
                  <SelectTrigger className="h-12 sm:h-14 text-base sm:text-lg bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                    <SelectItem value="120">120 Days</SelectItem>
                    <SelectItem value="180">180 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Confirm Button */}
              <Button
                variant="glow"
                size="lg"
                className="w-full gap-2 h-12 sm:h-14 text-sm sm:text-lg"
                onClick={handleConfirmOffer}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    CONFIRM OFFER
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </>
                )}
              </Button>

              {/* Terms */}
              <p className="text-center text-[10px] sm:text-sm text-muted-foreground mt-3 sm:mt-4">
                By confirming, you agree to locking the liquidity for the specified period upon borrower acceptance.
                <br />
                <a href="#" className="text-primary hover:underline">Terms & Conditions</a>
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

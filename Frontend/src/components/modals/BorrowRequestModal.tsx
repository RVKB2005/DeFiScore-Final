import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatPercent, formatAddress } from '@/utils/formatters';
import { toast } from 'sonner';
import { apiService } from '@/services/apiService';
import { useWallet } from '@/hooks/useWallet';

interface Supplier {
  id: string;
  supplier_address: string;
  currency: string;
  max_amount: number;
  available_amount: number;
  min_credit_score: number;
  max_apy: number;
}

interface BorrowRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier;
  onSuccess?: () => void;
}

export function BorrowRequestModal({ isOpen, onClose, supplier, onSuccess }: BorrowRequestModalProps) {
  const { token } = useWallet();
  const [amount, setAmount] = useState('');
  const [collateralPercent, setCollateralPercent] = useState([150]);
  const [durationDays, setDurationDays] = useState('30');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Interest rate is fixed from supplier - borrower cannot change it
  const interestRate = supplier.max_apy;

  // Calculate loan details
  const amountNum = parseFloat(amount) || 0;
  const durationNum = parseInt(durationDays) || 30;
  const interestAmount = (amountNum * interestRate / 100 * durationNum / 365);
  const totalRepayment = amountNum + interestAmount;

  // Debug logging
  console.log('Loan calculation:', { amount, amountNum, durationNum, interestRate, interestAmount, totalRepayment });

  const handleSubmit = async () => {
    if (!token) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > supplier.available_amount) {
      toast.error(`Amount exceeds available liquidity (${formatCurrency(supplier.available_amount)})`);
      return;
    }

    setIsSubmitting(true);

    try {
      await apiService.createBorrowRequest(token, {
        supplier_id: supplier.id,
        currency: supplier.currency,
        amount: parseFloat(amount),
        collateral_percent: collateralPercent[0],
        duration_days: parseInt(durationDays)
        // Note: Interest rate comes from supplier's intent, not from borrower
      });

      toast.success('Borrow request sent successfully!');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to create borrow request:', error);
      toast.error(error.response?.data?.detail || 'Failed to create borrow request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">Request Loan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              From {formatAddress(supplier.supplier_address)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Supplier Info */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Currency:</span>
              <span className="font-medium">{supplier.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-medium text-success">{formatCurrency(supplier.available_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max Interest Rate:</span>
              <span className="font-medium">{formatPercent(supplier.max_apy)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Min Credit Score:</span>
              <span className="font-medium">{supplier.min_credit_score}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning">Credit Score Verification Required</p>
              <p className="text-muted-foreground mt-1">
                The supplier will verify your credit score using zero-knowledge proofs before approving your request.
              </p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Amount ({supplier.currency})
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              max={supplier.available_amount}
              className="h-12 bg-muted/50 border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Max: {formatCurrency(supplier.available_amount)}
            </p>
          </div>

          {/* Collateral */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-muted-foreground">Collateral Percentage</label>
              <span className="text-lg font-bold text-primary">{collateralPercent[0]}%</span>
            </div>
            <Slider
              value={collateralPercent}
              onValueChange={setCollateralPercent}
              min={100}
              max={300}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>100%</span>
              <span>200%</span>
              <span>300%</span>
            </div>
          </div>

          {/* Interest Rate - Read Only (Set by Supplier) */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Interest Rate (Set by Supplier)
            </label>
            <div className="h-12 bg-muted/30 border border-border rounded-lg flex items-center px-4">
              <span className="text-lg font-bold text-primary">{formatPercent(interestRate)}</span>
              <span className="text-sm text-muted-foreground ml-2">per year</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This rate is fixed by the supplier and cannot be changed
            </p>
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Duration</label>
            <Select value={durationDays} onValueChange={setDurationDays}>
              <SelectTrigger className="h-12 bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
                <SelectItem value="180">180 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          {amountNum > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Loan Summary</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You'll receive:</span>
                <span className="font-bold">{formatCurrency(amountNum)} {supplier.currency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Interest ({formatPercent(interestRate)}):</span>
                <span className="font-medium">
                  {formatCurrency(interestAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-primary/30 pt-2">
                <span className="text-muted-foreground">Total to repay:</span>
                <span className="font-bold text-primary">
                  {formatCurrency(totalRepayment)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            variant="default" 
            onClick={handleSubmit} 
            className="flex-1"
            disabled={isSubmitting || amountNum <= 0}
          >
            {isSubmitting ? 'Submitting...' : 'Send Request'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatters';
import type { Asset } from '@/types';

interface BorrowSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
  amount: number;
  interestRate: number;
  duration: number;
}

export function BorrowSuccessModal({
  isOpen,
  onClose,
  asset,
  amount,
  interestRate,
  duration,
}: BorrowSuccessModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showClose={false}>
      <div className="text-center space-y-4 sm:space-y-6">
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
          className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-success/20 flex items-center justify-center"
        >
          <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-success" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl sm:text-2xl font-bold">Borrow Successful!</h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Your loan request has been approved
          </p>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-3 sm:p-4 rounded-xl space-y-2 sm:space-y-3"
        >
          <div className="flex justify-between text-sm sm:text-base">
            <span className="text-muted-foreground">Amount Borrowed</span>
            <span className="font-semibold">
              {amount.toLocaleString()} {asset.symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm sm:text-base">
            <span className="text-muted-foreground">Value</span>
            <span className="font-semibold">{formatCurrency(amount * asset.price)}</span>
          </div>
          <div className="flex justify-between text-sm sm:text-base">
            <span className="text-muted-foreground">Interest Rate</span>
            <span className="font-semibold text-primary">{interestRate}% APR</span>
          </div>
          <div className="flex justify-between text-sm sm:text-base">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-semibold">{duration} days</span>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-2 sm:gap-3"
        >
          <Button variant="outline" onClick={onClose} className="flex-1 text-sm">
            Close
          </Button>
          <Button variant="glow" onClick={onClose} className="flex-1 gap-2 text-sm">
            View Details
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </motion.div>
      </div>
    </Modal>
  );
}

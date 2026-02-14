import { motion } from 'framer-motion';
import { XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatters';
import type { Asset } from '@/types';

interface BorrowRejectedModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
  amount: number;
  reason: string;
}

export function BorrowRejectedModal({
  isOpen,
  onClose,
  asset,
  amount,
  reason,
}: BorrowRejectedModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showClose={false}>
      <div className="text-center space-y-6">
        {/* Rejected Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
          className="w-20 h-20 mx-auto rounded-full bg-destructive/20 flex items-center justify-center"
        >
          <XCircle className="w-10 h-10 text-destructive" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold">Borrow Request Rejected</h2>
          <p className="text-muted-foreground mt-2">
            We couldn't approve your loan request
          </p>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4 rounded-xl space-y-3"
        >
          <div className="flex justify-between">
            <span className="text-muted-foreground">Requested Amount</span>
            <span className="font-semibold">
              {amount.toLocaleString()} {asset.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Value</span>
            <span className="font-semibold">{formatCurrency(amount * asset.price)}</span>
          </div>
        </motion.div>

        {/* Reason */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-left"
        >
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Rejection Reason</p>
            <p className="text-sm text-muted-foreground mt-1">{reason}</p>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3"
        >
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button variant="glow" onClick={onClose} className="flex-1 gap-2">
            Improve Credit
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </Modal>
  );
}

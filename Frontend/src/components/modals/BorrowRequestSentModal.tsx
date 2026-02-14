import { motion } from 'framer-motion';
import { Send, Clock, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';

interface BorrowRequestSentModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierWallet: string;
  amount: string;
  asset: string;
}

export function BorrowRequestSentModal({
  isOpen,
  onClose,
  supplierWallet,
  amount,
  asset,
}: BorrowRequestSentModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showClose={false}>
      <div className="text-center space-y-4 sm:space-y-6">
        {/* Animated Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
          className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center"
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          >
            <Send className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl sm:text-2xl font-bold">Request Sent!</h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Your borrow request has been submitted to the supplier
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
            <span className="text-muted-foreground">Amount Requested</span>
            <span className="font-semibold">
              {amount || '0'} {asset}
            </span>
          </div>
          <div className="flex justify-between text-sm sm:text-base">
            <span className="text-muted-foreground">Supplier</span>
            <span className="font-semibold font-mono text-xs sm:text-sm">{supplierWallet}</span>
          </div>
          <div className="flex justify-between text-sm sm:text-base">
            <span className="text-muted-foreground">Status</span>
            <span className="font-semibold text-warning flex items-center gap-1 text-sm">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Pending Review
            </span>
          </div>
        </motion.div>

        {/* Info Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="p-2.5 sm:p-3 rounded-lg bg-muted/30 border border-border/30"
        >
          <p className="text-xs sm:text-sm text-muted-foreground">
            The supplier will review your request and verify your credit score. You'll be notified once it's approved.
          </p>
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
            View Requests
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </motion.div>
      </div>
    </Modal>
  );
}

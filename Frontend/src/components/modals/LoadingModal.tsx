import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';

interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
}

export function LoadingModal({
  isOpen,
  message = 'Processing transaction...',
}: LoadingModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} showClose={false} size="sm">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-8 space-y-4"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 mx-auto rounded-full border-4 border-primary/30 border-t-primary"
        />
        <h2 className="text-xl font-semibold">{message}</h2>
        <p className="text-muted-foreground text-sm">
          Please wait and don't close this window
        </p>
      </motion.div>
    </Modal>
  );
}

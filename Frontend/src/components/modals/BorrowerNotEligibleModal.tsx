import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface BorrowerNotEligibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredScore: number;
  onReject: () => void;
  onReviewVerification: () => void;
}

export function BorrowerNotEligibleModal({
  isOpen,
  onClose,
  requiredScore,
  onReject,
  onReviewVerification,
}: BorrowerNotEligibleModalProps) {
  const handleReject = () => {
    toast.success('Borrow request rejected');
    onReject();
  };

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md"
            >
              <Card variant="glass" className="relative overflow-hidden">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 text-muted-foreground hover:text-foreground z-10"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <CardContent className="pt-10 pb-6 px-5 sm:pt-12 sm:pb-8 sm:px-8">
                  <div className="flex flex-col items-center text-center">
                    {/* Error Icon */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-destructive/20 flex items-center justify-center mb-4 sm:mb-6 relative">
                      <div className="absolute inset-0 rounded-full bg-destructive/10 animate-pulse" />
                      <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-destructive" />
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Borrower Not Eligible</h2>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                      The borrower's current DeFiScore does not meet your
                      specified credit threshold for this asset. Proceeding
                      with this rejection will clear the request from your
                      queue.
                    </p>

                    {/* Required Score Card */}
                    <div className="w-full bg-muted/30 rounded-xl p-3 sm:p-4 flex items-center justify-between mb-4 sm:mb-6">
                      <span className="text-xs sm:text-sm text-muted-foreground">REQUIRED SCORE</span>
                      <span className="text-base sm:text-lg font-bold">{requiredScore}+</span>
                    </div>

                    {/* Reject Button */}
                    <Button
                      variant="destructive"
                      size="lg"
                      className="w-full mb-3 sm:mb-4 h-10 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-destructive to-destructive/70"
                      onClick={handleReject}
                    >
                      REJECT BORROW REQUEST
                    </Button>

                    {/* Review Link */}
                    <button
                      onClick={onReviewVerification}
                      className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Review Verification
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

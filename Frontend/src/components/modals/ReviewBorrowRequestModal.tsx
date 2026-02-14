import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Zap, Lock, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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

interface ReviewBorrowRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: BorrowRequest | null;
  onVerificationComplete: (request: BorrowRequest, isEligible: boolean, threshold: number) => void;
}

export function ReviewBorrowRequestModal({
  isOpen,
  onClose,
  request,
  onVerificationComplete,
}: ReviewBorrowRequestModalProps) {
  const [creditThreshold, setCreditThreshold] = useState('700');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleRunVerification = async () => {
    if (!request) return;
    setIsVerifying(true);
    
    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock borrower credit score - in real app this would come from backend
    const mockBorrowerScore = 720;
    const thresholdValue = parseInt(creditThreshold) || 700;
    const isEligible = mockBorrowerScore >= thresholdValue;
    
    setIsVerifying(false);
    onVerificationComplete(request, isEligible, thresholdValue);
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
              className="w-full max-w-3xl my-4"
            >
              {/* Breadcrumb */}
              <div className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                <span className="hover:text-foreground cursor-pointer" onClick={onClose}>‹ Borrow Requests</span>
                <span className="mx-2">/</span>
                <span className="text-foreground">Request #{request.id}</span>
              </div>

              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 sm:mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Review Borrow Request</h1>
                  <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
                    Evaluate the creditworthiness of the borrower using zero-knowledge proofs. All 
                    verifications are performed on-chain without exposing private data.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto text-xs sm:text-sm">
                  View Wallet History
                </Button>
              </div>

              {/* Main Card */}
              <Card variant="glass" className="mb-4 sm:mb-6">
                <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8 px-4 sm:px-6">
                  <div className="flex flex-col items-center text-center max-w-md mx-auto">
                    {/* Shield Icon */}
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 sm:mb-6">
                      <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>

                    <h2 className="text-lg sm:text-xl font-semibold mb-2">Verify Credit Score</h2>
                    <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-6">
                      Enter the minimum credit score threshold required for this
                      loan request. We will run a zero-knowledge proof
                      verification.
                    </p>

                    {/* Threshold Input */}
                    <div className="w-full mb-4">
                      <label className="text-xs sm:text-sm text-muted-foreground mb-2 block text-left">
                        Minimum Credit Threshold
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2">
                          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <Input
                          type="number"
                          value={creditThreshold}
                          onChange={(e) => setCreditThreshold(e.target.value)}
                          className="pl-10 sm:pl-12 h-12 sm:h-14 text-lg sm:text-xl font-semibold bg-muted/50 border-border"
                          placeholder="700"
                          min="0"
                          max="1000"
                        />
                      </div>
                    </div>

                    {/* Info Note */}
                    <div className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 text-left w-full">
                      <div className="w-2 h-2 rounded-full bg-warning mt-1.5 shrink-0" />
                      <p>
                        The borrower's exact score will not be revealed. You will
                        only receive a confirmation if their score is <strong className="text-foreground">≥ {creditThreshold || '700'}</strong>.
                      </p>
                    </div>

                    {/* Verification Button */}
                    <Button
                      variant="glow"
                      size="lg"
                      className="w-full gap-2 text-sm sm:text-base"
                      onClick={handleRunVerification}
                      disabled={isVerifying}
                    >
                      {isVerifying ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Run Verification
                        </>
                      )}
                    </Button>

                    <button
                      onClick={onClose}
                      className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel and return
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Bottom Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <Card variant="glass" className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1 sm:mb-2">
                    <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    <span className="font-semibold text-xs sm:text-sm">Asset Safety</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Smart contract audited by Trail of Bits. All
                    funds are secured in non-custodial vaults.
                  </p>
                </Card>

                <Card variant="glass" className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1 sm:mb-2">
                    <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    <span className="font-semibold text-xs sm:text-sm">ZK-Proof Tech</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Powered by zk-SNARKs to ensure borrower
                    credit data remains 100% private.
                  </p>
                </Card>

                <Card variant="glass" className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1 sm:mb-2">
                    <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    <span className="font-semibold text-xs sm:text-sm">Collateralization</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    This request is {request.collateralPercent}% collateralized by liquid
                    on-chain assets.
                  </p>
                </Card>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

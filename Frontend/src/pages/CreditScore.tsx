import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PasswordModal } from '@/components/CreditScore/PasswordModal';
import { OnChainScoreGauge } from '@/components/charts/OnChainScoreGauge';
import { HiddenScoreGauge } from '@/components/charts/HiddenScoreGauge';
import { CreditFactorsList } from '@/components/CreditScore/CreditFactorsList';
import { ScoreHistoryChart } from '@/components/charts/ScoreHistoryChart';
import { mockUser, mockCreditScoreHistory } from '@/mock/user';

interface CreditScorePageProps {
  onVerify: () => void;
}

export default function CreditScore({ onVerify }: CreditScorePageProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleUnlock = () => {
    setIsUnlocked(true);
    setShowPasswordModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Password Modal */}
      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onUnlock={handleUnlock}
      />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Credit Score
          </h1>
          <p className="text-muted-foreground">
            Your DeFi creditworthiness and lending reputation
          </p>
        </div>
        <Button variant="glow" className="gap-2" onClick={onVerify}>
          <Shield className="w-4 h-4" />
          Verify Identity
        </Button>
      </motion.div>

      {/* Main Score Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card variant="glow" className="overflow-hidden">
          <CardHeader>
            <CardTitle>DefiCreditScore</CardTitle>
          </CardHeader>
          <CardContent className="pb-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              {/* Score Gauge - Hidden or Visible based on unlock state */}
              <div className="flex flex-col items-center">
                {isUnlocked ? (
                  <>
                    <OnChainScoreGauge score={mockUser.creditScore} />
                    <div className="mt-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-success" />
                      <span className="text-sm text-success">+12 points this month</span>
                    </div>
                  </>
                ) : (
                  <HiddenScoreGauge onViewScore={() => setShowPasswordModal(true)} />
                )}
              </div>

              {/* Score Benefits */}
              <div className="flex-1 max-w-md space-y-4">
                <h3 className="text-lg font-semibold">Your Score Benefits</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium text-success">Lower Interest Rates</p>
                      <p className="text-sm text-muted-foreground">
                        Up to 2% lower APR on loans
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium text-success">Higher Borrowing Limits</p>
                      <p className="text-sm text-muted-foreground">
                        Borrow up to $100,000
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-primary">Exclusive Offers</p>
                      <p className="text-sm text-muted-foreground">
                        Access to premium lending pools
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Score History Chart - Only show when unlocked */}
      {isUnlocked && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ScoreHistoryChart data={mockCreditScoreHistory} height={250} />
        </motion.div>
      )}

      {/* Credit Factors - Simplified */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <CreditFactorsList />
      </motion.div>
    </div>
  );
}

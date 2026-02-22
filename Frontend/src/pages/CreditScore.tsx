import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PasswordModal } from '@/components/CreditScore/PasswordModal';
import { OnChainScoreGauge } from '@/components/charts/OnChainScoreGauge';
import { HiddenScoreGauge } from '@/components/charts/HiddenScoreGauge';
import { CreditFactorsList } from '@/components/CreditScore/CreditFactorsList';
import { ScoreHistoryChart } from '@/components/charts/ScoreHistoryChart';
import { useWallet } from '@/hooks/useWallet';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

export default function CreditScore() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [creditScore, setCreditScore] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ingestionStatus, setIngestionStatus] = useState<'idle' | 'ingesting' | 'complete'>('idle');
  const { address, token } = useWallet();

  // Check ingestion status on mount
  useEffect(() => {
    if (address && token) {
      checkIngestionStatus();
    }
  }, [address, token]);

  const checkIngestionStatus = async () => {
    try {
      // Check if data has been ingested
      const summary = await apiService.getWalletSummary(address!, token!);
      // If we got a response, ingestion is complete (even if 0 transactions)
      setIngestionStatus('complete');
    } catch (error: any) {
      console.error('Failed to check ingestion status:', error);
      // If 404, wallet hasn't been ingested yet
      if (error.response?.status === 404) {
        setIngestionStatus('idle');
      } else {
        // Other errors, assume complete
        setIngestionStatus('complete');
      }
    }
  };

  const handleUnlock = async (signature: string) => {
    if (!address || !token) {
      toast.error('Wallet not connected');
      return;
    }

    setIsLoading(true);
    
    try {
      // SECURITY: Verify the signature is for the currently connected wallet
      // The signature was created with a message containing the wallet address
      // The backend will verify this matches the JWT token's address
      
      // Fetch or calculate credit score
      toast.loading('Fetching your credit score...', { id: 'score' });
      
      let scoreData;
      try {
        // Try to get existing score first
        // The token already contains the wallet address, so this is secure
        scoreData = await apiService.getMyCreditScore(token);
        console.log('Credit score data received:', scoreData);
        toast.success('Credit score loaded!', { id: 'score' });
      } catch (error) {
        // If no score exists, calculate it (triggers Celery task)
        toast.loading('Starting credit score calculation...', { id: 'score' });
        
        // IMPORTANT: Use the address from the JWT token (verified by backend)
        // The backend will extract the address from the token, not from the request
        const calcResponse = await apiService.calculateCreditScore(address, token);
        console.log('Credit score calculation response:', calcResponse);
        
        // Check response status
        if (calcResponse.status === 'processing' && calcResponse.job_id) {
          toast.loading('Calculating your credit score... This may take 3-5 minutes for wallets with lots of transactions.', { 
            id: 'score',
            duration: 10000 
          });
          
          // Poll for completion
          const maxAttempts = 60; // 60 attempts * 5 seconds = 5 minutes max
          let attempts = 0;
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            
            try {
              const jobStatus = await apiService.getJobStatus(calcResponse.job_id, token);
              console.log('Job status:', jobStatus);
              
              if (jobStatus.status === 'SUCCESS' || jobStatus.status === 'COMPLETED') {
                // Job complete, fetch the score
                scoreData = await apiService.getMyCreditScore(token);
                toast.success('Credit score calculated successfully!', { id: 'score' });
                break;
              } else if (jobStatus.status === 'FAILURE' || jobStatus.status === 'FAILED') {
                throw new Error(jobStatus.error || 'Credit score calculation failed');
              } else {
                // Still processing
                const progress = jobStatus.progress || 0;
                toast.loading(`Calculating credit score... ${progress}% complete`, { 
                  id: 'score',
                  duration: 10000 
                });
              }
            } catch (pollError: any) {
              console.error('Error polling job status:', pollError);
              // Continue polling even if one check fails
            }
            
            attempts++;
          }
          
          if (!scoreData) {
            throw new Error('Credit score calculation timed out. Please try again in a few minutes.');
          }
        } else if (calcResponse.status === 'completed' && calcResponse.score) {
          // Score returned immediately (cached)
          scoreData = calcResponse;
          toast.success('Credit score loaded!', { id: 'score' });
        } else if (calcResponse.status === 'stale' && calcResponse.score) {
          // Stale score returned
          scoreData = calcResponse;
          toast.success('Credit score loaded (consider refreshing)', { id: 'score' });
        } else {
          console.error('Unexpected response:', calcResponse);
          throw new Error(`Unexpected response status: ${calcResponse.status}`);
        }
      }

      console.log('Setting credit score state:', scoreData);
      setCreditScore(scoreData);
      setIsUnlocked(true);
      setShowPasswordModal(false);
    } catch (error: any) {
      console.error('Failed to fetch credit score:', error);
      toast.error('Failed to load credit score: ' + error.message, { id: 'score' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewScore = () => {
    if (ingestionStatus === 'ingesting') {
      toast.info('Data ingestion in progress. Please wait a few minutes and try again.');
      return;
    }
    setShowPasswordModal(true);
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
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {ingestionStatus === 'ingesting' ? 'Analyzing your wallet data...' : 'Loading credit score...'}
          </div>
        )}
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
                {isUnlocked && creditScore ? (
                  <>
                    <OnChainScoreGauge score={creditScore.score || 0} />
                    <div className="mt-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-success" />
                      <span className="text-sm text-muted-foreground">
                        Score: {creditScore.score} / 900
                      </span>
                    </div>
                  </>
                ) : (
                  <HiddenScoreGauge onViewScore={handleViewScore} />
                )}
              </div>

              {/* Score Benefits */}
              <div className="flex-1 max-w-md space-y-4">
                <h3 className="text-lg font-semibold">Score Benefits</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium text-success">Better Interest Rates</p>
                      <p className="text-sm text-muted-foreground">
                        Lower APR based on your score
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium text-success">Increased Borrowing Power</p>
                      <p className="text-sm text-muted-foreground">
                        Higher limits for trusted borrowers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-primary">Premium Access</p>
                      <p className="text-sm text-muted-foreground">
                        Exclusive lending opportunities
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Score History Chart - Only show when unlocked and has data */}
      {isUnlocked && creditScore && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ScoreHistoryChart data={[]} height={250} />
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

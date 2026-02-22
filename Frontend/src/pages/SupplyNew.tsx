import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, TrendingUp, DollarSign, Building, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatPercent, formatAddress } from '@/utils/formatters';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { useMarketData } from '@/contexts/MarketDataContext';
import { useUserData } from '@/contexts/UserDataContext';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

interface MatchedRequest {
  id: string;
  borrower_address: string;
  currency: string;
  amount: number;
  collateral_percent: number;
  requested_apy: number;
  duration_days: number;
  created_at: string;
  estimated_return: number;
  risk_level: string;
}

interface VerificationState {
  requestId: string;
  threshold: number;
  isVerifying: boolean;
  isGeneratingProof: boolean;
  isVerifyingProof: boolean;
  proofData: {
    proof: any;
    public_signals: number[];
    nullifier: string;
    timestamp: number;
    onChainTxHash?: string;
    onChainVerified?: boolean;
  } | null;
  result: {
    is_eligible: boolean;
    // DO NOT include actual_score - this is zero-knowledge!
  } | null;
}

export default function SupplyNew({ onWalletClick }: { onWalletClick?: () => void }) {
  const navigate = useNavigate();
  const { isConnected, token, address } = useWallet();
  const { marketStats, topAssets, loading: loadingMarketData } = useMarketData();
  const { supplierStats, supplierIntents, matchedBorrowRequests: cachedMatchedRequests, loading: loadingUserData, refetch } = useUserData();
  
  // Step 1: Supply Intent
  const [step, setStep] = useState<'intent' | 'requests'>('intent');
  const [selectedCurrency, setSelectedCurrency] = useState('USDC');
  const [maxAmount, setMaxAmount] = useState('');
  const [minCreditScore, setMinCreditScore] = useState([700]);
  const [interestRate, setInterestRate] = useState('');
  const [currentIntent, setCurrentIntent] = useState<any>(null);
  const [isSubmittingIntent, setIsSubmittingIntent] = useState(false);
  
  // Step 2: Matched Requests
  const [matchedRequests, setMatchedRequests] = useState<MatchedRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  
  // Step 3: ZK Verification
  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);

  // Use cached data from UserDataContext
  useEffect(() => {
    if (cachedMatchedRequests && cachedMatchedRequests.length > 0) {
      setMatchedRequests(cachedMatchedRequests);
    }
  }, [cachedMatchedRequests]);

  useEffect(() => {
    if (step === 'requests' && isConnected && token) {
      loadMatchedRequests();
    }
  }, [isConnected, token, selectedCurrency]); // Removed 'step' dependency

  // Auto-navigate to requests page if user has already supplied
  // Only navigate after stats have finished loading to prevent flashing
  // Don't auto-navigate if user explicitly went back to intent step
  const [manualStepChange, setManualStepChange] = useState(false);
  
  useEffect(() => {
    if (!loadingUserData && supplierStats && supplierStats.activeIntents > 0 && step === 'intent' && !manualStepChange) {
      setStep('requests');
    }
  }, [supplierStats, loadingUserData, step, manualStepChange]);

  const loadCurrentIntent = async () => {
    if (supplierIntents && supplierIntents.length > 0) {
      // Use cached intent data
      const intent = supplierIntents[0];
      setSelectedCurrency(intent.currency);
      setMaxAmount(intent.max_amount.toString());
      setMinCreditScore([intent.min_credit_score]);
      setInterestRate(intent.max_apy.toString());
    }
  };

  useEffect(() => {
    if (supplierIntents && supplierIntents.length > 0) {
      loadCurrentIntent();
    }
  }, [supplierIntents]);

  const loadMatchedRequests = async () => {
    setLoadingRequests(true);
    try {
      const requests = await apiService.getMatchedBorrowRequests(token!, selectedCurrency);
      
      // Filter out requests where borrower is the current user
      const filteredRequests = requests.filter(
        (request: MatchedRequest) => 
          request.borrower_address.toLowerCase() !== address?.toLowerCase()
      );
      
      setMatchedRequests(filteredRequests);
    } catch (error) {
      console.error('Failed to load matched requests:', error);
      toast.error('Failed to load borrow requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleCreateIntent = async () => {
    if (!isConnected || !token) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!maxAmount || parseFloat(maxAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!interestRate || parseFloat(interestRate) <= 0) {
      toast.error('Please enter a valid interest rate');
      return;
    }

    setIsSubmittingIntent(true);
    try {
      await apiService.createSupplyIntent(token, {
        currency: selectedCurrency,
        max_amount: parseFloat(maxAmount),
        min_credit_score: minCreditScore[0],
        max_apy: parseFloat(interestRate)
      });

      const isUpdate = currentIntent !== null;
      toast.success(isUpdate ? 'Supply intent updated successfully' : 'Supply intent created successfully');
      
      // Reload stats and go to requests page
      await refetch();
      setManualStepChange(false); // Reset flag so auto-navigation works
      setStep('requests');
    } catch (error: any) {
      console.error('Failed to create supply intent:', error);
      toast.error(error.response?.data?.detail || 'Failed to create supply intent');
    } finally {
      setIsSubmittingIntent(false);
    }
  };

  const handleReviewRequest = async (request: MatchedRequest) => {
    console.log('[SupplyNew] Review request initiated (CLIENT-SIDE ZK):', {
      requestId: request.id,
      borrowerAddress: request.borrower_address,
      isConnected,
      hasToken: !!token,
      hasAddress: !!address
    });

    if (!isConnected || !token) {
      toast.error('Please connect your wallet to review requests');
      return;
    }

    if (!address) {
      toast.error('Wallet address not found. Please reconnect your wallet.');
      return;
    }

    const threshold = minCreditScore[0];

    setVerificationState({
      requestId: request.id,
      threshold,
      isVerifying: true,
      isGeneratingProof: true,
      isVerifyingProof: false,
      proofData: null,
      result: null
    });

    // Wrap everything in try-catch to prevent any unhandled errors
    let cleanupExecuted = false;
    
    const cleanup = () => {
      if (!cleanupExecuted) {
        cleanupExecuted = true;
        setVerificationState(prev => prev ? {
          ...prev,
          isVerifying: false,
          isGeneratingProof: false,
          isVerifyingProof: false
        } : null);
      }
    };

    try {
      // ========================================================================
      // PHASE 3: CLIENT-SIDE TRUSTLESS PROOF GENERATION
      // ========================================================================
      
      // Step 1: Check if borrower has credit score calculated
      console.log('[SupplyNew] Step 1: Checking borrower credit score status...');
      toast.info('Checking borrower credit score...', { duration: 5000, id: 'zk-check' });
      
      let creditScoreData;
      try {
        creditScoreData = await apiService.getCreditScore(token, request.borrower_address);
      } catch (error: any) {
        if (error.status === 404) {
          // No credit score exists - need to calculate
          toast.info('Borrower has no credit score. Calculating now...', { id: 'zk-check', duration: 10000 });
          
          // Trigger credit score calculation
          try {
            await apiService.calculateCreditScore(token, request.borrower_address);
          } catch (calcError: any) {
            console.error('[SupplyNew] Failed to trigger calculation:', calcError);
            throw new Error(`Failed to start credit score calculation: ${calcError.message}`);
          }
          
          // Wait and retry (with exponential backoff)
          let retries = 0;
          const maxRetries = 10; // 10 retries * increasing delays = ~10 minutes max
          
          while (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.min(30000 * Math.pow(1.5, retries), 120000))); // 30s to 2min
            
            try {
              creditScoreData = await apiService.getCreditScore(token, request.borrower_address);
              break; // Success!
            } catch (retryError: any) {
              retries++;
              if (retries >= maxRetries) {
                throw new Error('Credit score calculation timeout. Please try again later.');
              }
              
              const elapsed = Math.floor(retries * 30 / 60);
              toast.info(
                `Still calculating credit score... ${elapsed}m elapsed (attempt ${retries}/${maxRetries})`,
                { id: 'zk-check', duration: 30000 }
              );
            }
          }
        } else {
          // Some other error - rethrow
          throw error;
        }
      }

      // Check if score needs refresh (older than 3 days)
      if (!creditScoreData) {
        throw new Error('Failed to retrieve credit score data after calculation');
      }
      
      const scoreAge = Date.now() - new Date(creditScoreData.timestamp).getTime();
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      
      if (scoreAge > threeDays) {
        toast.info('Credit score is stale. Refreshing...', { id: 'zk-check', duration: 10000 });
        try {
          await apiService.calculateCreditScore(token, request.borrower_address);
          
          // Wait for refresh
          await new Promise(resolve => setTimeout(resolve, 5000));
          creditScoreData = await apiService.getCreditScore(token, request.borrower_address);
        } catch (refreshError: any) {
          console.error('[SupplyNew] Failed to refresh score:', refreshError);
          // Continue with stale score rather than failing
          toast.warning('Using existing score (refresh failed)', { id: 'zk-check' });
        }
      }

      toast.success('Credit score ready!', { id: 'zk-check' });

      // Step 2: Get feature data for proof generation
      console.log('[SupplyNew] Step 2: Fetching feature data...');
      toast.info('Preparing proof generation...', { id: 'zk-prep' });
      
      let featureData;
      try {
        featureData = await apiService.getFeatureData(token, request.borrower_address);
      } catch (featureError: any) {
        console.error('[SupplyNew] Failed to fetch feature data:', featureError);
        throw new Error(`Failed to fetch feature data: ${featureError.message || 'Unknown error'}`);
      }
      
      // Step 3: Generate ZK proof CLIENT-SIDE (TRUSTLESS)
      console.log('[SupplyNew] Step 3: Generating ZK proof in browser (trustless)...');
      toast.info('Generating ZK proof in your browser... This may take 10-30 seconds.', { 
        id: 'zk-gen',
        duration: 35000 
      });

      const { zkProofService } = await import('@/services/zkProofService');
      
      let zkProofResult;
      try {
        // Frontend computes scores itself (trustless)
        // Circuit will verify they match its own computation
        zkProofResult = await zkProofService.generateProof(
          request.borrower_address,
          featureData,
          threshold
        );
      } catch (proofError: any) {
        console.error('[SupplyNew] ZK proof generation failed:', proofError);
        throw new Error(`ZK proof generation failed: ${proofError.message || 'Unknown error'}`);
      }

      toast.success('ZK Proof generated successfully!', { id: 'zk-gen' });

      // Update state with proof data
      setVerificationState(prev => prev ? {
        ...prev,
        isGeneratingProof: false,
        isVerifyingProof: true,
        proofData: {
          proof: zkProofResult.proof,
          public_signals: zkProofResult.publicSignals,
          nullifier: zkProofResult.publicSignals[9], // Nullifier is at index 9
          timestamp: parseInt(zkProofResult.publicSignals[8]) // Timestamp at index 8
        }
      } : null);

      // Step 4: Verify eligibility (check if score >= threshold)
      console.log('[SupplyNew] Step 4: Checking eligibility...');
      
      const scoreTotal = parseInt(zkProofResult.publicSignals[1]); // Score at index 1
      const thresholdScaled = threshold * 1000; // Threshold scaled
      const isEligible = scoreTotal >= thresholdScaled;

      // Update state with proof data (before on-chain submission)
      setVerificationState(prev => prev ? {
        ...prev,
        isGeneratingProof: false,
        isVerifyingProof: true,
        proofData: {
          proof: zkProofResult.proof,
          public_signals: zkProofResult.publicSignals,
          nullifier: zkProofResult.publicSignals[9], // Nullifier is at index 9
          timestamp: parseInt(zkProofResult.publicSignals[8]) // Timestamp at index 8
        }
      } : null);

      // Step 5: Submit proof to blockchain (ON-CHAIN VERIFICATION)
      console.log('[SupplyNew] Step 5: Submitting proof to blockchain...');
      toast.info('Submitting proof to blockchain...', { 
        id: 'zk-blockchain', 
        duration: 5000 
      });

      const { blockchainProofService } = await import('@/services/blockchainProofService');
      
      let submissionResult;
      try {
        submissionResult = await blockchainProofService.submitProof(
          zkProofResult.proof,
          zkProofResult.publicSignals,
          (status) => {
            console.log('[SupplyNew] Blockchain status:', status);
            toast.info(status, { id: 'zk-blockchain', duration: 5000 });
          }
        );
      } catch (blockchainError: any) {
        console.error('[SupplyNew] Blockchain submission failed:', blockchainError);
        
        toast.warning(
          `Proof verified off-chain but blockchain submission failed: ${blockchainError.message}`,
          { id: 'zk-blockchain', duration: 10000 }
        );
        
        submissionResult = {
          success: false,
          error: blockchainError.message
        };
      }

      if (submissionResult.success) {
        toast.success(
          <div className="space-y-1">
            <p className="font-semibold">✓ Proof verified on-chain!</p>
            <p className="text-xs">Tx: {submissionResult.txHash?.substring(0, 20)}...</p>
            <p className="text-xs">Gas used: {submissionResult.gasUsed}</p>
          </div>,
          { id: 'zk-blockchain', duration: 8000 }
        );
      }

      // Update state with final result (ZERO-KNOWLEDGE: only eligibility, not score)
      setVerificationState(prev => prev ? {
        ...prev,
        isVerifying: false,
        isVerifyingProof: false,
        result: {
          is_eligible: isEligible
        },
        proofData: prev.proofData ? {
          ...prev.proofData,
          onChainTxHash: submissionResult.txHash,
          onChainVerified: submissionResult.success
        } : null
      } : null);

      if (isEligible) {
        const message = submissionResult.success 
          ? '✓ Borrower is eligible! Credit score verified on-chain with ZK proof.'
          : '✓ Borrower is eligible! Credit score verified off-chain with ZK proof.';
        
        toast.success(message, { 
          id: 'zk-result',
          duration: 5000 
        });
      } else {
        toast.warning('✗ Borrower does not meet credit score threshold', { 
          id: 'zk-result',
          duration: 5000 
        });
      }

    } catch (error: any) {
      console.error('[SupplyNew] Failed to generate proof:', error);
      console.error('[SupplyNew] Error stack:', error.stack);
      
      cleanup();

      // Handle specific error cases
      if (error.status === 401 || error.status === 403) {
        toast.error('Session expired. Please reconnect your wallet.', { id: 'zk-gen' });
        // Don't call onWalletClick - just show error
        // User can manually reconnect if needed
      } else if (error.status === 404) {
        toast.error('Backend service unavailable. Please ensure the server is running at http://localhost:8000', { id: 'zk-gen' });
      } else if (error.message?.includes('No feature data found')) {
        toast.error('Borrower needs to calculate their credit score first. Their calculation may still be in progress. Please wait a few minutes and try again.', { 
          id: 'zk-gen', 
          duration: 10000 
        });
      } else if (error.message?.includes('Credit score calculation in progress')) {
        toast.info('Borrower\'s credit score is being calculated. This can take 3-5 minutes. Please try again shortly.', { 
          id: 'zk-gen',
          duration: 8000
        });
      } else if (error.message?.includes('timeout')) {
        toast.error('Credit score calculation timeout. The borrower may need to try calculating their score again.', { 
          id: 'zk-gen',
          duration: 8000
        });
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        toast.error('Cannot connect to backend server. Please ensure it is running at http://localhost:8000', { id: 'zk-gen' });
      } else {
        toast.error(error.message || 'Failed to verify credit score', { id: 'zk-gen' });
      }
      
      // Close modal after showing error
      setTimeout(() => {
        setVerificationState(null);
      }, 1000);
    }
  };

  const handleApproveRequest = async () => {
    if (!verificationState || !token || !address) return;

    const request = matchedRequests.find(r => r.id === verificationState.requestId);
    if (!request) return;

    try {
      // Import ethers for transaction
      const { BrowserProvider, parseUnits } = await import('ethers');
      
      // Get provider from MetaMask
      if (!window.ethereum) {
        toast.error('MetaMask not found. Please install MetaMask.');
        return;
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Show confirmation toast
      toast.info(`Preparing to send ${request.amount} ${request.currency} to borrower...`, { 
        id: 'approve-loan',
        duration: 5000 
      });

      // For now, we'll use native MATIC transfer
      // TODO: Add support for ERC20 tokens (USDC, USDT, etc.)
      const tx = await signer.sendTransaction({
        to: request.borrower_address,
        value: parseUnits(request.amount.toString(), 18), // Assuming 18 decimals for MATIC
        gasLimit: 21000n
      });

      toast.info('Transaction submitted. Waiting for confirmation...', { 
        id: 'approve-loan',
        duration: 10000 
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">Loan Approved!</p>
          <p className="text-sm">{request.amount} {request.currency} sent to borrower</p>
          <p className="text-xs">Tx: {receipt?.hash?.substring(0, 20)}...</p>
        </div>,
        { id: 'approve-loan', duration: 8000 }
      );

      setVerificationState(null);
      loadMatchedRequests(); // Refresh list
    } catch (error: any) {
      console.error('Failed to approve request:', error);
      
      let errorMessage = 'Failed to send transaction';
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for transaction';
      }
      
      toast.error(errorMessage, { id: 'approve-loan' });
    }
  };

  const handleCreateLoan = async (requestId: string) => {
    if (!token) return;

    try {
      toast.info('Creating loan on blockchain...', { id: 'create-loan' });
      
      // For now, we'll use USDC addresses on Polygon Amoy
      // TODO: Make this dynamic based on currency
      const result = await apiService.createLoanOnChain(token, {
        request_id: requestId,
        loan_token: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // USDC on Amoy
        collateral_token: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' // USDC on Amoy
      });

      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">Loan Created on Blockchain!</p>
          <p className="text-sm">Loan ID: {result.loan_id}</p>
          <p className="text-sm">Status: {result.status}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Borrower must now deposit collateral
          </p>
        </div>,
        { id: 'create-loan', duration: 10000 }
      );

      // Redirect to loans page
      setTimeout(() => {
        window.location.href = '/loans';
      }, 2000);

    } catch (error: any) {
      console.error('Failed to create loan:', error);
      toast.error(error.message || 'Failed to create loan on blockchain', { id: 'create-loan' });
    }
  };

  const handleRejectRequest = async () => {
    if (!verificationState || !token) return;

    try {
      await apiService.rejectBorrowRequest(token, verificationState.requestId);
      toast.info('Request rejected');
      setVerificationState(null);
      loadMatchedRequests(); // Refresh list
    } catch (error: any) {
      console.error('Failed to reject request:', error);
      toast.error(error.response?.data?.detail || 'Failed to reject request');
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold">Supply Management</h1>
          <p className="text-muted-foreground">
            Privacy-first on-chain liquidity provisioning with ZK credit verification
          </p>
        </motion.div>

        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card variant="glass">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Value Locked</p>
                    {loadingMarketData ? (
                      <div className="h-9 w-32 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-3xl font-bold">{formatCurrency(marketStats?.totalValueLocked || 0, true)}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      In DeFi protocols
                    </p>
                  </div>
                  <Building className="w-16 h-16 opacity-20 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card variant="glass">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Average Supply APY</p>
                    {loadingMarketData ? (
                      <div className="h-9 w-24 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-3xl font-bold text-success">
                        {topAssets.length > 0 
                          ? formatPercent(topAssets.reduce((sum, a) => sum + (a.supplyApy || 0), 0) / topAssets.length)
                          : 'N/A'}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      Across top assets
                    </p>
                  </div>
                  <DollarSign className="w-16 h-16 opacity-20 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card variant="glass">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">24h Volume</p>
                    {loadingMarketData ? (
                      <div className="h-9 w-20 bg-muted animate-pulse rounded" />
                    ) : (
                      <p className="text-3xl font-bold">{formatCurrency(marketStats?.totalVolume24h || 0, true)}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      Trading volume
                    </p>
                  </div>
                  <Shield className="w-16 h-16 opacity-20 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Connect Wallet CTA - Moved Higher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="glass" className="border-primary/30">
            <CardContent className="p-12 text-center">
              {/* Wallet with Growing Coins Stack */}
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: [-10, 0, -10] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="mb-8"
              >
                <div className="relative inline-block">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-success/20 blur-3xl rounded-full" />
                  
                  {/* Wallet with Arrow Going Out (Supply) */}
                  <div className="relative w-32 h-32 mx-auto">
                    <svg viewBox="0 0 120 120" className="w-full h-full">
                      {/* Wallet body */}
                      <rect x="30" y="55" width="60" height="40" rx="6" fill="currentColor" className="text-primary/30" />
                      <rect x="30" y="60" width="60" height="10" fill="currentColor" className="text-primary/50" />
                      {/* Wallet clasp */}
                      <circle cx="80" cy="75" r="6" fill="currentColor" className="text-primary/60" />
                      <circle cx="80" cy="75" r="3" fill="currentColor" className="text-background" />
                      
                      {/* Arrow pointing out of wallet - animated */}
                      <motion.g
                        animate={{ x: [0, 8, 0], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {/* Arrow shaft */}
                        <line x1="50" y1="45" x2="87" y2="45" stroke="currentColor" strokeWidth="4" className="text-success" strokeLinecap="round" />
                        {/* Arrow head */}
                        <path d="M90 45 L80 40 L80 50 Z" fill="currentColor" className="text-success" />
                      </motion.g>
                      
                      {/* Dollar sign on wallet */}
                      <text x="52" y="83" fontSize="20" fontWeight="bold" fill="currentColor" className="text-primary">$</text>
                    </svg>
                  </div>
                </div>
              </motion.div>

              <h2 className="text-3xl font-bold mb-3">Ready to Start Supplying?</h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                Connect your wallet to set your supply criteria and start earning interest on your assets
              </p>
              <Button variant="default" size="lg" onClick={onWalletClick} className="text-lg px-8 py-6">
                Connect Wallet to Continue
              </Button>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span>Secure • Privacy-First • Non-Custodial</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card variant="glass">
            <CardHeader>
              <CardTitle>How Supply Works</CardTitle>
              <p className="text-sm text-muted-foreground">
                Earn interest by providing liquidity with privacy-preserving credit verification
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <h3 className="font-semibold">{currentIntent ? 'Update Your Criteria' : 'Set Your Criteria'}</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose currency, amount, minimum credit score, and interest rate you're willing to offer
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">2</span>
                  </div>
                  <h3 className="font-semibold">Review Borrowers</h3>
                  <p className="text-sm text-muted-foreground">
                    See matched requests and verify credit scores using zero-knowledge proofs - no personal data revealed
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">3</span>
                  </div>
                  <h3 className="font-semibold">Earn Interest</h3>
                  <p className="text-sm text-muted-foreground">
                    Approve eligible borrowers and start earning competitive interest rates on your supplied assets
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Supply Opportunities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Top Supply Opportunities</CardTitle>
              <p className="text-sm text-muted-foreground">
                Current best rates from real market data
              </p>
            </CardHeader>
            <CardContent>
              {loadingMarketData ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : topAssets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No market data available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topAssets.slice(0, 5).map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        {typeof asset.icon === 'string' && asset.icon.startsWith('http') ? (
                          <img src={asset.icon} alt={asset.symbol} className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl">
                            {asset.icon || '💰'}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{asset.symbol}</p>
                          <p className="text-xs text-muted-foreground">
                            Market Cap: {formatCurrency(asset.marketCap, true)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-success">
                          {formatPercent(asset.supplyApy || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Supply APY</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Supply Management</h1>
          <p className="text-muted-foreground">
            Privacy-first on-chain liquidity provisioning with ZK credit verification
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/supply/manage')}>
          <History className="w-4 h-4" />
          View History
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card variant="glass">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Supplied</p>
                {loadingUserData ? (
                  <div className="h-9 w-32 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-3xl font-bold">{formatCurrency(supplierStats?.totalSupplied || 0)}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Across all intents
                </p>
              </div>
              <Building className="w-20 h-20 opacity-20 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Earned Interest</p>
                {loadingUserData ? (
                  <div className="h-9 w-32 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-3xl font-bold">{formatCurrency(supplierStats?.earnedInterest || 0)}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Total earnings
                </p>
              </div>
              <DollarSign className="w-20 h-20 opacity-20 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading state while checking if user has already supplied */}
      {step === 'intent' && loadingUserData && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading your supply data...</p>
          </div>
        </div>
      )}

      {/* Step 1: Supply Intent */}
      {step === 'intent' && !loadingUserData && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Set Your Supply Intent</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define your lending criteria. You'll only see borrowers who match your requirements.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Currency</label>
                  <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger className="h-12 bg-muted/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                      <SelectItem value="USDC">USD Coin (USDC)</SelectItem>
                      <SelectItem value="USDT">Tether (USDT)</SelectItem>
                      <SelectItem value="DAI">Dai (DAI)</SelectItem>
                      <SelectItem value="WBTC">Wrapped Bitcoin (WBTC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Maximum Amount</label>
                  <Input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-12 bg-muted/50 border-border"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-muted-foreground">Minimum Credit Score</label>
                  <span className="text-lg font-bold text-primary">{minCreditScore[0]}</span>
                </div>
                <Slider
                  value={minCreditScore}
                  onValueChange={setMinCreditScore}
                  min={300}
                  max={900}
                  step={50}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>300 (Poor)</span>
                  <span>600 (Fair)</span>
                  <span>900 (Excellent)</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Interest Rate (%)</label>
                <Input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="0.00"
                  className="h-12 bg-muted/50 border-border"
                />
              </div>

              <Button
                variant="default"
                size="lg"
                className="w-full"
                onClick={handleCreateIntent}
                disabled={isSubmittingIntent}
              >
                {isSubmittingIntent ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    {currentIntent ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  currentIntent ? 'Update Supply Intent' : 'Supply'
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Step 2: Matched Requests */}
      {step === 'requests' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card variant="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Matched Borrow Requests</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Requests matching your criteria. Set threshold and verify credit score with ZK proofs.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  {matchedRequests.length} Matches
                </Badge>
                <Button variant="outline" size="sm" onClick={() => {
                  setManualStepChange(true);
                  setStep('intent');
                  loadCurrentIntent();
                }}>
                  Adjust Criteria
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading requests...</p>
                </div>
              ) : matchedRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No matching requests found</p>
                  <Button variant="outline" className="mt-4" onClick={() => setStep('intent')}>
                    Adjust Criteria
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {matchedRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 rounded-lg bg-muted/20 border border-border/30 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500" />
                          <div>
                            <p className="font-mono text-sm">{formatAddress(request.borrower_address)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(request.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge className={getRiskColor(request.risk_level)}>
                          {request.risk_level.toUpperCase()} RISK
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-semibold">{request.amount.toLocaleString()} {request.currency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Collateral</p>
                          <p className="font-semibold">{request.collateral_percent}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Interest Rate</p>
                          <p className="font-semibold text-success">{formatPercent(request.requested_apy)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Est. Return</p>
                          <p className="font-semibold">{formatCurrency(request.estimated_return)}</p>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleReviewRequest(request)}
                        disabled={verificationState?.requestId === request.id}
                      >
                        {verificationState?.requestId === request.id ? 'Verifying...' : 'Review with ZK Proof'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ZK Verification Modal */}
      <AnimatePresence>
        {verificationState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !verificationState.isVerifying && setVerificationState(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <Card variant="glass">
                <CardHeader>
                  <CardTitle>ZK Credit Verification</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Verifying borrower's credit score with zero-knowledge proof
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Step 1: Generating Proof */}
                  {verificationState.isGeneratingProof && (
                    <div className="text-center py-8">
                      <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                      <p className="font-semibold mb-2">Generating ZK Proof...</p>
                      <p className="text-sm text-muted-foreground">
                        Creating cryptographic proof of credit score
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Threshold: {verificationState.threshold}
                      </p>
                    </div>
                  )}

                  {/* Step 2: Proof Generated - Show Details */}
                  {verificationState.proofData && verificationState.isVerifyingProof && (
                    <div className="space-y-4">
                      <div className="text-center py-4">
                        <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                        <p className="font-semibold mb-2">Proof Generated Successfully!</p>
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mt-4 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Submitting to blockchain for on-chain verification...
                        </p>
                      </div>

                      {/* Proof Details */}
                      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-sm">Proof Details</h4>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Nullifier:</span>
                            <span className="font-mono">{verificationState.proofData.nullifier.substring(0, 16)}...</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Timestamp:</span>
                            <span>{new Date(verificationState.proofData.timestamp * 1000).toLocaleString()}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Public Signals:</span>
                            <span className="font-mono">{verificationState.proofData.public_signals.length} signals</span>
                          </div>
                        </div>

                        {/* Expandable Proof Data */}
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-primary hover:underline">
                            View Full Proof Data
                          </summary>
                          <div className="mt-2 p-3 bg-background/50 rounded border border-border/30 max-h-40 overflow-y-auto">
                            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">
                              {JSON.stringify(verificationState.proofData.proof, null, 2)}
                            </pre>
                          </div>
                        </details>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-primary hover:underline">
                            View Public Signals
                          </summary>
                          <div className="mt-2 p-3 bg-background/50 rounded border border-border/30">
                            <pre className="text-[10px] font-mono">
                              {JSON.stringify(verificationState.proofData.public_signals, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Verification Complete - Show Result */}
                  {!verificationState.isVerifying && verificationState.result && verificationState.proofData && (
                    <div className="space-y-6">
                      <div className="text-center">
                        {verificationState.result.is_eligible ? (
                          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
                        ) : (
                          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                        )}
                        <h3 className="text-xl font-bold mb-2">
                          {verificationState.result.is_eligible ? '✓ Eligible for Loan' : '✗ Not Eligible'}
                        </h3>
                        <p className="text-muted-foreground mb-2">
                          <span className="font-bold">Zero-Knowledge Proof Verified</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Threshold: {verificationState.threshold}
                        </p>
                        <p className="text-xs text-muted-foreground italic mt-2">
                          Actual credit score remains private (zero-knowledge)
                        </p>
                      </div>

                      {/* Verified Proof Details */}
                      <div className="bg-success/10 border border-success/30 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-4 h-4 text-success" />
                          <h4 className="font-semibold text-sm text-success">
                            {verificationState.proofData?.onChainVerified 
                              ? 'Proof Verified On-Chain' 
                              : 'Proof Verified Off-Chain'}
                          </h4>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Proof Type:</span>
                            <span className="font-semibold">Groth16 ZK-SNARK</span>
                          </div>
                          
                          {verificationState.proofData?.onChainVerified && verificationState.proofData?.onChainTxHash && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Transaction:</span>
                              <a 
                                href={`https://amoy.polygonscan.com/tx/${verificationState.proofData.onChainTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-primary hover:underline"
                              >
                                {verificationState.proofData.onChainTxHash.substring(0, 10)}...
                              </a>
                            </div>
                          )}
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Nullifier:</span>
                            <span className="font-mono">{verificationState.proofData.nullifier.substring(0, 20)}...</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Verified At:</span>
                            <span>{new Date(verificationState.proofData.timestamp * 1000).toLocaleString()}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Public Signals:</span>
                            <span className="font-mono">{verificationState.proofData.public_signals.length} signals</span>
                          </div>
                          
                          {verificationState.proofData?.onChainVerified && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Network:</span>
                              <span className="font-semibold">Polygon Amoy</span>
                            </div>
                          )}
                        </div>

                        {/* Expandable Verified Proof Data */}
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-primary hover:underline">
                            View Complete Proof
                          </summary>
                          <div className="mt-2 p-3 bg-background/50 rounded border border-border/30 max-h-40 overflow-y-auto">
                            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">
                              {JSON.stringify(verificationState.proofData.proof, null, 2)}
                            </pre>
                          </div>
                        </details>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-primary hover:underline">
                            View Public Signals
                          </summary>
                          <div className="mt-2 p-3 bg-background/50 rounded border border-border/30">
                            <div className="space-y-1 text-[10px]">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Score Total:</span>
                                <span className="font-mono">{verificationState.proofData.public_signals[0]}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Is Eligible:</span>
                                <span className="font-mono">{verificationState.proofData.public_signals[1] === 1 ? 'true' : 'false'}</span>
                              </div>
                              <details className="mt-2">
                                <summary className="cursor-pointer text-primary hover:underline">
                                  View Raw Signals
                                </summary>
                                <pre className="mt-2 text-[10px] font-mono">
                                  {JSON.stringify(verificationState.proofData.public_signals, null, 2)}
                                </pre>
                              </details>
                            </div>
                          </div>
                        </details>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        {verificationState.result.is_eligible ? (
                          <>
                            <Button
                              variant="default"
                              className="flex-1"
                              onClick={handleApproveRequest}
                            >
                              Approve Loan
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={handleRejectRequest}
                            >
                              Reject
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setVerificationState(null)}
                          >
                            Close
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

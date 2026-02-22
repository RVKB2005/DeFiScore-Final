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
  }, [step, isConnected, token, selectedCurrency]);

  // Auto-navigate to requests page if user has already supplied
  // Only navigate after stats have finished loading to prevent flashing
  useEffect(() => {
    if (!loadingUserData && supplierStats && supplierStats.activeIntents > 0 && step === 'intent') {
      setStep('requests');
    }
  }, [supplierStats, loadingUserData, step]);

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
      setStep('requests');
    } catch (error: any) {
      console.error('Failed to create supply intent:', error);
      toast.error(error.response?.data?.detail || 'Failed to create supply intent');
    }
  };

  const handleReviewRequest = async (request: MatchedRequest) => {
    console.log('[SupplyNew] Review request initiated:', {
      requestId: request.id,
      borrowerAddress: request.borrower_address,
      isConnected,
      hasToken: !!token,
      hasAddress: !!address,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
    });

    if (!isConnected || !token) {
      toast.error('Please connect your wallet to review requests');
      onWalletClick?.(); // Open wallet modal if available
      return;
    }

    if (!address) {
      toast.error('Wallet address not found. Please reconnect your wallet.');
      return;
    }

    // Set custom threshold or use default from intent
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

    try {
      // Step 1: Initiate review
      console.log('[SupplyNew] Step 1: Initiating review...');
      await apiService.reviewBorrowRequest(token, {
        request_id: request.id,
        credit_score_threshold: threshold
      });

      toast.info('Checking borrower credit score...', { duration: 10000, id: 'zk-gen' });

      // Step 2: Generate ZK proof (automatically calculates credit score if needed)
      // The API service now handles automatic retries with 2-minute intervals
      console.log('[SupplyNew] Step 2: Generating ZK proof with automatic retry...');
      
      const zkProofResult = await apiService.generateZKProofForBorrower(
        token,
        {
          request_id: request.id,
          borrower_address: request.borrower_address,
          threshold: threshold
        },
        {
          maxRetries: 5, // 5 retries * 2 minutes = 10 minutes max
          retryDelay: 120000, // 2 minutes (120 seconds) between retries
          onProgress: (attempt, maxRetries) => {
            const elapsedMinutes = Math.floor(attempt * 2);
            const remainingMinutes = Math.ceil((maxRetries - attempt) * 2);
            toast.info(
              `Calculating credit score... ${elapsedMinutes}m elapsed, up to ${remainingMinutes}m remaining (attempt ${attempt}/${maxRetries})`,
              { id: 'zk-gen', duration: 120000 }
            );
          }
        }
      );
      
      toast.success('ZK Proof generated successfully!', { id: 'zk-gen' });

      // Update state with proof data
      setVerificationState(prev => prev ? {
        ...prev,
        isGeneratingProof: false,
        isVerifyingProof: true,
        proofData: {
          proof: zkProofResult.proof,
          public_signals: zkProofResult.public_signals,
          nullifier: zkProofResult.nullifier,
          timestamp: zkProofResult.timestamp
        }
      } : null);

      // Step 3: Verify the proof
      console.log('[SupplyNew] Step 3: Verifying proof...');
      toast.info('Verifying proof on-chain...', { id: 'zk-verify' });
      
      const verifyResult = await apiService.verifyZKProofForRequest(token, request.id, zkProofResult);

      toast.success('Proof verified successfully!', { id: 'zk-verify' });

      // Update state with result (ZERO-KNOWLEDGE: only eligibility, not score)
      setVerificationState(prev => prev ? {
        ...prev,
        isVerifying: false,
        isVerifyingProof: false,
        result: {
          is_eligible: verifyResult.is_eligible
          // DO NOT include actual_score - zero-knowledge proof!
        }
      } : null);

      if (verifyResult.is_eligible) {
        toast.success('Borrower is eligible! Credit score verified with ZK proof.', { id: 'zk-gen' });
      } else {
        toast.warning('Borrower does not meet credit score threshold', { id: 'zk-gen' });
      }

    } catch (error: any) {
      console.error('[SupplyNew] Failed to initiate review:', error);
      
      // Handle specific error cases
      if (error.status === 401 || error.status === 403 || error.message?.includes('Unauthorized') || error.message?.includes('401') || error.message?.includes('403')) {
        toast.error('Session expired. Please reconnect your wallet.', { id: 'zk-gen' });
        onWalletClick?.(); // Open wallet modal to reconnect
      } else if (error.status === 404 || error.message?.includes('404') || error.message?.includes('Not Found')) {
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
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        toast.error('Cannot connect to backend server. Please ensure it is running at http://localhost:8000', { id: 'zk-gen' });
      } else {
        toast.error(error.message || 'Failed to verify credit score', { id: 'zk-gen' });
      }
      
      setVerificationState(null);
    }
  };

  const handleApproveRequest = async () => {
    if (!verificationState || !token) return;

    const request = matchedRequests.find(r => r.id === verificationState.requestId);
    if (!request) return;

    try {
      await apiService.approveBorrowRequest(token, {
        request_id: verificationState.requestId,
        offered_apy: request.requested_apy,
        terms: null
      });

      toast.success('Borrow request approved!');
      setVerificationState(null);
      loadMatchedRequests(); // Refresh list
    } catch (error: any) {
      console.error('Failed to approve request:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve request');
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
              >
                {currentIntent ? 'Update Supply Intent' : 'Supply'}
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
                <Button variant="outline" size="sm" onClick={() => setStep('intent')}>
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
                          Verifying proof on-chain...
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
                          <h4 className="font-semibold text-sm text-success">Proof Verified On-Chain</h4>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Proof Type:</span>
                            <span className="font-semibold">Groth16 ZK-SNARK</span>
                          </div>
                          
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

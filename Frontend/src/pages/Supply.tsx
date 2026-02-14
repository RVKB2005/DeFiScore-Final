import { useState } from 'react';
import { motion } from 'framer-motion';
import { History, TrendingUp, DollarSign, Building } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReviewBorrowRequestModal } from '@/components/modals/ReviewBorrowRequestModal';
import { BorrowerEligibleModal } from '@/components/modals/BorrowerEligibleModal';
import { BorrowerNotEligibleModal } from '@/components/modals/BorrowerNotEligibleModal';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { useNavigate } from 'react-router-dom';

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

const mockIncomingRequests: BorrowRequest[] = [
  {
    id: '8291',
    borrower: '0x4a...f92',
    asset: 'USDC',
    assetIcon: '$',
    assetColor: '#2775CA',
    amount: 5000.00,
    collateralPercent: 120,
    apy: 8.5,
  },
  {
    id: '8292',
    borrower: '0x12...a34',
    asset: 'ETH',
    assetIcon: 'E',
    assetColor: '#627EEA',
    amount: 1.50,
    collateralPercent: 150,
    apy: 12.2,
  },
  {
    id: '8293',
    borrower: '0x9c...b21',
    asset: 'USDT',
    assetIcon: 'T',
    assetColor: '#26A17B',
    amount: 12500.00,
    collateralPercent: 110,
    apy: 7.9,
  },
  {
    id: '8294',
    borrower: '0xe1...d77',
    asset: 'WBTC',
    assetIcon: '₿',
    assetColor: '#F7931A',
    amount: 0.80,
    collateralPercent: 200,
    apy: 6.1,
  },
];

const supplyAssets = [
  { symbol: 'ETH', name: 'Ethereum', balance: 24.52, apy: 4.2 },
  { symbol: 'USDC', name: 'USD Coin', balance: 15000, apy: 8.5 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: 0.85, apy: 3.2 },
  { symbol: 'DAI', name: 'Dai', balance: 8500, apy: 7.8 },
];

export default function Supply() {
  const navigate = useNavigate();
  const [selectedAsset, setSelectedAsset] = useState('ETH');
  const [amount, setAmount] = useState('');
  
  // Modal states
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [eligibleModalOpen, setEligibleModalOpen] = useState(false);
  const [notEligibleModalOpen, setNotEligibleModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);
  const [requiredScore, setRequiredScore] = useState(700);

  const currentAsset = supplyAssets.find(a => a.symbol === selectedAsset);

  const handleMaxClick = () => {
    if (currentAsset) {
      setAmount(currentAsset.balance.toString());
    }
  };

  const handleReviewClick = (request: BorrowRequest) => {
    setSelectedRequest(request);
    setReviewModalOpen(true);
  };

  const handleVerificationComplete = (request: BorrowRequest, isEligible: boolean, threshold: number) => {
    setReviewModalOpen(false);
    setRequiredScore(threshold);
    
    if (isEligible) {
      setEligibleModalOpen(true);
    } else {
      setNotEligibleModalOpen(true);
    }
  };

  const handleConfirmOffer = () => {
    setEligibleModalOpen(false);
    setSelectedRequest(null);
  };

  const handleReject = () => {
    setNotEligibleModalOpen(false);
    setSelectedRequest(null);
  };

  const handleReviewVerification = () => {
    setNotEligibleModalOpen(false);
    setReviewModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Supply Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Privacy-first on-chain liquidity provisioning. Earn yield securely.
          </p>
        </div>
        <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={() => navigate('/supply/manage')}>
          <History className="w-4 h-4" />
          View History
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="glass" className="relative overflow-hidden">
            <CardContent className="pt-5 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Supplied</p>
                  <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(142500.80)}</p>
                  <p className="text-xs sm:text-sm text-success mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    +12.5% vs last month
                  </p>
                </div>
                <div className="w-14 h-14 sm:w-20 sm:h-20 opacity-20">
                  <Building className="w-full h-full text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="glass" className="relative overflow-hidden">
            <CardContent className="pt-5 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Earned Interest</p>
                  <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(4240.50)}</p>
                  <p className="text-xs sm:text-sm text-success mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    +$214.20 Today
                  </p>
                </div>
                <div className="w-14 h-14 sm:w-20 sm:h-20 opacity-20">
                  <DollarSign className="w-full h-full text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Supply Assets Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card variant="glass">
            <CardHeader className="px-4 sm:px-6 pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Supply Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6 pb-5 sm:pb-6">
              <div>
                <label className="text-xs sm:text-sm text-muted-foreground mb-2 block">Select Asset</label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                  <SelectTrigger className="h-11 sm:h-12 bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supplyAssets.map((asset) => (
                      <SelectItem key={asset.symbol} value={asset.symbol}>
                        {asset.name} ({asset.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm text-muted-foreground">Amount</label>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Balance: {currentAsset?.balance} {selectedAsset}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-11 sm:h-12 bg-muted/50 border-border pr-16"
                  />
                  <button
                    onClick={handleMaxClick}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary font-semibold text-xs sm:text-sm hover:text-primary/80"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-2 border-t border-border/50">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Supply APY</span>
                  <span className="text-primary font-semibold">{formatPercent(currentAsset?.apy || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Privacy Reward</span>
                  <span className="text-success font-semibold">+1.5%</span>
                </div>
              </div>

              <Button variant="glow" size="lg" className="w-full text-sm sm:text-base">
                Supply {selectedAsset}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Incoming Borrow Requests Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card variant="glass">
            <CardHeader className="flex flex-row items-center justify-between px-4 sm:px-6 pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Incoming Borrow Requests</CardTitle>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                {mockIncomingRequests.length} Active
              </Badge>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              {/* Mobile Card Layout */}
              <div className="sm:hidden space-y-3">
                {mockIncomingRequests.map((request, index) => (
                  <div key={request.id} className="p-3 rounded-lg bg-muted/20 border border-border/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded-full" 
                          style={{ 
                            background: `linear-gradient(135deg, ${
                              index === 0 ? '#A855F7, #6366F1' :
                              index === 1 ? '#F97316, #EF4444' :
                              index === 2 ? '#3B82F6, #06B6D4' :
                              '#22C55E, #10B981'
                            })`
                          }}
                        />
                        <span className="font-mono text-xs">{request.borrower}</span>
                      </div>
                      <span className="text-success font-semibold text-sm">{formatPercent(request.apy)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: request.assetColor }}
                        >
                          {request.assetIcon}
                        </div>
                        <div>
                          <span className="font-semibold text-sm">{request.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className="text-xs text-muted-foreground ml-1">{request.asset}</span>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleReviewClick(request)}
                      >
                        Review
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      at {request.collateralPercent}% Collateral
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Borrower
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Asset
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        APY
                      </th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockIncomingRequests.map((request, index) => (
                      <tr key={request.id} className="border-b border-border/30 last:border-0">
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded-full" 
                              style={{ 
                                background: `linear-gradient(135deg, ${
                                  index === 0 ? '#A855F7, #6366F1' :
                                  index === 1 ? '#F97316, #EF4444' :
                                  index === 2 ? '#3B82F6, #06B6D4' :
                                  '#22C55E, #10B981'
                                })`
                              }}
                            />
                            <span className="font-mono text-sm">{request.borrower}</span>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ backgroundColor: request.assetColor }}
                            >
                              {request.assetIcon}
                            </div>
                            <span>{request.asset}</span>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div>
                            <p className="font-semibold">
                              {request.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              at {request.collateralPercent}% Collateral
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <span className="text-success font-semibold">{formatPercent(request.apy)}</span>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReviewClick(request)}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="text-center pt-4 border-t border-border/30 mt-4">
                <button className="text-primary hover:text-primary/80 text-xs sm:text-sm font-medium">
                  View all requests
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Modals */}
      <ReviewBorrowRequestModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        request={selectedRequest}
        onVerificationComplete={handleVerificationComplete}
      />

      <BorrowerEligibleModal
        isOpen={eligibleModalOpen}
        onClose={() => setEligibleModalOpen(false)}
        request={selectedRequest}
        onConfirmOffer={handleConfirmOffer}
      />

      <BorrowerNotEligibleModal
        isOpen={notEligibleModalOpen}
        onClose={() => setNotEligibleModalOpen(false)}
        requiredScore={requiredScore}
        onReject={handleReject}
        onReviewVerification={handleReviewVerification}
      />
    </div>
  );
}

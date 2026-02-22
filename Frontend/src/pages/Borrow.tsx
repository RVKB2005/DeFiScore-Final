import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Shield, Building, Search, Filter, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BorrowRequestModal } from '@/components/modals/BorrowRequestModal';
import { formatCurrency, formatPercent, formatAddress } from '@/utils/formatters';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/hooks/useWallet';
import { useMarketData } from '@/contexts/MarketDataContext';
import { useUserData } from '@/contexts/UserDataContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Supplier {
  id: string;
  supplier_address: string;
  currency: string;
  max_amount: number;
  min_credit_score: number;
  max_apy: number;
  available_amount: number;
}

interface BorrowRequest {
  id: string;
  currency: string;
  amount: number;
  collateral_percent: number;
  requested_apy: number;
  duration_days: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  created_at: string;
  supplier_address?: string;
}

export default function Borrow({ onWalletClick }: { onWalletClick?: () => void }) {
  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const { marketStats, topAssets, loading: loadingMarketData } = useMarketData();
  const { myBorrowRequests, availableSuppliers, loading: loadingUserData, refetch } = useUserData();
  
  // Search and filter states
  const [searchAddress, setSearchAddress] = useState('');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  
  // Filtered suppliers
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  
  // Modal state
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  useEffect(() => {
    if (!availableSuppliers) return;
    
    let filtered = [...availableSuppliers];
    
    // Filter by currency
    if (filterCurrency !== 'all') {
      filtered = filtered.filter(s => s.currency === filterCurrency);
    }
    
    // Filter by address search
    if (searchAddress.trim()) {
      filtered = filtered.filter(s => 
        s.supplier_address.toLowerCase().includes(searchAddress.toLowerCase())
      );
    }
    
    setFilteredSuppliers(filtered);
  }, [availableSuppliers, filterCurrency, searchAddress]);

  const handleRequestLoan = async (supplier: Supplier) => {
    if (!isConnected) {
      toast.error('Please connect your wallet to request a loan');
      onWalletClick?.();
      return;
    }
    
    setSelectedSupplier(supplier);
    setRequestModalOpen(true);
  };

  const handleRequestSuccess = () => {
    // Refresh user data to show new request
    refetch();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
        return 'bg-success/20 text-success border-success/30';
      case 'rejected':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'pending':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'completed':
        return 'bg-muted/20 text-muted-foreground border-muted/30';
      default:
        return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-xs sm:text-sm text-muted-foreground mb-2">
          Home / <span className="text-foreground">Borrow</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold">Borrow Assets</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Find suppliers and request loans with privacy-preserving credit verification
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="glass" className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">Available Suppliers</p>
            {loadingUserData && isConnected ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{availableSuppliers?.length || 0}</p>
            )}
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="glass" className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">My Requests</p>
            {loadingUserData ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-primary">{myBorrowRequests?.length || 0}</p>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Available Suppliers (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Available Suppliers</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Browse and request loans from active suppliers
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by wallet address..."
                    value={searchAddress}
                    onChange={(e) => setSearchAddress(e.target.value)}
                    className="pl-10 h-10 bg-muted/50 border-border"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                    <SelectTrigger className="w-full sm:w-[140px] h-10 bg-muted/50 border-border">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Currencies</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="USDT">USDT</SelectItem>
                      <SelectItem value="DAI">DAI</SelectItem>
                      <SelectItem value="WBTC">WBTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Suppliers List */}
              <div className="space-y-2 sm:space-y-3">
                {loadingUserData && isConnected ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-muted/20 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filteredSuppliers.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      {searchAddress || filterCurrency !== 'all' 
                        ? 'No suppliers match your filters' 
                        : 'No suppliers available at the moment'}
                    </p>
                  </div>
                ) : (
                  filteredSuppliers.map((supplier, index) => (
                    <motion.div
                      key={supplier.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card variant="glass" className="p-3 sm:p-4 hover:border-primary/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                {supplier.currency}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatAddress(supplier.supplier_address)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Max Amount:</span>
                                <p className="font-medium">{formatCurrency(supplier.max_amount)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Available:</span>
                                <p className="font-medium text-success">{formatCurrency(supplier.available_amount)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Interest Rate:</span>
                                <p className="font-medium">{formatPercent(supplier.max_apy)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Min Score:</span>
                                <p className="font-medium">{supplier.min_credit_score}</p>
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="glow" 
                            size="sm"
                            onClick={() => handleRequestLoan(supplier)}
                            className="w-full sm:w-auto"
                          >
                            Request Loan
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Previous Requests (1/3 width) */}
        <div className="space-y-4">
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">My Requests</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Track your borrow requests
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isConnected ? (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ y: 0 }}
                    animate={{ y: [-10, 0, -10] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="mb-6"
                  >
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                      <div className="relative w-24 h-24 mx-auto">
                        <svg viewBox="0 0 120 120" className="w-full h-full">
                          <rect x="30" y="55" width="60" height="40" rx="6" fill="currentColor" className="text-primary/30" />
                          <rect x="30" y="60" width="60" height="10" fill="currentColor" className="text-primary/50" />
                          <circle cx="80" cy="75" r="6" fill="currentColor" className="text-primary/60" />
                          <circle cx="80" cy="75" r="3" fill="currentColor" className="text-background" />
                          <motion.g
                            animate={{ x: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <line x1="70" y1="45" x2="33" y2="45" stroke="currentColor" strokeWidth="4" className="text-primary" strokeLinecap="round" />
                            <path d="M30 45 L40 40 L40 50 Z" fill="currentColor" className="text-primary" />
                          </motion.g>
                          <text x="52" y="83" fontSize="16" fontWeight="bold" fill="currentColor" className="text-primary">$</text>
                        </svg>
                      </div>
                    </div>
                  </motion.div>
                  <h3 className="text-lg font-bold mb-2">Ready to Borrow?</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Connect your wallet to request loans
                  </p>
                  <Button variant="default" size="sm" onClick={onWalletClick}>
                    Connect Wallet
                  </Button>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <span>Secure • Privacy-First</span>
                  </div>
                </div>
              ) : loadingUserData ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : !myBorrowRequests || myBorrowRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    No borrow requests yet
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/borrow/previous-requests')}
                  >
                    Create Request
                  </Button>
                </div>
              ) : (
                <>
                  {myBorrowRequests.slice(0, 5).map((request, index) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card variant="glass" className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                {request.currency}
                              </Badge>
                              <span className={cn(
                                'text-[10px] px-2 py-0.5 rounded-full border uppercase font-medium',
                                getStatusColor(request.status)
                              )}>
                                {request.status}
                              </span>
                            </div>
                            {getStatusIcon(request.status)}
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amount:</span>
                              <span className="font-medium">{formatCurrency(request.amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Interest:</span>
                              <span className="font-medium">{formatPercent(request.requested_apy)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Duration:</span>
                              <span className="font-medium">{request.duration_days}d</span>
                            </div>
                          </div>
                          
                          {/* Repayment buttons for active loans */}
                          {request.status === 'active' && request.supplier_address && (
                            <div className="flex gap-2 mt-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={async () => {
                                  try {
                                    const { BrowserProvider, parseUnits } = await import('ethers');
                                    if (!window.ethereum) {
                                      toast.error('MetaMask not found');
                                      return;
                                    }
                                    const provider = new BrowserProvider(window.ethereum);
                                    const signer = await provider.getSigner();
                                    
                                    // Calculate interest (simple calculation for demo)
                                    const interestAmount = (request.amount * request.requested_apy / 100 / 365 * request.duration_days).toFixed(4);
                                    
                                    const tx = await signer.sendTransaction({
                                      to: request.supplier_address,
                                      value: parseUnits(interestAmount, 18),
                                      gasLimit: 21000n
                                    });
                                    
                                    toast.info('Paying interest...', { id: 'pay-interest' });
                                    await tx.wait();
                                    toast.success(`Interest paid: ${interestAmount} MATIC`, { id: 'pay-interest' });
                                  } catch (error: any) {
                                    toast.error(error.code === 'ACTION_REJECTED' ? 'Transaction rejected' : 'Payment failed');
                                  }
                                }}
                              >
                                Pay Interest
                              </Button>
                              <Button 
                                variant="default" 
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={async () => {
                                  const amount = prompt(`Enter amount to repay (max: ${request.amount} MATIC):`);
                                  if (!amount || isNaN(parseFloat(amount))) return;
                                  
                                  try {
                                    const { BrowserProvider, parseUnits } = await import('ethers');
                                    if (!window.ethereum) {
                                      toast.error('MetaMask not found');
                                      return;
                                    }
                                    const provider = new BrowserProvider(window.ethereum);
                                    const signer = await provider.getSigner();
                                    
                                    const tx = await signer.sendTransaction({
                                      to: request.supplier_address,
                                      value: parseUnits(amount, 18),
                                      gasLimit: 21000n
                                    });
                                    
                                    toast.info('Repaying loan...', { id: 'repay-loan' });
                                    await tx.wait();
                                    toast.success(`Repaid: ${amount} MATIC`, { id: 'repay-loan' });
                                  } catch (error: any) {
                                    toast.error(error.code === 'ACTION_REJECTED' ? 'Transaction rejected' : 'Repayment failed');
                                  }
                                }}
                              >
                                Repay
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                  {myBorrowRequests.length > 5 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate('/borrow/previous-requests')}
                    >
                      View All ({myBorrowRequests.length})
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Borrow Request Modal */}
      {selectedSupplier && (
        <BorrowRequestModal
          isOpen={requestModalOpen}
          onClose={() => setRequestModalOpen(false)}
          supplier={selectedSupplier}
          onSuccess={handleRequestSuccess}
        />
      )}
    </div>
  );
}

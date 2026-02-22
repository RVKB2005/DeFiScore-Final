import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, Clock, CheckCircle2, XCircle, AlertTriangle, 
  TrendingUp, DollarSign, Shield, ArrowRight, ExternalLink,
  RefreshCw, Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatPercent, formatAddress } from '@/utils/formatters';
import { useWallet } from '@/hooks/useWallet';
import { useBlockchain } from '@/hooks/useBlockchain';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

interface Loan {
  loan_id: string;
  borrower: string;
  lender: string;
  currency: string;
  amount: number;
  interest_rate: number;
  duration_days: number;
  status: string;
  created_at: string;
  due_date?: string;
  role: 'borrower' | 'lender';
  blockchain_status?: string;
  is_overdue?: boolean;
  total_repayment?: number;
  amount_repaid?: number;
}

export default function LoansPage({ onWalletClick }: { onWalletClick?: () => void }) {
  const { isConnected, token, address } = useWallet();
  const blockchain = useBlockchain();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'borrower' | 'lender'>('all');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isConnected && token) {
      loadLoans();
    }
  }, [isConnected, token, activeTab]);

  const loadLoans = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const role = activeTab === 'all' ? undefined : activeTab;
      const data = await apiService.getMyLoans(token, role);
      setLoans(data);
    } catch (error: any) {
      console.error('Failed to load loans:', error);
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success border-success/20';
      case 'pending_collateral': return 'bg-warning/10 text-warning border-warning/20';
      case 'pending_funding': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'repaid': return 'bg-success/10 text-success border-success/20';
      case 'defaulted': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_collateral': return 'Awaiting Collateral';
      case 'pending_funding': return 'Awaiting Funding';
      case 'active': return 'Active';
      case 'repaid': return 'Repaid';
      case 'defaulted': return 'Defaulted';
      default: return status;
    }
  };

  const getActionButton = (loan: Loan) => {
    if (loan.role === 'borrower') {
      if (loan.status === 'pending_collateral') {
        return (
          <Button 
            size="sm" 
            onClick={() => handleDepositCollateral(loan)}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deposit Collateral'}
          </Button>
        );
      }
      if (loan.status === 'active') {
        return (
          <Button 
            size="sm" 
            onClick={() => handleMakeRepayment(loan)}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Make Repayment'}
          </Button>
        );
      }
    } else if (loan.role === 'lender') {
      if (loan.status === 'pending_funding') {
        return (
          <Button 
            size="sm" 
            onClick={() => handleFundLoan(loan)}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fund Loan'}
          </Button>
        );
      }
      if (loan.status === 'defaulted') {
        return (
          <Button 
            size="sm" 
            variant="destructive"
            onClick={() => handleLiquidate(loan)}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Liquidate'}
          </Button>
        );
      }
    }
    return null;
  };

  const handleDepositCollateral = async (loan: Loan) => {
    if (!token) return;
    
    try {
      setActionLoading(true);
      
      // Get collateral instructions from backend
      const instructions = await apiService.getCollateralInstructions(token, loan.loan_id);
      
      toast.info('Preparing collateral deposit...', { id: 'collateral' });
      
      // Execute blockchain transaction
      const txHash = await blockchain.depositCollateral(
        loan.loan_id,
        instructions.collateral_token,
        instructions.collateral_amount.toString()
      );
      
      // Confirm with backend
      await apiService.confirmCollateralDeposit(token, loan.loan_id);
      
      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">Collateral Deposited!</p>
          <p className="text-sm">Waiting for lender to fund the loan</p>
          <a 
            href={`https://amoy.polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View Transaction <ExternalLink className="w-3 h-3" />
          </a>
        </div>,
        { id: 'collateral', duration: 10000 }
      );
      
      // Refresh loans
      await loadLoans();
      
    } catch (error: any) {
      console.error('Failed to deposit collateral:', error);
      toast.error(error.message || 'Failed to deposit collateral', { id: 'collateral' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFundLoan = async (loan: Loan) => {
    if (!token) return;
    
    try {
      setActionLoading(true);
      
      // Get funding instructions from backend
      const instructions = await apiService.getFundingInstructions(token, loan.loan_id);
      
      toast.info('Preparing to fund loan...', { id: 'fund' });
      
      // Execute blockchain transaction
      const txHash = await blockchain.fundLoan(
        loan.loan_id,
        instructions.loan_token,
        instructions.loan_amount.toString()
      );
      
      // Confirm with backend
      await apiService.confirmLoanFunded(token, loan.loan_id);
      
      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">Loan Funded!</p>
          <p className="text-sm">Borrower can now make repayments</p>
          <a 
            href={`https://amoy.polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View Transaction <ExternalLink className="w-3 h-3" />
          </a>
        </div>,
        { id: 'fund', duration: 10000 }
      );
      
      // Refresh loans
      await loadLoans();
      
    } catch (error: any) {
      console.error('Failed to fund loan:', error);
      toast.error(error.message || 'Failed to fund loan', { id: 'fund' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMakeRepayment = async (loan: Loan) => {
    if (!token) return;
    
    try {
      setActionLoading(true);
      
      // Get repayment instructions from backend
      const instructions = await apiService.getRepaymentInstructions(token, loan.loan_id);
      
      toast.info('Preparing repayment...', { id: 'repay' });
      
      // Execute blockchain transaction (full repayment for now)
      const txHash = await blockchain.makeRepayment(
        loan.loan_id,
        instructions.loan_token,
        instructions.remaining_amount.toString()
      );
      
      // Confirm with backend
      await apiService.confirmRepayment(token, loan.loan_id);
      
      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">Repayment Successful!</p>
          <p className="text-sm">
            {instructions.remaining_amount === instructions.total_repayment 
              ? 'Loan fully repaid! Collateral returned.'
              : 'Partial repayment made.'}
          </p>
          <a 
            href={`https://amoy.polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View Transaction <ExternalLink className="w-3 h-3" />
          </a>
        </div>,
        { id: 'repay', duration: 10000 }
      );
      
      // Refresh loans
      await loadLoans();
      
    } catch (error: any) {
      console.error('Failed to make repayment:', error);
      toast.error(error.message || 'Failed to make repayment', { id: 'repay' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLiquidate = async (loan: Loan) => {
    if (!token) return;
    
    try {
      setActionLoading(true);
      
      // Mark loan as defaulted first (if not already)
      if (loan.status !== 'defaulted') {
        toast.info('Marking loan as defaulted...', { id: 'liquidate' });
        await apiService.markLoanDefaulted(token, loan.loan_id);
      }
      
      toast.info('Liquidating collateral...', { id: 'liquidate' });
      
      // Execute blockchain transaction
      const txHash = await blockchain.liquidateCollateral(loan.loan_id);
      
      // Confirm with backend
      await apiService.confirmLiquidation(token, loan.loan_id);
      
      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">Collateral Liquidated!</p>
          <p className="text-sm">Collateral transferred to your wallet</p>
          <a 
            href={`https://amoy.polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View Transaction <ExternalLink className="w-3 h-3" />
          </a>
        </div>,
        { id: 'liquidate', duration: 10000 }
      );
      
      // Refresh loans
      await loadLoans();
      
    } catch (error: any) {
      console.error('Failed to liquidate:', error);
      toast.error(error.message || 'Failed to liquidate collateral', { id: 'liquidate' });
    } finally {
      setActionLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold">My Loans</h1>
          <p className="text-muted-foreground">
            Manage your active loans and repayments
          </p>
        </motion.div>

        <Card variant="glass">
          <CardContent className="pt-12 pb-12 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to view and manage your loans
            </p>
            <Button onClick={onWalletClick}>
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
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
          <h1 className="text-2xl font-bold">My Loans</h1>
          <p className="text-muted-foreground">
            Manage your active loans and repayments
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadLoans}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Loans</TabsTrigger>
          <TabsTrigger value="borrower">As Borrower</TabsTrigger>
          <TabsTrigger value="lender">As Lender</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} variant="glass">
                  <CardContent className="pt-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-6 bg-muted rounded w-1/2" />
                      <div className="h-4 bg-muted rounded w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : loans.length === 0 ? (
            <Card variant="glass">
              <CardContent className="pt-12 pb-12 text-center">
                <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">No Loans Found</h3>
                <p className="text-muted-foreground">
                  {activeTab === 'borrower' 
                    ? 'You haven\'t borrowed any funds yet'
                    : activeTab === 'lender'
                    ? 'You haven\'t supplied any funds yet'
                    : 'You don\'t have any active loans'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {loans.map((loan) => (
                <motion.div
                  key={loan.loan_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card variant="glass" className="hover:border-primary/50 transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getStatusColor(loan.status)}>
                              {getStatusLabel(loan.status)}
                            </Badge>
                            <Badge variant="outline">
                              {loan.role === 'borrower' ? 'Borrowing' : 'Lending'}
                            </Badge>
                            {loan.is_overdue && (
                              <Badge variant="destructive">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <h3 className="text-lg font-semibold mb-1">
                            {formatCurrency(loan.amount)} {loan.currency}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {loan.role === 'borrower' 
                              ? `Lender: ${formatAddress(loan.lender)}`
                              : `Borrower: ${formatAddress(loan.borrower)}`}
                          </p>
                        </div>
                        {getActionButton(loan)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/50">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                          <p className="text-sm font-semibold">{formatPercent(loan.interest_rate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Duration</p>
                          <p className="text-sm font-semibold">{loan.duration_days} days</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Created</p>
                          <p className="text-sm font-semibold">
                            {new Date(loan.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {loan.due_date && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                            <p className="text-sm font-semibold">
                              {new Date(loan.due_date).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {loan.status === 'active' && loan.total_repayment && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Repayment Progress</span>
                            <span className="text-sm font-semibold">
                              {formatCurrency(loan.amount_repaid || 0)} / {formatCurrency(loan.total_repayment)}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-success h-2 rounded-full transition-all"
                              style={{ 
                                width: `${((loan.amount_repaid || 0) / loan.total_repayment) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLoan(loan)}
                        >
                          View Details
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        <a
                          href={`https://amoy.polygonscan.com/address/${loan.loan_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          View on Explorer
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

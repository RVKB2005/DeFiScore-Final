import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { apiService } from '@/services/apiService';
import { CollateralDepositModal } from '@/components/modals/CollateralDepositModal';
import { FundLoanModal } from '@/components/modals/FundLoanModal';
import { RepaymentModal } from '@/components/modals/RepaymentModal';
import { LiquidationModal } from '@/components/modals/LiquidationModal';
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
  due_date?: number;
  role: 'borrower' | 'lender';
}

export default function Loans() {
  const { isConnected, address, token } = useWallet();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'collateral' | 'fund' | 'repay' | 'liquidate' | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'borrower' | 'lender'>('all');

  useEffect(() => {
    if (isConnected && token) {
      loadLoans();
    }
  }, [isConnected, token]);

  const loadLoans = async () => {
    try {
      setLoading(true);
      const data = await apiService.getMyLoans(token!);
      setLoans(data);
    } catch (error: any) {
      console.error('Failed to load loans:', error);
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (loanId: string, type: 'collateral' | 'fund' | 'repay' | 'liquidate') => {
    setSelectedLoan(loanId);
    setModalType(type);
  };

  const closeModal = () => {
    setSelectedLoan(null);
    setModalType(null);
  };

  const handleModalSuccess = () => {
    closeModal();
    loadLoans();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      pending_collateral: { variant: 'secondary', icon: Clock, label: 'Awaiting Collateral' },
      pending_funding: { variant: 'secondary', icon: Clock, label: 'Awaiting Funding' },
      active: { variant: 'default', icon: TrendingUp, label: 'Active' },
      repaid: { variant: 'success', icon: CheckCircle2, label: 'Repaid' },
      defaulted: { variant: 'destructive', icon: AlertCircle, label: 'Defaulted' },
      liquidated: { variant: 'destructive', icon: XCircle, label: 'Liquidated' }
    };

    const config = statusConfig[status] || { variant: 'secondary', icon: Clock, label: status };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getActionButton = (loan: Loan) => {
    if (loan.role === 'borrower') {
      if (loan.status === 'pending_collateral') {
        return (
          <Button size="sm" onClick={() => openModal(loan.loan_id, 'collateral')}>
            Deposit Collateral
          </Button>
        );
      }
      if (loan.status === 'active') {
        return (
          <Button size="sm" onClick={() => openModal(loan.loan_id, 'repay')}>
            Make Repayment
          </Button>
        );
      }
    }

    if (loan.role === 'lender') {
      if (loan.status === 'pending_funding') {
        return (
          <Button size="sm" onClick={() => openModal(loan.loan_id, 'fund')}>
            Fund Loan
          </Button>
        );
      }
      if (loan.status === 'defaulted') {
        return (
          <Button size="sm" variant="destructive" onClick={() => openModal(loan.loan_id, 'liquidate')}>
            Liquidate Collateral
          </Button>
        );
      }
    }

    return null;
  };

  const filteredLoans = loans.filter(loan => {
    if (activeTab === 'all') return true;
    return loan.role === activeTab;
  });

  const stats = {
    total: loans.length,
    active: loans.filter(l => l.status === 'active').length,
    asBorrower: loans.filter(l => l.role === 'borrower').length,
    asLender: loans.filter(l => l.role === 'lender').length
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            Please connect your wallet to view your loans.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Loans</h1>
        <p className="text-muted-foreground">Manage your active loans and repayments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Loans</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Loans</CardDescription>
            <CardTitle className="text-3xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>As Borrower</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {stats.asBorrower}
              <TrendingDown className="h-5 w-5 text-red-500" />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>As Lender</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {stats.asLender}
              <TrendingUp className="h-5 w-5 text-green-500" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Loans List */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Agreements</CardTitle>
          <CardDescription>All your loan agreements and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Loans</TabsTrigger>
              <TabsTrigger value="borrower">As Borrower</TabsTrigger>
              <TabsTrigger value="lender">As Lender</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredLoans.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No loans found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLoans.map((loan) => (
                    <Card key={loan.loan_id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">
                                {loan.amount} {loan.currency}
                              </h3>
                              {getStatusBadge(loan.status)}
                              <Badge variant="outline">
                                {loan.role === 'borrower' ? 'Borrowing' : 'Lending'}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Interest Rate</p>
                                <p className="font-medium">{loan.interest_rate}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Duration</p>
                                <p className="font-medium">{loan.duration_days} days</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  {loan.role === 'borrower' ? 'Lender' : 'Borrower'}
                                </p>
                                <p className="font-mono text-xs">
                                  {loan.role === 'borrower' 
                                    ? `${loan.lender.slice(0, 6)}...${loan.lender.slice(-4)}`
                                    : `${loan.borrower.slice(0, 6)}...${loan.borrower.slice(-4)}`
                                  }
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Created</p>
                                <p className="font-medium">
                                  {new Date(loan.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            {loan.due_date && (
                              <div className="text-sm">
                                <p className="text-muted-foreground">Due Date</p>
                                <p className="font-medium">
                                  {new Date(loan.due_date * 1000).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="ml-4">
                            {getActionButton(loan)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedLoan && modalType === 'collateral' && (
        <CollateralDepositModal
          isOpen={true}
          onClose={closeModal}
          loanId={selectedLoan}
          onSuccess={handleModalSuccess}
        />
      )}

      {selectedLoan && modalType === 'fund' && (
        <FundLoanModal
          isOpen={true}
          onClose={closeModal}
          loanId={selectedLoan}
          onSuccess={handleModalSuccess}
        />
      )}

      {selectedLoan && modalType === 'repay' && (
        <RepaymentModal
          isOpen={true}
          onClose={closeModal}
          loanId={selectedLoan}
          onSuccess={handleModalSuccess}
        />
      )}

      {selectedLoan && modalType === 'liquidate' && (
        <LiquidationModal
          isOpen={true}
          onClose={closeModal}
          loanId={selectedLoan}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

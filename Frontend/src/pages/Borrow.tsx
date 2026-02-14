import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link2, History, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BorrowRequestSentModal } from '@/components/modals/BorrowRequestSentModal';

interface Supplier {
  id: string;
  wallet: string;
  liquidity: number;
  verified: boolean;
  recommended?: boolean;
}

const mockSuppliers: Supplier[] = [
  { id: '1', wallet: '0x71C...4e21', liquidity: 450000, verified: true },
  { id: '2', wallet: '0xa3D...9F12', liquidity: 1200000, verified: true, recommended: true },
  { id: '3', wallet: '0x12E...8B77', liquidity: 85000, verified: false },
];

export default function Borrow() {
  const navigate = useNavigate();
  const [selectedAsset] = useState('USDC (USD Coin)');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>('2');
  const [requestSentModalOpen, setRequestSentModalOpen] = useState(false);

  const handleBorrow = () => {
    if (selectedSupplier) {
      setRequestSentModalOpen(true);
    }
  };

  const getSelectedSupplierWallet = () => {
    const supplier = mockSuppliers.find(s => s.id === selectedSupplier);
    return supplier?.wallet || '';
  };

  const formatLiquidity = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount) + ' USDC';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold">Borrow Assets</h1>
        <p className="text-muted-foreground">
          Configure your loan request and select a verified supplier.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left Column - Main Form */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Asset Selection & Amount Input */}
          <Card variant="glass">
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Select Asset */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Select Asset to Borrow
                  </label>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-11 bg-muted/30 border-border/50 hover:bg-muted/50"
                  >
                    <span className="truncate">{selectedAsset}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </Button>
                </div>

                {/* Enter Amount */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Enter Amount to Borrow
                  </label>
                  <div className="relative flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={borrowAmount}
                      onChange={(e) => setBorrowAmount(e.target.value)}
                      className="flex-1 bg-muted/30 border-border/50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 px-3 sm:px-4 bg-primary/20 border-primary/50 text-primary hover:bg-primary/30"
                    >
                      MAX
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Suppliers */}
          <Card variant="glass">
            <CardHeader className="pb-4 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg">Available Suppliers</CardTitle>
                <span className="text-xs sm:text-sm text-muted-foreground">Found 12 matches</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Table Header - Hidden on mobile */}
              <div className="hidden sm:grid grid-cols-4 gap-4 px-4 sm:px-6 py-3 border-b border-border/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Supplier Wallet</span>
                <span className="text-right">Liquidity</span>
                <span className="text-center">Status</span>
                <span className="text-right">Action</span>
              </div>

              {/* Table Rows - Mobile Cards / Desktop Grid */}
              <div className="divide-y divide-border/20">
                {mockSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className={cn(
                      'p-4 sm:px-6 sm:py-4 transition-colors',
                      'sm:grid sm:grid-cols-4 sm:gap-4 sm:items-center',
                      selectedSupplier === supplier.id && 'bg-primary/5'
                    )}
                  >
                    {/* Mobile Layout */}
                    <div className="sm:hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{supplier.wallet}</span>
                          {supplier.recommended && (
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                              REC
                            </Badge>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            supplier.verified
                              ? 'bg-success/10 text-success border-success/30'
                              : 'bg-muted/30 text-muted-foreground border-border/50'
                          )}
                        >
                          {supplier.verified ? 'VERIFIED' : 'UNVERIFIED'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Liquidity: <span className="text-foreground font-medium">{formatLiquidity(supplier.liquidity)}</span></span>
                        <Button
                          variant={selectedSupplier === supplier.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedSupplier(supplier.id)}
                          className={cn(
                            'min-w-[70px] text-xs',
                            selectedSupplier === supplier.id
                              ? 'bg-primary hover:bg-primary/90'
                              : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                          )}
                        >
                          {selectedSupplier === supplier.id ? 'Selected' : 'Select'}
                        </Button>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="font-mono text-sm">{supplier.wallet}</span>
                      {supplier.recommended && (
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                          RECOMMENDED
                        </Badge>
                      )}
                    </div>
                    <span className="hidden sm:block text-right font-medium">
                      {formatLiquidity(supplier.liquidity)}
                    </span>
                    <div className="hidden sm:flex justify-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          supplier.verified
                            ? 'bg-success/10 text-success border-success/30'
                            : 'bg-muted/30 text-muted-foreground border-border/50'
                        )}
                      >
                        {supplier.verified ? 'VERIFIED' : 'UNVERIFIED'}
                      </Badge>
                    </div>
                    <div className="hidden sm:flex justify-end">
                      <Button
                        variant={selectedSupplier === supplier.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedSupplier(supplier.id)}
                        className={cn(
                          'min-w-[80px]',
                          selectedSupplier === supplier.id
                            ? 'bg-primary hover:bg-primary/90'
                            : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                        )}
                      >
                        {selectedSupplier === supplier.id ? 'Selected' : 'Select'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Request Borrow Button */}
          <Button
            variant="glow"
            size="lg"
            className="w-full gap-2 sm:gap-3 py-4 sm:py-6 text-sm sm:text-base font-semibold"
            onClick={handleBorrow}
            disabled={!selectedSupplier}
          >
            REQUEST BORROW
            <Link2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-4 order-first lg:order-last">
          {/* View Previous Requests */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11 sm:h-12 bg-muted/20 border-border/50 hover:bg-muted/40 text-sm"
            onClick={() => navigate('/borrow/previous-requests')}
          >
            <History className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">View Previous Requests</span>
          </Button>

          {/* Request Status */}
          <Card variant="glass">
            <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20 flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">Request Status</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Awaiting Supplier Verification</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground">
                Your credit verification is being processed on-chain. This usually takes between 30-60 seconds.
              </p>

              <div className="p-2.5 sm:p-3 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-[10px] sm:text-xs text-muted-foreground italic">
                  "Please keep this window open until the transaction is confirmed by the supplier."
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tips - Hidden on mobile for space */}
          <Card variant="glass" className="hidden sm:block">
            <CardContent className="p-4 sm:p-5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Quick Tips
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Verified suppliers offer better interest rates.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    High DeFiScore increases borrow limits.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Market */}
          <Card variant="glass" className="overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Live Market
              </h3>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-primary">1.25%</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">AVG. 1D INTEREST RATE</p>
                </div>
                <div className="flex items-end gap-0.5 h-10 sm:h-12">
                  {[40, 60, 45, 70, 55, 80, 65].map((height, i) => (
                    <div
                      key={i}
                      className="w-1.5 sm:w-2 bg-primary/60 rounded-t"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Request Sent Modal */}
      <BorrowRequestSentModal
        isOpen={requestSentModalOpen}
        onClose={() => setRequestSentModalOpen(false)}
        supplierWallet={getSelectedSupplierWallet()}
        amount={borrowAmount}
        asset="USDC"
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { blockchainService } from '@/services/blockchainService';
import { useWallet } from '@/hooks/useWallet';
import { toast } from 'sonner';

interface RepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  onSuccess?: () => void;
}

export function RepaymentModal({ isOpen, onClose, loanId, onSuccess }: RepaymentModalProps) {
  const { token } = useWallet();
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'loading' | 'ready' | 'repaying' | 'confirming' | 'success'>('loading');
  const [txHash, setTxHash] = useState<string>('');

  useEffect(() => {
    if (isOpen && token) {
      loadInstructions();
    }
  }, [isOpen, loanId, token]);

  const loadInstructions = async () => {
    try {
      setStep('loading');
      const data = await apiService.getRepaymentInstructions(token!, loanId);
      setInstructions(data);
      setAmount(data.remaining_amount.toString());
      setStep('ready');
    } catch (error: any) {
      toast.error(error.message);
      onClose();
    }
  };

  const handleRepay = async () => {
    if (!instructions || !amount) return;

    const repayAmount = parseFloat(amount);
    if (isNaN(repayAmount) || repayAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (repayAmount > instructions.remaining_amount) {
      toast.error('Amount exceeds remaining balance');
      return;
    }

    try {
      setStep('repaying');
      setLoading(true);

      // Make repayment via blockchain service
      const result = await blockchainService.makeRepayment(
        loanId,
        instructions.loan_token,
        amount
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to make repayment');
      }

      setTxHash(result.txHash || '');
      setStep('confirming');

      // Confirm with backend
      await apiService.confirmRepayment(token!, loanId);

      setStep('success');
      toast.success('Repayment successful!');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to make repayment:', error);
      toast.error(error.message || 'Failed to make repayment');
      setStep('ready');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Make Repayment</DialogTitle>
          <DialogDescription>
            Repay your loan to get your collateral back
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {step === 'ready' && instructions && (
            <>
              <Alert variant={instructions.is_overdue ? 'destructive' : 'default'}>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Loan Status:</p>
                    <div className="text-sm space-y-1">
                      <p>Total Repayment: {instructions.total_repayment} tokens</p>
                      <p>Amount Repaid: {instructions.amount_repaid} tokens</p>
                      <p>Remaining: {instructions.remaining_amount} tokens</p>
                      <p>Due Date: {new Date(instructions.due_date * 1000).toLocaleDateString()}</p>
                      {instructions.is_overdue && (
                        <p className="text-destructive font-medium flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          OVERDUE - Risk of liquidation!
                        </p>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="amount">Repayment Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  step="0.01"
                  min="0"
                  max={instructions.remaining_amount}
                />
                <p className="text-xs text-muted-foreground">
                  Max: {instructions.remaining_amount} tokens
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAmount((instructions.remaining_amount / 2).toString())}
                  className="flex-1"
                >
                  50%
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAmount(instructions.remaining_amount.toString())}
                  className="flex-1"
                >
                  100% (Full)
                </Button>
              </div>

              <Button onClick={handleRepay} disabled={loading || !amount} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Make Repayment'
                )}
              </Button>
            </>
          )}

          {step === 'repaying' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing repayment...</p>
            </div>
          )}

          {step === 'confirming' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Confirming on blockchain...</p>
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1"
                >
                  View transaction <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="font-medium">Repayment Successful!</p>
              <p className="text-sm text-muted-foreground text-center">
                Your repayment has been processed. {parseFloat(amount) >= instructions?.remaining_amount ? 'Your collateral has been returned!' : 'Continue making payments to get your collateral back.'}
              </p>
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1"
                >
                  View transaction <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

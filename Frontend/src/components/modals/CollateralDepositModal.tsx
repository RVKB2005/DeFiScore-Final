import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { blockchainService } from '@/services/blockchainService';
import { useWallet } from '@/hooks/useWallet';
import { toast } from 'sonner';

interface CollateralDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  onSuccess?: () => void;
}

export function CollateralDepositModal({ isOpen, onClose, loanId, onSuccess }: CollateralDepositModalProps) {
  const { token } = useWallet();
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState<any>(null);
  const [step, setStep] = useState<'loading' | 'ready' | 'depositing' | 'confirming' | 'success'>('loading');
  const [txHash, setTxHash] = useState<string>('');

  useEffect(() => {
    if (isOpen && token) {
      loadInstructions();
    }
  }, [isOpen, loanId, token]);

  const loadInstructions = async () => {
    try {
      setStep('loading');
      const data = await apiService.getCollateralInstructions(token!, loanId);
      setInstructions(data);
      setStep('ready');
    } catch (error: any) {
      toast.error(error.message);
      onClose();
    }
  };

  const handleDeposit = async () => {
    if (!instructions) return;

    try {
      setStep('depositing');
      setLoading(true);

      // Deposit collateral via blockchain service
      const result = await blockchainService.depositCollateral(
        loanId,
        instructions.collateral_token,
        instructions.collateral_amount.toString()
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to deposit collateral');
      }

      setTxHash(result.txHash || '');
      setStep('confirming');

      // Confirm with backend
      await apiService.confirmCollateralDeposit(token!, loanId);

      setStep('success');
      toast.success('Collateral deposited successfully!');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to deposit collateral:', error);
      toast.error(error.message || 'Failed to deposit collateral');
      setStep('ready');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Deposit Collateral</DialogTitle>
          <DialogDescription>
            Lock your collateral to secure the loan
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
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Collateral Details:</p>
                    <div className="text-sm space-y-1">
                      <p>Amount: {instructions.collateral_amount} tokens</p>
                      <p>Token: {instructions.collateral_token}</p>
                      <p>Contract: {instructions.instructions.contract_address}</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Steps:</p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  {instructions.instructions.instructions.map((instruction: string, index: number) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ol>
              </div>

              <Button onClick={handleDeposit} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Depositing...
                  </>
                ) : (
                  'Deposit Collateral'
                )}
              </Button>
            </>
          )}

          {step === 'depositing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing transaction...</p>
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
              <p className="font-medium">Collateral Deposited!</p>
              <p className="text-sm text-muted-foreground text-center">
                Your collateral has been locked. The lender can now fund the loan.
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

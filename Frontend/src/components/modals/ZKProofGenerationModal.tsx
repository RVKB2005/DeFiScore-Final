/**
 * ZK Proof Generation Modal
 * Handles complete client-side proof generation and blockchain submission
 * 
 * Flow:
 * 1. Fetch witness data from backend
 * 2. Generate proof in Web Worker (browser-side)
 * 3. Submit proof to DeFiScoreRegistry contract
 * 4. Verify on-chain eligibility
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Shield, Zap } from 'lucide-react';
import { zkProofService, type WitnessData } from '@/services/zkProofService';
import { apiService } from '@/services/apiService';
import { toast } from 'sonner';

interface ZKProofGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  threshold: number;
  token: string;
  onSuccess?: (txHash: string) => void;
}

type Stage = 'idle' | 'fetching' | 'generating' | 'submitting' | 'success' | 'error';

export function ZKProofGenerationModal({
  isOpen,
  onClose,
  threshold,
  token,
  onSuccess
}: ZKProofGenerationModalProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && stage === 'idle') {
      startProofGeneration();
    }
  }, [isOpen]);

  const startProofGeneration = async () => {
    try {
      setError(null);
      
      // Stage 1: Fetch witness data from backend
      setStage('fetching');
      setStatusMessage('Fetching witness data from backend...');
      setProgress(10);

      const witnessResponse = await apiService.generateZKProof(threshold, token);
      
      if (!witnessResponse.success) {
        throw new Error(witnessResponse.error || 'Failed to fetch witness data');
      }

      const witnessData: WitnessData = witnessResponse.data;
      
      setProgress(20);
      setStatusMessage('Witness data received. Starting proof generation...');

      // Stage 2: Generate proof client-side
      setStage('generating');
      setStatusMessage('Generating ZK proof in browser (this may take 10-30 seconds)...');

      const proofData = await zkProofService.generateProof(
        witnessData,
        (progressStage, progressPercent) => {
          setStatusMessage(progressStage);
          setProgress(20 + (progressPercent * 0.6)); // 20-80%
        }
      );

      setProgress(80);
      setStatusMessage('Proof generated successfully! Preparing blockchain submission...');

      // Stage 3: Submit to blockchain
      setStage('submitting');
      setStatusMessage('Submitting proof to DeFiScoreRegistry contract...');
      setProgress(85);

      const submitResult = await zkProofService.submitProofToBlockchain(proofData);

      if (!submitResult.success) {
        throw new Error(submitResult.error || 'Failed to submit proof to blockchain');
      }

      setProgress(100);
      setTxHash(submitResult.txHash || null);
      setStage('success');
      setStatusMessage('Proof verified and registered on-chain!');

      if (onSuccess && submitResult.txHash) {
        onSuccess(submitResult.txHash);
      }

      toast.success('ZK proof successfully generated and verified!');
    } catch (err: any) {
      console.error('Proof generation failed:', err);
      setError(err.message || 'Unknown error occurred');
      setStage('error');
      setStatusMessage('Proof generation failed');
      toast.error('Failed to generate ZK proof');
    }
  };

  const handleClose = () => {
    if (stage === 'generating') {
      toast.error('Cannot close while generating proof');
      return;
    }
    
    zkProofService.cleanup();
    setStage('idle');
    setProgress(0);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
    onClose();
  };

  const handleRetry = () => {
    setStage('idle');
    setProgress(0);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
    startProofGeneration();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Zero-Knowledge Proof Generation
          </DialogTitle>
          <DialogDescription>
            Generating cryptographic proof of your credit score without revealing private data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Status Message */}
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            {stage === 'generating' && (
              <Loader2 className="h-5 w-5 animate-spin text-primary mt-0.5" />
            )}
            {stage === 'success' && (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            )}
            {stage === 'error' && (
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            )}
            {(stage === 'fetching' || stage === 'submitting') && (
              <Zap className="h-5 w-5 text-primary mt-0.5" />
            )}
            
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{statusMessage}</p>
              {stage === 'generating' && (
                <p className="text-xs text-muted-foreground">
                  Your browser is computing the proof locally. Private data never leaves your device.
                </p>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Info */}
          {stage === 'success' && txHash && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Proof successfully verified on-chain!</p>
                  <p className="text-xs text-muted-foreground">
                    Transaction: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your eligibility is now registered and valid for 24 hours.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Stage Indicators */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className={`p-2 rounded text-center ${
              stage === 'fetching' || stage === 'generating' || stage === 'submitting' || stage === 'success'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}>
              1. Fetch Data
            </div>
            <div className={`p-2 rounded text-center ${
              stage === 'generating' || stage === 'submitting' || stage === 'success'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}>
              2. Generate Proof
            </div>
            <div className={`p-2 rounded text-center ${
              stage === 'submitting' || stage === 'success'
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}>
              3. Submit On-Chain
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex gap-2">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-xs text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">Zero-Knowledge Privacy</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Your wallet data and transaction history remain private. Only the proof that you meet the threshold is revealed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {stage === 'error' && (
            <Button onClick={handleRetry} variant="outline">
              Retry
            </Button>
          )}
          <Button
            onClick={handleClose}
            variant={stage === 'success' ? 'default' : 'outline'}
            disabled={stage === 'generating' || stage === 'submitting'}
          >
            {stage === 'success' ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

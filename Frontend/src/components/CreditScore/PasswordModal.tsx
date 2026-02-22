import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/modals/Modal';
import { useWallet } from '@/hooks/useWallet';
import { walletConnector } from '@/services/walletConnector';
import { toast } from 'sonner';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (signature: string) => void;
}

export function PasswordModal({ isOpen, onClose, onUnlock }: PasswordModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useWallet();

  const handleSignature = async () => {
    setIsLoading(true);

    try {
      // Get the saved wallet type to use the correct wallet
      const savedWalletType = localStorage.getItem('defi_wallet_type') as 'metamask' | 'coinbase' | null;
      
      if (!savedWalletType) {
        throw new Error('Wallet type not found. Please reconnect your wallet.');
      }

      // Create a message to sign
      const message = `I authorize viewing my DeFi credit score.\n\nWallet: ${address}\nTimestamp: ${new Date().toISOString()}\n\nThis signature proves I own this wallet and authorizes decryption of my credit score data.`;

      // Request signature from the CORRECT wallet (MetaMask or Coinbase)
      toast.loading('Please sign the message in your wallet...', { id: 'signature' });
      
      let connection;
      if (savedWalletType === 'metamask') {
        connection = await walletConnector.connectMetaMask();
      } else if (savedWalletType === 'coinbase') {
        connection = await walletConnector.connectCoinbase();
      } else {
        throw new Error('Unsupported wallet type');
      }

      const signature = await walletConnector.signMessage(connection.signer, message);

      toast.success('Signature verified!', { id: 'signature' });
      
      // Pass signature to parent component
      onUnlock(signature);
      onClose();
    } catch (error: any) {
      console.error('Signature error:', error);
      
      if (error.message.includes('User rejected') || error.code === 4001 || error.code === 'ACTION_REJECTED') {
        toast.error('Signature cancelled', { id: 'signature' });
      } else {
        toast.error('Failed to sign message: ' + error.message, { id: 'signature' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="text-center space-y-6">
        {/* Shield Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center"
        >
          <Shield className="w-8 h-8 text-primary" />
        </motion.div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Verify Wallet Ownership
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign a message with your wallet to prove ownership and decrypt your credit score. This is free and doesn't require any gas fees.
          </p>
        </div>

        {/* Wallet Info */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Wallet Address
          </p>
          <p className="text-sm font-mono text-foreground break-all">
            {address}
          </p>
        </div>

        {/* Security Info */}
        <div className="space-y-3 text-left">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <div className="w-1 h-1 rounded-full bg-success mt-1.5" />
            <p>Signing proves you own this wallet without exposing your private key</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <div className="w-1 h-1 rounded-full bg-success mt-1.5" />
            <p>No transaction or gas fees required</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <div className="w-1 h-1 rounded-full bg-success mt-1.5" />
            <p>Your credit score is encrypted and only viewable by you</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <div className="w-1 h-1 rounded-full bg-success mt-1.5" />
            <p>Rate limited to prevent unauthorized access attempts</p>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleSignature}
          variant="glow"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Waiting for signature...
            </>
          ) : (
            <>
              <Shield className="w-5 h-5 mr-2" />
              Sign Message to View Score
            </>
          )}
        </Button>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2 border-t">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Secure Cryptographic Verification
        </div>
      </div>
    </Modal>
  );
}

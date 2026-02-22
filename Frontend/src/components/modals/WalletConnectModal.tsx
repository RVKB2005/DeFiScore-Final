import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, ChevronRight, Check, Loader2, QrCode, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/useWallet';
import { cn } from '@/lib/utils';
import type { WalletType } from '@/services/walletConnector';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const wallets = [
  { 
    id: 'metamask' as WalletType, 
    name: 'MetaMask', 
    icon: '🦊', 
    popular: true,
    description: 'Browser extension wallet'
  },
  { 
    id: 'coinbase' as WalletType, 
    name: 'Coinbase Wallet', 
    icon: '🔵', 
    popular: true,
    description: 'Browser & mobile wallet'
  },
  { 
    id: 'other' as WalletType, 
    name: 'Other Wallets', 
    icon: <QrCode className="w-6 h-6" />, 
    popular: true,
    description: 'Scan QR code to connect'
  },
];

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { connect, isAuthenticating, address } = useWallet();
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  const handleConnect = async (walletId: WalletType) => {
    if (walletId === 'other') {
      setShowQR(true);
      return;
    }

    setConnectingWallet(walletId);
    try {
      await connect(walletId);
      // Close modal on successful connection
      setTimeout(() => {
        onClose();
        setConnectingWallet(null);
      }, 500);
    } catch (error) {
      setConnectingWallet(null);
    }
  };

  // Generate WalletConnect URI for QR code
  const walletConnectURI = `wc:${address || '0x0000000000000000000000000000000000000000'}@2?relay-protocol=irn&symKey=${Math.random().toString(36).substring(2, 15)}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={showQR ? "Scan QR Code" : "Connect Wallet"} size="md">
      <div className="space-y-4">
        {showQR ? (
          // QR Code View
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code with your mobile wallet app to connect
            </p>
            <div className="flex justify-center p-6 bg-white rounded-xl">
              <QRCodeSVG 
                value={walletConnectURI}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowQR(false)}
            >
              Back to Wallet Options
            </Button>
          </div>
        ) : (
          // Wallet Selection View
          <>
            <p className="text-sm text-muted-foreground">
              Connect your wallet to access DeFi lending features. Your wallet will be used for secure authentication.
            </p>

            {/* Available wallets */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Available Wallets
              </p>
              <div className="grid gap-2">
                {wallets.map((wallet, index) => (
                  <motion.button
                    key={wallet.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleConnect(wallet.id)}
                    disabled={isAuthenticating}
                    className={cn(
                      'flex items-center gap-3 w-full p-4 rounded-xl border transition-all duration-200',
                      connectingWallet === wallet.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/50',
                      isAuthenticating && connectingWallet !== wallet.id && 'opacity-50'
                    )}
                  >
                    {typeof wallet.icon === 'string' ? (
                      <span className="text-2xl">{wallet.icon}</span>
                    ) : (
                      <div className="text-muted-foreground">{wallet.icon}</div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{wallet.name}</div>
                      <div className="text-xs text-muted-foreground">{wallet.description}</div>
                    </div>
                    {connectingWallet === wallet.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Don't have a wallet link */}
            <div className="pt-2 text-center">
              <a
                href="https://ethereum.org/wallets/find-wallet/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                I don't have a wallet
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="pt-4 space-y-3">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5" />
                <p>You'll be asked to sign a message to verify wallet ownership</p>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5" />
                <p>No transaction or gas fees required for authentication</p>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5" />
                <p>Your private keys never leave your wallet</p>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground pt-2 border-t">
              By connecting, you agree to our Terms of Service and Privacy Policy
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

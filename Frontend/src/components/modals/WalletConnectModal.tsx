import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, ChevronRight, Check, Loader2, QrCode } from 'lucide-react';
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
    id: 'walletconnect' as WalletType, 
    name: 'WalletConnect', 
    icon: '🔗', 
    popular: true,
    description: 'Scan QR with any wallet',
    comingSoon: true
  },
];

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { connect, isAuthenticating } = useWallet();
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const handleConnect = async (walletId: WalletType) => {
    if (wallets.find(w => w.id === walletId)?.comingSoon) {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Wallet" size="md">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to access DeFi lending features. Your wallet will be used for secure authentication.
        </p>

        {/* Popular wallets */}
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
                disabled={isAuthenticating || wallet.comingSoon}
                className={cn(
                  'flex items-center gap-3 w-full p-4 rounded-xl border transition-all duration-200',
                  wallet.comingSoon && 'opacity-50 cursor-not-allowed',
                  connectingWallet === wallet.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/50',
                  isAuthenticating && connectingWallet !== wallet.id && 'opacity-50'
                )}
              >
                <span className="text-2xl">{wallet.icon}</span>
                <div className="flex-1 text-left">
                  <div className="font-medium flex items-center gap-2">
                    {wallet.name}
                    {wallet.comingSoon && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{wallet.description}</div>
                </div>
                {connectingWallet === wallet.id ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : wallet.id === 'walletconnect' ? (
                  <QrCode className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </motion.button>
            ))}
          </div>
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
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/modals/Modal';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: () => void;
}

// Sample password for testing: "demo123"
const SAMPLE_PASSWORD = 'demo123';

export function PasswordModal({ isOpen, onClose, onUnlock }: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate verification delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (password === SAMPLE_PASSWORD) {
      onUnlock();
      setPassword('');
      onClose();
    } else {
      setError('Invalid password. Please try again.');
    }
    setIsLoading(false);
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="text-center space-y-6">
        {/* Lock Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center"
        >
          <Lock className="w-8 h-8 text-primary" />
        </motion.div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Enter Your Private Password
          </h1>
          <p className="text-muted-foreground text-sm">
            Your credit score is encrypted on-chain. Provide your master password to decrypt and view your profile.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <label className="text-sm font-medium text-foreground">
              Private Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 bg-muted/30 border-border/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}
          </div>

          <Button
            type="submit"
            variant="glow"
            className="w-full"
            disabled={isLoading || !password}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              'Unlock Score'
            )}
          </Button>
        </form>

        {/* Footer Links */}
        <div className="space-y-3">
          <button className="text-primary text-sm hover:underline">
            Forgot your password?
          </button>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Secure End-to-End Encryption
          </div>
        </div>
      </div>
    </Modal>
  );
}

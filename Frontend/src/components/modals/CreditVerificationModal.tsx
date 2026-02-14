import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Fingerprint, Loader2, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreditVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreditVerificationModal({
  isOpen,
  onClose,
  onSuccess,
}: CreditVerificationModalProps) {
  const [step, setStep] = useState<'input' | 'verifying' | 'success'>('input');
  const [code, setCode] = useState(['', '', '', '', '', '']);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-verify when complete
    if (newCode.every((c) => c) && newCode.join('').length === 6) {
      handleVerify();
    }
  };

  const handleVerify = async () => {
    setStep('verifying');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setStep('success');
    setTimeout(() => {
      onSuccess();
      onClose();
      setStep('input');
      setCode(['', '', '', '', '', '']);
    }, 1500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showClose={step === 'input'}>
      <div className="text-center space-y-6">
        {step === 'input' && (
          <>
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center"
            >
              <Shield className="w-10 h-10 text-primary" />
            </motion.div>

            <div>
              <h2 className="text-2xl font-bold">Credit Verification</h2>
              <p className="text-muted-foreground mt-2">
                Enter the 6-digit code sent to your registered device
              </p>
            </div>

            {/* Code Input */}
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <Input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  className="w-12 h-14 text-center text-2xl font-bold"
                />
              ))}
            </div>

            <Button variant="glow" onClick={handleVerify} className="w-full gap-2">
              <Lock className="w-4 h-4" />
              Verify Code
            </Button>

            <p className="text-sm text-muted-foreground">
              Didn't receive a code?{' '}
              <button className="text-primary hover:underline">Resend</button>
            </p>
          </>
        )}

        {step === 'verifying' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 space-y-4"
          >
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
            <h2 className="text-xl font-semibold">Verifying...</h2>
            <p className="text-muted-foreground">
              Please wait while we verify your identity
            </p>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-8 space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="w-20 h-20 mx-auto rounded-full bg-success/20 flex items-center justify-center"
            >
              <CheckCircle className="w-10 h-10 text-success" />
            </motion.div>
            <h2 className="text-xl font-semibold">Verified Successfully!</h2>
            <p className="text-muted-foreground">
              Your identity has been confirmed
            </p>
          </motion.div>
        )}
      </div>
    </Modal>
  );
}

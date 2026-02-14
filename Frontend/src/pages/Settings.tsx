import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sun, Moon, HelpCircle, MessageCircle, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Customize your experience
        </p>
      </div>

      {/* Appearance Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Choose your preferred theme
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Light Mode */}
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'flex flex-col items-center gap-3 p-4 sm:p-6 rounded-xl border-2 transition-all duration-200',
              theme === 'light'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            )}
          >
            <div className={cn(
              'w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center',
              theme === 'light' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              <Sun className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span className={cn(
              'font-medium text-sm sm:text-base',
              theme === 'light' ? 'text-primary' : 'text-muted-foreground'
            )}>
              Light Mode
            </span>
          </button>

          {/* Dark Mode */}
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'flex flex-col items-center gap-3 p-4 sm:p-6 rounded-xl border-2 transition-all duration-200',
              theme === 'dark'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            )}
          >
            <div className={cn(
              'w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center',
              theme === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              <Moon className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span className={cn(
              'font-medium text-sm sm:text-base',
              theme === 'dark' ? 'text-primary' : 'text-muted-foreground'
            )}>
              Dark Mode
            </span>
          </button>
        </div>
      </motion.div>

      {/* Support Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-4 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-foreground">Support</h2>
        <p className="text-sm text-muted-foreground">
          Get help and learn more about DefiScore
        </p>

        <div className="space-y-3">
          {/* FAQ Button */}
          <Button
            variant="outline"
            className="w-full justify-between h-auto py-4 px-4"
            onClick={() => navigate('/faq')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">FAQ</p>
                <p className="text-xs text-muted-foreground">Frequently asked questions</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Button>

          {/* Help Center */}
          <Button
            variant="outline"
            className="w-full justify-between h-auto py-4 px-4"
            onClick={() => window.open('https://docs.defiscore.com', '_blank')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-secondary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Help Center</p>
                <p className="text-xs text-muted-foreground">Browse documentation</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Button>

          {/* Contact Support */}
          <Button
            variant="outline"
            className="w-full justify-between h-auto py-4 px-4"
            onClick={() => window.open('mailto:support@defiscore.com', '_blank')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-success" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Contact Support</p>
                <p className="text-xs text-muted-foreground">Get in touch with us</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </motion.div>

      {/* App Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center text-sm text-muted-foreground py-4"
      >
        <p>DefiScore v1.0.0</p>
        <p className="mt-1">© 2024 DefiScore. All rights reserved.</p>
      </motion.div>
    </div>
  );
}

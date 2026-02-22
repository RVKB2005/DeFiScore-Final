import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, Wallet, Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/hooks/useWallet';
import { formatAddress } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onMenuClick: () => void;
  onWalletClick: () => void;
  isMobileMenuOpen?: boolean;
}

export function Navbar({ onMenuClick, onWalletClick, isMobileMenuOpen }: NavbarProps) {
  const { isConnected, user, disconnect } = useWallet();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>

          {/* Search */}
          <div className="hidden md:flex items-center relative">
            <motion.div
              animate={{ width: isSearchFocused ? 320 : 240 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search assets, transactions..."
                className="pl-10 bg-muted/30 border-border/50"
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
            </motion.div>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </Button>

          {/* Wallet */}
          {isConnected && user ? (
            <div className="relative">
              <Button
                variant="glass"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold">
                  {user.username?.[0]?.toUpperCase() || 'W'}
                </div>
                <span className="hidden sm:inline font-mono text-sm">
                  {formatAddress(user.address)}
                </span>
                <ChevronDown className="w-4 h-4" />
              </Button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-48 glass-card border border-border rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        disconnect();
                        setShowUserMenu(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Button variant="default" onClick={onWalletClick} className="gap-2">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Connect Wallet</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

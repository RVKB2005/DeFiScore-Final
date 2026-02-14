import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  CreditCard,
  HelpCircle,
  Shield,
  History,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MobileNavProps {
  onClose: () => void;
}

const navItems = [
  { label: 'Dashboard', href: '/user', icon: LayoutDashboard },
  { label: 'Market', href: '/', icon: TrendingUp },
  { label: 'Supply', href: '/supply', icon: Wallet },
  { label: 'Borrow', href: '/borrow', icon: CreditCard },
  { label: 'Credit Score', href: '/score', icon: Shield },
  { label: 'FAQ', href: '/faq', icon: HelpCircle },
];

const bottomNavItems = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function MobileNav({ onClose }: MobileNavProps) {
  const location = useLocation();

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
      />

      {/* Drawer */}
      <motion.nav
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed left-0 top-0 z-50 h-screen w-72 bg-sidebar border-r border-sidebar-border flex flex-col lg:hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">D</span>
            </div>
            <span className="font-bold text-xl text-foreground">DefiScore</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-6 px-3 overflow-y-auto custom-scrollbar">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));

              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <item.icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Divider */}
          <div className="my-6 border-t border-sidebar-border" />

          {/* History section */}
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
            History
          </h3>
          <ul className="space-y-1">
            <li>
              <Link
                to="/borrow/history"
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                  location.pathname === '/borrow/history'
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <History className="w-5 h-5" />
                <span className="font-medium">Borrow History</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Bottom actions */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </motion.nav>
    </>
  );
}

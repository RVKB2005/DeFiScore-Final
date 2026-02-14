// Asset Types
export interface Asset {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  circulatingSupply: number;
  totalSupply: number;
  sparklineData: number[];
  apy?: number;
  supplyApy?: number;
  borrowApy?: number;
}

export interface WalletAsset {
  asset: Asset;
  balance: number;
  value: number;
  percentage: number;
}

// User Types
export interface User {
  id: string;
  address: string;
  avatar?: string;
  username?: string;
  creditScore: number;
  totalBalance: number;
  totalSupply: number;
  totalBorrow: number;
  netApy: number;
  healthFactor: number;
  joinedAt: string;
}

// Borrow Types
export interface BorrowRequest {
  id: string;
  asset: Asset;
  amount: number;
  collateral: Asset;
  collateralAmount: number;
  interestRate: number;
  duration: number;
  status: 'pending' | 'active' | 'completed' | 'rejected' | 'liquidated';
  createdAt: string;
  dueDate?: string;
  healthFactor: number;
  ltv: number;
}

export interface LoanOffer {
  id: string;
  asset: Asset;
  maxAmount: number;
  minAmount: number;
  interestRate: number;
  duration: number;
  ltv: number;
  collateralTypes: Asset[];
}

// Supply Types
export interface SupplyPosition {
  id: string;
  asset: Asset;
  amount: number;
  value: number;
  apy: number;
  earnings: number;
  startDate: string;
}

// Credit Score Types
export interface CreditScoreHistory {
  date: string;
  score: number;
}

export interface CreditFactor {
  name: string;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  description: string;
}

// Chart Types
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface PriceDataPoint {
  time: string;
  price: number;
  volume?: number;
}

// Transaction Types
export interface Transaction {
  id: string;
  type: 'supply' | 'borrow' | 'repay' | 'withdraw' | 'liquidation';
  asset: Asset;
  amount: number;
  value: number;
  status: 'pending' | 'completed' | 'failed';
  hash: string;
  timestamp: string;
}

// Market Types
export interface MarketStats {
  totalMarketCap: number;
  totalVolume24h: number;
  totalValueLocked: number;
  totalSupply: number;
  totalBorrow: number;
  dominance: {
    symbol: string;
    percentage: number;
  };
}

// FAQ Types
export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

// Navigation Types
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  children?: NavItem[];
}

// Modal Types
export type ModalType = 
  | 'wallet-connect'
  | 'borrow-success'
  | 'borrow-rejected'
  | 'credit-verification'
  | 'loading'
  | 'confirm-transaction'
  | null;

// Table Types
export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Form Types
export interface BorrowFormData {
  asset: string;
  amount: number;
  collateralAsset: string;
  collateralAmount: number;
  duration: number;
}

export interface SupplyFormData {
  asset: string;
  amount: number;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

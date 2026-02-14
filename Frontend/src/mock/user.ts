import type { User, WalletAsset, CreditScoreHistory, CreditFactor, Notification } from '@/types';
import { mockAssets } from './assets';

export const mockUser: User = {
  id: '1',
  address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  username: 'cryptowhale.eth',
  avatar: undefined,
  creditScore: 742,
  totalBalance: 125430.50,
  totalSupply: 85000.00,
  totalBorrow: 32500.00,
  netApy: 4.8,
  healthFactor: 2.45,
  joinedAt: '2023-06-15T10:30:00Z',
};

export const mockWalletAssets: WalletAsset[] = [
  {
    asset: mockAssets[0], // BTC
    balance: 1.25,
    value: 84290.63,
    percentage: 45.2,
  },
  {
    asset: mockAssets[1], // ETH
    balance: 8.5,
    value: 29935.30,
    percentage: 25.8,
  },
  {
    asset: mockAssets[2], // USDC
    balance: 15000,
    value: 15000.00,
    percentage: 12.5,
  },
  {
    asset: mockAssets[4], // SOL
    balance: 45.2,
    value: 8065.94,
    percentage: 8.2,
  },
  {
    asset: mockAssets[7], // LINK
    balance: 250,
    value: 4687.50,
    percentage: 5.1,
  },
];

export const mockCreditScoreHistory: CreditScoreHistory[] = [
  { date: '2024-01-01', score: 680 },
  { date: '2024-01-15', score: 692 },
  { date: '2024-02-01', score: 705 },
  { date: '2024-02-15', score: 698 },
  { date: '2024-03-01', score: 715 },
  { date: '2024-03-15', score: 722 },
  { date: '2024-04-01', score: 730 },
  { date: '2024-04-15', score: 735 },
  { date: '2024-05-01', score: 742 },
];

export const mockCreditFactors: CreditFactor[] = [
  {
    name: 'Payment History',
    score: 185,
    maxScore: 200,
    status: 'excellent',
    description: 'On-time repayments for all loans',
  },
  {
    name: 'Credit Utilization',
    score: 145,
    maxScore: 175,
    status: 'good',
    description: 'Using 38% of available credit',
  },
  {
    name: 'Credit Age',
    score: 120,
    maxScore: 150,
    status: 'good',
    description: 'Average account age: 14 months',
  },
  {
    name: 'Account Mix',
    score: 85,
    maxScore: 100,
    status: 'excellent',
    description: 'Diverse lending activities',
  },
  {
    name: 'Hard Inquiries',
    score: 55,
    maxScore: 75,
    status: 'fair',
    description: '3 inquiries in the last 6 months',
  },
];

export const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'success',
    title: 'Loan Approved',
    message: 'Your loan request for 5,000 USDC has been approved.',
    timestamp: '2024-05-15T14:30:00Z',
    read: false,
  },
  {
    id: '2',
    type: 'warning',
    title: 'Health Factor Alert',
    message: 'Your health factor is approaching the liquidation threshold.',
    timestamp: '2024-05-14T09:15:00Z',
    read: false,
  },
  {
    id: '3',
    type: 'info',
    title: 'New APY Rates',
    message: 'Supply APY for ETH has increased to 4.5%.',
    timestamp: '2024-05-13T16:45:00Z',
    read: true,
  },
  {
    id: '4',
    type: 'success',
    title: 'Interest Earned',
    message: 'You earned $125.50 in interest this month.',
    timestamp: '2024-05-12T08:00:00Z',
    read: true,
  },
];

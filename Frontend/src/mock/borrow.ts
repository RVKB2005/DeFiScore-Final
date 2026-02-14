import type { BorrowRequest, LoanOffer } from '@/types';
import { mockAssets } from './assets';

export const mockBorrowRequests: BorrowRequest[] = [
  {
    id: '1',
    asset: mockAssets[2], // USDC
    amount: 5000,
    collateral: mockAssets[1], // ETH
    collateralAmount: 2.5,
    interestRate: 8.5,
    duration: 30,
    status: 'active',
    createdAt: '2024-04-15T10:30:00Z',
    dueDate: '2024-05-15T10:30:00Z',
    healthFactor: 2.45,
    ltv: 65,
  },
  {
    id: '2',
    asset: mockAssets[3], // USDT
    amount: 10000,
    collateral: mockAssets[0], // BTC
    collateralAmount: 0.25,
    interestRate: 7.8,
    duration: 60,
    status: 'active',
    createdAt: '2024-03-20T14:15:00Z',
    dueDate: '2024-05-20T14:15:00Z',
    healthFactor: 3.12,
    ltv: 55,
  },
  {
    id: '3',
    asset: mockAssets[2], // USDC
    amount: 3000,
    collateral: mockAssets[4], // SOL
    collateralAmount: 35,
    interestRate: 9.2,
    duration: 14,
    status: 'completed',
    createdAt: '2024-02-01T09:00:00Z',
    dueDate: '2024-02-15T09:00:00Z',
    healthFactor: 2.8,
    ltv: 60,
  },
  {
    id: '4',
    asset: mockAssets[3], // USDT
    amount: 2500,
    collateral: mockAssets[1], // ETH
    collateralAmount: 1.2,
    interestRate: 8.0,
    duration: 30,
    status: 'rejected',
    createdAt: '2024-01-28T11:45:00Z',
    healthFactor: 1.2,
    ltv: 80,
  },
  {
    id: '5',
    asset: mockAssets[2], // USDC
    amount: 15000,
    collateral: mockAssets[0], // BTC
    collateralAmount: 0.5,
    interestRate: 7.5,
    duration: 90,
    status: 'pending',
    createdAt: '2024-05-14T16:20:00Z',
    healthFactor: 2.65,
    ltv: 58,
  },
];

export const mockLoanOffers: LoanOffer[] = [
  {
    id: '1',
    asset: mockAssets[2], // USDC
    maxAmount: 50000,
    minAmount: 100,
    interestRate: 8.5,
    duration: 30,
    ltv: 75,
    collateralTypes: [mockAssets[0], mockAssets[1], mockAssets[4]],
  },
  {
    id: '2',
    asset: mockAssets[3], // USDT
    maxAmount: 100000,
    minAmount: 500,
    interestRate: 7.8,
    duration: 60,
    ltv: 70,
    collateralTypes: [mockAssets[0], mockAssets[1]],
  },
  {
    id: '3',
    asset: mockAssets[1], // ETH
    maxAmount: 25,
    minAmount: 0.1,
    interestRate: 6.2,
    duration: 90,
    ltv: 65,
    collateralTypes: [mockAssets[0], mockAssets[2], mockAssets[3]],
  },
  {
    id: '4',
    asset: mockAssets[0], // BTC
    maxAmount: 2,
    minAmount: 0.01,
    interestRate: 5.8,
    duration: 120,
    ltv: 60,
    collateralTypes: [mockAssets[1], mockAssets[2], mockAssets[3]],
  },
];

export const getBorrowRequestById = (id: string): BorrowRequest | undefined => {
  return mockBorrowRequests.find(request => request.id === id);
};

export const getLoanOfferById = (id: string): LoanOffer | undefined => {
  return mockLoanOffers.find(offer => offer.id === id);
};

export const getActiveBorrowRequests = (): BorrowRequest[] => {
  return mockBorrowRequests.filter(request => request.status === 'active');
};

export const getPendingBorrowRequests = (): BorrowRequest[] => {
  return mockBorrowRequests.filter(request => request.status === 'pending');
};

import type { SupplyPosition, Transaction } from '@/types';
import { mockAssets } from './assets';

export const mockSupplyPositions: SupplyPosition[] = [
  {
    id: '1',
    asset: mockAssets[1], // ETH
    amount: 5.5,
    value: 19369.90,
    apy: 4.5,
    earnings: 245.30,
    startDate: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    asset: mockAssets[2], // USDC
    amount: 25000,
    value: 25000.00,
    apy: 8.5,
    earnings: 850.00,
    startDate: '2024-02-01T14:30:00Z',
  },
  {
    id: '3',
    asset: mockAssets[0], // BTC
    amount: 0.45,
    value: 30344.63,
    apy: 3.2,
    earnings: 320.50,
    startDate: '2024-03-10T09:15:00Z',
  },
  {
    id: '4',
    asset: mockAssets[4], // SOL
    amount: 85,
    value: 15168.25,
    apy: 5.8,
    earnings: 185.40,
    startDate: '2024-04-05T16:45:00Z',
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'supply',
    asset: mockAssets[1],
    amount: 2.5,
    value: 8804.50,
    status: 'completed',
    hash: '0x1234...5678',
    timestamp: '2024-05-14T14:30:00Z',
  },
  {
    id: '2',
    type: 'borrow',
    asset: mockAssets[2],
    amount: 5000,
    value: 5000.00,
    status: 'completed',
    hash: '0xabcd...efgh',
    timestamp: '2024-05-13T10:15:00Z',
  },
  {
    id: '3',
    type: 'repay',
    asset: mockAssets[3],
    amount: 2500,
    value: 2500.00,
    status: 'completed',
    hash: '0x9876...5432',
    timestamp: '2024-05-12T16:45:00Z',
  },
  {
    id: '4',
    type: 'withdraw',
    asset: mockAssets[0],
    amount: 0.15,
    value: 10114.88,
    status: 'completed',
    hash: '0xfedc...ba98',
    timestamp: '2024-05-11T09:00:00Z',
  },
  {
    id: '5',
    type: 'supply',
    asset: mockAssets[4],
    amount: 25,
    value: 4461.25,
    status: 'pending',
    hash: '0x4567...89ab',
    timestamp: '2024-05-15T11:30:00Z',
  },
];

export const getTotalSupplyValue = (): number => {
  return mockSupplyPositions.reduce((total, position) => total + position.value, 0);
};

export const getTotalEarnings = (): number => {
  return mockSupplyPositions.reduce((total, position) => total + position.earnings, 0);
};

export const getAverageApy = (): number => {
  const totalValue = getTotalSupplyValue();
  const weightedApy = mockSupplyPositions.reduce(
    (total, position) => total + (position.apy * position.value) / totalValue,
    0
  );
  return weightedApy;
};

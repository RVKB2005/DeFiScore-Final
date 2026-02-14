import type { MarketStats, ChartDataPoint, PriceDataPoint, FAQItem } from '@/types';

export const mockMarketStats: MarketStats = {
  totalMarketCap: 2450000000000,
  totalVolume24h: 125000000000,
  totalValueLocked: 85000000000,
  totalSupply: 42000000000,
  totalBorrow: 28000000000,
  dominance: {
    symbol: 'BTC',
    percentage: 52.4,
  },
};

export const mockMarketChartData: ChartDataPoint[] = [
  { date: '2024-01-01', value: 1850000000000 },
  { date: '2024-01-15', value: 1920000000000 },
  { date: '2024-02-01', value: 2050000000000 },
  { date: '2024-02-15', value: 1980000000000 },
  { date: '2024-03-01', value: 2150000000000 },
  { date: '2024-03-15', value: 2280000000000 },
  { date: '2024-04-01', value: 2180000000000 },
  { date: '2024-04-15', value: 2320000000000 },
  { date: '2024-05-01', value: 2450000000000 },
];

export const mockTVLChartData: ChartDataPoint[] = [
  { date: '2024-01-01', value: 65000000000 },
  { date: '2024-01-15', value: 68000000000 },
  { date: '2024-02-01', value: 72000000000 },
  { date: '2024-02-15', value: 70000000000 },
  { date: '2024-03-01', value: 75000000000 },
  { date: '2024-03-15', value: 78000000000 },
  { date: '2024-04-01', value: 80000000000 },
  { date: '2024-04-15', value: 82000000000 },
  { date: '2024-05-01', value: 85000000000 },
];

export const generatePriceHistory = (basePrice: number, volatility: number = 0.02): PriceDataPoint[] => {
  const data: PriceDataPoint[] = [];
  let currentPrice = basePrice * 0.9;
  
  for (let i = 0; i < 168; i++) { // 7 days of hourly data
    const change = (Math.random() - 0.5) * 2 * volatility;
    currentPrice = currentPrice * (1 + change);
    
    const date = new Date();
    date.setHours(date.getHours() - (168 - i));
    
    data.push({
      time: date.toISOString(),
      price: currentPrice,
      volume: Math.random() * 1000000000,
    });
  }
  
  return data;
};

export const mockFAQItems: FAQItem[] = [
  {
    id: '1',
    question: 'What is DeFi lending?',
    answer: 'DeFi lending allows users to lend or borrow cryptocurrency assets without traditional intermediaries. Lenders earn interest on their deposits while borrowers can access liquidity by providing collateral.',
    category: 'General',
  },
  {
    id: '2',
    question: 'How does collateralization work?',
    answer: 'When borrowing, you must deposit collateral worth more than your loan (over-collateralization). The Loan-to-Value (LTV) ratio determines how much you can borrow against your collateral. If your collateral value drops below the threshold, it may be liquidated.',
    category: 'Borrowing',
  },
  {
    id: '3',
    question: 'What is a Health Factor?',
    answer: 'Health Factor is a numeric representation of the safety of your loan position. A Health Factor above 1 means your position is safe. If it drops below 1, your collateral may be liquidated to repay the loan.',
    category: 'Borrowing',
  },
  {
    id: '4',
    question: 'How are interest rates determined?',
    answer: 'Interest rates are algorithmically determined based on supply and demand. When more assets are borrowed, rates increase. When more assets are supplied, rates may decrease.',
    category: 'Rates',
  },
  {
    id: '5',
    question: 'What is the Credit Score?',
    answer: 'Your DeFi Credit Score reflects your lending and borrowing history on the platform. A higher score unlocks better rates, higher borrowing limits, and exclusive loan offers.',
    category: 'Credit',
  },
  {
    id: '6',
    question: 'How can I improve my Credit Score?',
    answer: 'Improve your score by: making timely repayments, maintaining healthy LTV ratios, keeping accounts in good standing, diversifying your lending activities, and minimizing hard credit inquiries.',
    category: 'Credit',
  },
  {
    id: '7',
    question: 'What happens during liquidation?',
    answer: 'If your Health Factor drops below 1, your collateral will be automatically sold to repay your loan. A liquidation penalty (typically 5-10%) is applied. To avoid this, monitor your Health Factor and add collateral or repay loans as needed.',
    category: 'Borrowing',
  },
  {
    id: '8',
    question: 'Are my funds safe?',
    answer: 'Our smart contracts are audited by leading security firms. However, DeFi carries inherent risks including smart contract vulnerabilities and market volatility. Only invest what you can afford to lose.',
    category: 'Security',
  },
  {
    id: '9',
    question: 'What wallets are supported?',
    answer: 'We support major Web3 wallets including MetaMask, WalletConnect, Coinbase Wallet, Rainbow, and Trust Wallet. Hardware wallets like Ledger and Trezor can be connected via MetaMask.',
    category: 'Wallets',
  },
  {
    id: '10',
    question: 'How do I withdraw my earnings?',
    answer: 'Navigate to the Supply page, select the asset you want to withdraw, and click "Withdraw". Confirm the transaction in your wallet. Earnings are automatically included in your withdrawal.',
    category: 'Supply',
  },
];

export const getFAQsByCategory = (category: string): FAQItem[] => {
  return mockFAQItems.filter(item => item.category === category);
};

export const getAllFAQCategories = (): string[] => {
  return [...new Set(mockFAQItems.map(item => item.category))];
};

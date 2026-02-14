import { motion } from 'framer-motion';
import { History, Filter, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/tables/DataTable';
import { mockBorrowRequests } from '@/mock/borrow';
import { formatCurrency, formatPercent, formatDate, getStatusColor } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { TableColumn, BorrowRequest } from '@/types';

export default function BorrowHistory() {
  const columns: TableColumn<BorrowRequest>[] = [
    {
      key: 'asset',
      header: 'Asset',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            {item.asset.icon}
          </div>
          <div>
            <p className="font-medium">{item.asset.symbol}</p>
            <p className="text-xs text-muted-foreground">{item.amount.toLocaleString()}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'collateral',
      header: 'Collateral',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{item.collateral.icon}</span>
          <span>{item.collateralAmount} {item.collateral.symbol}</span>
        </div>
      ),
    },
    {
      key: 'interestRate',
      header: 'Interest',
      sortable: true,
      render: (item) => formatPercent(item.interestRate),
    },
    {
      key: 'healthFactor',
      header: 'Health',
      sortable: true,
      render: (item) => (
        <span className={cn('font-medium', item.healthFactor < 1.5 ? 'text-destructive' : 'text-success')}>
          {item.healthFactor.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <span className={cn('text-xs px-2 py-1 rounded-full border capitalize', getStatusColor(item.status))}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (item) => formatDate(item.createdAt, 'short'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6" />
            Borrow History
          </h1>
          <p className="text-muted-foreground">
            View all your past and current loan requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </motion.div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="stat">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Requests</p>
            <p className="text-2xl font-bold mt-1">{mockBorrowRequests.length}</p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active Loans</p>
            <p className="text-2xl font-bold mt-1 text-success">
              {mockBorrowRequests.filter(r => r.status === 'active').length}
            </p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {mockBorrowRequests.filter(r => r.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card variant="stat">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold mt-1 text-destructive">
              {mockBorrowRequests.filter(r => r.status === 'rejected').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <DataTable
        data={mockBorrowRequests as unknown as Record<string, unknown>[]}
        columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
        pageSize={10}
      />
    </div>
  );
}

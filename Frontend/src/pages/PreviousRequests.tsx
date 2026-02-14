import { useState } from 'react';
import { motion } from 'framer-motion';
import { History, MoreVertical, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { mockAssets } from '@/mock/assets';
import { BorrowSuccessModal } from '@/components/modals/BorrowSuccessModal';

type RequestStatus = 'approved' | 'pending' | 'rejected';
type FilterType = 'all' | 'approved' | 'pending' | 'rejected';

interface BorrowRequest {
  id: string;
  asset: typeof mockAssets[0];
  amount: number;
  supplier: string;
  interestRate: number;
  period: number;
  status: RequestStatus;
}

const mockRequests: BorrowRequest[] = [
  {
    id: '1',
    asset: mockAssets[0], // BTC
    amount: 2.45,
    supplier: '0x3f...e921',
    interestRate: 4.2,
    period: 60,
    status: 'approved',
  },
  {
    id: '2',
    asset: mockAssets[2], // USDC
    amount: 15000,
    supplier: '0x8a...42b0',
    interestRate: 3.8,
    period: 30,
    status: 'pending',
  },
  {
    id: '3',
    asset: mockAssets[1], // ETH
    amount: 10,
    supplier: '0x1d...f929',
    interestRate: 5.1,
    period: 14,
    status: 'rejected',
  },
  {
    id: '4',
    asset: mockAssets[4], // LINK
    amount: 5000,
    supplier: '0x92...c011',
    interestRate: 6.5,
    period: 180,
    status: 'approved',
  },
  {
    id: '5',
    asset: mockAssets[1], // ETH
    amount: 25,
    supplier: '0x5c...a123',
    interestRate: 4.8,
    period: 90,
    status: 'approved',
  },
  {
    id: '6',
    asset: mockAssets[2], // USDC
    amount: 8000,
    supplier: '0x7b...d456',
    interestRate: 3.5,
    period: 45,
    status: 'pending',
  },
  {
    id: '7',
    asset: mockAssets[0], // BTC
    amount: 1.2,
    supplier: '0x9e...f789',
    interestRate: 4.0,
    period: 30,
    status: 'rejected',
  },
  {
    id: '8',
    asset: mockAssets[3], // SOL
    amount: 150,
    supplier: '0x2d...b012',
    interestRate: 5.5,
    period: 60,
    status: 'approved',
  },
  {
    id: '9',
    asset: mockAssets[4], // LINK
    amount: 3000,
    supplier: '0x4f...c345',
    interestRate: 6.0,
    period: 120,
    status: 'pending',
  },
  {
    id: '10',
    asset: mockAssets[1], // ETH
    amount: 5,
    supplier: '0x6a...e678',
    interestRate: 4.5,
    period: 21,
    status: 'rejected',
  },
  {
    id: '11',
    asset: mockAssets[2], // USDC
    amount: 20000,
    supplier: '0x8c...g901',
    interestRate: 3.2,
    period: 90,
    status: 'approved',
  },
  {
    id: '12',
    asset: mockAssets[0], // BTC
    amount: 0.5,
    supplier: '0x1b...h234',
    interestRate: 4.4,
    period: 45,
    status: 'pending',
  },
];

const ITEMS_PER_PAGE = 4;

export default function PreviousRequests() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [borrowSuccessOpen, setBorrowSuccessOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);

  const handleConfirmBorrow = (request: BorrowRequest) => {
    setSelectedRequest(request);
    setBorrowSuccessOpen(true);
  };

  const filteredRequests = filter === 'all' 
    ? mockRequests 
    : mockRequests.filter(req => req.status === filter);

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const stats = {
    total: mockRequests.length,
    approved: mockRequests.filter(r => r.status === 'approved').length,
    pending: mockRequests.filter(r => r.status === 'pending').length,
  };

  const getStatusStyles = (status: RequestStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-success/20 text-success border-success/30';
      case 'pending':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'rejected':
        return 'bg-destructive/20 text-destructive border-destructive/30';
    }
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All History' },
    { key: 'approved', label: 'Approved' },
    { key: 'pending', label: 'Pending' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs sm:text-sm text-muted-foreground">
        Home / <span className="text-foreground">Borrow Requests</span>
      </div>

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl sm:text-2xl font-bold">Previous Borrow Requests</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Review and manage your pending asset loan applications.
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="glass" className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">Total Requests</p>
            <p className="text-xl sm:text-3xl font-bold text-foreground">{stats.total}</p>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="glass" className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">Approved</p>
            <p className="text-xl sm:text-3xl font-bold text-success">{stats.approved}</p>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card variant="glass" className="p-3 sm:p-5">
            <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">Pending</p>
            <p className="text-xl sm:text-3xl font-bold text-warning">{stats.pending}</p>
          </Card>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter(f.key);
              setCurrentPage(1);
            }}
            className={cn(
              'text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3',
              filter === f.key && 'bg-primary text-primary-foreground'
            )}
          >
            {f.label}
          </Button>
        ))}
        <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
          <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Button>
      </div>

      {/* Request Cards */}
      <div className="space-y-2 sm:space-y-3">
        {paginatedRequests.map((request, index) => (
          <motion.div
            key={request.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card variant="glass" className="p-3 sm:p-4">
              {/* Mobile Layout */}
              <div className="sm:hidden space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-lg">
                      {request.asset.icon}
                    </div>
                    <div>
                      <p className="font-bold text-sm">
                        {request.amount.toLocaleString()} {request.asset.symbol}
                      </p>
                      <p className="text-xs text-muted-foreground">{request.asset.name}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border uppercase font-medium',
                    getStatusStyles(request.status)
                  )}>
                    {request.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-4">
                    <div>
                      <span className="text-muted-foreground">Supplier: </span>
                      <span className="font-medium">{request.supplier}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">APY: </span>
                      <span className="font-medium">{request.interestRate}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{request.period} Days</span>
                  {request.status === 'approved' && (
                    <Button 
                      variant="glow" 
                      size="sm" 
                      className="uppercase text-[10px] font-semibold h-7 px-2"
                      onClick={() => handleConfirmBorrow(request)}
                    >
                      Confirm
                    </Button>
                  )}
                  {request.status === 'rejected' && (
                    <Button variant="outline" size="sm" className="text-[10px] h-7 px-2">
                      Details
                    </Button>
                  )}
                  {request.status === 'pending' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden sm:flex sm:flex-row sm:items-center justify-between gap-4">
                {/* Asset Info */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-2xl">
                    {request.asset.icon}
                  </div>
                  <div>
                    <p className="font-bold text-lg">
                      {request.amount.toLocaleString()} {request.asset.symbol}
                    </p>
                    <p className="text-sm text-muted-foreground">{request.asset.name}</p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="flex flex-wrap items-center gap-6 lg:gap-8">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Supplier</p>
                    <p className="text-sm font-medium">{request.supplier}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Interest Rate</p>
                    <p className="text-sm font-medium">{request.interestRate}% APY</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Period</p>
                    <p className="text-sm font-medium">{request.period} Days</p>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-xs px-3 py-1 rounded-full border uppercase font-medium',
                      getStatusStyles(request.status)
                    )}>
                      {request.status}
                    </span>
                    
                    {request.status === 'approved' && (
                      <Button 
                        variant="glow" 
                        size="sm" 
                        className="uppercase text-xs font-semibold"
                        onClick={() => handleConfirmBorrow(request)}
                      >
                        Confirm Borrow
                      </Button>
                    )}
                    
                    {request.status === 'rejected' && (
                      <Button variant="outline" size="sm" className="text-xs">
                        View Details
                      </Button>
                    )}
                    
                    {request.status === 'pending' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
        <p className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
          Showing {paginatedRequests.length} of {filteredRequests.length} requests
        </p>
        <div className="flex items-center gap-1 order-1 sm:order-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 text-xs sm:text-sm"
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>

      {/* Borrow Success Modal */}
      {selectedRequest && (
        <BorrowSuccessModal
          isOpen={borrowSuccessOpen}
          onClose={() => {
            setBorrowSuccessOpen(false);
            setSelectedRequest(null);
          }}
          asset={selectedRequest.asset}
          amount={selectedRequest.amount}
          interestRate={selectedRequest.interestRate}
          duration={selectedRequest.period}
        />
      )}
    </div>
  );
}

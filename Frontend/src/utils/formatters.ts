export function formatNumber(
  value: number,
  options?: {
    decimals?: number;
    compact?: boolean;
    prefix?: string;
    suffix?: string;
  }
): string {
  const { decimals = 2, compact = false, prefix = '', suffix = '' } = options ?? {};

  let formatted: string;

  if (compact) {
    const absValue = Math.abs(value);
    if (absValue >= 1e12) {
      formatted = (value / 1e12).toFixed(decimals) + 'T';
    } else if (absValue >= 1e9) {
      formatted = (value / 1e9).toFixed(decimals) + 'B';
    } else if (absValue >= 1e6) {
      formatted = (value / 1e6).toFixed(decimals) + 'M';
    } else if (absValue >= 1e3) {
      formatted = (value / 1e3).toFixed(decimals) + 'K';
    } else {
      formatted = value.toFixed(decimals);
    }
  } else {
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return `${prefix}${formatted}${suffix}`;
}

export function formatCurrency(value: number, compact = false): string {
  return formatNumber(value, { decimals: 2, compact, prefix: '$' });
}

export function formatPercent(value: number, decimals = 2): string {
  return formatNumber(value, { decimals, suffix: '%' });
}

export function formatAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (format === 'relative') {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  const options: Intl.DateTimeFormatOptions =
    format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric' };

  return d.toLocaleDateString('en-US', options);
}

export function getColorForChange(value: number): 'text-success' | 'text-destructive' | 'text-muted-foreground' {
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-destructive';
  return 'text-muted-foreground';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-success/20 text-success border-success/30',
    completed: 'bg-primary/20 text-primary border-primary/30',
    pending: 'bg-warning/20 text-warning border-warning/30',
    rejected: 'bg-destructive/20 text-destructive border-destructive/30',
    liquidated: 'bg-destructive/20 text-destructive border-destructive/30',
    failed: 'bg-destructive/20 text-destructive border-destructive/30',
  };
  return colors[status] ?? 'bg-muted text-muted-foreground border-border';
}

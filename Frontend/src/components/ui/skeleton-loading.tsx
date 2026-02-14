import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-muted/50 relative overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("glass-card p-6 space-y-4", className)} {...props}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function SkeletonTable({ rows = 5, className, ...props }: SkeletonProps & { rows?: number }) {
  return (
    <div className={cn("glass-card p-6 space-y-3", className)} {...props}>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 w-1/4" />
          <Skeleton className="h-10 w-1/4" />
          <Skeleton className="h-10 w-1/4" />
          <Skeleton className="h-10 w-1/4" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("glass-card p-6", className)} {...props}>
      <Skeleton className="h-4 w-1/4 mb-4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonChart };

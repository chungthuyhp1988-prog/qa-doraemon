import { Skeleton } from './Skeleton';

interface ViewSkeletonProps {
  cards?: number;
  rows?: number;
}

export function ViewSkeleton({ cards = 0, rows = 6 }: ViewSkeletonProps) {
  return (
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Stats cards */}
      {cards > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-[32px]" />
          ))}
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-surface-container-lowest rounded-[32px] shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="p-5 border-b border-outline-variant/30 flex gap-4">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>

        {/* Table rows */}
        <div className="p-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-[200px]" />
              <Skeleton className="h-4 flex-1 max-w-[120px]" />
              <Skeleton className="h-4 flex-1 max-w-[100px]" />
              <Skeleton className="h-6 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

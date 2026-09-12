
export function ContainerSkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 overflow-y-auto pb-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 bg-background/80 rounded-xl border border-border shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-background/80 rounded w-3/4" />
              <div className="h-3 bg-background/50 rounded w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50">
            <div className="h-6 bg-background/50 rounded" />
            <div className="h-6 bg-background/50 rounded" />
            <div className="h-6 bg-background/50 rounded" />
          </div>
          <div className="h-8 bg-background/50 rounded w-full" />
        </div>
      ))}
    </div>
  );
}

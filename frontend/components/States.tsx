export function Skeleton({ className = "h-4" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-card bg-msurface p-4">
      <Skeleton className="h-5 w-2/3 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-2" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-card border border-merror/30 bg-merror/10 px-4 py-3"
    >
      <p className="text-sm text-merror">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-lg bg-merror px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

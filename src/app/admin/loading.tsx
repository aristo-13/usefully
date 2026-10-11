export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      <div className="space-y-3 rounded-lg border border-border p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-6 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}

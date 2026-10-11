import Link from 'next/link'

export default function AdminNotFound() {
  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Not found</h1>
      <p className="text-sm text-muted-foreground">This item does not exist or has been deleted.</p>
      <Link href="/admin" className="text-sm text-link hover:underline">
        Back to the dashboard
      </Link>
    </div>
  )
}

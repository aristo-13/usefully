'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This page could not be loaded. If you have just set up the project, check that the Supabase
        migration has been applied and that your account has the admin role (see the README).
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <button
        type="button"
        onClick={() => retry()}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function PublicError({
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
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      <h1 className="font-heading text-3xl font-semibold text-foreground">Something went wrong</h1>
      <p className="mt-4 text-muted-foreground">
        This page could not be loaded right now. Please try again in a moment.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent"
        >
          Go to the home page
        </Link>
      </div>
    </div>
  )
}

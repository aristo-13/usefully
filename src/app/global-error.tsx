'use client'

// Replaces the root layout when it fails, so it cannot rely on global styles.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          padding: '4rem 1.5rem',
          maxWidth: '40rem',
          marginInline: 'auto',
          lineHeight: 1.6,
        }}
      >
        <title>Something went wrong</title>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Something went wrong</h1>
        <p>The site could not be loaded right now. Please try again in a moment.</p>
        {error.digest ? <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Reference: {error.digest}</p> : null}
        <button type="button" onClick={() => retry()} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}

'use client'

import { useFormStatus } from 'react-dom'
import { RefreshCw } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={buttonVariants({ variant: 'outline' })}>
      <RefreshCw aria-hidden className={pending ? 'animate-spin' : undefined} />
      {pending ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}

/** Runs a Server Action that expires cached data, then shows the page again. */
export function RefreshButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <Submit />
    </form>
  )
}

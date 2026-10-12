'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Shares the page of a piece of content on this site, never a file or an
 * outbound link, so people land on the page and decide what to do there.
 * Uses the device's share sheet when available, otherwise copies the link.
 */
export function ShareButton({
  path,
  title,
  withLabel = false,
  className,
}: {
  path: string
  title: string
  withLabel?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = new URL(path, window.location.origin).toString()

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        // The user closed the share sheet; anything else falls back to copying.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link to share it:', url)
    }
  }

  return (
    <span className={cn('relative z-10 inline-flex items-center', className)}>
      <button
        type="button"
        onClick={share}
        title={copied ? 'Link copied' : 'Share link'}
        aria-label={withLabel ? undefined : `Share “${title}”`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          withLabel ? 'border border-border px-2.5 py-1 text-sm' : 'p-1.5',
        )}
      >
        {copied ? <Check aria-hidden className="size-4" /> : <Share2 aria-hidden className="size-4" />}
        {withLabel ? <span>{copied ? 'Link copied' : 'Share'}</span> : null}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied to the clipboard' : ''}
      </span>
    </span>
  )
}

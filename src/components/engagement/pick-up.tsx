'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, X } from 'lucide-react'

import { unfinished, useDismissed, useReadingHistory } from '@/lib/reading-history'

/** How long the prompt stays before it gets out of the way by itself. */
const SHOW_FOR_MS = 20_000

/** Scrolls back to the view the visitor had when they left (progress is measured at the bottom of the window). */
function jumpTo(bodyId: string, progress: number) {
  const body = document.getElementById(bodyId)
  if (!body) return
  const rect = body.getBoundingClientRect()
  const top = window.scrollY + rect.top + progress * rect.height - window.innerHeight
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

/**
 * "Pick up where you left off". On a page the visitor started before, it jumps
 * back to where they stopped; without `path` (the home page) it offers their
 * latest unfinished page. Fixed under the header, so it never moves the page.
 */
export function PickUpWhereYouLeftOff({ path, bodyId = 'article-body' }: { path?: string; bodyId?: string }) {
  const history = useReadingHistory()
  const { dismissed, dismiss } = useDismissed()
  const [timedOut, setTimedOut] = useState(false)
  const jumped = useRef(false)

  const pending = unfinished(history)
  const entry = path ? pending.find((item) => item.path === path) : pending.find((item) => !dismissed.includes(`page:${item.path}`))
  const key = path ? `page:${path}` : 'home'
  const visible = Boolean(entry) && !timedOut && !dismissed.includes(key)

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => setTimedOut(true), SHOW_FOR_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  // Arriving through "Continue" on the home page (#continue): go straight to the saved place.
  useEffect(() => {
    if (!path || !entry || jumped.current || window.location.hash !== '#continue') return
    jumped.current = true
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    jumpTo(bodyId, entry.progress)
    dismiss(key)
  }, [path, entry, bodyId, key, dismiss])

  if (!visible || !entry) return null
  const percent = Math.round(entry.progress * 100)

  return (
    <aside
      aria-label="Continue reading"
      className="fixed top-20 right-4 left-4 z-30 rounded-lg border border-border bg-background p-3 shadow-lg animate-in fade-in slide-in-from-top-2 sm:left-auto sm:w-96"
    >
      <div className="flex items-start gap-3">
        <BookOpen aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{path ? 'Pick up where you left off' : 'Continue reading'}</p>
            {path ? null : <p className="truncate text-sm text-muted-foreground">{entry.title}</p>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
            </span>
            <span className="tabular-nums">{percent}% read</span>
          </div>
          {path ? (
            <button
              type="button"
              onClick={() => {
                jumpTo(bodyId, entry.progress)
                dismiss(key)
              }}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            >
              Continue from {percent}%
            </button>
          ) : (
            <Link
              href={`${entry.path}#continue`}
              onClick={() => dismiss(key)}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            >
              Continue
              <span className="sr-only"> reading {entry.title}</span>
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => dismiss(key)}
          className="-mt-1 -mr-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </aside>
  )
}

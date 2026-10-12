'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'

import { saveReading, useReadingHistory } from '@/lib/reading-history'

export type NextRead = { path: string; title: string; label: string }

/** Share of the body read before "Up next" slides in. */
const UP_NEXT_AT = 0.75

/**
 * A reading progress bar under the header with the minutes left, and an
 * "Up next" bar near the end that suggests a related page the visitor has not
 * read yet. Also remembers how far they got, so they can pick up later. Sits
 * below the header and never on top of ads, which always stack above it.
 */
export function ReadingProgress({
  path,
  title,
  label,
  minutes,
  bodyId,
  next,
}: {
  path: string
  title: string
  label: string
  /** Reading time of the whole body. */
  minutes: number
  /** id of the element holding the body. */
  bodyId: string
  /** Related pages, most relevant first. */
  next: NextRead[]
}) {
  const [progress, setProgress] = useState(0)
  // "Up next" waits until the visitor scrolls, so a short page does not greet them with it.
  const [engaged, setEngaged] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const history = useReadingHistory()
  const latest = useRef(0)

  useEffect(() => {
    let frame = 0
    let scrolled = false
    let lastSaved = 0

    const save = () => {
      // Opening a page is not reading it: save only once the visitor has scrolled.
      if (scrolled) saveReading({ path, title, label, progress: latest.current })
    }
    const measure = () => {
      frame = 0
      const body = document.getElementById(bodyId)
      if (!body) return
      const rect = body.getBoundingClientRect()
      const value = rect.height > 0 ? Math.min(1, Math.max(0, (window.innerHeight - rect.top) / rect.height)) : 0
      latest.current = value
      setProgress(value)
      if (scrolled && (Date.now() - lastSaved > 2000 || value >= 0.9)) {
        lastSaved = Date.now()
        save()
      }
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }
    const onScroll = () => {
      scrolled = true
      setEngaged(true)
      schedule()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }

    schedule()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', schedule)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('visibilitychange', onHide)
      // Leaving for another page on the site.
      save()
    }
  }, [path, title, label, bodyId])

  // Prefer a page the visitor has not opened yet.
  const upNext = useMemo(() => {
    const seen = new Set(history.map((entry) => entry.path))
    const candidates = next.filter((item) => item.path !== path)
    return candidates.find((item) => !seen.has(item.path)) ?? candidates[0] ?? null
  }, [history, next, path])

  const minutesLeft = Math.ceil(minutes * (1 - progress))
  const showUpNext = upNext !== null && engaged && !dismissed && progress >= UP_NEXT_AT

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-16 z-30 h-[3px]">
        <div
          className="h-full origin-left bg-brand transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {minutes >= 3 && progress > 0.02 && progress < UP_NEXT_AT ? (
        <p
          aria-hidden
          className="pointer-events-none fixed top-[4.6rem] right-4 z-30 hidden rounded-full border border-border bg-background/95 px-2.5 py-0.5 text-xs text-muted-foreground shadow-sm xl:block"
        >
          {minutesLeft <= 1 ? 'About a minute left' : `${minutesLeft} min left`}
        </p>
      ) : null}

      {showUpNext ? (
        <aside
          aria-label="Up next"
          className="fixed inset-x-0 top-[calc(4rem+3px)] z-30 border-b border-border bg-background/95 shadow-sm backdrop-blur animate-in fade-in slide-in-from-top-2"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
            <span className="shrink-0 text-xs font-semibold tracking-wide text-brand uppercase">Up next</span>
            <Link
              href={upNext.path}
              className="group flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground"
            >
              <span className="truncate group-hover:underline">{upNext.title}</span>
              <span className="hidden shrink-0 text-xs font-normal text-muted-foreground sm:inline">{upNext.label}</span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
              <span className="sr-only">Hide the suggestion</span>
            </button>
          </div>
        </aside>
      ) : null}
    </>
  )
}

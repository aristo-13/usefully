'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { CategoryCard, categoryGridClass } from '@/components/content/category-card'
import { ContentCard, listClasses, type ListLayout } from '@/components/content/content-card'
import { feedQuery, type Feed, type FeedItem, type FeedResponse } from '@/lib/content/feeds'
import { cn } from '@/lib/utils'

const buttonClass =
  'inline-flex h-10 min-w-40 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent aria-busy:opacity-70 disabled:opacity-70'

/**
 * Appends the next PAGE_SIZE items of a list. With JavaScript it fetches from
 * /api/content; without it, `hrefTemplate` makes it a plain link to the next
 * paginated page, so every item stays reachable for crawlers and all users.
 */
export function LoadMore({
  feed,
  nextPage,
  hasMore: initialHasMore,
  hrefTemplate,
  seenIds,
  layout = 'list',
  showType = false,
  headingLevel = 'h2',
  label,
}: {
  feed: Feed
  nextPage: number
  hasMore: boolean
  /** Next page URL with a `{page}` placeholder, e.g. `/articles/page/{page}`. */
  hrefTemplate?: string
  /** Ids already rendered above, so overlapping batches never show duplicates. */
  seenIds: string[]
  layout?: ListLayout | 'categories'
  showType?: boolean
  headingLevel?: 'h2' | 'h3'
  label: string
}) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [page, setPage] = useState(nextPage)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [announcement, setAnnouncement] = useState('')
  const seen = useRef(new Set(seenIds))
  const listRef = useRef<HTMLUListElement>(null)
  const focusIndex = useRef<number | null>(null)

  // When the button disappears, move keyboard focus to the first new item.
  useEffect(() => {
    if (focusIndex.current === null) return
    listRef.current?.children[focusIndex.current]?.querySelector('a')?.focus()
    focusIndex.current = null
  }, [items])

  async function load(event: MouseEvent<HTMLElement>) {
    // Let modified clicks open the next page in a new tab.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (status === 'loading') return

    setStatus('loading')
    try {
      const response = await fetch(`/api/content?${feedQuery(feed, page)}`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`Request failed with ${response.status}`)
      const data = (await response.json()) as FeedResponse

      const fresh = data.items.filter((item) => !seen.current.has(item.id))
      fresh.forEach((item) => seen.current.add(item.id))
      const more = data.hasMore && data.items.length > 0
      if (!more && fresh.length) focusIndex.current = items.length

      setItems((current) => [...current, ...fresh])
      setPage((current) => current + 1)
      setHasMore(more)
      setAnnouncement(
        fresh.length ? `${fresh.length} more ${fresh.length === 1 ? 'item' : 'items'} loaded.` : 'There is nothing more to load.',
      )
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  const href = hrefTemplate?.replace('{page}', String(page))

  return (
    <>
      {items.length ? (
        <ul ref={listRef} className={layout === 'categories' ? cn(categoryGridClass, 'mt-4') : listClasses[layout]}>
          {items.map((item) => (
            <li key={item.id} className={layout === 'categories' ? undefined : 'border-b border-border'}>
              {'type' in item ? (
                <ContentCard item={item} showType={showType} headingLevel={headingLevel} />
              ) : (
                <CategoryCard category={item} />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {hasMore ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          {href ? (
            <a href={href} onClick={load} aria-busy={status === 'loading'} className={buttonClass}>
              {status === 'loading' ? 'Loading…' : label}
            </a>
          ) : (
            <button type="button" onClick={load} disabled={status === 'loading'} className={buttonClass}>
              {status === 'loading' ? 'Loading…' : label}
            </button>
          )}
          {status === 'error' ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn’t load more right now. Please try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

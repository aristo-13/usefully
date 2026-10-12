import type { ContentSummary, ContentType } from '@/lib/content/types'

/** A list that loads PAGE_SIZE items at a time through /api/content. */
export type Feed =
  | { kind: 'type'; type: ContentType }
  | { kind: 'category'; slug: string }
  | { kind: 'tag'; slug: string }
  | { kind: 'search'; query: string; type: ContentType | null }
  | { kind: 'categories' }

export type CategoryCardData = {
  id: string
  name: string
  slug: string
  description: string
  count: number
}

export type FeedItem = ContentSummary | CategoryCardData

export type FeedResponse = { items: FeedItem[]; hasMore: boolean }

export function feedQuery(feed: Feed, page: number): string {
  const params = new URLSearchParams({ feed: feed.kind, page: String(page) })
  if (feed.kind === 'type') params.set('type', feed.type)
  if (feed.kind === 'category' || feed.kind === 'tag') params.set('slug', feed.slug)
  if (feed.kind === 'search') {
    params.set('q', feed.query)
    if (feed.type) params.set('type', feed.type)
  }
  return params.toString()
}

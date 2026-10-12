import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import type { FeedResponse } from '@/lib/content/feeds'
import {
  getCategories,
  getCategoryBySlug,
  getContentPage,
  getTagBySlug,
  getTagContentPage,
  searchContent,
} from '@/lib/content/queries'
import { CONTENT_TYPES, PAGE_SIZE } from '@/lib/content/types'

// Next batches for "Load more" buttons. Read-only, public, published content
// only (it uses the same cached, RLS-restricted queries as the pages).

const slug = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const page = z.coerce.number().int().min(2).max(1000)

const requestSchema = z.discriminatedUnion('feed', [
  z.object({ feed: z.literal('type'), type: z.enum(CONTENT_TYPES), page }),
  z.object({ feed: z.literal('category'), slug, page }),
  z.object({ feed: z.literal('tag'), slug, page }),
  z.object({
    feed: z.literal('search'),
    q: z.string().trim().min(2).max(200),
    type: z.enum(CONTENT_TYPES).optional(),
    page,
  }),
  z.object({ feed: z.literal('categories'), page }),
])

const headers = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
}

function respond(body: FeedResponse | { error: string }, status = 200) {
  return NextResponse.json(body, { status, headers })
}

export async function GET(request: NextRequest) {
  const parsed = requestSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return respond({ error: 'Invalid request.' }, 400)
  const input = parsed.data

  switch (input.feed) {
    case 'type': {
      const result = await getContentPage({ type: input.type }, input.page)
      return respond({ items: result.items, hasMore: input.page < result.totalPages })
    }
    case 'category': {
      const category = await getCategoryBySlug(input.slug)
      if (!category) return respond({ items: [], hasMore: false })
      const result = await getContentPage({ categoryId: category.id }, input.page)
      return respond({ items: result.items, hasMore: input.page < result.totalPages })
    }
    case 'tag': {
      const tag = await getTagBySlug(input.slug)
      if (!tag) return respond({ items: [], hasMore: false })
      const result = await getTagContentPage(tag.id, input.page)
      return respond({ items: result.items, hasMore: input.page < result.totalPages })
    }
    case 'search': {
      const result = await searchContent(input.q, input.type ?? null, input.page)
      if (!result.ok) return respond({ error: 'Search is temporarily unavailable.' }, 503)
      // Strip the internal rank before sending results to the browser.
      const items = result.results.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        slug: item.slug,
        excerpt: item.excerpt,
        publishedAt: item.publishedAt,
        updatedAt: item.updatedAt,
        category: item.category,
      }))
      return respond({ items, hasMore: result.hasMore })
    }
    case 'categories': {
      const categories = (await getCategories()).filter((category) => category.count > 0)
      const start = (input.page - 1) * PAGE_SIZE
      const items = categories
        .slice(start, start + PAGE_SIZE)
        .map(({ id, name, slug: categorySlug, description, count }) => ({
          id,
          name,
          slug: categorySlug,
          description,
          count,
        }))
      return respond({ items, hasMore: categories.length > start + PAGE_SIZE })
    }
  }
}

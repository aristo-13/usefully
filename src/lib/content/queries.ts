import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import {
  DETAIL_SELECT,
  SUMMARY_SELECT,
  toDetail,
  toSummaries,
  type DetailRow,
  type SummaryRow,
} from '@/lib/content/mappers'
import {
  PAGE_SIZE,
  isContentType,
  type ContentDetail,
  type ContentSummary,
  type ContentType,
  type Paginated,
} from '@/lib/content/types'
import { mediaPublicUrl } from '@/lib/supabase/config'
import { getPublicClient } from '@/lib/supabase/public'

/** Every public read is tagged with this; admin mutations call updateTag() on it. */
export const PUBLIC_CONTENT_TAG = 'public-content'

/*
 * Caching rules for this file:
 * - Successful reads are cached for hours and refreshed on demand by tag.
 * - Failed reads are logged and cached for minutes only, so a database hiccup
 *   (or a build before the migrations have run) never sticks for long.
 * - A failed single-item read throws instead, so a real page is never cached
 *   as "not found".
 */

type QueryError = { message: string; code?: string }

// Missing table (PGRST205, 42P01) or column (42703, PGRST204): a migration has not been applied.
const MISSING_SCHEMA_CODES = new Set(['PGRST205', '42P01', '42703', 'PGRST204'])

function logQueryError(scope: string, error: QueryError) {
  const missingSchema = MISSING_SCHEMA_CODES.has(error.code ?? '')
  console.error(
    `[content] ${scope} failed: ${error.message}${error.code ? ` (${error.code})` : ''}` +
      (missingSchema ? ' - have the Supabase migrations been applied?' : ''),
  )
}

function emptyPage(page: number): Paginated<ContentSummary> {
  return { items: [], page, totalPages: 0, total: 0 }
}

function rangeFor(page: number) {
  const from = (page - 1) * PAGE_SIZE
  return { from, to: from + PAGE_SIZE - 1 }
}

type PageResult = { ok: boolean; result: Paginated<ContentSummary> }

function toPageResult(
  page: number,
  response: { data: SummaryRow[] | null; error: QueryError | null; count: number | null },
  scope: string,
): PageResult {
  const { data, error, count } = response
  if (error) {
    // PGRST103: requested range is past the last row, i.e. an empty page.
    if (error.code === 'PGRST103') return { ok: true, result: emptyPage(page) }
    logQueryError(scope, error)
    return { ok: false, result: emptyPage(page) }
  }
  const total = count ?? 0
  return {
    ok: true,
    result: { items: toSummaries(data), page, total, totalPages: Math.ceil(total / PAGE_SIZE) },
  }
}

export async function getContentPage(
  filter: { type?: ContentType; categoryId?: string },
  page: number,
): Promise<Paginated<ContentSummary>> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return emptyPage(page)
  }

  const { from, to } = rangeFor(page)
  let query = supabase
    .from('content_items')
    .select(SUMMARY_SELECT, { count: 'exact' })
    .eq('status', 'published')
  if (filter.type) query = query.eq('type', filter.type)
  if (filter.categoryId) query = query.eq('category_id', filter.categoryId)

  const response = await query
    .order('published_at', { ascending: false })
    .order('id')
    .range(from, to)

  const { ok, result } = toPageResult(page, response, 'getContentPage')
  if (ok) cacheLife('hours')
  else cacheLife('minutes')
  return result
}

export async function getTagContentPage(
  tagId: string,
  page: number,
): Promise<Paginated<ContentSummary>> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return emptyPage(page)
  }

  const { from, to } = rangeFor(page)
  const response = await supabase
    .from('content_items')
    .select(
      'id, type, title, slug, excerpt, published_at, updated_at, cover_image_url, cover_alt, icon_url, video_url, category:categories(name, slug), cover:media(storage_path, alt_text, width, height), content_tags!inner(tag_id)',
      { count: 'exact' },
    )
    .eq('status', 'published')
    .eq('content_tags.tag_id', tagId)
    .order('published_at', { ascending: false })
    .order('id')
    .range(from, to)

  const { ok, result } = toPageResult(page, response, 'getTagContentPage')
  if (ok) cacheLife('hours')
  else cacheLife('minutes')
  return result
}

/** Number of listing pages, used to prerender paginated routes. */
export async function getPageCount(filter: {
  type?: ContentType
  categoryId?: string
}): Promise<number> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return 0
  }

  let query = supabase
    .from('content_items')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
  if (filter.type) query = query.eq('type', filter.type)
  if (filter.categoryId) query = query.eq('category_id', filter.categoryId)

  const { count, error } = await query
  if (error) {
    logQueryError('getPageCount', error)
    cacheLife('minutes')
    return 0
  }
  cacheLife('hours')
  return Math.ceil((count ?? 0) / PAGE_SIZE)
}

/** Most recent published slugs of a type, used to prerender detail pages. */
export async function getPublishedSlugs(type: ContentType, limit = 1000): Promise<string[]> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return []
  }

  const { data, error } = await supabase
    .from('content_items')
    .select('slug')
    .eq('status', 'published')
    .eq('type', type)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    logQueryError('getPublishedSlugs', error)
    cacheLife('minutes')
    return []
  }
  cacheLife('hours')
  return (data ?? []).map((row) => row.slug)
}

export async function getPublishedContent(
  type: ContentType,
  slug: string,
): Promise<ContentDetail | null> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return null
  }

  const { data, error } = await supabase
    .from('content_items')
    .select(DETAIL_SELECT)
    .eq('type', type)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle<DetailRow>()

  if (error) {
    logQueryError('getPublishedContent', error)
    throw new Error('Content could not be loaded. Please try again shortly.')
  }
  if (!data) {
    cacheLife('minutes')
    return null
  }
  cacheLife('hours')
  return toDetail(data)
}

/** Up to `limit` items from the same category, topped up with the same type. */
export async function getRelatedContent(
  item: { id: string; type: ContentType; categoryId: string | null },
  limit = PAGE_SIZE,
): Promise<ContentSummary[]> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return []
  }

  const related: ContentSummary[] = []

  if (item.categoryId) {
    const { data, error } = await supabase
      .from('content_items')
      .select(SUMMARY_SELECT)
      .eq('status', 'published')
      .eq('category_id', item.categoryId)
      .neq('id', item.id)
      .order('published_at', { ascending: false })
      .limit(limit)
    if (error) {
      logQueryError('getRelatedContent', error)
      cacheLife('minutes')
      return []
    }
    related.push(...toSummaries(data))
  }

  if (related.length < limit) {
    const excluded = [item.id, ...related.map((entry) => entry.id)]
    const { data, error } = await supabase
      .from('content_items')
      .select(SUMMARY_SELECT)
      .eq('status', 'published')
      .eq('type', item.type)
      .not('id', 'in', `(${excluded.join(',')})`)
      .order('published_at', { ascending: false })
      .limit(limit - related.length)
    if (error) {
      logQueryError('getRelatedContent', error)
      cacheLife('minutes')
      return related
    }
    related.push(...toSummaries(data))
  }

  cacheLife('hours')
  return related
}

export type TaxonomyEntry = {
  id: string
  name: string
  slug: string
  description: string
  updatedAt: string
  count: number
}

export async function getCategories(): Promise<TaxonomyEntry[]> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return []
  }

  const [categories, counts] = await Promise.all([
    supabase.from('categories').select('id, name, slug, description, updated_at').order('name'),
    supabase.rpc('category_counts'),
  ])

  const error = categories.error ?? counts.error
  if (error) {
    logQueryError('getCategories', error)
    cacheLife('minutes')
    return []
  }

  const countById = new Map((counts.data ?? []).map((row) => [row.category_id, Number(row.item_count)]))
  cacheLife('hours')
  return (categories.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    updatedAt: row.updated_at,
    count: countById.get(row.id) ?? 0,
  }))
}

export async function getTags(): Promise<TaxonomyEntry[]> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return []
  }

  const [tags, counts] = await Promise.all([
    supabase.from('tags').select('id, name, slug, description, updated_at').order('name'),
    supabase.rpc('tag_counts'),
  ])

  const error = tags.error ?? counts.error
  if (error) {
    logQueryError('getTags', error)
    cacheLife('minutes')
    return []
  }

  const countById = new Map((counts.data ?? []).map((row) => [row.tag_id, Number(row.item_count)]))
  cacheLife('hours')
  return (tags.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    updatedAt: row.updated_at,
    count: countById.get(row.id) ?? 0,
  }))
}

export async function getCategoryBySlug(slug: string): Promise<TaxonomyEntry | null> {
  const categories = await getCategories()
  return categories.find((category) => category.slug === slug) ?? null
}

export async function getTagBySlug(slug: string): Promise<TaxonomyEntry | null> {
  const tags = await getTags()
  return tags.find((tag) => tag.slug === slug) ?? null
}

export type SitemapContent = {
  type: ContentType
  slug: string
  updatedAt: string
  noindex: boolean
  canonicalUrl: string | null
  coverUrl: string | null
}

export async function getSitemapContent(): Promise<SitemapContent[]> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return []
  }

  const batchSize = 1000
  const entries: SitemapContent[] = []

  // A single sitemap file holds at most 50,000 URLs.
  for (let offset = 0; offset < 45000; offset += batchSize) {
    const { data, error } = await supabase
      .from('content_items')
      .select('type, slug, updated_at, noindex, canonical_url, cover_image_url, cover:media(storage_path)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .order('id')
      .range(offset, offset + batchSize - 1)

    if (error) {
      if (error.code === 'PGRST103') break
      logQueryError('getSitemapContent', error)
      cacheLife('minutes')
      return entries
    }

    for (const row of data ?? []) {
      if (!isContentType(row.type)) continue
      entries.push({
        type: row.type,
        slug: row.slug,
        updatedAt: row.updated_at,
        noindex: row.noindex,
        canonicalUrl: row.canonical_url,
        coverUrl: (row.cover ? mediaPublicUrl(row.cover.storage_path) : null) ?? row.cover_image_url,
      })
    }

    if (!data || data.length < batchSize) break
  }

  cacheLife('hours')
  return entries
}

export type SearchResult = ContentSummary & { rank: number }

/** One page (PAGE_SIZE results) of search results. */
export async function searchContent(
  query: string,
  type: ContentType | null,
  page = 1,
): Promise<{ ok: boolean; results: SearchResult[]; hasMore: boolean }> {
  'use cache'
  cacheTag(PUBLIC_CONTENT_TAG)

  const supabase = getPublicClient()
  if (!supabase) {
    cacheLife('minutes')
    return { ok: false, results: [], hasMore: false }
  }

  // One extra row tells us whether another page exists.
  const { data, error } = await supabase.rpc('search_content', {
    search_query: query,
    content_type: type,
    result_limit: PAGE_SIZE + 1,
    result_offset: (page - 1) * PAGE_SIZE,
  })

  if (error) {
    logQueryError('searchContent', error)
    cacheLife('minutes')
    return { ok: false, results: [], hasMore: false }
  }

  cacheLife('hours')
  const rows = data ?? []
  const results: SearchResult[] = []
  for (const row of rows.slice(0, PAGE_SIZE)) {
    const [summary] = toSummaries([
      {
        id: row.id,
        type: row.type,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        published_at: row.published_at,
        updated_at: row.updated_at,
        category:
          row.category_name && row.category_slug
            ? { name: row.category_name, slug: row.category_slug }
            : null,
        cover: row.cover_path
          ? {
              storage_path: row.cover_path,
              alt_text: row.cover_media_alt ?? '',
              width: row.cover_width,
              height: row.cover_height,
            }
          : null,
        cover_image_url: row.cover_image_url,
        cover_alt: row.cover_alt,
        icon_url: row.icon_url,
        video_url: row.video_url,
      },
    ])
    if (summary) results.push({ ...summary, rank: row.rank })
  }
  return { ok: true, results, hasMore: rows.length > PAGE_SIZE }
}

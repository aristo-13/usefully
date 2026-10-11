import 'server-only'

import { DETAIL_SELECT, parseSources, toDetail, type DetailRow } from '@/lib/content/mappers'
import {
  CONTENT_STATUSES,
  CONTENT_TYPES,
  isContentStatus,
  isContentType,
  type ContentDetail,
  type ContentStatus,
  type ContentType,
} from '@/lib/content/types'
import type {
  AdminContentRow,
  DashboardData,
  EditableContent,
  MediaOption,
  MediaRow,
  Option,
  TaxonomyRow,
} from '@/lib/admin/types'
import { mediaPublicUrl } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

// Admin reads use the signed-in user's session. RLS only returns drafts and
// private tables to admins, so these queries are safe even if a page forgot
// its own requireAdmin() check (they would simply return nothing).

export const ADMIN_PAGE_SIZE = 25

function fail(scope: string, error: { message: string }): never {
  console.error(`[admin] ${scope} failed: ${error.message}`)
  throw new Error(`Could not load ${scope}. Check the server logs for details.`)
}

export async function listContent(options: {
  type: ContentType
  status: ContentStatus | null
  query: string
  page: number
}): Promise<{ items: AdminContentRow[]; total: number; totalPages: number }> {
  const supabase = await createClient()
  const from = (options.page - 1) * ADMIN_PAGE_SIZE

  let request = supabase
    .from('content_items')
    .select(
      'id, type, status, title, slug, updated_at, published_at, ai_generated, click_count, category:categories(name)',
      { count: 'exact' },
    )
    .eq('type', options.type)
  if (options.status) request = request.eq('status', options.status)
  if (options.query) {
    const pattern = `%${options.query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
    request = request.ilike('title', pattern)
  }

  const { data, error, count } = await request
    .order('updated_at', { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1)

  if (error && error.code !== 'PGRST103') fail('content list', error)
  const total = count ?? 0

  return {
    total,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    items: (data ?? []).flatMap((row) =>
      isContentType(row.type) && isContentStatus(row.status)
        ? [
            {
              id: row.id,
              type: row.type,
              status: row.status,
              title: row.title,
              slug: row.slug,
              updatedAt: row.updated_at,
              publishedAt: row.published_at,
              categoryName: row.category?.name ?? null,
              aiGenerated: row.ai_generated,
              clickCount: row.click_count,
            },
          ]
        : [],
    ),
  }
}

export async function getEditableContent(id: string): Promise<EditableContent | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_items')
    .select(
      `id, type, status, title, slug, excerpt, body, category_id, author_id, cover_media_id,
       seo_title, seo_description, canonical_url, noindex, keywords,
       external_url, file_path, file_name, file_size, file_mime, version, difficulty,
       sources, ai_generated, reviewed_at, published_at, created_at, updated_at, click_count,
       reviewer:profiles!content_items_reviewed_by_fkey(display_name),
       content_tags(tag_id)`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) fail('content item', error)
  if (!data || !isContentType(data.type) || !isContentStatus(data.status)) return null

  return {
    id: data.id,
    type: data.type,
    status: data.status,
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    body: data.body,
    categoryId: data.category_id,
    authorId: data.author_id,
    coverMediaId: data.cover_media_id,
    seoTitle: data.seo_title ?? '',
    seoDescription: data.seo_description ?? '',
    canonicalUrl: data.canonical_url ?? '',
    noindex: data.noindex,
    keywords: data.keywords ?? [],
    externalUrl: data.external_url ?? '',
    filePath: data.file_path,
    fileName: data.file_name,
    fileSize: data.file_size,
    fileMime: data.file_mime,
    version: data.version ?? '',
    difficulty: data.difficulty ?? '',
    sources: parseSources(data.sources),
    aiGenerated: data.ai_generated,
    reviewedAt: data.reviewed_at,
    reviewerName: data.reviewer?.display_name || null,
    publishedAt: data.published_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    clickCount: data.click_count,
    tagIds: (data.content_tags ?? []).map((link) => link.tag_id),
  }
}

/** Any status, for the admin preview. */
export async function getContentForPreview(id: string): Promise<ContentDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_items')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle<DetailRow>()
  if (error) fail('preview', error)
  return data ? toDetail(data) : null
}

export async function listTaxonomy(kind: 'categories' | 'tags'): Promise<TaxonomyRow[]> {
  const supabase = await createClient()
  const [rows, counts] = await Promise.all([
    supabase.from(kind).select('id, name, slug, description').order('name'),
    kind === 'categories' ? supabase.rpc('category_counts') : supabase.rpc('tag_counts'),
  ])
  if (rows.error) fail(kind, rows.error)
  if (counts.error) fail(`${kind} counts`, counts.error)

  const countById = new Map<string, number>()
  for (const row of counts.data ?? []) {
    const id = 'category_id' in row ? row.category_id : row.tag_id
    countById.set(id, Number(row.item_count))
  }

  return (rows.data ?? []).map((row) => ({ ...row, publishedCount: countById.get(row.id) ?? 0 }))
}

export async function getTaxonomyItem(kind: 'categories' | 'tags', id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(kind)
    .select('id, name, slug, description, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) fail(kind === 'categories' ? 'category' : 'tag', error)
  return data
}

export async function listAuthors(): Promise<Option[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('role', 'admin')
    .order('display_name')
  if (error) fail('authors', error)
  return (data ?? []).map((row) => ({ id: row.id, name: row.display_name || 'Unnamed author' }))
}

export async function listMedia(page: number): Promise<{ items: MediaRow[]; totalPages: number }> {
  const supabase = await createClient()
  const pageSize = 48
  const from = (page - 1) * pageSize

  const { data, error, count } = await supabase
    .from('media')
    .select('id, file_name, storage_path, mime_type, size_bytes, width, height, alt_text, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)
  if (error && error.code !== 'PGRST103') fail('media', error)

  const ids = (data ?? []).map((row) => row.id)
  const usage = new Map<string, number>()
  if (ids.length) {
    const { data: covers, error: coverError } = await supabase
      .from('content_items')
      .select('cover_media_id')
      .in('cover_media_id', ids)
    if (coverError) fail('media usage', coverError)
    for (const row of covers ?? []) {
      if (row.cover_media_id) usage.set(row.cover_media_id, (usage.get(row.cover_media_id) ?? 0) + 1)
    }
  }

  return {
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    items: (data ?? []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      url: mediaPublicUrl(row.storage_path),
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      width: row.width,
      height: row.height,
      altText: row.alt_text,
      createdAt: row.created_at,
      coverUsage: usage.get(row.id) ?? 0,
    })),
  }
}

export async function listMediaOptions(): Promise<MediaOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media')
    .select('id, file_name, alt_text, storage_path')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) fail('media options', error)
  return (data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    altText: row.alt_text,
    url: mediaPublicUrl(row.storage_path),
  }))
}

export async function listRedirects() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('redirects')
    .select('id, slug, destination_url, is_active, click_count, notes, updated_at')
    .order('slug')
  if (error) fail('redirects', error)
  return data ?? []
}

export async function getRedirect(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('redirects')
    .select('id, slug, destination_url, is_active, click_count, notes, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) fail('redirect', error)
  return data
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()
  const select = 'id, type, status, title, slug, updated_at, published_at, ai_generated, click_count, category:categories(name)'

  const [counts, inReview, recent] = await Promise.all([
    supabase.rpc('content_status_counts'),
    supabase.from('content_items').select(select).eq('status', 'in_review').order('updated_at', { ascending: false }).limit(10),
    supabase.from('content_items').select(select).order('updated_at', { ascending: false }).limit(10),
  ])
  if (counts.error) fail('dashboard counts', counts.error)
  if (inReview.error) fail('review queue', inReview.error)
  if (recent.error) fail('recent content', recent.error)

  const table = Object.fromEntries(
    CONTENT_TYPES.map((type) => [type, Object.fromEntries(CONTENT_STATUSES.map((status) => [status, 0]))]),
  ) as DashboardData['counts']
  for (const row of counts.data ?? []) {
    if (isContentType(row.type) && isContentStatus(row.status)) table[row.type][row.status] = Number(row.item_count)
  }

  const toRows = (rows: typeof recent.data): AdminContentRow[] =>
    (rows ?? []).flatMap((row) =>
      isContentType(row.type) && isContentStatus(row.status)
        ? [
            {
              id: row.id,
              type: row.type,
              status: row.status,
              title: row.title,
              slug: row.slug,
              updatedAt: row.updated_at,
              publishedAt: row.published_at,
              categoryName: row.category?.name ?? null,
              aiGenerated: row.ai_generated,
              clickCount: row.click_count,
            },
          ]
        : [],
    )

  return { counts: table, inReview: toRows(inReview.data), recent: toRows(recent.data) }
}

export async function listCategoryOptions(): Promise<Option[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('id, name').order('name')
  if (error) fail('categories', error)
  return data ?? []
}

export async function listTagOptions(): Promise<Option[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('tags').select('id, name').order('name')
  if (error) fail('tags', error)
  return data ?? []
}

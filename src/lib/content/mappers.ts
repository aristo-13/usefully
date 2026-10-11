import type { Json } from '@/lib/database.types'
import {
  isContentStatus,
  isContentType,
  isDifficulty,
  type ContentDetail,
  type ContentSummary,
  type Source,
} from '@/lib/content/types'

type Ref = { name: string; slug: string } | null

/** Columns and relations needed to render a content page (public and preview). */
export const DETAIL_SELECT = `
  id, type, status, title, slug, excerpt, body, published_at, updated_at, category_id,
  seo_title, seo_description, canonical_url, noindex, keywords,
  external_url, file_path, file_name, file_size, file_mime, version, difficulty,
  sources, ai_generated, reviewed_at,
  category:categories(name, slug),
  author:profiles!content_items_author_id_fkey(display_name, bio),
  reviewer:profiles!content_items_reviewed_by_fkey(display_name),
  cover:media(storage_path, alt_text, width, height),
  content_tags(tags(name, slug))
`

export type SummaryRow = {
  id: string
  type: string
  title: string
  slug: string
  excerpt: string
  published_at: string | null
  updated_at: string
  category: Ref
}

export type DetailRow = SummaryRow & {
  status: string
  body: string
  category_id: string | null
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  noindex: boolean
  keywords: string[]
  external_url: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  file_mime: string | null
  version: string | null
  difficulty: string | null
  sources: Json
  ai_generated: boolean
  reviewed_at: string | null
  author: { display_name: string; bio: string } | null
  reviewer: { display_name: string } | null
  cover: { storage_path: string; alt_text: string; width: number | null; height: number | null } | null
  content_tags: { tags: Ref }[]
}

export function toSummary(row: SummaryRow): ContentSummary | null {
  if (!isContentType(row.type)) return null
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    publishedAt: row.published_at ?? row.updated_at,
    updatedAt: row.updated_at,
    category: row.category ? { name: row.category.name, slug: row.category.slug } : null,
  }
}

export function toSummaries(rows: SummaryRow[] | null | undefined): ContentSummary[] {
  return (rows ?? []).map(toSummary).filter((item): item is ContentSummary => item !== null)
}

export function parseSources(value: Json): Source[] {
  if (!Array.isArray(value)) return []
  const sources: Source[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const { title, url, publisher } = entry as Record<string, Json | undefined>
    if (typeof title !== 'string' || typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue
    sources.push({
      title,
      url,
      ...(typeof publisher === 'string' && publisher ? { publisher } : {}),
    })
  }
  return sources
}

export function toDetail(row: DetailRow): ContentDetail | null {
  const summary = toSummary(row)
  if (!summary || !isContentStatus(row.status)) return null

  return {
    ...summary,
    status: row.status,
    body: row.body,
    categoryId: row.category_id,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    canonicalUrl: row.canonical_url,
    noindex: row.noindex,
    keywords: row.keywords ?? [],
    externalUrl: row.external_url,
    hasFile: Boolean(row.file_path),
    fileName: row.file_name,
    fileSize: row.file_size,
    fileMime: row.file_mime,
    version: row.version,
    difficulty: isDifficulty(row.difficulty) ? row.difficulty : null,
    sources: parseSources(row.sources),
    aiGenerated: row.ai_generated,
    reviewedAt: row.reviewed_at,
    author: row.author?.display_name
      ? { name: row.author.display_name, bio: row.author.bio ?? '' }
      : null,
    reviewer: row.reviewer?.display_name ? { name: row.reviewer.display_name } : null,
    cover: row.cover
      ? {
          path: row.cover.storage_path,
          alt: row.cover.alt_text,
          width: row.cover.width,
          height: row.cover.height,
        }
      : null,
    tags: (row.content_tags ?? [])
      .map((link) => link.tags)
      .filter((tag): tag is { name: string; slug: string } => Boolean(tag))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

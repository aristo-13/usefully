import type { Json } from '@/lib/database.types'
import {
  isContentStatus,
  isContentType,
  isDifficulty,
  type ContentDetail,
  type ContentSummary,
  type ContentType,
  type ImageRef,
  type Source,
} from '@/lib/content/types'
import { parseVideoUrl, videoThumbnailUrl } from '@/lib/media'
import { isMediaLibraryUrl, mediaPublicUrl } from '@/lib/supabase/config'

type Ref = { name: string; slug: string } | null
type MediaRef = { storage_path: string; alt_text: string; width: number | null; height: number | null } | null

/** Columns and relations needed to render a content card. */
export const SUMMARY_SELECT =
  'id, type, title, slug, excerpt, published_at, updated_at, cover_image_url, cover_alt, icon_url, video_url, category:categories(name, slug), cover:media(storage_path, alt_text, width, height)'

/** Columns and relations needed to render a content page (public and preview). */
export const DETAIL_SELECT = `
  id, type, status, title, slug, excerpt, body, published_at, updated_at, category_id,
  seo_title, seo_description, canonical_url, noindex, keywords,
  external_url, file_path, file_name, file_size, file_mime, version, difficulty,
  cover_image_url, cover_alt, icon_url, video_url,
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
  cover: MediaRef
  cover_image_url: string | null
  cover_alt: string | null
  icon_url: string | null
  video_url: string | null
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
  content_tags: { tags: Ref }[]
}

function linkedImage(src: string | null, alt: string): ImageRef | null {
  return src ? { src, alt, width: null, height: null, optimize: isMediaLibraryUrl(src) } : null
}

/** The cover: an uploaded image (with its size) or an image linked from another site. */
function coverImage(row: SummaryRow): ImageRef | null {
  if (row.cover) {
    const src = mediaPublicUrl(row.cover.storage_path)
    if (!src) return null
    return {
      src,
      alt: row.cover_alt || row.cover.alt_text,
      width: row.cover.width,
      height: row.cover.height,
      optimize: true,
    }
  }
  return linkedImage(row.cover_image_url, row.cover_alt ?? '')
}

function iconImage(row: SummaryRow, type: ContentType): ImageRef | null {
  return type === 'download' ? linkedImage(row.icon_url, '') : null
}

function thumbnail(row: SummaryRow, type: ContentType): ContentSummary['thumbnail'] {
  const icon = iconImage(row, type)
  if (icon) return { ...icon, kind: 'icon' }
  const cover = coverImage(row)
  if (cover) return { ...cover, kind: 'cover' }
  const still = type === 'resource' ? videoThumbnailUrl(parseVideoUrl(row.video_url)) : null
  return still ? { src: still, alt: '', width: 480, height: 360, optimize: false, kind: 'cover' } : null
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
    thumbnail: thumbnail(row, row.type),
    hasVideo: row.type === 'resource' && Boolean(row.video_url),
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
    cover: coverImage(row),
    icon: iconImage(row, summary.type),
    video: summary.type === 'resource' ? parseVideoUrl(row.video_url) : null,
    tags: (row.content_tags ?? [])
      .map((link) => link.tags)
      .filter((tag): tag is { name: string; slug: string } => Boolean(tag))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

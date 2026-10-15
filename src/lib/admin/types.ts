import type { ContentStatus, ContentType, Source } from '@/lib/content/types'

export type AdminContentRow = {
  id: string
  type: ContentType
  status: ContentStatus
  title: string
  slug: string
  updatedAt: string
  publishedAt: string | null
  categoryName: string | null
  aiGenerated: boolean
  clickCount: number
}

export type EditableContent = {
  id: string
  type: ContentType
  status: ContentStatus
  title: string
  slug: string
  excerpt: string
  body: string
  categoryId: string | null
  authorId: string | null
  coverMediaId: string | null
  /** Public URL of the uploaded cover, for the editor preview. */
  coverMediaUrl: string | null
  coverImageUrl: string
  coverAlt: string
  iconUrl: string
  videoUrl: string
  seoTitle: string
  seoDescription: string
  canonicalUrl: string
  noindex: boolean
  keywords: string[]
  externalUrl: string
  filePath: string | null
  fileName: string | null
  fileSize: number | null
  fileMime: string | null
  version: string
  difficulty: string
  sources: Source[]
  aiGenerated: boolean
  reviewedAt: string | null
  reviewerName: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  clickCount: number
  tagIds: string[]
}

export type Option = { id: string; name: string }

/** Used to spot trends that already have a post. */
export type PostTitle = { id: string; type: ContentType; status: ContentStatus; title: string }

/** Starting values for a new post, for example one started from the Trends page. */
export type ContentDraft = {
  title: string
  keywords: string[]
  source: Source | null
  videoUrl: string
  /** Why the topic is trending, for the AI writer. Empty for posts not started from Trends. */
  context: string
  region: 'ghana' | 'global' | null
  /** Start "Write the whole post" with AI as soon as the editor opens. */
  autoDraft: boolean
}

export type TaxonomyRow = {
  id: string
  name: string
  slug: string
  description: string
  publishedCount: number
}

export type MediaRow = {
  id: string
  fileName: string
  url: string | null
  storagePath: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  altText: string
  createdAt: string
  /** Posts that use the file as their cover, icon or video. */
  usage: number
}

export type MediaOption = { id: string; fileName: string; altText: string; url: string | null; kind: 'image' | 'video' }

export type DashboardData = {
  counts: Record<ContentType, Record<ContentStatus, number>>
  inReview: AdminContentRow[]
  recent: AdminContentRow[]
}

/** A free photo from Pexels, offered as a post's cover. */
export type StockPhoto = {
  id: number
  /** The image used as the cover: 1200 × 627, cropped by Pexels to the shape of the cover frame. */
  src: string
  /** A small preview for the picker. */
  thumb: string
  alt: string
  photographer: string
  photographerUrl: string
  /** The photo's page on Pexels, used for the credit. */
  page: string
}

export type PhotoSearchResult = { ok: true; photos: StockPhoto[] } | { ok: false; message: string }

import type { VideoSource } from '@/lib/media'

export const CONTENT_TYPES = ['article', 'tutorial', 'resource', 'download'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const CONTENT_STATUSES = ['draft', 'in_review', 'published'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

type ContentTypeConfig = {
  label: string
  plural: string
  path: string
  adminPath: string
  /** Used as the section intro and meta description. */
  description: string
}

export const contentTypeConfig: Record<ContentType, ContentTypeConfig> = {
  article: {
    label: 'Article',
    plural: 'Articles',
    path: '/articles',
    adminPath: '/admin/articles',
    description: 'Articles that explain concepts, compare options and share practical advice.',
  },
  tutorial: {
    label: 'Tutorial',
    plural: 'Tutorials',
    path: '/tutorials',
    adminPath: '/admin/tutorials',
    description: 'Step-by-step tutorials you can follow from start to finish.',
  },
  resource: {
    label: 'Resource',
    plural: 'Resources',
    path: '/resources',
    adminPath: '/admin/resources',
    description: 'Tools, references and websites, each with a short review of what it is good for.',
  },
  download: {
    label: 'Download',
    plural: 'Downloads',
    path: '/downloads',
    adminPath: '/admin/downloads',
    description: 'Templates, files and tools to download, with format, size and version details.',
  },
}

export const statusLabels: Record<ContentStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
}

export const difficultyLabels: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && (CONTENT_TYPES as readonly string[]).includes(value)
}

export function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === 'string' && (CONTENT_STATUSES as readonly string[]).includes(value)
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value)
}

export function contentPath(type: ContentType, slug: string): string {
  return `${contentTypeConfig[type].path}/${slug}`
}

/** Path for page `page` of a paginated listing whose first page is `basePath`. */
export function paginatedPath(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/page/${page}`
}

/** Items per batch: lists show this many, and "Load more" fetches this many again. */
export const PAGE_SIZE = 3

/** Tag pages with fewer published items than this are thin and kept out of the index. */
export const MIN_INDEXABLE_TAG_ITEMS = 2

/** Slugs that would collide with fixed routes such as /articles/page/2. */
export const RESERVED_SLUGS = ['page', 'new', 'feed', 'rss', 'index'] as const

export type Source = {
  title: string
  url: string
  publisher?: string
}

export type CategoryRef = { name: string; slug: string }
export type TagRef = { name: string; slug: string }

/** An image ready to render. `optimize` is true for files in the site's own media library. */
export type ImageRef = {
  src: string
  alt: string
  width: number | null
  height: number | null
  optimize: boolean
}

export type ContentSummary = {
  id: string
  type: ContentType
  title: string
  slug: string
  excerpt: string
  publishedAt: string
  updatedAt: string
  category: CategoryRef | null
  /** Shown on cards: a download's icon, otherwise the cover image or a video still. */
  thumbnail: (ImageRef & { kind: 'icon' | 'cover' }) | null
  /** A resource that features a video. */
  hasVideo: boolean
}

export type ContentDetail = ContentSummary & {
  status: ContentStatus
  body: string
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  noindex: boolean
  keywords: string[]
  externalUrl: string | null
  hasFile: boolean
  fileName: string | null
  fileSize: number | null
  fileMime: string | null
  version: string | null
  difficulty: Difficulty | null
  sources: Source[]
  aiGenerated: boolean
  reviewedAt: string | null
  author: { name: string; bio: string } | null
  reviewer: { name: string } | null
  cover: ImageRef | null
  /** Downloads only: the app's icon. */
  icon: ImageRef | null
  /** Resources only: a featured video. */
  video: VideoSource | null
  tags: TagRef[]
  categoryId: string | null
}

export type Paginated<T> = {
  items: T[]
  page: number
  totalPages: number
  total: number
}

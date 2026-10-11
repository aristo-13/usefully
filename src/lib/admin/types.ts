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
  coverUsage: number
}

export type MediaOption = { id: string; fileName: string; altText: string; url: string | null }

export type DashboardData = {
  counts: Record<ContentType, Record<ContentStatus, number>>
  inReview: AdminContentRow[]
  recent: AdminContentRow[]
}

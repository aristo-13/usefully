import type { MetadataRoute } from 'next'
import { connection } from 'next/server'

import { getCategories, getSitemapContent, getTags } from '@/lib/content/queries'
import {
  CONTENT_TYPES,
  MIN_INDEXABLE_TAG_ITEMS,
  contentPath,
  contentTypeConfig,
  type ContentType,
} from '@/lib/content/types'
import { absoluteUrl } from '@/lib/site'

/**
 * Next.js writes sitemap values into the XML unchanged, so characters with a
 * meaning in XML are escaped here: an image link such as `…?w=1200&h=627`
 * would otherwise make the whole sitemap unreadable.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Lists only pages worth indexing: sections and categories with published
 * content, tags with enough items, and published pages that are not marked
 * noindex or canonicalised to another URL.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Built when requested: a sitemap is otherwise generated once at build time
  // and misses everything published after a deploy. The queries stay cached
  // (15 minutes, or until the next publish), like the pages.
  await connection()
  const [items, categories, tags] = await Promise.all([getSitemapContent(), getCategories(), getTags()])

  const latestByType = new Map<ContentType, string>()
  let latest = ''
  for (const item of items) {
    const current = latestByType.get(item.type)
    if (!current || item.updatedAt > current) latestByType.set(item.type, item.updatedAt)
    if (item.updatedAt > latest) latest = item.updatedAt
  }

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), ...(latest ? { lastModified: latest } : {}) },
  ]

  for (const type of CONTENT_TYPES) {
    const lastModified = latestByType.get(type)
    if (lastModified) entries.push({ url: absoluteUrl(contentTypeConfig[type].path), lastModified })
  }

  const activeCategories = categories.filter((category) => category.count > 0)
  if (activeCategories.length) entries.push({ url: absoluteUrl('/categories') })
  for (const category of activeCategories) {
    entries.push({ url: absoluteUrl(`/categories/${category.slug}`) })
  }

  for (const tag of tags) {
    if (tag.count >= MIN_INDEXABLE_TAG_ITEMS) entries.push({ url: absoluteUrl(`/tags/${tag.slug}`) })
  }

  entries.push({ url: absoluteUrl('/privacy') })

  for (const item of items) {
    if (item.noindex) continue
    const url = absoluteUrl(contentPath(item.type, item.slug))
    if (item.canonicalUrl && item.canonicalUrl !== url) continue
    const image = item.coverUrl
    entries.push({ url, lastModified: item.updatedAt, ...(image ? { images: [image] } : {}) })
  }

  return entries.map((entry) => ({ ...entry, url: xml(entry.url), ...(entry.images ? { images: entry.images.map(xml) } : {}) }))
}

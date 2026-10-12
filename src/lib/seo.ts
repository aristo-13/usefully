import type { Metadata } from 'next'

import { contentPath, contentTypeConfig, type ContentDetail } from '@/lib/content/types'
import { absoluteUrl, siteConfig } from '@/lib/site'
import { truncate } from '@/lib/utils'

export const DEFAULT_OG_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: siteConfig.name }

/** Strips Markdown syntax for use in meta descriptions. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Open Graph fields every page repeats. Metadata objects are merged shallowly,
 * so a page that sets `openGraph` must include these itself.
 */
export function openGraphBase(path: string): NonNullable<Metadata['openGraph']> {
  return {
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    url: path,
    images: [DEFAULT_OG_IMAGE],
  }
}

/** Metadata for listing and taxonomy pages. */
export function pageMetadata(options: {
  title: string
  description: string
  path: string
  noindex?: boolean
}): Metadata {
  const { title, description, path, noindex } = options
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { ...openGraphBase(path), type: 'website', title, description },
    twitter: { card: 'summary', title, description },
  }
}

export function contentDescription(item: ContentDetail): string {
  return (
    item.seoDescription ||
    item.excerpt ||
    truncate(markdownToPlainText(item.body), 160) ||
    contentTypeConfig[item.type].description
  )
}

export function contentMetadata(item: ContentDetail): Metadata {
  const path = contentPath(item.type, item.slug)
  const description = contentDescription(item)
  const imageUrl = item.cover?.src ?? null
  const images = imageUrl
    ? [
        {
          url: imageUrl,
          ...(item.cover?.width ? { width: item.cover.width } : {}),
          ...(item.cover?.height ? { height: item.cover.height } : {}),
          alt: item.cover?.alt || item.title,
        },
      ]
    : [DEFAULT_OG_IMAGE]

  return {
    // An SEO title is the complete <title>; otherwise the site name is appended.
    title: item.seoTitle ? { absolute: item.seoTitle } : item.title,
    description,
    ...(item.keywords.length ? { keywords: item.keywords } : {}),
    ...(item.author ? { authors: [{ name: item.author.name }] } : {}),
    alternates: { canonical: item.canonicalUrl || path },
    ...(item.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      ...openGraphBase(path),
      type: 'article',
      title: item.seoTitle || item.title,
      description,
      publishedTime: item.publishedAt,
      modifiedTime: item.updatedAt,
      ...(item.author ? { authors: [item.author.name] } : {}),
      ...(item.category ? { section: item.category.name } : {}),
      ...(item.tags.length ? { tags: item.tags.map((tag) => tag.name) } : {}),
      images,
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: item.seoTitle || item.title,
      description,
      images: images.map((image) => image.url),
    },
  }
}

// ---------------------------------------------------------------------------
// Structured data (JSON-LD)
// ---------------------------------------------------------------------------

type JsonLdObject = Record<string, unknown>

const ORGANIZATION_ID = `${siteConfig.url}/#organization`
const WEBSITE_ID = `${siteConfig.url}/#website`

export function websiteJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: absoluteUrl('/'),
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: siteConfig.language,
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: siteConfig.name,
        url: absoluteUrl('/'),
      },
    ],
  }
}

function organizationRef(): JsonLdObject {
  return { '@type': 'Organization', '@id': ORGANIZATION_ID, name: siteConfig.name, url: absoluteUrl('/') }
}

export type BreadcrumbItem = { name: string; path?: string }

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path) } : {}),
    })),
  }
}

export function contentJsonLd(item: ContentDetail): JsonLdObject {
  const url = absoluteUrl(contentPath(item.type, item.slug))
  const imageUrl = item.cover?.src ?? null
  const isDownload = item.type === 'download'

  return {
    '@context': 'https://schema.org',
    '@type': isDownload ? 'CreativeWork' : 'Article',
    [isDownload ? 'name' : 'headline']: truncate(item.title, 110),
    description: contentDescription(item),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: siteConfig.language,
    datePublished: item.publishedAt,
    dateModified: item.updatedAt,
    ...(imageUrl ? { image: [imageUrl] } : {}),
    author: item.author ? { '@type': 'Person', name: item.author.name } : organizationRef(),
    publisher: organizationRef(),
    isPartOf: { '@type': 'WebSite', '@id': WEBSITE_ID, name: siteConfig.name, url: absoluteUrl('/') },
    ...(item.category ? { articleSection: item.category.name } : {}),
    ...(item.keywords.length ? { keywords: item.keywords.join(', ') } : {}),
    ...(item.type === 'resource' && item.externalUrl
      ? { about: { '@type': 'Thing', name: item.title, url: item.externalUrl } }
      : {}),
    ...(isDownload && item.version ? { version: item.version } : {}),
    ...(isDownload && item.fileMime ? { encodingFormat: item.fileMime } : {}),
    ...(item.sources.length
      ? {
          citation: item.sources.map((source) => ({
            '@type': 'CreativeWork',
            name: source.title,
            url: source.url,
            ...(source.publisher
              ? { publisher: { '@type': 'Organization', name: source.publisher } }
              : {}),
          })),
        }
      : {}),
  }
}

/** Serialises JSON-LD for a <script> tag, escaping `<` to prevent tag injection. */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

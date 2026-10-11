import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ListingLayout, listingTitle } from '@/components/content/listing'
import {
  getCategoryBySlug,
  getContentPage,
  getTagBySlug,
  getTagContentPage,
  type TaxonomyEntry,
} from '@/lib/content/queries'
import { isValidSlug } from '@/lib/content/routes'
import { MIN_INDEXABLE_TAG_ITEMS, paginatedPath } from '@/lib/content/types'
import { pageMetadata } from '@/lib/seo'
import { siteConfig } from '@/lib/site'

export function categoryDescription(category: TaxonomyEntry) {
  return category.description || `Articles, tutorials, resources and downloads about ${category.name}.`
}

export function tagDescription(tag: TaxonomyEntry) {
  return tag.description || `Everything on ${siteConfig.name} tagged “${tag.name}”.`
}

async function loadCategory(slug: string) {
  return isValidSlug(slug) ? getCategoryBySlug(slug) : null
}

/** A tag only has a page while it has published items. */
async function loadTag(slug: string) {
  const tag = isValidSlug(slug) ? await getTagBySlug(slug) : null
  return tag && tag.count > 0 ? tag : null
}

export async function categoryMetadata(slug: string, page: number): Promise<Metadata> {
  const category = await loadCategory(slug)
  if (!category) return { title: 'Not found', robots: { index: false } }
  return pageMetadata({
    title: listingTitle(category.name, page),
    description: categoryDescription(category),
    path: paginatedPath(`/categories/${category.slug}`, page),
    noindex: category.count === 0,
  })
}

export async function tagMetadata(slug: string, page: number): Promise<Metadata> {
  const tag = await loadTag(slug)
  if (!tag) return { title: 'Not found', robots: { index: false } }
  return pageMetadata({
    title: listingTitle(`Tagged “${tag.name}”`, page),
    description: tagDescription(tag),
    path: paginatedPath(`/tags/${tag.slug}`, page),
    noindex: tag.count < MIN_INDEXABLE_TAG_ITEMS,
  })
}

export async function CategoryListing({ slug, page }: { slug: string; page: number }) {
  const category = await loadCategory(slug)
  if (!category) notFound()

  const result = await getContentPage({ categoryId: category.id }, page)
  if (page > 1 && result.items.length === 0) notFound()
  const basePath = `/categories/${category.slug}`

  return (
    <ListingLayout
      breadcrumbs={[
        { name: 'Categories', path: '/categories' },
        ...(page > 1
          ? [{ name: category.name, path: basePath }, { name: `Page ${page}` }]
          : [{ name: category.name }]),
      ]}
      title={category.name}
      description={categoryDescription(category)}
      result={result}
      basePath={basePath}
      showType
      activeCategory={category.slug}
      emptyMessage="Nothing has been published in this category yet."
    />
  )
}

export async function TagListing({ slug, page }: { slug: string; page: number }) {
  const tag = await loadTag(slug)
  if (!tag) notFound()

  const result = await getTagContentPage(tag.id, page)
  if (page > 1 && result.items.length === 0) notFound()
  const basePath = `/tags/${tag.slug}`

  return (
    <ListingLayout
      breadcrumbs={
        page > 1
          ? [{ name: `Tag: ${tag.name}`, path: basePath }, { name: `Page ${page}` }]
          : [{ name: `Tag: ${tag.name}` }]
      }
      title={`Tagged “${tag.name}”`}
      description={tagDescription(tag)}
      result={result}
      basePath={basePath}
      showType
      emptyMessage="Nothing has been published with this tag yet."
    />
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentArticle } from '@/components/content/content-article'
import { getPublishedContent } from '@/lib/content/queries'
import { contentSlugParams, isValidSlug } from '@/lib/content/routes'
import { contentMetadata } from '@/lib/seo'

const TYPE = 'resource'

// Fully static output; new slugs are generated (or 404) on first request.
export const ensureStatic = 'navigation'
export const instant = false

export function generateStaticParams() {
  return contentSlugParams(TYPE)
}

async function loadItem(slug: string) {
  return isValidSlug(slug) ? getPublishedContent(TYPE, slug) : null
}

export async function generateMetadata({ params }: PageProps<'/resources/[slug]'>): Promise<Metadata> {
  const item = await loadItem((await params).slug)
  return item ? contentMetadata(item) : { title: 'Not found', robots: { index: false } }
}

export default async function ResourcePage({ params }: PageProps<'/resources/[slug]'>) {
  const item = await loadItem((await params).slug)
  if (!item) notFound()
  return <ContentArticle item={item} />
}

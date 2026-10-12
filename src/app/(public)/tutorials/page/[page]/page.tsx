import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContentTypeListing } from '@/components/content/listing'
import { contentPageParams, parsePageParam } from '@/lib/content/routes'
import { contentTypeConfig, paginatedPath } from '@/lib/content/types'
import { pageMetadata } from '@/lib/seo'

const TYPE = 'tutorial'

// Fully static output; unknown pages are generated (or 404) on first request.
export const ensureStatic = 'navigation'
export const instant = false

export function generateStaticParams() {
  return contentPageParams(TYPE)
}

export async function generateMetadata({
  params,
}: PageProps<'/tutorials/page/[page]'>): Promise<Metadata> {
  const page = parsePageParam((await params).page)
  if (!page) return { title: 'Page not found', robots: { index: false } }
  const config = contentTypeConfig[TYPE]
  return pageMetadata({
    title: `${config.plural} – Page ${page}`,
    description: config.description,
    path: paginatedPath(config.path, page),
    // Fallback pages for "Load more" without JavaScript: followed, not indexed.
    noindex: true,
  })
}

export default async function TutorialsPaginatedPage({ params }: PageProps<'/tutorials/page/[page]'>) {
  const page = parsePageParam((await params).page)
  if (!page) notFound()
  return <ContentTypeListing type={TYPE} page={page} />
}

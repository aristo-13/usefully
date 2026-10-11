import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TagListing, tagMetadata } from '@/components/content/taxonomy-listing'
import { tagPageParams, parsePageParam } from '@/lib/content/routes'

export const ensureStatic = 'navigation'
export const instant = false

export function generateStaticParams() {
  return tagPageParams()
}

export async function generateMetadata({
  params,
}: PageProps<'/tags/[slug]/page/[page]'>): Promise<Metadata> {
  const { slug, page } = await params
  const pageNumber = parsePageParam(page)
  if (!pageNumber) return { title: 'Page not found', robots: { index: false } }
  return tagMetadata(slug, pageNumber)
}

export default async function TagPaginatedPage({ params }: PageProps<'/tags/[slug]/page/[page]'>) {
  const { slug, page } = await params
  const pageNumber = parsePageParam(page)
  if (!pageNumber) notFound()
  return <TagListing slug={slug} page={pageNumber} />
}

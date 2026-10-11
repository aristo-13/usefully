import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CategoryListing, categoryMetadata } from '@/components/content/taxonomy-listing'
import { categoryPageParams, parsePageParam } from '@/lib/content/routes'

export const ensureStatic = 'navigation'
export const instant = false

export function generateStaticParams() {
  return categoryPageParams()
}

export async function generateMetadata({
  params,
}: PageProps<'/categories/[slug]/page/[page]'>): Promise<Metadata> {
  const { slug, page } = await params
  const pageNumber = parsePageParam(page)
  if (!pageNumber) return { title: 'Page not found', robots: { index: false } }
  return categoryMetadata(slug, pageNumber)
}

export default async function CategoryPaginatedPage({ params }: PageProps<'/categories/[slug]/page/[page]'>) {
  const { slug, page } = await params
  const pageNumber = parsePageParam(page)
  if (!pageNumber) notFound()
  return <CategoryListing slug={slug} page={pageNumber} />
}

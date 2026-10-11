import type { Metadata } from 'next'

import { CategoryListing, categoryMetadata } from '@/components/content/taxonomy-listing'
import { categorySlugParams } from '@/lib/content/routes'

export const ensureStatic = 'navigation'
export const instant = false

export function generateStaticParams() {
  return categorySlugParams()
}

export async function generateMetadata({ params }: PageProps<'/categories/[slug]'>): Promise<Metadata> {
  return categoryMetadata((await params).slug, 1)
}

export default async function CategoryPage({ params }: PageProps<'/categories/[slug]'>) {
  return <CategoryListing slug={(await params).slug} page={1} />
}

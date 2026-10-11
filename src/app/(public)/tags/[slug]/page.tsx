import type { Metadata } from 'next'

import { TagListing, tagMetadata } from '@/components/content/taxonomy-listing'
import { tagSlugParams } from '@/lib/content/routes'

export const ensureStatic = 'navigation'
export const instant = false

export function generateStaticParams() {
  return tagSlugParams()
}

export async function generateMetadata({ params }: PageProps<'/tags/[slug]'>): Promise<Metadata> {
  return tagMetadata((await params).slug, 1)
}

export default async function TagPage({ params }: PageProps<'/tags/[slug]'>) {
  return <TagListing slug={(await params).slug} page={1} />
}

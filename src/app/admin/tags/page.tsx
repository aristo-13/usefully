import type { Metadata } from 'next'

import { TaxonomyIndex } from '@/components/admin/taxonomy-pages'

export const metadata: Metadata = { title: 'Tags' }

export default function AdminTagsPage({ searchParams }: PageProps<'/admin/tags'>) {
  return <TaxonomyIndex kind="tag" searchParams={searchParams} />
}

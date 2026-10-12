import type { Metadata } from 'next'
import { Suspense } from 'react'

import { TaxonomyIndex } from '@/components/admin/taxonomy-pages'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Tags' }

export default function AdminTagsPage({ searchParams }: PageProps<'/admin/tags'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Tags" />}>
      <TaxonomyIndex kind="tag" searchParams={searchParams} />
    </Suspense>
  )
}

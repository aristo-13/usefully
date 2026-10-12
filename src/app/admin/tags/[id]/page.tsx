import type { Metadata } from 'next'
import { Suspense } from 'react'

import { TaxonomyEdit } from '@/components/admin/taxonomy-pages'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Edit tag' }

export default function EditTagPage({ params }: PageProps<'/admin/tags/[id]'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <TaxonomyEdit kind="tag" params={params} />
    </Suspense>
  )
}

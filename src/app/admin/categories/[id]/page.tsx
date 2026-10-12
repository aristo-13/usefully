import type { Metadata } from 'next'
import { Suspense } from 'react'

import { TaxonomyEdit } from '@/components/admin/taxonomy-pages'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Edit category' }

export default function EditCategoryPage({ params }: PageProps<'/admin/categories/[id]'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <TaxonomyEdit kind="category" params={params} />
    </Suspense>
  )
}

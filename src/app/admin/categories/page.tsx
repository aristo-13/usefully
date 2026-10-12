import type { Metadata } from 'next'
import { Suspense } from 'react'

import { TaxonomyIndex } from '@/components/admin/taxonomy-pages'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Categories' }

export default function AdminCategoriesPage({ searchParams }: PageProps<'/admin/categories'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Categories" />}>
      <TaxonomyIndex kind="category" searchParams={searchParams} />
    </Suspense>
  )
}

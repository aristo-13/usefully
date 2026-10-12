import type { Metadata } from 'next'
import { Suspense } from 'react'

import { TaxonomyIndex } from '@/components/admin/taxonomy-pages'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Categories' }

// AI category suggestions (a Server Action on this page) can take a minute.
export const maxDuration = 120

export default function AdminCategoriesPage({ searchParams }: PageProps<'/admin/categories'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Categories" />}>
      <TaxonomyIndex kind="category" searchParams={searchParams} />
    </Suspense>
  )
}

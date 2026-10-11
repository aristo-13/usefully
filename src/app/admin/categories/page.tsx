import type { Metadata } from 'next'

import { TaxonomyIndex } from '@/components/admin/taxonomy-pages'

export const metadata: Metadata = { title: 'Categories' }

export default function AdminCategoriesPage({ searchParams }: PageProps<'/admin/categories'>) {
  return <TaxonomyIndex kind="category" searchParams={searchParams} />
}

import type { Metadata } from 'next'

import { TaxonomyEdit } from '@/components/admin/taxonomy-pages'

export const metadata: Metadata = { title: 'Edit category' }

export default async function EditCategoryPage({ params }: PageProps<'/admin/categories/[id]'>) {
  const { id } = await params
  return <TaxonomyEdit kind="category" id={id} />
}

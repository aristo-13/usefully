import type { Metadata } from 'next'

import { TaxonomyEdit } from '@/components/admin/taxonomy-pages'

export const metadata: Metadata = { title: 'Edit tag' }

export default async function EditTagPage({ params }: PageProps<'/admin/tags/[id]'>) {
  const { id } = await params
  return <TaxonomyEdit kind="tag" id={id} />
}

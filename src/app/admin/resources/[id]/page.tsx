import type { Metadata } from 'next'

import { ContentEditor } from '@/components/admin/content-editor'

export const metadata: Metadata = { title: 'Edit resource' }

export default async function EditResourcePage({ params, searchParams }: PageProps<'/admin/resources/[id]'>) {
  const { id } = await params
  return <ContentEditor type="resource" id={id} searchParams={searchParams} />
}

import type { Metadata } from 'next'

import { ContentEditor } from '@/components/admin/content-editor'

export const metadata: Metadata = { title: 'Edit article' }

export default async function EditArticlePage({ params, searchParams }: PageProps<'/admin/articles/[id]'>) {
  const { id } = await params
  return <ContentEditor type="article" id={id} searchParams={searchParams} />
}

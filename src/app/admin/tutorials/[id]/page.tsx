import type { Metadata } from 'next'

import { ContentEditor } from '@/components/admin/content-editor'

export const metadata: Metadata = { title: 'Edit tutorial' }

export default async function EditTutorialPage({ params, searchParams }: PageProps<'/admin/tutorials/[id]'>) {
  const { id } = await params
  return <ContentEditor type="tutorial" id={id} searchParams={searchParams} />
}

import type { Metadata } from 'next'

import { ContentEditor } from '@/components/admin/content-editor'

export const metadata: Metadata = { title: 'Edit download' }

export default async function EditDownloadPage({ params, searchParams }: PageProps<'/admin/downloads/[id]'>) {
  const { id } = await params
  return <ContentEditor type="download" id={id} searchParams={searchParams} />
}

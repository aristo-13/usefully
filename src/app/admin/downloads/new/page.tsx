import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'New download' }

export default function NewDownloadPage({ searchParams }: PageProps<'/admin/downloads/new'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="New download" />}>
      <ContentEditor type="download" searchParams={searchParams} />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Edit download' }

export default function EditDownloadPage({ params, searchParams }: PageProps<'/admin/downloads/[id]'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ContentEditor type="download" params={params} searchParams={searchParams} />
    </Suspense>
  )
}

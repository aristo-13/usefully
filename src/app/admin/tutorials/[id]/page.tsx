import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Edit tutorial' }

export default function EditTutorialPage({ params, searchParams }: PageProps<'/admin/tutorials/[id]'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ContentEditor type="tutorial" params={params} searchParams={searchParams} />
    </Suspense>
  )
}

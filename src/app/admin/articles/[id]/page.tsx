import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Edit article' }

export default function EditArticlePage({ params, searchParams }: PageProps<'/admin/articles/[id]'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ContentEditor type="article" params={params} searchParams={searchParams} />
    </Suspense>
  )
}

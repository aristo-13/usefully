import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'New article' }

export default function NewArticlePage({ searchParams }: PageProps<'/admin/articles/new'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="New article" />}>
      <ContentEditor type="article" searchParams={searchParams} />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'New article' }

export default function NewArticlePage() {
  return (
    <Suspense fallback={<AdminPageSkeleton title="New article" />}>
      <ContentEditor type="article" />
    </Suspense>
  )
}

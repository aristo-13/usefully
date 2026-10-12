import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'New tutorial' }

export default function NewTutorialPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton title="New tutorial" />}>
      <ContentEditor type="tutorial" />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'New resource' }

export default function NewResourcePage() {
  return (
    <Suspense fallback={<AdminPageSkeleton title="New resource" />}>
      <ContentEditor type="resource" />
    </Suspense>
  )
}

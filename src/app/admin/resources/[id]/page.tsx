import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentEditor } from '@/components/admin/content-editor'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Edit resource' }

export default function EditResourcePage({ params, searchParams }: PageProps<'/admin/resources/[id]'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ContentEditor type="resource" params={params} searchParams={searchParams} />
    </Suspense>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentIndex } from '@/components/admin/content-index'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Resources' }

export default function AdminResourcesPage({ searchParams }: PageProps<'/admin/resources'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Resources" />}>
      <ContentIndex type="resource" searchParams={searchParams} />
    </Suspense>
  )
}

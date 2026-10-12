import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentIndex } from '@/components/admin/content-index'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Tutorials' }

export default function AdminTutorialsPage({ searchParams }: PageProps<'/admin/tutorials'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Tutorials" />}>
      <ContentIndex type="tutorial" searchParams={searchParams} />
    </Suspense>
  )
}

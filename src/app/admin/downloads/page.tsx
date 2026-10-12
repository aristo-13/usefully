import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentIndex } from '@/components/admin/content-index'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Downloads' }

export default function AdminDownloadsPage({ searchParams }: PageProps<'/admin/downloads'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Downloads" />}>
      <ContentIndex type="download" searchParams={searchParams} />
    </Suspense>
  )
}

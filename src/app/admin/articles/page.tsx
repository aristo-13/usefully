import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ContentIndex } from '@/components/admin/content-index'
import { AdminPageSkeleton } from '@/components/admin/ui'

export const metadata: Metadata = { title: 'Articles' }

export default function AdminArticlesPage({ searchParams }: PageProps<'/admin/articles'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Articles" />}>
      <ContentIndex type="article" searchParams={searchParams} />
    </Suspense>
  )
}

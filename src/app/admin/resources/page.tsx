import type { Metadata } from 'next'

import { ContentIndex } from '@/components/admin/content-index'

export const metadata: Metadata = { title: 'Resources' }

export default function AdminResourcesPage({ searchParams }: PageProps<'/admin/resources'>) {
  return <ContentIndex type="resource" searchParams={searchParams} />
}

import type { Metadata } from 'next'

import { ContentIndex } from '@/components/admin/content-index'

export const metadata: Metadata = { title: 'Downloads' }

export default function AdminDownloadsPage({ searchParams }: PageProps<'/admin/downloads'>) {
  return <ContentIndex type="download" searchParams={searchParams} />
}

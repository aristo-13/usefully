import type { Metadata } from 'next'

import { ContentIndex } from '@/components/admin/content-index'

export const metadata: Metadata = { title: 'Tutorials' }

export default function AdminTutorialsPage({ searchParams }: PageProps<'/admin/tutorials'>) {
  return <ContentIndex type="tutorial" searchParams={searchParams} />
}

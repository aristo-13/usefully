import type { Metadata } from 'next'

import { ContentIndex } from '@/components/admin/content-index'

export const metadata: Metadata = { title: 'Articles' }

export default function AdminArticlesPage({ searchParams }: PageProps<'/admin/articles'>) {
  return <ContentIndex type="article" searchParams={searchParams} />
}

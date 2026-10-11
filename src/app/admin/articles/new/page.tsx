import type { Metadata } from 'next'

import { ContentEditor } from '@/components/admin/content-editor'

export const metadata: Metadata = { title: 'New article' }

export default function NewArticlePage() {
  return <ContentEditor type="article" />
}

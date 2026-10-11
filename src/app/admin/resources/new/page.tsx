import type { Metadata } from 'next'

import { ContentEditor } from '@/components/admin/content-editor'

export const metadata: Metadata = { title: 'New resource' }

export default function NewResourcePage() {
  return <ContentEditor type="resource" />
}

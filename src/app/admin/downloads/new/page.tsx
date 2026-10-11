import type { Metadata } from 'next'

import { ContentEditor } from '@/components/admin/content-editor'

export const metadata: Metadata = { title: 'New download' }

export default function NewDownloadPage() {
  return <ContentEditor type="download" />
}

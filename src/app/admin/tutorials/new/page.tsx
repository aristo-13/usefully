import type { Metadata } from 'next'

import { ContentEditor } from '@/components/admin/content-editor'

export const metadata: Metadata = { title: 'New tutorial' }

export default function NewTutorialPage() {
  return <ContentEditor type="tutorial" />
}

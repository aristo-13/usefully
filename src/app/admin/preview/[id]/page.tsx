import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ContentArticle } from '@/components/content/content-article'
import { Notice } from '@/components/admin/ui'
import { getContentForPreview } from '@/lib/admin/queries'
import { requireAdmin } from '@/lib/auth'
import { contentPath, contentTypeConfig, statusLabels } from '@/lib/content/types'

export const metadata: Metadata = { title: 'Preview' }

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PreviewPage({ params }: PageProps<'/admin/preview/[id]'>) {
  await requireAdmin()
  const { id } = await params
  if (!GUID.test(id)) notFound()
  const item = await getContentForPreview(id)
  if (!item) notFound()

  const editHref = `${contentTypeConfig[item.type].adminPath}/${item.id}`

  return (
    <>
      <Notice tone={item.status === 'published' ? 'info' : 'warning'}>
        <strong>Preview · {statusLabels[item.status]}.</strong>{' '}
        {item.status === 'published' ? (
          <>
            This is the saved version.{' '}
            <a href={contentPath(item.type, item.slug)} target="_blank" rel="noopener" className="underline">
              Open the live page
            </a>
            .
          </>
        ) : (
          'Only admins can see this page until it is published.'
        )}{' '}
        <Link href={editHref} className="font-medium underline">
          Back to the editor
        </Link>
      </Notice>
      <div className="-mx-4 rounded-lg border border-border md:mx-0">
        <ContentArticle item={item} preview />
      </div>
    </>
  )
}

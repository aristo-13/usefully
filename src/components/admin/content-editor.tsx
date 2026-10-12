import { notFound } from 'next/navigation'

import { ContentForm } from '@/components/admin/content-form'
import { DeleteButton } from '@/components/admin/delete-button'
import { PageHeader } from '@/components/admin/ui'
import { deleteContent } from '@/lib/admin/content-actions'
import {
  getEditableContent,
  listAuthors,
  listCategoryOptions,
  listMediaOptions,
  listTagOptions,
} from '@/lib/admin/queries'
import { requireAdmin } from '@/lib/auth'
import { contentTypeConfig, isContentStatus, type ContentType } from '@/lib/content/types'
import { siteConfig } from '@/lib/site'

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const savedNotices = {
  draft: 'Draft created.',
  in_review: 'Created and marked as ready for review.',
  published: 'Published. The page is now live.',
} as const

export async function ContentEditor({
  type,
  params,
  searchParams,
}: {
  type: ContentType
  params?: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const admin = await requireAdmin()
  const id = params ? (await params).id : undefined
  if (id !== undefined && !GUID.test(id)) notFound()

  const [item, categories, tags, authors, media, query] = await Promise.all([
    id ? getEditableContent(id) : Promise.resolve(null),
    listCategoryOptions(),
    listTagOptions(),
    listAuthors(),
    listMediaOptions(),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ])
  if (id && (!item || item.type !== type)) notFound()

  const config = contentTypeConfig[type]
  const saved = typeof query.saved === 'string' ? query.saved : ''
  const notice = isContentStatus(saved)
    ? `${savedNotices[saved]}${query.tags === 'failed' ? ' The tags could not be saved; please try again.' : ''}`
    : undefined

  return (
    <>
      <PageHeader
        backHref={config.adminPath}
        backLabel={config.plural}
        title={item ? item.title || `Untitled ${config.label.toLowerCase()}` : `New ${config.label.toLowerCase()}`}
        description={item ? `Editing ${config.label.toLowerCase()}` : config.description}
      />

      <ContentForm
        key={item?.id ?? 'new'}
        type={type}
        item={item}
        categories={categories}
        tags={tags}
        authors={authors}
        media={media}
        defaultAuthorId={admin.id}
        siteUrl={siteConfig.url}
        notice={notice}
      />

      {item ? (
        <section className="mt-12 max-w-xl space-y-3 border-t border-border pt-6">
          <h2 className="text-base font-semibold text-foreground">Delete this {config.label.toLowerCase()}</h2>
          <p className="text-sm text-muted-foreground">
            Permanently removes the item{type === 'download' ? ' and its uploaded file' : ''}. To take a live page
            offline but keep it, use Unpublish instead.
          </p>
          <DeleteButton
            action={deleteContent.bind(null, item.id)}
            confirmMessage={`Delete “${item.title}” permanently? This cannot be undone.`}
            label={`Delete ${config.label.toLowerCase()}`}
          />
        </section>
      ) : null}
    </>
  )
}

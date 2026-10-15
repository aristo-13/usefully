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
import type { ContentDraft } from '@/lib/admin/types'
import { sourceSchema, splitList } from '@/lib/admin/validation'
import { aiSetup } from '@/lib/ai/writer'
import { requireAdmin } from '@/lib/auth'
import { contentTypeConfig, isContentStatus, type ContentType } from '@/lib/content/types'
import { parseVideoUrl } from '@/lib/media'
import { siteConfig } from '@/lib/site'
import { photosEnabled } from '@/lib/stock-photos'

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const savedNotices = {
  draft: 'Draft created.',
  in_review: 'Created and marked as ready for review.',
  published: 'Published. The page is now live.',
} as const

/**
 * Starting values for a new post from the URL, e.g. /admin/articles/new?title=…
 * (the Trends page links here). Each value is checked like the saved field.
 */
function draftFrom(query: Record<string, string | string[] | undefined>, type: ContentType): ContentDraft | undefined {
  const text = (key: string, max: number) => (typeof query[key] === 'string' ? query[key].trim().slice(0, max) : '')
  const title = text('title', 200)
  const keywords = splitList(text('keywords', 500))
    .filter((keyword) => keyword.length <= 50)
    .slice(0, 10)
  const source = sourceSchema.safeParse({
    title: text('source_title', 200) || text('source_url', 200),
    url: text('source_url', 2000),
    publisher: text('source_publisher', 100),
  })
  const videoUrl = type === 'resource' && parseVideoUrl(text('video_url', 2000)) ? text('video_url', 2000) : ''
  const context = text('context', 1000)
  if (!title && !keywords.length && !source.success && !videoUrl && !context) return undefined
  return {
    title,
    keywords,
    source: source.success
      ? { title: source.data.title, url: source.data.url, ...(source.data.publisher ? { publisher: source.data.publisher } : {}) }
      : null,
    videoUrl,
    context,
    region: query.region === 'ghana' || query.region === 'global' ? query.region : null,
    autoDraft: query.ai === '1',
  }
}

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
        draft={item ? undefined : draftFrom(query, type)}
        aiProvider={aiSetup().provider}
        photosEnabled={photosEnabled()}
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

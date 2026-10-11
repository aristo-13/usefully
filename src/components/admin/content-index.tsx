import Form from 'next/form'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { EmptyRow, Notice, PageHeader, StatusBadge, tableClass, tdClass, thClass } from '@/components/admin/ui'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listContent } from '@/lib/admin/queries'
import { requireAdmin } from '@/lib/auth'
import {
  CONTENT_STATUSES,
  contentPath,
  contentTypeConfig,
  isContentStatus,
  statusLabels,
  type ContentStatus,
  type ContentType,
} from '@/lib/content/types'
import { cn, formatShortDate } from '@/lib/utils'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

function listHref(basePath: string, params: { status?: ContentStatus | null; q?: string; page?: number }) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.q) query.set('q', params.q)
  if (params.page && params.page > 1) query.set('page', String(params.page))
  const suffix = query.toString()
  return suffix ? `${basePath}?${suffix}` : basePath
}

export async function ContentIndex({ type, searchParams }: { type: ContentType; searchParams: SearchParams }) {
  await requireAdmin()
  const config = contentTypeConfig[type]
  const params = await searchParams

  const statusParam = first(params.status)
  const status = isContentStatus(statusParam) ? statusParam : null
  const query = first(params.q).trim().slice(0, 100)
  const page = Math.max(1, Math.min(10000, Number.parseInt(first(params.page), 10) || 1))

  const { items, total, totalPages } = await listContent({ type, status, query, page })
  const showClicks = type === 'resource' || type === 'download'

  return (
    <>
      <PageHeader
        title={config.plural}
        description={`${total} ${total === 1 ? 'item' : 'items'}${status ? ` · ${statusLabels[status]}` : ''}${query ? ` · matching “${query}”` : ''}`}
        actions={
          <Link href={`${config.adminPath}/new`} className={buttonVariants()}>
            <Plus aria-hidden />
            New {config.label.toLowerCase()}
          </Link>
        }
      />

      {first(params.deleted) ? <Notice tone="success">The item was deleted.</Notice> : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status">
          <ul className="flex flex-wrap gap-1 text-sm">
            {[null, ...CONTENT_STATUSES].map((option) => (
              <li key={option ?? 'all'}>
                <Link
                  href={listHref(config.adminPath, { status: option, q: query })}
                  aria-current={option === status ? 'page' : undefined}
                  className={cn(
                    'inline-block rounded-md px-3 py-1.5 hover:bg-accent',
                    option === status ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {option ? statusLabels[option] : 'All'}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Form action={config.adminPath} className="flex gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="admin-search" className="sr-only">
            Search titles
          </label>
          <Input id="admin-search" name="q" type="search" placeholder="Search titles…" defaultValue={query} className="w-56" />
          <button type="submit" className={buttonVariants({ variant: 'outline' })}>
            Search
          </button>
        </Form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className={tableClass}>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className={thClass}>
                Title
              </th>
              <th scope="col" className={thClass}>
                Status
              </th>
              <th scope="col" className={thClass}>
                Category
              </th>
              <th scope="col" className={thClass}>
                Updated
              </th>
              {showClicks ? (
                <th scope="col" className={cn(thClass, 'text-right')}>
                  {type === 'download' ? 'Downloads' : 'Clicks'}
                </th>
              ) : null}
              <th scope="col" className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className={cn(tdClass, 'max-w-md')}>
                    <Link href={`${config.adminPath}/${item.id}`} className="font-medium text-foreground hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">/{item.slug}</p>
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={item.status} />
                      {item.aiGenerated ? <Badge tone="info">AI-assisted</Badge> : null}
                    </div>
                  </td>
                  <td className={cn(tdClass, 'text-muted-foreground')}>{item.categoryName ?? '—'}</td>
                  <td className={cn(tdClass, 'whitespace-nowrap text-muted-foreground')}>{formatShortDate(item.updatedAt)}</td>
                  {showClicks ? <td className={cn(tdClass, 'text-right tabular-nums')}>{item.clickCount}</td> : null}
                  <td className={cn(tdClass, 'whitespace-nowrap text-right')}>
                    <Link href={`/admin/preview/${item.id}`} className="text-link hover:underline">
                      Preview
                    </Link>
                    {item.status === 'published' ? (
                      <>
                        <span aria-hidden className="mx-2 text-muted-foreground">
                          ·
                        </span>
                        <a href={contentPath(item.type, item.slug)} target="_blank" rel="noopener" className="text-link hover:underline">
                          View<span className="sr-only"> {item.title} (opens in a new tab)</span>
                        </a>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={showClicks ? 6 : 5}>
                {query || status ? 'Nothing matches these filters.' : `No ${config.plural.toLowerCase()} yet.`}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={listHref(config.adminPath, { status, q: query, page: page - 1 })} className="text-link hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={listHref(config.adminPath, { status, q: query, page: page + 1 })} className="text-link hover:underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  )
}

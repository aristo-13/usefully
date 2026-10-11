import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Notice, PageHeader, Panel, StatusBadge, tableClass, tdClass, thClass } from '@/components/admin/ui'
import { buttonVariants } from '@/components/ui/button'
import { getDashboardData } from '@/lib/admin/queries'
import type { AdminContentRow } from '@/lib/admin/types'
import { requireAdmin } from '@/lib/auth'
import { CONTENT_STATUSES, CONTENT_TYPES, contentTypeConfig, statusLabels } from '@/lib/content/types'
import { cn, formatShortDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }

function ItemList({ items, empty }: { items: AdminContentRow[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <Link
              href={`${contentTypeConfig[item.type].adminPath}/${item.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {item.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {contentTypeConfig[item.type].label} · updated {formatShortDate(item.updatedAt)}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </li>
      ))}
    </ul>
  )
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin()
  const { counts, inReview, recent } = await getDashboardData()

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome${admin.displayName ? `, ${admin.displayName}` : ''}.`}
        actions={CONTENT_TYPES.map((type) => (
          <Link
            key={type}
            href={`${contentTypeConfig[type].adminPath}/new`}
            className={buttonVariants({ variant: type === 'article' ? 'default' : 'outline' })}
          >
            <Plus aria-hidden />
            {contentTypeConfig[type].label}
          </Link>
        ))}
      />

      {!admin.displayName ? (
        <Notice tone="warning">
          Add your name in <Link href="/admin/settings" className="font-medium underline">Settings</Link> so
          published pages show a proper author byline.
        </Notice>
      ) : null}
      {!process.env.NEXT_PUBLIC_SITE_URL ? (
        <Notice tone="warning">
          NEXT_PUBLIC_SITE_URL is not set, so canonical URLs and the sitemap use a placeholder address. Set it to your
          domain before going live.
        </Notice>
      ) : null}

      <div className="space-y-6">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <caption className="sr-only">Content by type and status</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className={thClass}>
                  Type
                </th>
                {CONTENT_STATUSES.map((status) => (
                  <th key={status} scope="col" className={cn(thClass, 'text-right')}>
                    {statusLabels[status]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONTENT_TYPES.map((type) => (
                <tr key={type}>
                  <th scope="row" className={cn(tdClass, 'font-medium')}>
                    <Link href={contentTypeConfig[type].adminPath} className="hover:underline">
                      {contentTypeConfig[type].plural}
                    </Link>
                  </th>
                  {CONTENT_STATUSES.map((status) => (
                    <td key={status} className={cn(tdClass, 'text-right tabular-nums')}>
                      <Link href={`${contentTypeConfig[type].adminPath}?status=${status}`} className="hover:underline">
                        {counts[type][status]}
                      </Link>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Ready for review" description="Read, fact-check and publish, or send back to draft.">
            <ItemList items={inReview} empty="Nothing is waiting for review." />
          </Panel>
          <Panel title="Recently updated">
            <ItemList items={recent} empty="No content yet. Start by creating a category, then your first article." />
          </Panel>
        </div>
      </div>
    </>
  )
}

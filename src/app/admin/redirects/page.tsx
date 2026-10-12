import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { RedirectForm } from '@/components/admin/redirect-form'
import { AdminPageSkeleton, EmptyRow, Notice, PageHeader, Panel, tableClass, tdClass, thClass } from '@/components/admin/ui'
import { Badge } from '@/components/ui/badge'
import { listRedirects } from '@/lib/admin/queries'
import { requireAdmin } from '@/lib/auth'
import { siteConfig } from '@/lib/site'
import { cn, hostnameOf } from '@/lib/utils'

export const metadata: Metadata = { title: 'Redirects' }

export default function AdminRedirectsPage(props: PageProps<'/admin/redirects'>) {
  return (
    <Suspense fallback={<AdminPageSkeleton title="Redirects" />}>
      <RedirectList {...props} />
    </Suspense>
  )
}

async function RedirectList({ searchParams }: PageProps<'/admin/redirects'>) {
  await requireAdmin()
  const [redirects, params] = await Promise.all([listRedirects(), searchParams])

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Short links under /go/. Resources and downloads get a /go/ link automatically; add custom ones here. Every visit is counted."
      />
      {params.deleted ? <Notice tone="success">The redirect was deleted.</Notice> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className={thClass}>
                  Short link
                </th>
                <th scope="col" className={thClass}>
                  Destination
                </th>
                <th scope="col" className={cn(thClass, 'text-right')}>
                  Clicks
                </th>
              </tr>
            </thead>
            <tbody>
              {redirects.length ? (
                redirects.map((redirect) => (
                  <tr key={redirect.id} className="hover:bg-muted/30">
                    <td className={tdClass}>
                      <Link href={`/admin/redirects/${redirect.id}`} className="font-medium text-foreground hover:underline">
                        /go/{redirect.slug}
                      </Link>
                      {redirect.is_active ? null : (
                        <Badge tone="neutral" className="ml-2">
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className={cn(tdClass, 'max-w-xs truncate text-muted-foreground')} title={redirect.destination_url}>
                      {hostnameOf(redirect.destination_url)}
                    </td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{redirect.click_count}</td>
                  </tr>
                ))
              ) : (
                <EmptyRow colSpan={3}>No custom redirects yet.</EmptyRow>
              )}
            </tbody>
          </table>
        </div>
        <Panel title="Add a redirect">
          <RedirectForm siteUrl={siteConfig.url} />
        </Panel>
      </div>
    </>
  )
}

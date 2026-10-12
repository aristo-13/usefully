import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ActionButton } from '@/components/admin/action-button'
import { RefreshButton } from '@/components/admin/refresh-button'
import {
  ConnectSearchEngines,
  ContentChecks,
  IndexingPanel,
  PanelSkeleton,
  PerformancePanel,
  StatusCard,
} from '@/components/admin/seo'
import { AdminPageSkeleton, PageHeader, Panel } from '@/components/admin/ui'
import { refreshSearchData, submitAllToIndexNow, submitSitemap } from '@/lib/admin/growth-actions'
import { listAuditItems } from '@/lib/admin/queries'
import { requireAdmin } from '@/lib/auth'
import { contentPath } from '@/lib/content/types'
import {
  getIndexStatus,
  getSearchPerformance,
  getSitemaps,
  indexNowSetup,
  searchConsoleSetup,
  type Result,
} from '@/lib/search-engines'
import { auditContent, type AuditItem } from '@/lib/search-engines/audit'
import type { Inspection } from '@/lib/search-engines/search-console'
import { absoluteUrl, siteConfig } from '@/lib/site'

export const metadata: Metadata = { title: 'SEO' }

const day = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Africa/Accra' })

export default function AdminSeoPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton title="SEO" />}>
      <Seo />
    </Suspense>
  )
}

async function Seo() {
  await requireAdmin()
  const searchConsole = searchConsoleSetup()
  const indexNow = indexNowSetup()
  const items = await listAuditItems()
  const https = siteConfig.url.startsWith('https://')

  return (
    <>
      <PageHeader
        title="SEO"
        description="How search engines see the site, and what to do next. Google's figures come from Search Console; Bing and other engines are told about every change through IndexNow."
        actions={searchConsole.connected ? <RefreshButton action={refreshSearchData} /> : null}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Google Search Console"
          ok={searchConsole.connected}
          value={searchConsole.connected ? (searchConsole.property ?? '') : 'Not connected'}
          detail={searchConsole.connected ? null : searchConsole.message}
        />
        <StatusCard title="Bing and others (IndexNow)" ok={indexNow.enabled} value={indexNow.enabled ? 'On' : 'Off'} detail={indexNow.message} />
        <Suspense fallback={<StatusCard title="Sitemap on Google" ok={null} value="Checking…" />}>
          <SitemapStatus connected={searchConsole.connected} />
        </Suspense>
        <StatusCard
          title="Site address"
          ok={https}
          value={siteConfig.url}
          detail={https ? 'Served over https.' : 'Set NEXT_PUBLIC_SITE_URL to your https:// domain.'}
        />
      </div>

      <div className="space-y-6">
        {searchConsole.connected && searchConsole.property ? (
          <>
            <Suspense fallback={<PanelSkeleton title="Google search, last 28 days" />}>
              <Performance />
            </Suspense>
            <Suspense fallback={<PanelSkeleton title="Indexing on Google" />}>
              <Indexing items={items.slice(0, 20)} property={searchConsole.property} />
            </Suspense>
          </>
        ) : (
          <Panel title="Google search">
            <p className="text-sm text-muted-foreground">
              Connect Google Search Console to see which searches bring visitors, which pages Google has indexed, and where you are close to
              the first page.{' '}
              <a href="#connect" className="text-link underline">
                How to connect it
              </a>
            </p>
          </Panel>
        )}

        <Panel
          title="Bing and other search engines"
          description="Every time you publish, edit, unpublish or delete a published post, Bing, Yandex and other IndexNow engines are told straight away. Use this after first setting up IndexNow, to announce every page at once."
        >
          <ActionButton action={submitAllToIndexNow} label="Send all pages now" pendingLabel="Sending…" disabled={!indexNow.enabled} />
        </Panel>

        <ContentChecks results={auditContent(items, { siteName: siteConfig.name })} total={items.length} />

        <ConnectSearchEngines siteUrl={siteConfig.url} />
      </div>
    </>
  )
}

async function SitemapStatus({ connected }: { connected: boolean }) {
  if (!connected) return <StatusCard title="Sitemap on Google" ok={null} value="Unknown" detail="Connect Search Console to check." />
  const result = await getSitemaps()
  if (result.status !== 'ok') return <StatusCard title="Sitemap on Google" ok={false} value="Could not check" detail={result.message} />
  const sitemap = result.data.find((entry) => entry.path === absoluteUrl('/sitemap.xml'))
  if (!sitemap) {
    return (
      <StatusCard title="Sitemap on Google" ok={false} value="Not submitted" detail="Submitting it helps Google find every post.">
        <ActionButton action={submitSitemap} label="Submit sitemap" pendingLabel="Submitting…" variant="default" />
      </StatusCard>
    )
  }
  const problems = sitemap.errors + sitemap.warnings
  return (
    <StatusCard
      title="Sitemap on Google"
      ok={sitemap.errors === 0}
      value={sitemap.lastDownloaded ? `Read ${day.format(new Date(sitemap.lastDownloaded))}` : sitemap.isPending ? 'Waiting for Google' : 'Submitted'}
      detail={problems ? `${sitemap.errors} errors, ${sitemap.warnings} warnings: see Sitemaps in Search Console.` : 'No problems reported.'}
    >
      <ActionButton action={submitSitemap} label="Submit again" pendingLabel="Submitting…" />
    </StatusCard>
  )
}

async function Performance() {
  return <PerformancePanel result={await getSearchPerformance()} />
}

async function Indexing({ items, property }: { items: AuditItem[]; property: string }) {
  // A few at a time keeps within Google's per-minute limit; each result is cached for a day.
  const statuses: Result<Inspection>[] = []
  for (let start = 0; start < items.length; start += 5) {
    statuses.push(...(await Promise.all(items.slice(start, start + 5).map((item) => getIndexStatus(absoluteUrl(contentPath(item.type, item.slug)))))))
  }
  return (
    <IndexingPanel
      property={property}
      pages={items.map((item, index) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        slug: item.slug,
        url: absoluteUrl(contentPath(item.type, item.slug)),
        status: statuses[index],
      }))}
    />
  )
}

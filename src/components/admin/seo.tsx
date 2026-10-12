import Link from 'next/link'
import { CircleAlert, CircleCheck, ExternalLink } from 'lucide-react'

import { EmptyRow, Panel, tableClass, tdClass, thClass } from '@/components/admin/ui'
import { Badge } from '@/components/ui/badge'
import { contentPath, contentTypeConfig } from '@/lib/content/types'
import type { Performance, Result } from '@/lib/search-engines'
import type { AuditResult } from '@/lib/search-engines/audit'
import { describeCoverage, type Inspection, type SearchRow } from '@/lib/search-engines/search-console'
import { cn } from '@/lib/utils'

const whole = new Intl.NumberFormat('en')
const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 })
const decimal = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })
const day = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Africa/Accra' })

export function StatusCard({
  title,
  ok,
  value,
  detail,
  children,
}: {
  title: string
  ok: boolean | null
  value: string
  detail?: string | null
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 flex items-center gap-2 font-medium break-all text-foreground">
        {ok === null ? null : ok ? (
          <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
        ) : (
          <CircleAlert aria-hidden className="size-4 shrink-0 text-warning" />
        )}
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

export function PanelSkeleton({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <div aria-busy="true" className="space-y-3">
        <span className="sr-only">Loading…</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-8 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </Panel>
  )
}

function ResultProblem<T>({ result }: { result: Result<T> }) {
  if (result.status === 'ok') return null
  return <p className={cn('text-sm', result.status === 'error' ? 'font-medium text-destructive' : 'text-muted-foreground')}>{result.message}</p>
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function QueryTable({ rows, caption }: { rows: SearchRow[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className={tableClass}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className={thClass}>
              Search
            </th>
            <th scope="col" className={cn(thClass, 'text-right')}>
              Clicks
            </th>
            <th scope="col" className={cn(thClass, 'text-right')}>
              Impressions
            </th>
            <th scope="col" className={cn(thClass, 'text-right')}>
              Click rate
            </th>
            <th scope="col" className={cn(thClass, 'text-right')}>
              Position
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.keys.join('|')}>
                <td className={cn(tdClass, 'max-w-xs')}>{row.keys[0]}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{whole.format(row.clicks)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{whole.format(row.impressions)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{percent.format(row.ctr)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{decimal.format(row.position)}</td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={5}>No searches yet. New sites can take a few weeks to appear.</EmptyRow>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Totals({ totals }: { totals: SearchRow | null }) {
  const figures = [
    ['Clicks', totals ? whole.format(totals.clicks) : '0'],
    ['Impressions', totals ? whole.format(totals.impressions) : '0'],
    ['Click rate', totals ? percent.format(totals.ctr) : '–'],
    ['Average position', totals ? decimal.format(totals.position) : '–'],
  ]
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {figures.map(([label, value]) => (
        <div key={label} className="rounded-md border border-border p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-xl font-semibold text-foreground tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function PerformancePanel({ result }: { result: Result<Performance> }) {
  if (result.status !== 'ok') {
    return (
      <Panel title="Google search, last 28 days">
        <ResultProblem result={result} />
      </Panel>
    )
  }
  const { range, totals, queries, pages, opportunities } = result.data
  return (
    <>
      <Panel title="Google search, last 28 days" description={`${day.format(new Date(range.startDate))} to ${day.format(new Date(range.endDate))}. Google's data is about two days behind.`}>
        <Totals totals={totals} />
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Top searches</h3>
            <QueryTable rows={queries.slice(0, 10)} caption="Searches that showed this site, most clicked first" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Top pages</h3>
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {pages.length ? (
                pages.slice(0, 10).map((row) => (
                  <li key={row.keys[0]} className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <a href={row.keys[0]} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-link hover:underline">
                      {pathOf(row.keys[0])}
                    </a>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {whole.format(row.clicks)} clicks · {whole.format(row.impressions)} impressions
                    </span>
                  </li>
                ))
              ) : (
                <li className="px-3 py-8 text-center text-muted-foreground">No pages with clicks yet.</li>
              )}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel title="Opportunities" description="Searches where a little work is likely to bring more visitors.">
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Almost on the first page</h3>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              You appear in positions 4 to 20. Improve the page that ranks: answer the question more fully, use the search as a heading,
              and link to the page from related posts.
            </p>
            <QueryTable rows={opportunities.nearFirstPage} caption="Searches just off the first page" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Seen often, rarely clicked</h3>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              You are on the first page but under 2% of people click. Rewrite the SEO title and description so they match what people
              search for and promise a clear answer.
            </p>
            <QueryTable rows={opportunities.lowClickRate} caption="Searches with a low click rate" />
          </div>
        </div>
      </Panel>
    </>
  )
}

export function IndexingPanel({
  pages,
  property,
}: {
  pages: Array<{ id: string; title: string; type: keyof typeof contentTypeConfig; slug: string; url: string; status: Result<Inspection> }>
  property: string
}) {
  const indexed = pages.filter((page) => page.status.status === 'ok' && describeCoverage(page.status.data).indexed).length
  const firstProblem = pages.find((page) => page.status.status === 'error')?.status
  return (
    <Panel
      title="Indexing on Google"
      description={`${indexed} of the ${pages.length} most recent posts are in Google's index. Google lets only you request indexing: open a page in Search Console and choose Request indexing.`}
    >
      {firstProblem ? <ResultProblem result={firstProblem} /> : null}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className={tableClass}>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className={thClass}>
                Post
              </th>
              <th scope="col" className={thClass}>
                Google
              </th>
              <th scope="col" className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pages.length ? (
              pages.map((page) => {
                const coverage = page.status.status === 'ok' ? describeCoverage(page.status.data) : null
                return (
                  <tr key={page.id}>
                    <td className={cn(tdClass, 'max-w-sm')}>
                      <Link href={`${contentTypeConfig[page.type].adminPath}/${page.id}`} className="font-medium text-foreground hover:underline">
                        {page.title}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{contentPath(page.type, page.slug)}</p>
                    </td>
                    <td className={cn(tdClass, 'max-w-md')}>
                      {coverage ? (
                        <>
                          <Badge tone={coverage.indexed ? 'success' : 'warning'}>{coverage.label}</Badge>
                          {coverage.advice ? <p className="mt-1 text-xs text-muted-foreground">{coverage.advice}</p> : null}
                          {page.status.status === 'ok' && page.status.data.lastCrawlTime ? (
                            <p className="mt-1 text-xs text-muted-foreground">Last crawled {day.format(new Date(page.status.data.lastCrawlTime))}</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not checked</span>
                      )}
                    </td>
                    <td className={cn(tdClass, 'whitespace-nowrap text-right')}>
                      <a
                        href={`https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(property)}&id=${encodeURIComponent(page.url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-link hover:underline"
                      >
                        Inspect
                        <ExternalLink aria-hidden className="size-3.5" />
                        <span className="sr-only"> {page.title} in Search Console (opens in a new tab)</span>
                      </a>
                    </td>
                  </tr>
                )
              })
            ) : (
              <EmptyRow colSpan={3}>No published posts yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

export function ContentChecks({ results, total }: { results: AuditResult[]; total: number }) {
  const shown = results.slice(0, 50)
  return (
    <Panel
      title="Content checks"
      description={
        results.length
          ? `${results.length} of ${total} published posts have something to improve. Fix items likely hold a page back; Improve items are worthwhile gains.`
          : total
            ? `All ${total} published posts pass the checks.`
            : 'Checks run on published posts.'
      }
    >
      {shown.length ? (
        <ul className="divide-y divide-border">
          {shown.map(({ item, issues }) => (
            <li key={item.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {item.title}{' '}
                  <span className="text-xs font-normal text-muted-foreground">{contentTypeConfig[item.type].label}</span>
                </p>
                <ul className="mt-1.5 space-y-1">
                  {issues.map((issue) => (
                    <li key={issue.code} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Badge tone={issue.level === 'fix' ? 'warning' : 'neutral'} className="mt-0.5 shrink-0">
                        {issue.level === 'fix' ? 'Fix' : 'Improve'}
                      </Badge>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href={`${contentTypeConfig[item.type].adminPath}/${item.id}`} className="shrink-0 text-sm text-link hover:underline">
                Edit<span className="sr-only"> {item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {results.length > shown.length ? (
        <p className="mt-3 text-xs text-muted-foreground">Showing the first {shown.length}. Fix these and the rest will appear.</p>
      ) : null}
    </Panel>
  )
}

export function ConnectSearchEngines({ siteUrl }: { siteUrl: string }) {
  const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return (
    <details id="connect" className="group rounded-lg border border-border bg-card p-4 md:p-5">
      <summary className="cursor-pointer text-base font-semibold text-foreground">Connect search engines</summary>
      <div className="mt-4 space-y-5 text-sm text-muted-foreground">
        <section>
          <h3 className="font-semibold text-foreground">Google Search Console</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Add and verify the site in{' '}
              <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-link underline">
                Search Console
              </a>
              . A Domain property, verified with a DNS record, covers every address of the site.
            </li>
            <li>In Google Cloud, create a project, enable the Google Search Console API, then create a service account and a JSON key for it.</li>
            <li>In Search Console, open Settings, then Users and permissions, and add the service account&apos;s email address with Full permission (needed to submit the sitemap).</li>
            <li>
              On the server, set <code>GOOGLE_SERVICE_ACCOUNT_KEY</code> to the JSON key file&apos;s contents and <code>SEARCH_CONSOLE_PROPERTY</code> to{' '}
              <code>sc-domain:{host}</code> (or <code>{siteUrl}/</code> for a URL-prefix property). Never use a NEXT_PUBLIC_ name for them. Then redeploy.
            </li>
          </ol>
        </section>
        <section>
          <h3 className="font-semibold text-foreground">Bing and others (IndexNow)</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Pick a key of 8 to 128 letters, digits or dashes, for example the output of <code>node -e &quot;console.log(crypto.randomUUID())&quot;</code>.
            </li>
            <li>
              Set it as <code>INDEXNOW_KEY</code> on the server and redeploy. {siteUrl}/indexnow.txt should then show the key.
            </li>
            <li>Optional: add the site to Bing Webmaster Tools (it can import from Search Console) to see Bing&apos;s own reports.</li>
          </ol>
        </section>
        <p>
          Google offers no way to make it index ordinary pages faster. Keep the sitemap submitted, link new posts from older ones, publish genuinely
          useful pages, and request indexing in Search Console for the important ones.
        </p>
      </div>
    </details>
  )
}

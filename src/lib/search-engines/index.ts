import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { setting } from '@/lib/env'
import { isValidIndexNowKey, submitToIndexNow } from '@/lib/search-engines/indexnow'
import {
  SearchConsoleError,
  createSearchConsoleClient,
  findOpportunities,
  parseServiceAccount,
  reportRange,
  type Inspection,
  type SearchConsoleClient,
  type SearchRow,
  type SitemapInfo,
} from '@/lib/search-engines/search-console'
import { absoluteUrl, siteConfig } from '@/lib/site'

export type Result<T> =
  | { status: 'ok'; data: T; fetchedAt: string }
  | { status: 'error'; message: string }
  | { status: 'off'; message: string }

export type Performance = {
  range: { startDate: string; endDate: string }
  totals: SearchRow | null
  queries: SearchRow[]
  pages: SearchRow[]
  opportunities: ReturnType<typeof findOpportunities>
}

/** Every Search Console read is tagged with this; the Refresh button expires it. */
export const SEARCH_CONSOLE_TAG = 'search-console'

// Google updates performance data about once a day and index status less often.
const SIX_HOURS = { stale: 300, revalidate: 6 * 3600, expire: 86_400 }
const ONE_DAY = { stale: 3600, revalidate: 86_400, expire: 2 * 86_400 }
const RETRY = { stale: 30, revalidate: 120, expire: 600 }

let client: SearchConsoleClient | null = null

function searchConsole(): SearchConsoleClient | null {
  const account = parseServiceAccount(setting(process.env.GOOGLE_SERVICE_ACCOUNT_KEY))
  const property = setting(process.env.SEARCH_CONSOLE_PROPERTY)
  if (!account || !property) return null
  // One client per server instance, so its access token is reused.
  if (!client || client.property !== property) client = createSearchConsoleClient({ account, property })
  return client
}

/** Whether Search Console is set up, and if not, why. Never reveals the key. */
export function searchConsoleSetup(): { connected: boolean; property: string | null; message: string } {
  const key = setting(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  const property = setting(process.env.SEARCH_CONSOLE_PROPERTY) ?? null
  if (!key && !property) return { connected: false, property, message: 'See Connect search engines below.' }
  if (!parseServiceAccount(key)) {
    return { connected: false, property, message: 'GOOGLE_SERVICE_ACCOUNT_KEY is missing or is not a service account key.' }
  }
  if (!property) {
    return { connected: false, property, message: 'Set SEARCH_CONSOLE_PROPERTY to your property, e.g. sc-domain:usefully.live.' }
  }
  return { connected: true, property, message: 'Connected.' }
}

export function indexNowSetup(): { enabled: boolean; message: string } {
  const key = setting(process.env.INDEXNOW_KEY)
  if (!key) return { enabled: false, message: 'Not set up.' }
  if (!isValidIndexNowKey(key)) return { enabled: false, message: 'INDEXNOW_KEY must be 8 to 128 letters, digits or dashes.' }
  if (!siteConfig.url.startsWith('https://')) return { enabled: false, message: 'Runs on the live https:// site only.' }
  return { enabled: true, message: 'On: changes are announced as you publish.' }
}

function explain(error: unknown): string {
  if (error instanceof SearchConsoleError) {
    return error.status === 403
      ? `${error.message} Add the service account's email address as a user of this property in Search Console.`
      : error.message
  }
  return 'Search Console could not be reached. Try again in a few minutes.'
}

function failed<T>(scope: string, error: unknown): Result<T> {
  console.error(`[search-console] ${scope} failed: ${error instanceof Error ? error.message : String(error)}`)
  cacheLife(RETRY)
  return { status: 'error', message: explain(error) }
}

function notConnected<T>(): Result<T> {
  cacheLife(SIX_HOURS)
  return { status: 'off', message: 'Connect Google Search Console to see this.' }
}

/** Clicks, impressions, top queries and pages for the last 28 days with complete data. */
export async function getSearchPerformance(): Promise<Result<Performance>> {
  'use cache'
  cacheTag(SEARCH_CONSOLE_TAG)

  const searchConsoleClient = searchConsole()
  if (!searchConsoleClient) return notConnected()
  const range = reportRange(28)
  try {
    const [totals, queries, pages] = await Promise.all([
      searchConsoleClient.searchAnalytics(range),
      searchConsoleClient.searchAnalytics({ ...range, dimensions: ['query'], rowLimit: 500 }),
      searchConsoleClient.searchAnalytics({ ...range, dimensions: ['page'], rowLimit: 25 }),
    ])
    cacheLife(SIX_HOURS)
    return {
      status: 'ok',
      fetchedAt: new Date().toISOString(),
      data: { range, totals: totals[0] ?? null, queries: queries.slice(0, 25), pages, opportunities: findOpportunities(queries) },
    }
  } catch (error) {
    return failed('performance', error)
  }
}

/** Google's index status for one page (the URL Inspection API allows 2,000 checks a day). */
export async function getIndexStatus(url: string): Promise<Result<Inspection>> {
  'use cache'
  cacheTag(SEARCH_CONSOLE_TAG)

  const searchConsoleClient = searchConsole()
  if (!searchConsoleClient) return notConnected()
  try {
    const data = await searchConsoleClient.inspect(url)
    cacheLife(ONE_DAY)
    return { status: 'ok', fetchedAt: new Date().toISOString(), data }
  } catch (error) {
    return failed('inspection', error)
  }
}

export async function getSitemaps(): Promise<Result<SitemapInfo[]>> {
  'use cache'
  cacheTag(SEARCH_CONSOLE_TAG)

  const searchConsoleClient = searchConsole()
  if (!searchConsoleClient) return notConnected()
  try {
    const data = await searchConsoleClient.sitemaps()
    cacheLife(SIX_HOURS)
    return { status: 'ok', fetchedAt: new Date().toISOString(), data }
  } catch (error) {
    return failed('sitemaps', error)
  }
}

export async function submitSitemapToGoogle(): Promise<{ ok: boolean; message: string }> {
  const searchConsoleClient = searchConsole()
  if (!searchConsoleClient) return { ok: false, message: 'Connect Google Search Console first.' }
  try {
    await searchConsoleClient.submitSitemap(absoluteUrl('/sitemap.xml'))
    return { ok: true, message: 'Sitemap submitted to Google. It usually reads it within a day.' }
  } catch (error) {
    console.error(`[search-console] sitemap submission failed: ${error instanceof Error ? error.message : String(error)}`)
    return { ok: false, message: explain(error) }
  }
}

export async function submitToIndexNowEngines(paths: string[]): Promise<{ ok: boolean; message: string }> {
  const setup = indexNowSetup()
  const key = setting(process.env.INDEXNOW_KEY)
  if (!setup.enabled || !key) return { ok: false, message: setup.message }
  try {
    const result = await submitToIndexNow({ siteUrl: siteConfig.url, key, urls: paths.map((path) => absoluteUrl(path)) })
    return { ok: result.ok, message: result.ok ? `${result.count} pages sent. ${result.message}` : result.message }
  } catch (error) {
    console.error(`[indexnow] failed: ${error instanceof Error ? error.message : String(error)}`)
    return { ok: false, message: 'IndexNow could not be reached. Try again later.' }
  }
}

/** Announces changed pages to IndexNow search engines. For after(): never throws, quiet when not set up. */
export async function notifySearchEngines(paths: string[]): Promise<void> {
  if (!indexNowSetup().enabled) return
  const result = await submitToIndexNowEngines(paths)
  if (!result.ok) console.error(`[indexnow] ${result.message}`)
}

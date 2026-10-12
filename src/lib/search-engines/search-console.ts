// Google Search Console API client for a service account. Uses Node built-ins
// only (no project imports), so it can be tested on its own.

import { createSign } from 'node:crypto'

export type ServiceAccount = { client_email: string; private_key: string }

export type SearchRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

export type Inspection = {
  /** PASS (indexed), NEUTRAL (not indexed, e.g. excluded on purpose) or FAIL. */
  verdict: string
  coverageState: string
  lastCrawlTime: string | null
  googleCanonical: string | null
}

export type SitemapInfo = {
  path: string
  lastSubmitted: string | null
  lastDownloaded: string | null
  isPending: boolean
  errors: number
  warnings: number
}

export const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters'
const API = 'https://searchconsole.googleapis.com'

export class SearchConsoleError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** The service account key: the downloaded JSON file's contents, or that JSON base64-encoded. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const json = JSON.parse(value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8'))
    if (typeof json?.client_email !== 'string' || typeof json?.private_key !== 'string') return null
    // Environment variables often carry the key's newlines as "\n".
    return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, '\n') }
  } catch {
    return null
  }
}

/** A signed JWT that Google exchanges for an access token (RS256). */
export function signJwt(account: ServiceAccount, scope: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.client_email,
    scope,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key).toString('base64url')
  return `${unsigned}.${signature}`
}

/** Start and end dates (YYYY-MM-DD) of the last `days` days with complete data (Google lags about two days). */
export function reportRange(days: number, now = new Date()): { startDate: string; endDate: string } {
  const end = new Date(now.getTime() - 2 * 86_400_000)
  const start = new Date(end.getTime() - (days - 1) * 86_400_000)
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

export function createSearchConsoleClient({
  account,
  property,
  fetch: fetchImpl = fetch,
}: {
  account: ServiceAccount
  /** The Search Console property, e.g. "sc-domain:example.com" or "https://example.com/". */
  property: string
  fetch?: typeof fetch
}) {
  let token: { value: string; expiresAt: number } | null = null

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value
    const response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signJwt(account, SEARCH_CONSOLE_SCOPE),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || typeof json.access_token !== 'string') {
      throw new SearchConsoleError(`Google sign-in failed: ${json.error_description ?? json.error ?? `HTTP ${response.status}`}`, response.status)
    }
    token = { value: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 }
    return token.value
  }

  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetchImpl(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    })
    const json = response.status === 204 ? {} : await response.json().catch(() => ({}))
    if (!response.ok) throw new SearchConsoleError(json?.error?.message ?? `HTTP ${response.status}`, response.status)
    return json as T
  }

  const site = `/webmasters/v3/sites/${encodeURIComponent(property)}`

  return {
    property,

    async searchAnalytics(query: {
      startDate: string
      endDate: string
      dimensions?: Array<'query' | 'page' | 'country' | 'device' | 'date'>
      rowLimit?: number
    }): Promise<SearchRow[]> {
      const json = await call<{ rows?: SearchRow[] }>(`${site}/searchAnalytics/query`, { method: 'POST', body: query })
      return (json.rows ?? []).map((row) => ({
        keys: row.keys ?? [],
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        ctr: Number(row.ctr) || 0,
        position: Number(row.position) || 0,
      }))
    },

    async inspect(url: string): Promise<Inspection> {
      const json = await call<{
        inspectionResult?: {
          indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string; googleCanonical?: string }
        }
      }>('/v1/urlInspection/index:inspect', { method: 'POST', body: { inspectionUrl: url, siteUrl: property, languageCode: 'en-US' } })
      const result = json.inspectionResult?.indexStatusResult ?? {}
      return {
        verdict: result.verdict ?? 'VERDICT_UNSPECIFIED',
        coverageState: result.coverageState ?? '',
        lastCrawlTime: result.lastCrawlTime ?? null,
        googleCanonical: result.googleCanonical ?? null,
      }
    },

    async sitemaps(): Promise<SitemapInfo[]> {
      const json = await call<{
        sitemap?: Array<{
          path?: string
          lastSubmitted?: string
          lastDownloaded?: string
          isPending?: boolean
          errors?: string | number
          warnings?: string | number
        }>
      }>(`${site}/sitemaps`)
      return (json.sitemap ?? []).flatMap((entry) =>
        entry.path
          ? [
              {
                path: entry.path,
                lastSubmitted: entry.lastSubmitted ?? null,
                lastDownloaded: entry.lastDownloaded ?? null,
                isPending: Boolean(entry.isPending),
                errors: Number(entry.errors) || 0,
                warnings: Number(entry.warnings) || 0,
              },
            ]
          : [],
      )
    },

    async submitSitemap(url: string): Promise<void> {
      await call(`${site}/sitemaps/${encodeURIComponent(url)}`, { method: 'PUT' })
    },
  }
}

export type SearchConsoleClient = ReturnType<typeof createSearchConsoleClient>

/**
 * Queries worth acting on: ones just off the first page (a better page can
 * move them up) and ones seen often but rarely clicked (the title and
 * description could be clearer).
 */
export function findOpportunities(queries: SearchRow[]) {
  const byImpressions = (a: SearchRow, b: SearchRow) => b.impressions - a.impressions
  return {
    nearFirstPage: queries.filter((row) => row.position > 3 && row.position <= 20 && row.impressions >= 20).sort(byImpressions).slice(0, 10),
    lowClickRate: queries.filter((row) => row.position <= 10 && row.impressions >= 100 && row.ctr < 0.02).sort(byImpressions).slice(0, 10),
  }
}

/** Plain-language meaning of a URL Inspection coverage state. */
export function describeCoverage(inspection: Inspection): { indexed: boolean; label: string; advice: string } {
  const state = inspection.coverageState
  if (inspection.verdict === 'PASS') return { indexed: true, label: 'Indexed', advice: '' }
  if (/discovered/i.test(state)) {
    return { indexed: false, label: 'Found, not crawled yet', advice: 'Google knows the page but has not visited it. Link to it from related posts and give it time.' }
  }
  if (/crawled/i.test(state)) {
    return { indexed: false, label: 'Crawled, not indexed', advice: 'Google read the page and chose not to index it yet. Make it more complete and useful than similar pages, then request indexing.' }
  }
  if (/unknown/i.test(state)) {
    return { indexed: false, label: 'Unknown to Google', advice: 'Google has not found this page. Submit the sitemap and request indexing in Search Console.' }
  }
  if (/noindex/i.test(state)) return { indexed: false, label: 'Excluded by noindex', advice: 'Turn off noindex in the editor if this page should be found.' }
  if (/canonical|duplicate/i.test(state)) {
    return { indexed: false, label: 'Treated as a duplicate', advice: 'Google picked another page as the main version. Check the canonical URL and make the content distinct.' }
  }
  return { indexed: false, label: state || 'Not indexed', advice: 'Open the page in Search Console for details.' }
}

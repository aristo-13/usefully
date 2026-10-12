import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { setting } from '@/lib/env'
import { siteConfig } from '@/lib/site'
import {
  GHANA,
  GLOBAL_MARKETS,
  GLOBAL_VIDEO_MARKETS,
  GOOGLE_NEWS_GHANA,
  GOOGLE_NEWS_WORLD,
  X_LOCATIONS,
  googleTrendsUrl,
  hasLatinLetters,
  mergeTrends,
  mergeVideos,
  parseGoogleNews,
  parseGoogleTrends,
  parseWikipediaMostRead,
  parseXTrends,
  parseYouTubeTrending,
  wikipediaFeedUrl,
  xTrendsUrl,
  youtubeTrendingUrl,
  type Headline,
  type ReadingTrend,
  type SearchTrend,
  type SocialTrend,
  type TrendingVideo,
} from '@/lib/trends/sources'

export type Region = 'ghana' | 'global'

export type SourceResult<T> =
  | { status: 'ok'; items: T[]; fetchedAt: string }
  | { status: 'error'; message: string }
  | { status: 'off'; message: string }

/** Every trends read is tagged with this; the Refresh button expires it. */
export const TRENDS_TAG = 'trends'

// Fresh for 15 minutes while someone is looking; failed reads are retried after a minute.
const FRESH = { stale: 300, revalidate: 900, expire: 3600 }
const RETRY = { stale: 30, revalidate: 60, expire: 300 }

const USER_AGENT = `${siteConfig.name.replace(/\s+/g, '')}Trends/1.0 (+${siteConfig.url})`

async function download(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

function ok<T>(items: T[]): SourceResult<T> {
  cacheLife(FRESH)
  return { status: 'ok', items, fetchedAt: new Date().toISOString() }
}

function failed<T>(source: string, error: unknown, message?: string): SourceResult<T> {
  // Never log request URLs: some of them carry API keys.
  console.error(`[trends] ${source} failed: ${error instanceof Error ? error.message : String(error)}`)
  cacheLife(RETRY)
  return { status: 'error', message: message ?? `${source} could not be reached. Try again in a few minutes.` }
}

function off<T>(message: string): SourceResult<T> {
  cacheLife(FRESH)
  return { status: 'off', message }
}

/** Top Google searches: Ghana, or several large markets combined. */
export async function getSearchTrends(region: Region): Promise<SourceResult<SearchTrend>> {
  'use cache'
  cacheTag(TRENDS_TAG)

  const markets = region === 'ghana' ? [GHANA] : GLOBAL_MARKETS
  const results = await Promise.allSettled(
    markets.map(async (market) => parseGoogleTrends(await (await download(googleTrendsUrl(market.code))).text(), market.name)),
  )
  const lists = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  if (!lists.length) {
    const reason = results.find((result) => result.status === 'rejected')?.reason
    return failed('Google Trends', reason)
  }
  if (region === 'ghana') return ok(lists[0])
  // Some markets trend in other scripts; keep topics an English-language site can use.
  return ok(mergeTrends(lists.map((list) => list.filter((trend) => hasLatinLetters(trend.term)))))
}

export async function getHeadlines(region: Region): Promise<SourceResult<Headline>> {
  'use cache'
  cacheTag(TRENDS_TAG)

  try {
    const response = await download(region === 'ghana' ? GOOGLE_NEWS_GHANA : GOOGLE_NEWS_WORLD)
    return ok(parseGoogleNews(await response.text()))
  } catch (error) {
    return failed('Google News', error)
  }
}

export async function getTrendingVideos(region: Region): Promise<SourceResult<TrendingVideo>> {
  'use cache'
  cacheTag(TRENDS_TAG)

  const key = setting(process.env.YOUTUBE_API_KEY)
  if (!key) return off('Add a free YouTube Data API key as YOUTUBE_API_KEY to see the most popular videos.')

  const markets = region === 'ghana' ? [GHANA] : GLOBAL_VIDEO_MARKETS
  try {
    const lists = await Promise.all(
      markets.map(async (market) => parseYouTubeTrending(await (await download(youtubeTrendingUrl(market.code, key))).json())),
    )
    return ok(region === 'ghana' ? lists[0] : mergeVideos(lists))
  } catch (error) {
    return failed('YouTube', error)
  }
}

export async function getXTrends(region: Region): Promise<SourceResult<SocialTrend>> {
  'use cache'
  cacheTag(TRENDS_TAG)

  const token = setting(process.env.X_BEARER_TOKEN)
  if (!token) {
    return off('X only shares trends through its paid API. Add the bearer token of a plan that includes trends as X_BEARER_TOKEN.')
  }

  try {
    const response = await fetch(xTrendsUrl(X_LOCATIONS[region]), {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 401 || response.status === 403) {
      return failed('X', new Error(`HTTP ${response.status}`), 'X refused the request. Check the token, and that your X API plan includes trends.')
    }
    if (response.status === 429) {
      return failed('X', new Error('HTTP 429'), 'The X API limit for now has been reached. Try again later.')
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return ok(parseXTrends(await response.json()))
  } catch (error) {
    return failed('X', error)
  }
}

/** Most-read English Wikipedia pages: a global signal of what people are looking up. */
export async function getMostRead(): Promise<SourceResult<ReadingTrend>> {
  'use cache'
  cacheTag(TRENDS_TAG)

  try {
    // Today's feed lists yesterday's most-read pages; early in the day it may not be ready.
    for (const daysAgo of [0, 1]) {
      const response = await download(wikipediaFeedUrl(new Date(Date.now() - daysAgo * 86_400_000)))
      const pages = parseWikipediaMostRead(await response.json())
      if (pages.length) return ok(pages)
    }
    return ok([])
  } catch (error) {
    return failed('Wikipedia', error)
  }
}

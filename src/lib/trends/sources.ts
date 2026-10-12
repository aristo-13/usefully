// Trend sources: addresses and parsers. Pure functions with no framework or
// project imports, so they can be tested on their own.

export type NewsLink = { title: string; url: string; source: string }

/** A search term that is trending on Google. */
export type SearchTrend = {
  term: string
  /** Google's rounded count of searches, e.g. "2,000+". */
  traffic: string
  trafficValue: number
  startedAt: string | null
  /** Countries where it is trending (several in the global list). */
  countries: string[]
  news: NewsLink[]
}

export type Headline = { title: string; url: string; source: string; publishedAt: string | null }

export type TrendingVideo = {
  id: string
  title: string
  channel: string
  views: number | null
  publishedAt: string | null
  thumbnail: string | null
  url: string
}

export type SocialTrend = { name: string; posts: number | null; url: string }

export type ReadingTrend = { title: string; description: string; views: number; url: string; thumbnail: string | null }

export type Market = { code: string; name: string }

export const GHANA: Market = { code: 'GH', name: 'Ghana' }

/** "Global" Google searches combine these markets; Google has no worldwide list. */
export const GLOBAL_MARKETS: Market[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IN', name: 'India' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
]

/** YouTube has no worldwide chart either; the global list combines these. */
export const GLOBAL_VIDEO_MARKETS: Market[] = GLOBAL_MARKETS.slice(0, 3)

/** Where On Earth IDs used by the X trends API. */
export const X_LOCATIONS = { ghana: 23424824, global: 1 } as const

// XML -------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const code = /^#x/i.test(entity) ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10)
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

function textOf(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return (cdata ? cdata[1] : decodeEntities(raw)).trim()
}

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Inner XML of every <name>…</name> element. */
export function elements(xml: string, name: string): string[] {
  const tag = escapeName(name)
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')
  return [...xml.matchAll(pattern)].map((match) => match[1])
}

/** Text of the first <name> element; empty when it is missing or self-closing. */
export function field(xml: string, name: string): string {
  const [first] = elements(xml, name)
  return first === undefined ? '' : textOf(first)
}

/** Only web links are passed on, so nothing like javascript: can reach a page. */
export function safeUrl(value: string | null | undefined): string {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

// Google Trends ("Trending now") ------------------------------------------------

export function googleTrendsUrl(countryCode: string): string {
  return `https://trends.google.com/trending/rss?geo=${encodeURIComponent(countryCode)}`
}

/** "200+", "2,000+", "20K+" or "1M+" as a number. */
export function trafficValue(text: string): number {
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([km])?/i)
  if (!match) return 0
  const multiplier = { k: 1e3, m: 1e6 }[match[2]?.toLowerCase() as 'k' | 'm'] ?? 1
  return Math.round(Number.parseFloat(match[1]) * multiplier)
}

export function parseGoogleTrends(xml: string, country: string): SearchTrend[] {
  return elements(xml, 'item')
    .map((item) => {
      const traffic = field(item, 'ht:approx_traffic')
      return {
        term: field(item, 'title'),
        traffic,
        trafficValue: trafficValue(traffic),
        startedAt: isoDate(field(item, 'pubDate')),
        countries: [country],
        news: elements(item, 'ht:news_item')
          .map((news) => ({
            title: field(news, 'ht:news_item_title'),
            url: safeUrl(field(news, 'ht:news_item_url')),
            source: field(news, 'ht:news_item_source'),
          }))
          .filter((news) => news.title && news.url)
          .slice(0, 3),
      }
    })
    .filter((trend) => trend.term)
}

/** True when a term contains Latin letters, i.e. one an English-language site can write about. */
export function hasLatinLetters(text: string): boolean {
  return /\p{Script=Latin}/u.test(text)
}

/** Combines several countries' lists: terms trending in more countries come first. */
export function mergeTrends(lists: SearchTrend[][], limit = 20): SearchTrend[] {
  const byTerm = new Map<string, SearchTrend>()
  for (const list of lists) {
    for (const trend of list) {
      const key = trend.term.toLocaleLowerCase()
      const existing = byTerm.get(key)
      if (!existing) {
        byTerm.set(key, { ...trend, countries: [...trend.countries], news: [...trend.news] })
        continue
      }
      for (const country of trend.countries) {
        if (!existing.countries.includes(country)) existing.countries.push(country)
      }
      existing.trafficValue += trend.trafficValue
      if (existing.news.length < 3) existing.news = [...existing.news, ...trend.news].slice(0, 3)
      if (trend.startedAt && (!existing.startedAt || trend.startedAt < existing.startedAt)) {
        existing.startedAt = trend.startedAt
      }
    }
  }
  return [...byTerm.values()]
    .sort((a, b) => b.countries.length - a.countries.length || b.trafficValue - a.trafficValue)
    .slice(0, limit)
}

// Google News -------------------------------------------------------------------

export const GOOGLE_NEWS_GHANA = 'https://news.google.com/rss?hl=en-GH&gl=GH&ceid=GH:en'
export const GOOGLE_NEWS_WORLD = 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en'

export function parseGoogleNews(xml: string, limit = 20): Headline[] {
  return elements(xml, 'item')
    .map((item) => {
      const source = field(item, 'source')
      const fullTitle = field(item, 'title')
      // Google appends " - Source" to every headline.
      const title = source && fullTitle.endsWith(` - ${source}`) ? fullTitle.slice(0, -(source.length + 3)) : fullTitle
      return { title, url: safeUrl(field(item, 'link')), source, publishedAt: isoDate(field(item, 'pubDate')) }
    })
    .filter((headline) => headline.title && headline.url)
    .slice(0, limit)
}

// Wikipedia ---------------------------------------------------------------------

/** Featured feed for a day; its "most read" list covers the day before. */
export function wikipediaFeedUrl(date: Date): string {
  const day = date.toISOString().slice(0, 10).replace(/-/g, '/')
  return `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${day}`
}

type WikipediaArticle = {
  normalizedtitle?: string
  description?: string
  views?: number
  content_urls?: { desktop?: { page?: string } }
  thumbnail?: { source?: string }
}

export function parseWikipediaMostRead(json: unknown, limit = 15): ReadingTrend[] {
  const articles = (json as { mostread?: { articles?: unknown } } | null)?.mostread?.articles
  if (!Array.isArray(articles)) return []
  return articles
    .flatMap((entry: WikipediaArticle) => {
      const title = entry?.normalizedtitle ?? ''
      const url = safeUrl(entry?.content_urls?.desktop?.page)
      if (!title || !url) return []
      return [
        {
          title,
          description: entry.description ?? '',
          views: Number(entry.views) || 0,
          url,
          thumbnail: safeUrl(entry.thumbnail?.source) || null,
        },
      ]
    })
    .slice(0, limit)
}

// YouTube -----------------------------------------------------------------------

export function youtubeTrendingUrl(regionCode: string, apiKey: string, maxResults = 12): string {
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    chart: 'mostPopular',
    regionCode,
    maxResults: String(maxResults),
    key: apiKey,
  })
  return `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`
}

type YouTubeVideo = {
  id?: unknown
  snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } }
  statistics?: { viewCount?: string }
}

export function parseYouTubeTrending(json: unknown): TrendingVideo[] {
  const items = (json as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) return []
  return items.flatMap((entry: YouTubeVideo) => {
    if (typeof entry?.id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(entry.id)) return []
    const views = Number(entry.statistics?.viewCount)
    return [
      {
        id: entry.id,
        title: entry.snippet?.title ?? '',
        channel: entry.snippet?.channelTitle ?? '',
        views: Number.isFinite(views) ? views : null,
        publishedAt: isoDate(entry.snippet?.publishedAt),
        thumbnail: safeUrl(entry.snippet?.thumbnails?.medium?.url) || null,
        url: `https://www.youtube.com/watch?v=${entry.id}`,
      },
    ]
  })
}

/** One list from several regions: duplicates removed, most viewed first. */
export function mergeVideos(lists: TrendingVideo[][], limit = 12): TrendingVideo[] {
  const byId = new Map<string, TrendingVideo>()
  for (const list of lists) for (const video of list) if (!byId.has(video.id)) byId.set(video.id, video)
  return [...byId.values()].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, limit)
}

// X -----------------------------------------------------------------------------

export function xTrendsUrl(woeid: number, maxTrends = 20): string {
  return `https://api.x.com/2/trends/by/woeid/${woeid}?max_trends=${maxTrends}`
}

export function parseXTrends(json: unknown): SocialTrend[] {
  const data = (json as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []
  return data.flatMap((entry: { trend_name?: unknown; tweet_count?: unknown }) => {
    if (typeof entry?.trend_name !== 'string' || !entry.trend_name) return []
    return [
      {
        name: entry.trend_name,
        posts: typeof entry.tweet_count === 'number' ? entry.tweet_count : null,
        url: `https://x.com/search?q=${encodeURIComponent(entry.trend_name)}`,
      },
    ]
  })
}

// Matching against existing posts ------------------------------------------------

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** The first post whose title mentions the term, to avoid writing the same story twice. */
export function findCoverage<T extends { title: string }>(term: string, posts: T[]): T | undefined {
  const needle = normalize(term)
  if (needle.length < 3) return undefined
  return posts.find((post) => ` ${normalize(post.title)} `.includes(` ${needle} `))
}

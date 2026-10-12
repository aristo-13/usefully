import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, PenLine, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import type { PostTitle } from '@/lib/admin/types'
import { contentTypeConfig, statusLabels, type ContentType } from '@/lib/content/types'
import type { Region, SourceResult } from '@/lib/trends'
import {
  findCoverage,
  type Headline,
  type ReadingTrend,
  type SearchTrend,
  type SocialTrend,
  type TrendingVideo,
} from '@/lib/trends/sources'
import { cn } from '@/lib/utils'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const clock = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: 'Africa/Accra' })

type Draft = {
  title?: string
  keywords?: string
  sourceUrl?: string
  sourceTitle?: string
  sourcePublisher?: string
  videoUrl?: string
  /** Why the topic is trending, passed to the AI writer. */
  context?: string
  region?: Region
}

/** Link to a new post with the title, keywords, source and video filled in. `ai` starts an AI draft at once. */
export function newPostHref(type: ContentType, draft: Draft, ai = false): string {
  const params = new URLSearchParams()
  const set = (key: string, value: string | undefined) => {
    if (value) params.set(key, value)
  }
  set('title', draft.title)
  set('keywords', draft.keywords)
  set('source_url', draft.sourceUrl)
  set('source_title', draft.sourceTitle)
  set('source_publisher', draft.sourcePublisher)
  set('video_url', draft.videoUrl)
  set('context', draft.context?.slice(0, 1000))
  set('region', draft.region)
  if (ai) params.set('ai', '1')
  return `${contentTypeConfig[type].adminPath}/new?${params.toString()}`
}

/** "in Ghana" or "worldwide". */
function placeOf(region: Region): string {
  return region === 'ghana' ? 'in Ghana' : 'worldwide'
}

/** A couple of related headlines, as background for the AI writer. */
function headlinesNote(news: { title: string; source: string }[]): string {
  if (!news.length) return ''
  const list = news
    .slice(0, 2)
    .map((item) => `"${item.title}" (${item.source})`)
    .join('; ')
  return ` Related headlines: ${list}.`
}

/** "12 min ago", measured from when the source was read (lists are cached briefly). */
function ago(from: string | null, now: string): string {
  if (!from) return ''
  const minutes = Math.max(0, Math.round((Date.parse(now) - Date.parse(from)) / 60_000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`
}

function ExternalAnchor({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn('text-link hover:underline', className)}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** "Write a post" opens the editor with the topic filled in; "Draft with AI" also starts an AI draft. */
function WriteLinks({
  type = 'article',
  draft,
  topic,
  label = 'Write a post',
  aiEnabled,
}: {
  type?: ContentType
  draft: Draft
  topic: string
  label?: string
  aiEnabled: boolean
}) {
  return (
    <div className="flex shrink-0 flex-col items-stretch gap-1.5">
      <Link href={newPostHref(type, draft)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        <PenLine aria-hidden />
        {label}
        <span className="sr-only"> about {topic}</span>
      </Link>
      {aiEnabled ? (
        // Not prefetched: opening it starts a paid AI draft.
        <Link
          href={newPostHref(type, draft, true)}
          prefetch={false}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          <Sparkles aria-hidden className="text-brand" />
          Draft with AI
          <span className="sr-only"> about {topic}</span>
        </Link>
      ) : null}
    </div>
  )
}

function Covered({ post }: { post: PostTitle | undefined }) {
  if (!post) return null
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Badge tone="success">Covered</Badge>
      <Link href={`${contentTypeConfig[post.type].adminPath}/${post.id}`} className="text-link hover:underline">
        {post.title}
      </Link>
      <span>({statusLabels[post.status]})</span>
    </p>
  )
}

/** Explains a source that is switched off, failed or empty. Returns null when there is a list to show. */
function SourceState<T>({ result }: { result: SourceResult<T> }) {
  if (result.status === 'off') {
    return (
      <p className="text-sm text-muted-foreground">
        {result.message}{' '}
        <a href="#connect" className="text-link underline">
          How to connect it
        </a>
      </p>
    )
  }
  if (result.status === 'error') return <p className="text-sm font-medium text-destructive">{result.message}</p>
  if (!result.items.length) return <p className="text-sm text-muted-foreground">Nothing to show right now.</p>
  return null
}

function Updated({ at }: { at: string }) {
  return <p className="mt-3 text-xs text-muted-foreground">Updated at {clock.format(new Date(at))} GMT</p>
}

export function TrendSection({
  id,
  title,
  source,
  children,
}: {
  id: string
  title: string
  source: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{source}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function SectionSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-10 animate-pulse rounded bg-muted" />
      ))}
    </div>
  )
}

export function RegionTabs({ region }: { region: Region }) {
  const tabs = [
    { value: 'ghana', label: 'Ghana', href: '/admin/trends' },
    { value: 'global', label: 'Global', href: '/admin/trends?region=global' },
  ] as const
  return (
    <nav aria-label="Region" className="mb-6 inline-flex rounded-md border border-border p-0.5 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          aria-current={region === tab.value ? 'page' : undefined}
          className={cn(
            'rounded px-4 py-1.5',
            region === tab.value ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

export function SearchTrendList({
  result,
  region,
  posts,
  aiEnabled,
}: {
  result: SourceResult<SearchTrend>
  region: Region
  posts: PostTitle[]
  aiEnabled: boolean
}) {
  if (result.status !== 'ok' || !result.items.length) return <SourceState result={result} />
  return (
    <>
      <ol className="divide-y divide-border">
        {result.items.map((trend, index) => {
          const lead = trend.news[0]
          return (
            <li key={trend.term} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
                  {trend.term}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {region === 'global' ? `Trending in ${trend.countries.join(', ')}` : `${trend.traffic} searches`}
                  {trend.startedAt ? ` · started ${ago(trend.startedAt, result.fetchedAt)}` : ''}
                </p>
                {trend.news.length ? (
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {trend.news.map((news) => (
                      <li key={news.url}>
                        <ExternalAnchor href={news.url}>{news.title}</ExternalAnchor>{' '}
                        <span className="text-xs text-muted-foreground">· {news.source}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Covered post={findCoverage(trend.term, posts)} />
              </div>
              <WriteLinks
                topic={trend.term}
                aiEnabled={aiEnabled}
                draft={{
                  title: trend.term,
                  keywords: trend.term,
                  sourceUrl: lead?.url,
                  sourceTitle: lead?.title,
                  sourcePublisher: lead?.source,
                  region,
                  context:
                    (region === 'global'
                      ? `Trending on Google in ${trend.countries.join(', ')}.`
                      : `Trending on Google in Ghana (${trend.traffic} searches).`) + headlinesNote(trend.news),
                }}
              />
            </li>
          )
        })}
      </ol>
      <Updated at={result.fetchedAt} />
    </>
  )
}

export function HeadlineList({
  result,
  region,
  aiEnabled,
}: {
  result: SourceResult<Headline>
  region: Region
  aiEnabled: boolean
}) {
  if (result.status !== 'ok' || !result.items.length) return <SourceState result={result} />
  return (
    <>
      <ul className="divide-y divide-border">
        {result.items.map((headline) => (
          <li key={headline.url} className="flex items-start justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0">
              <ExternalAnchor href={headline.url} className="font-medium">
                {headline.title}
              </ExternalAnchor>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {headline.source}
                {headline.publishedAt ? ` · ${ago(headline.publishedAt, result.fetchedAt)}` : ''}
              </p>
            </div>
            <WriteLinks
              topic={headline.title}
              aiEnabled={aiEnabled}
              draft={{
                title: headline.title,
                sourceUrl: headline.url,
                sourceTitle: headline.title,
                sourcePublisher: headline.source,
                region,
                context: `A top story on Google News ${region === 'ghana' ? '(Ghana edition)' : '(world news)'}, reported by ${headline.source}. Write an original, useful post about it for our readers, not a copy of the report.`,
              }}
            />
          </li>
        ))}
      </ul>
      <Updated at={result.fetchedAt} />
    </>
  )
}

export function VideoList({
  result,
  region,
  posts,
  aiEnabled,
}: {
  result: SourceResult<TrendingVideo>
  region: Region
  posts: PostTitle[]
  aiEnabled: boolean
}) {
  if (result.status !== 'ok' || !result.items.length) return <SourceState result={result} />
  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2">
        {result.items.map((video) => (
          <li key={video.id} className="flex flex-col gap-2">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-video overflow-hidden rounded-md border border-border bg-muted"
            >
              {video.thumbnail ? (
                <Image src={video.thumbnail} alt="" fill sizes="(min-width: 1280px) 15rem, (min-width: 640px) 45vw, 100vw" unoptimized className="object-cover" />
              ) : null}
              <span className="sr-only">Watch {video.title} on YouTube (opens in a new tab)</span>
            </a>
            <p className="line-clamp-2 text-sm font-medium text-foreground">{video.title}</p>
            <p className="text-xs text-muted-foreground">
              {video.channel}
              {video.views !== null ? ` · ${compact.format(video.views)} views` : ''}
            </p>
            <Covered post={findCoverage(video.title, posts)} />
            <div>
              <WriteLinks
                type="resource"
                label="Feature as a resource"
                topic={video.title}
                aiEnabled={aiEnabled}
                draft={{
                  title: video.title,
                  videoUrl: video.url,
                  sourceUrl: video.url,
                  sourceTitle: video.title,
                  sourcePublisher: video.channel,
                  region,
                  context: `A popular YouTube video ${placeOf(region)}: "${video.title}" by ${video.channel}${video.views !== null ? `, ${compact.format(video.views)} views` : ''}. The post features the video: explain what it is about and why people are watching it.`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <Updated at={result.fetchedAt} />
    </>
  )
}

export function SocialTrendList({
  result,
  region,
  posts,
  aiEnabled,
}: {
  result: SourceResult<SocialTrend>
  region: Region
  posts: PostTitle[]
  aiEnabled: boolean
}) {
  if (result.status !== 'ok' || !result.items.length) return <SourceState result={result} />
  return (
    <>
      <ol className="divide-y divide-border">
        {result.items.map((trend, index) => {
          const topic = trend.name.replace(/^#/, '')
          return (
            <li key={trend.name} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p>
                  <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
                  <ExternalAnchor href={trend.url} className="font-medium">
                    {trend.name}
                  </ExternalAnchor>
                  {trend.posts !== null ? (
                    <span className="text-xs text-muted-foreground"> · {compact.format(trend.posts)} posts</span>
                  ) : null}
                </p>
                <Covered post={findCoverage(topic, posts)} />
              </div>
              <WriteLinks
                topic={trend.name}
                aiEnabled={aiEnabled}
                draft={{
                  title: topic,
                  keywords: topic,
                  region,
                  context: `Trending on X ${placeOf(region)} as ${trend.name}${trend.posts !== null ? ` (${compact.format(trend.posts)} posts)` : ''}. Find out what the conversation is about before writing.`,
                }}
              />
            </li>
          )
        })}
      </ol>
      <Updated at={result.fetchedAt} />
    </>
  )
}

export function ReadingList({
  result,
  posts,
  aiEnabled,
}: {
  result: SourceResult<ReadingTrend>
  posts: PostTitle[]
  aiEnabled: boolean
}) {
  if (result.status !== 'ok' || !result.items.length) return <SourceState result={result} />
  return (
    <>
      <ol className="divide-y divide-border">
        {result.items.map((page, index) => (
          <li key={page.url} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
            <div className="min-w-0">
              <p>
                <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
                <ExternalAnchor href={page.url} className="font-medium">
                  {page.title}
                </ExternalAnchor>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {page.description ? `${page.description} · ` : ''}
                {compact.format(page.views)} views yesterday
              </p>
              <Covered post={findCoverage(page.title, posts)} />
            </div>
            <WriteLinks
              topic={page.title}
              aiEnabled={aiEnabled}
              draft={{
                title: page.title,
                keywords: page.title,
                sourceUrl: page.url,
                sourceTitle: `${page.title} – Wikipedia`,
                sourcePublisher: 'Wikipedia',
                region: 'global',
                context: `One of the most-read English Wikipedia pages yesterday (${compact.format(page.views)} views)${page.description ? `: ${page.description}` : ''}. Find out why people are looking it up now.`,
              }}
            />
          </li>
        ))}
      </ol>
      <Updated at={result.fetchedAt} />
    </>
  )
}

/** Networks without a public trends API: honest about it, with links to check by hand. */
export function OtherNetworks({ region }: { region: Region }) {
  const links = [
    { label: 'Google Trends: full list', href: `https://trends.google.com/trending?geo=${region === 'ghana' ? 'GH' : 'US'}` },
    { label: 'TikTok Creative Center: trending hashtags', href: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en' },
    { label: 'X: trending', href: 'https://x.com/explore/tabs/trending' },
    { label: 'Instagram: Explore', href: 'https://www.instagram.com/explore/' },
  ]
  return (
    <TrendSection id="other-networks" title="Instagram, Facebook and TikTok" source="Check by hand">
      <p className="text-sm text-muted-foreground">
        These networks do not share trend data with other websites, and copying it out of their apps breaks their terms,
        so they cannot be listed here automatically. Have a look yourself, then start a post.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {links.map((link) => (
          <li key={link.href} className="flex items-center gap-1.5">
            <ExternalLink aria-hidden className="size-3.5 text-muted-foreground" />
            <ExternalAnchor href={link.href}>{link.label}</ExternalAnchor>
          </li>
        ))}
      </ul>
      <Link href={contentTypeConfig.article.adminPath + '/new'} className={buttonVariants({ size: 'sm', className: 'mt-4' })}>
        <PenLine aria-hidden />
        New article
      </Link>
    </TrendSection>
  )
}

export function ConnectSources() {
  return (
    <details id="connect" className="group mt-6 rounded-lg border border-border bg-card p-4 md:p-5">
      <summary className="cursor-pointer text-base font-semibold text-foreground">Connect more sources</summary>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">
        <p>Google searches, Google News and Wikipedia need no setup. Two sources need a key, added as a server environment variable (never one starting with NEXT_PUBLIC_), followed by a restart or redeploy:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">YouTube (free):</strong> in Google Cloud, enable the YouTube Data API v3, create an API key, restrict it to that API,
            and set it as <code>YOUTUBE_API_KEY</code>.
          </li>
          <li>
            <strong className="text-foreground">X (paid):</strong> X shares trends only through its paid API. With a plan that includes trends, set the app&apos;s
            bearer token as <code>X_BEARER_TOKEN</code>.
          </li>
        </ul>
      </div>
    </details>
  )
}

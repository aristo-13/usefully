import 'server-only'

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import type { AiReference, LinkReadResult } from '@/lib/ai/fields'
import { setting } from '@/lib/env'
import { parseVideoUrl } from '@/lib/media'
import { siteConfig } from '@/lib/site'
import { decodeEntities } from '@/lib/trends/sources'

// Reads a link the editor pasted (a post on X, TikTok, YouTube… or any web
// page) so the AI writer can write from it. Uses each platform's public embed
// data. Facebook and Instagram share little without a login, so the editor can
// paste the text instead.

type Platform = AiReference['platform']

const USER_AGENT = `Mozilla/5.0 (compatible; ${siteConfig.name.replace(/\s+/g, '')}Bot/1.0; +${siteConfig.url})`
const MAX_TEXT = 5000
const MAX_HTML_BYTES = 1_500_000

const PLATFORMS: { platform: Exclude<Platform, 'web'>; name: string; host: RegExp }[] = [
  { platform: 'x', name: 'X', host: /^(?:www\.|mobile\.)?(?:x|twitter)\.com$/ },
  { platform: 'tiktok', name: 'TikTok', host: /^(?:www\.|m\.|vm\.|vt\.)?tiktok\.com$/ },
  { platform: 'youtube', name: 'YouTube', host: /^(?:(?:www\.|m\.|music\.)?youtube\.com|youtu\.be)$/ },
  { platform: 'instagram', name: 'Instagram', host: /^(?:www\.)?instagram\.com$/ },
  { platform: 'facebook', name: 'Facebook', host: /^(?:(?:www\.|m\.|web\.)?facebook\.com|fb\.watch)$/ },
  { platform: 'threads', name: 'Threads', host: /^(?:www\.)?threads\.(?:net|com)$/ },
  { platform: 'linkedin', name: 'LinkedIn', host: /^(?:www\.)?linkedin\.com$/ },
]

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Text of an HTML fragment. */
function plain(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** JSON from a platform's public endpoint (fixed, trusted hosts), or null. */
async function getJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

// Fetching pages safely -------------------------------------------------------

/** Public internet addresses only: never this server, its network or a cloud metadata service. */
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }
  const v6 = address.toLowerCase()
  if (v6.startsWith('::ffff:')) return publicAddress(v6.slice(7))
  return !(v6 === '::' || v6 === '::1' || /^(fc|fd|fe[89ab]|ff)/.test(v6))
}

/** A URL this server may fetch: https on the standard port, with a host name that resolves to public addresses only. */
export async function fetchableUrl(raw: string): Promise<URL | null> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const host = url.hostname
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password) return null
  if (isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || /\.(local|internal|localhost)$/i.test(host)) return null
  const addresses = await lookup(host, { all: true }).catch(() => [])
  return addresses.length && addresses.every(({ address }) => publicAddress(address)) ? url : null
}

async function readLimited(body: ReadableStream<Uint8Array>, max: number): Promise<string> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < max) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
  }
  await reader.cancel().catch(() => undefined)
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, max))
}

/** An HTML page from a public address, following up to three redirects and checking each one. */
async function fetchPage(raw: string): Promise<{ url: string; html: string } | null> {
  let current = raw
  for (let hop = 0; hop < 4; hop++) {
    const url = await fetchableUrl(current)
    if (!url) return null
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(8000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return null
      current = new URL(location, url).toString()
      continue
    }
    if (!response.ok || !response.body || !(response.headers.get('content-type') ?? '').includes('html')) return null
    return { url: url.toString(), html: await readLimited(response.body, MAX_HTML_BYTES) }
  }
  return null
}

/** <meta> values by name or property (lower case), first one wins. */
export function metaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>()
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = new Map<string, string>()
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? '')
    }
    const key = (attributes.get('property') ?? attributes.get('name') ?? attributes.get('itemprop') ?? '').toLowerCase()
    const content = attributes.get('content')
    if (key && content && !tags.has(key)) tags.set(key, decodeEntities(content).trim())
  }
  return tags
}

/** What a page says about itself in its preview tags (what social networks show when it is shared). */
export function fromPage(page: { url: string; html: string }, platform: Platform, name: string): AiReference {
  const meta = metaTags(page.html)
  const host = new URL(page.url).hostname.replace(/^www\./, '')
  // A sign-in wall (Instagram, Facebook…) only names the site: that says nothing about the post.
  const useful = (value: string) =>
    value && ![name.toLowerCase(), host].includes(value.toLowerCase()) && !/\b(log ?in|sign ?up|sign in)\b/i.test(value) ? value : ''
  const title = meta.get('og:title') ?? meta.get('twitter:title') ?? plain(page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const author = meta.get('author') ?? meta.get('article:author') ?? ''
  return {
    url: page.url,
    platform,
    source: clip(platform === 'web' ? (meta.get('og:site_name') ?? host) : name, 100),
    author: clip(/^https?:\/\//.test(author) ? '' : author, 200),
    title: clip(useful(title), 300),
    text: clip(useful(meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description') ?? ''), MAX_TEXT),
    publishedAt: meta.get('article:published_time') ?? null,
  }
}

// Platforms ------------------------------------------------------------------

/** The token X's embed widget sends with a post id (as in Vercel's react-tweet). */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, '')
}

type XPost = {
  text?: string
  created_at?: string
  user?: { name?: string; screen_name?: string }
  entities?: { urls?: { url?: string; expanded_url?: string }[] }
  quoted_tweet?: XPost
}

/** A post's text with its links spelled out and the links to its own photos removed. */
export function xText(post: XPost): string {
  let text = post.text ?? ''
  for (const link of post.entities?.urls ?? []) {
    if (link.url && link.expanded_url) text = text.replaceAll(link.url, link.expanded_url)
  }
  return decodeEntities(text.replace(/\s*https:\/\/t\.co\/\w+/g, '')).trim()
}

async function readX(url: URL): Promise<AiReference | null> {
  const id = url.pathname.match(/\/status(?:es)?\/(\d{1,25})/)?.[1]
  if (!id) return null
  const handle = url.pathname.split('/')[1] ?? 'i'
  const canonical = `https://x.com/${handle}/status/${id}`

  const post = (await getJson(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`)) as XPost | null
  if (post?.text) {
    const quoted = post.quoted_tweet?.text
      ? `\n\nQuoting @${post.quoted_tweet.user?.screen_name ?? ''}: ${xText(post.quoted_tweet)}`
      : ''
    return {
      url: canonical,
      platform: 'x',
      source: 'X',
      author: clip(post.user ? `${post.user.name ?? ''} (@${post.user.screen_name ?? handle})`.trim() : `@${handle}`, 200),
      title: '',
      text: clip(xText(post) + quoted, MAX_TEXT),
      publishedAt: post.created_at ?? null,
    }
  }

  // X's official embed endpoint, in case the one above changes.
  const embed = (await getJson(`https://publish.x.com/oembed?url=${encodeURIComponent(canonical)}&omit_script=true&dnt=true`)) as {
    author_name?: string
    html?: string
  } | null
  const paragraph = embed?.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]
  if (!paragraph) return null
  return {
    url: canonical,
    platform: 'x',
    source: 'X',
    author: clip(`${embed?.author_name ?? ''} (@${handle})`.trim(), 200),
    title: '',
    text: clip(plain(paragraph).replace(/\s*pic\.(?:twitter|x)\.com\/\w+/g, ''), MAX_TEXT),
    publishedAt: embed?.html?.match(/<a [^>]*>([^<]*)<\/a>\s*<\/blockquote>/i)?.[1] ?? null,
  }
}

async function readYouTube(url: URL): Promise<AiReference | null> {
  const video = parseVideoUrl(url.toString())
  if (video?.provider !== 'youtube') return null
  const canonical = `https://www.youtube.com/watch?v=${video.id}`
  const embed = (await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`)) as {
    title?: string
    author_name?: string
  } | null
  let description = ''
  let publishedAt: string | null = null
  // The description needs the (free) YouTube Data API key from the Trends page.
  const key = setting(process.env.YOUTUBE_API_KEY)
  if (key) {
    const data = (await getJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${video.id}&key=${encodeURIComponent(key)}`)) as {
      items?: { snippet?: { description?: string; publishedAt?: string } }[]
    } | null
    description = data?.items?.[0]?.snippet?.description ?? ''
    publishedAt = data?.items?.[0]?.snippet?.publishedAt ?? null
  }
  if (!embed?.title && !description) return null
  return {
    url: canonical,
    platform: 'youtube',
    source: 'YouTube',
    author: clip(embed?.author_name ?? '', 200),
    title: clip(embed?.title ?? '', 300),
    text: clip(description, MAX_TEXT),
    publishedAt,
  }
}

async function readTikTok(url: URL): Promise<AiReference | null> {
  let full = url.toString()
  // Short links (vm.tiktok.com) redirect to the full address the embed endpoint needs.
  if (/^(vm|vt)\./.test(url.hostname)) {
    try {
      const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) })
      const location = response.headers.get('location')
      if (location) full = new URL(location, url).toString()
    } catch {
      // Keep the short link.
    }
  }
  const embed = (await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(full)}`)) as {
    title?: string
    author_name?: string
    author_unique_id?: string
  } | null
  if (!embed?.title) return null
  return {
    url: full.split('?')[0],
    platform: 'tiktok',
    source: 'TikTok',
    author: clip(embed.author_unique_id ? `${embed.author_name ?? ''} (@${embed.author_unique_id})`.trim() : (embed.author_name ?? ''), 200),
    title: '',
    text: clip(embed.title, MAX_TEXT),
    publishedAt: null,
  }
}

/** Reads a pasted link. Never throws; when nothing can be read, the editor is asked to paste the text. */
export async function readLink(raw: string): Promise<LinkReadResult> {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, message: 'Paste the full link, starting with https://' }
  }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:') return { ok: false, message: 'Paste the full link, starting with https://' }

  const host = url.hostname.toLowerCase()
  const known = PLATFORMS.find((entry) => entry.host.test(host))
  let reference: AiReference | null = null
  try {
    if (known?.platform === 'x') reference = await readX(url)
    else if (known?.platform === 'youtube') reference = await readYouTube(url)
    else if (known?.platform === 'tiktok') reference = await readTikTok(url)
    if (!reference) {
      const page = await fetchPage(url.toString())
      reference = page ? fromPage(page, known?.platform ?? 'web', known?.name ?? '') : null
    }
  } catch (error) {
    // The host only: links can carry personal tokens.
    console.error(`[link] reading ${host} failed: ${error instanceof Error ? error.message : String(error)}`)
    reference = null
  }

  // Nothing readable: keep the link so the editor can paste the text.
  reference ??= {
    url: url.toString(),
    platform: known?.platform ?? 'web',
    source: known?.name ?? host.replace(/^www\./, ''),
    author: '',
    title: '',
    text: '',
    publishedAt: null,
  }
  const note = reference.text
    ? null
    : reference.title
      ? `Only the title could be read from ${reference.source}. Paste the post's text or description below if you have it.`
      : `${reference.source} did not share this post's text with other sites. Paste the text below so the AI can use it.`
  return { ok: true, reference, note }
}

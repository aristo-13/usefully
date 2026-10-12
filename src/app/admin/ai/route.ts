import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { listCategoryOptions, listPublishedLinks, listTagOptions } from '@/lib/admin/queries'
import { AI_FIELDS, type AiEvent } from '@/lib/ai/fields'
import { aiSetup, writeWithAi, type WriterContext } from '@/lib/ai/writer'
import { getAuthState } from '@/lib/auth'
import { CONTENT_STATUSES, CONTENT_TYPES } from '@/lib/content/types'

// The AI writer for the post editor. Streams newline-delimited JSON events
// (see AiEvent). Admins only, same-origin only.

// Researching and writing a long body can take a few minutes.
export const maxDuration = 300

const text = (max: number) => z.string().max(max)

const requestSchema = z.object({
  field: z.enum(AI_FIELDS),
  post: z.object({
    id: z.guid().nullable(),
    type: z.enum(CONTENT_TYPES),
    status: z.enum(CONTENT_STATUSES),
    title: text(300),
    slug: text(200),
    excerpt: text(1000),
    body: text(200_000),
    seoTitle: text(300),
    seoDescription: text(500),
    keywords: z.array(text(100)).max(30),
    tags: z.array(text(100)).max(60),
    category: text(200),
    difficulty: text(50),
    externalUrl: text(2000),
    videoUrl: text(2000),
    version: text(100),
    // Context only: rows still being typed are passed on as they are.
    sources: z.array(z.object({ title: text(300), url: text(2000), publisher: text(200).optional() })).max(40),
  }),
  guidance: text(2000),
  research: z.boolean(),
  trend: z.object({ context: text(1500), region: z.enum(['ghana', 'global']).nullable() }).nullable(),
  imageUrl: z.url({ protocol: /^https?$/ }).max(2000).nullable(),
})

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

function reply(error: string, status: number) {
  return Response.json({ error }, { status, headers: HEADERS })
}

/**
 * Only the dashboard itself may call this: a page on another site must not be
 * able to make a signed-in admin's browser spend AI credit.
 */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host'))?.split(',')[0]?.trim()
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply('Forbidden.', 403)

  const auth = await getAuthState()
  if (auth.status !== 'admin') return reply('Your session has ended. Sign in again, then retry.', 401)

  const setup = aiSetup()
  if (!setup.enabled) return reply(setup.message, 503)

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return reply('Invalid request.', 400)
  const input = parsed.data

  let context: WriterContext
  try {
    const [categories, tags, links] = await Promise.all([
      input.field === 'category' || input.field === 'meta' ? listCategoryOptions() : [],
      input.field === 'tags' || input.field === 'meta' ? listTagOptions() : [],
      input.field === 'body' ? listPublishedLinks() : [],
    ])
    context = {
      today: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date()),
      categories: categories.map((category) => category.name),
      tags: tags.map((tag) => tag.name),
      links: links.filter((link) => link.id !== input.post.id).map(({ title, path }) => ({ title, path })),
    }
  } catch {
    return reply('The site data the AI writer needs could not be loaded. Try again.', 500)
  }

  // Closing the editor, or pressing Stop, cancels the request to the AI service too.
  const abort = new AbortController()
  request.signal.addEventListener('abort', () => abort.abort(), { once: true })
  const events = writeWithAi(input, context, abort.signal)
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await events.next()
      if (closed) return
      if (next.done) {
        closed = true
        controller.close()
        return
      }
      const event: AiEvent = next.value
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
    },
    async cancel() {
      closed = true
      abort.abort()
      await events.return(undefined)
    },
  })

  return new Response(stream, { headers: { ...HEADERS, 'Content-Type': 'application/x-ndjson; charset=utf-8' } })
}

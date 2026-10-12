import 'server-only'

import Anthropic, { type APIError } from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'

import type { AiEvent, AiField, AiRequest } from '@/lib/ai/fields'
import {
  REFUSED,
  STATUS,
  SYSTEM_PROMPT,
  bodyTask,
  cleanBody,
  finishShort,
  postContext,
  precheck,
  shortSpec,
  type ShortField,
  type StructuredResult,
  type WriterContext,
} from '@/lib/ai/prompts'
import type { Source } from '@/lib/content/types'
import { setting } from '@/lib/env'
import { hostnameOf, truncate } from '@/lib/utils'

// The AI writer on Claude: web research (search and fetch) for bodies,
// structured output for short fields.

type Block = Anthropic.Beta.BetaContentBlock

/** Claude Opus 5.5: careful research and writing at a moderate price. */
export const CLAUDE_MODEL = 'claude-opus-5-5'

/**
 * Refusal fallback: if a safety classifier declines a request, the API runs it
 * again on the model Anthropic recommends for that case instead of refusing.
 */
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const }

/** A long research turn can pause on the server; it is resumed this many times at most. */
const MAX_CONTINUATIONS = 4

export function claudeKey(): string | undefined {
  return setting(process.env.ANTHROPIC_API_KEY)
}

let anthropic: Anthropic | null = null

function client(): Anthropic {
  const key = claudeKey()
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set.')
  // One client per server instance; the key is passed explicitly so a placeholder never reaches the API.
  anthropic ??= new Anthropic({ apiKey: key })
  return anthropic
}

// Identical for every request, so it is served from the prompt cache.
const SYSTEM: Anthropic.Beta.BetaTextBlockParam[] = [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }]

/** The post, shared by every field, as a second cache breakpoint. */
function postBlock(request: AiRequest, context: WriterContext): Anthropic.Beta.BetaTextBlockParam {
  return { type: 'text', text: postContext(request, context), cache_control: { type: 'ephemeral' } }
}

async function* writeShort(field: ShortField, request: AiRequest, context: WriterContext, signal: AbortSignal): AsyncGenerator<AiEvent> {
  const problem = precheck(field, request, context)
  if (problem) {
    yield problem
    return
  }

  yield { type: 'status', message: STATUS[field] }
  const { schema, task } = shortSpec(field, request, context)
  const content: Anthropic.Beta.BetaContentBlockParam[] = [postBlock(request, context)]
  if (field === 'cover_alt' && request.imageUrl) {
    content.push({ type: 'image', source: { type: 'url', url: request.imageUrl } })
  }
  content.push({ type: 'text', text: task })

  const response = await client().beta.messages.parse(
    {
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      // Short fields need little deliberation; low effort keeps the buttons quick.
      output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    },
    { signal, timeout: 120_000 },
  )

  if (response.stop_reason === 'refusal') {
    yield { type: 'error', message: REFUSED }
    return
  }
  yield finishShort(field, response.parsed_output, request, context)
}

function researchTools(region: 'ghana' | 'global' | null): Anthropic.Beta.BetaToolUnion[] {
  return [
    {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: 6,
      // Local results for topics trending in Ghana.
      ...(region === 'ghana'
        ? { user_location: { type: 'approximate' as const, country: 'GH', city: 'Accra', timezone: 'Africa/Accra' } }
        : {}),
    },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5, max_content_tokens: 20_000 },
  ]
}

function describeToolCall(name: string, input: unknown): string {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  if (name === 'web_search') {
    return typeof record.query === 'string' && record.query ? `Searching: ${truncate(record.query, 90)}` : 'Searching the web…'
  }
  if (name === 'web_fetch') {
    const host = typeof record.url === 'string' ? hostnameOf(record.url) : ''
    return host ? `Reading ${host}…` : 'Reading a source…'
  }
  return 'Going through the results…'
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

const isToolBlock = (block: Block) => block.type === 'server_tool_use' || block.type.endsWith('_tool_result')

/** The text after the last research step: earlier text was a note between searches. */
function finalBody(blocks: Block[]): string {
  let start = 0
  blocks.forEach((block, index) => {
    if (isToolBlock(block)) start = index + 1
  })
  const textOf = (list: Block[]) => list.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
  const afterResearch = textOf(blocks.slice(start))
  return cleanBody(afterResearch.trim() ? afterResearch : textOf(blocks))
}

/** Pages cited in the body or read while researching, minus those the editor already listed. */
function collectSources(blocks: Block[], existing: Source[]): Source[] {
  const normalise = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null
    } catch {
      return null
    }
  }
  const known = new Set(existing.map((source) => normalise(source.url)?.href))
  const found = new Map<string, Source>()
  const add = (url: string, title: string | null) => {
    const parsed = normalise(url)
    if (!parsed || parsed.href.length > 2000 || known.has(parsed.href) || found.has(parsed.href) || found.size >= 10) return
    const publisher = parsed.hostname.replace(/^www\./, '').slice(0, 100)
    found.set(parsed.href, { title: truncate(title?.trim() || publisher, 200), url: parsed.href, publisher })
  }
  for (const block of blocks) {
    if (block.type === 'text') {
      for (const citation of block.citations ?? []) {
        if (citation.type === 'web_search_result_location') add(citation.url, citation.title)
      }
    }
    if (block.type === 'web_fetch_tool_result' && block.content.type === 'web_fetch_result') {
      add(block.content.url, block.content.content.title)
    }
  }
  return [...found.values()]
}

async function* streamBody(request: AiRequest, context: WriterContext, signal: AbortSignal, research: boolean): AsyncGenerator<AiEvent> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: [postBlock(request, context), { type: 'text', text: bodyTask(request, context, research ? 'web' : 'none') }],
    },
  ]
  const blocks: Block[] = []
  let streamedText = false
  let stopReason: Anthropic.Beta.BetaStopReason | null = null

  yield { type: 'status', message: research ? 'Researching the topic…' : 'Planning the post…' }

  for (let turn = 0; turn < MAX_CONTINUATIONS; turn++) {
    const stream = client().beta.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: 64_000,
        ...FALLBACK,
        // The body is what readers come for: worth the extra thinking.
        output_config: { effort: 'high' },
        system: SYSTEM,
        ...(research ? { tools: researchTools(request.trend?.region ?? null) } : {}),
        messages,
      },
      { signal },
    )

    const toolCalls = new Map<number, { name: string; input: unknown; json: string }>()
    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block
        if (block.type === 'server_tool_use') {
          // Text before more research is a note, not the body.
          if (streamedText) yield { type: 'reset' }
          streamedText = false
          toolCalls.set(event.index, { name: block.name, input: block.input, json: '' })
        } else if (block.type === 'text' && !streamedText) {
          yield { type: 'status', message: 'Writing…' }
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          streamedText = true
          yield { type: 'text', text: event.delta.text }
        } else if (event.delta.type === 'input_json_delta') {
          const call = toolCalls.get(event.index)
          if (call) call.json += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        const call = toolCalls.get(event.index)
        if (call) {
          toolCalls.delete(event.index)
          yield { type: 'status', message: describeToolCall(call.name, parseJson(call.json) ?? call.input) }
        }
      }
    }

    const message = await stream.finalMessage()
    blocks.push(...message.content)
    stopReason = message.stop_reason
    if (stopReason !== 'pause_turn') break
    // The server paused a long research turn: sending it back resumes it where it stopped.
    messages.push({ role: 'assistant', content: message.content })
  }

  if (stopReason === 'refusal') {
    yield { type: 'error', message: REFUSED }
    return
  }
  const body = finalBody(blocks)
  if (!body) {
    yield { type: 'error', message: 'The AI did not return a body. Try again.' }
    return
  }
  if (stopReason === 'max_tokens' || stopReason === 'pause_turn') {
    yield { type: 'notice', message: 'The body may be cut short. Check the ending, or write it again.' }
  }
  if (blocks.some((block) => block.type === 'web_search_tool_result' && !Array.isArray(block.content))) {
    yield { type: 'notice', message: 'Some web searches failed, so parts of the body may rest on older knowledge. Check the facts.' }
  }
  yield { type: 'result', value: body }
  const sources = collectSources(blocks, request.post.sources)
  if (sources.length) yield { type: 'sources', sources }
}

async function* writeBody(request: AiRequest, context: WriterContext, signal: AbortSignal): AsyncGenerator<AiEvent> {
  try {
    yield* streamBody(request, context, signal, request.research)
  } catch (error) {
    // An account without web search (switched off in the Claude Console) rejects the tools.
    if (!request.research || !(error instanceof Anthropic.BadRequestError)) throw error
    console.error(`[ai] web research was rejected, writing without it: ${apiMessage(error)}`)
    yield { type: 'notice', message: 'Web research is not available for this API key, so the body was written without it. Check the facts.' }
    yield { type: 'reset' }
    yield* streamBody(request, context, signal, false)
  }
}

function apiMessage(error: APIError): string {
  const body = error.error as { error?: { message?: unknown } } | undefined
  return typeof body?.error?.message === 'string' ? body.error.message : error.message
}

function describeError(error: unknown, field: AiField): string {
  if (error instanceof Anthropic.APIUserAbortError) return 'Stopped.'
  if (error instanceof Anthropic.AuthenticationError) return 'The Claude API key was not accepted. Check ANTHROPIC_API_KEY.'
  if (error instanceof Anthropic.PermissionDeniedError) return 'This API key may not use the AI model or its research tools.'
  if (error instanceof Anthropic.NotFoundError) return 'The AI model is not available to this API key.'
  if (error instanceof Anthropic.RateLimitError) return 'The AI service is busy right now. Try again in a minute.'
  if (error instanceof Anthropic.BadRequestError) {
    return field === 'cover_alt'
      ? 'The AI could not open the image. Use an image from the media library or a direct link to an image file.'
      : `The AI service could not process this request: ${apiMessage(error)}`
  }
  if (error instanceof Anthropic.InternalServerError) return 'The AI service is having problems. Try again shortly.'
  // Connection errors are a kind of APIError, so they are checked first.
  if (error instanceof Anthropic.APIConnectionError) return 'The AI service could not be reached. Try again.'
  if (error instanceof Anthropic.APIError) {
    return error.status === 402
      ? 'The Claude account has a billing problem (for example, no credit left).'
      : `The AI service returned an error (${error.status ?? 'unknown'}). Try again.`
  }
  return 'Something went wrong while writing. Try again.'
}

/** One structured answer from Claude for a task that is not about a single post. Never throws. */
export async function claudeStructured(system: string, prompt: string, schema: z.ZodType): Promise<StructuredResult> {
  try {
    const response = await client().beta.messages.parse(
      {
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        ...FALLBACK,
        output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
        system,
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: 120_000 },
    )
    if (response.stop_reason === 'refusal') return { ok: false, message: REFUSED }
    return response.parsed_output
      ? { ok: true, data: response.parsed_output }
      : { ok: false, message: 'The AI returned an answer that could not be used. Try again.' }
  } catch (error) {
    console.error(`[ai] claude request failed: ${error instanceof Anthropic.APIError ? `${error.status} ${apiMessage(error)}` : String(error)}`)
    return { ok: false, message: describeError(error, 'meta') }
  }
}

/** Writes one field (or every short field, for `meta`) with Claude, as a stream of events. Never throws. */
export async function* writeWithClaude(request: AiRequest, context: WriterContext, signal: AbortSignal): AsyncGenerator<AiEvent> {
  try {
    if (request.field === 'body') yield* writeBody(request, context, signal)
    else yield* writeShort(request.field, request, context, signal)
  } catch (error) {
    if (!(error instanceof Anthropic.APIUserAbortError)) {
      console.error(`[ai] claude ${request.field} failed: ${error instanceof Anthropic.APIError ? `${error.status} ${apiMessage(error)}` : String(error)}`)
    }
    yield { type: 'error', message: describeError(error, request.field) }
  }
}

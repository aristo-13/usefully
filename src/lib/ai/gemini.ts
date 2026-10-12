import 'server-only'

import { isIP } from 'node:net'

import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel, type GenerateContentResponse, type Part } from '@google/genai'
import { z } from 'zod'

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
  type Research,
  type ShortField,
  type WriterContext,
} from '@/lib/ai/prompts'
import { setting } from '@/lib/env'
import { isMediaLibraryUrl } from '@/lib/supabase/config'

// The AI writer on Google's Gemini API, whose free tier needs no card. On the
// free tier Gemini cannot search Google, so bodies are researched by reading
// the editor's sources (the URL context tool) instead.

/** Google's recommended Flash model (free tier). Models change often: GEMINI_MODEL overrides it. */
const DEFAULT_MODEL = 'gemini-3.8-flash'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Image types Gemini accepts. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** The URL context tool reads at most this many links per request. */
const MAX_SOURCE_URLS = 20

export function geminiKey(): string | undefined {
  return setting(process.env.GEMINI_API_KEY)
}

export function geminiModel(): string {
  return setting(process.env.GEMINI_MODEL) ?? DEFAULT_MODEL
}

let gemini: GoogleGenAI | null = null

function client(): GoogleGenAI {
  const key = geminiKey()
  if (!key) throw new Error('GEMINI_API_KEY is not set.')
  gemini ??= new GoogleGenAI({
    // Passed explicitly so a placeholder never reaches the API.
    apiKey: key,
    // Retry only server trouble: a 429 on the free tier means the quota is used up.
    httpOptions: { retryOptions: { attempts: 2, httpStatusCodes: [500, 502, 503, 504] } },
  })
  return gemini
}

/** Gemini 3 models take a thinking level; older ones are left on their defaults. */
function thinking(level: ThinkingLevel) {
  return geminiModel().startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: level } } : {}
}

/** JSON Schema for Gemini's structured output, without the keywords it does not accept. */
function jsonSchema(schema: z.ZodType): unknown {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>
  void $schema
  return rest
}

/** Why Gemini produced no usable answer, or null when it did. */
function blocked(response: GenerateContentResponse): string | null {
  if (response.promptFeedback?.blockReason) return REFUSED
  switch (response.candidates?.[0]?.finishReason) {
    case FinishReason.SAFETY:
    case FinishReason.PROHIBITED_CONTENT:
    case FinishReason.BLOCKLIST:
    case FinishReason.SPII:
    case FinishReason.IMAGE_SAFETY:
    case FinishReason.IMAGE_PROHIBITED_CONTENT:
      return REFUSED
    case FinishReason.RECITATION:
      return 'Gemini stopped because its text came too close to an existing page. Try again or change the instructions.'
    default:
      return null
  }
}

/**
 * Downloads the cover for Gemini, which needs the image itself rather than a
 * link. Only the media library or public https addresses, no redirects,
 * images up to 5 MB, so the server cannot be pointed at internal addresses.
 */
async function fetchImage(url: string, signal: AbortSignal): Promise<Part | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  const publicHttps = parsed.protocol === 'https:' && !isIP(host) && host !== 'localhost' && host.includes('.')
  if (!isMediaLibraryUrl(url) && !publicHttps) return null

  const response = await fetch(parsed, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) })
  const type = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!response.ok || !IMAGE_TYPES.includes(type) || Number(response.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) {
    return null
  }
  const data = Buffer.from(await response.arrayBuffer())
  return data.byteLength > MAX_IMAGE_BYTES ? null : { inlineData: { mimeType: type, data: data.toString('base64') } }
}

async function* writeShort(field: ShortField, request: AiRequest, context: WriterContext, signal: AbortSignal): AsyncGenerator<AiEvent> {
  const problem = precheck(field, request, context)
  if (problem) {
    yield problem
    return
  }

  yield { type: 'status', message: STATUS[field] }
  const { schema, task } = shortSpec(field, request, context)
  const parts: Part[] = [{ text: postContext(request, context) }]
  if (field === 'cover_alt' && request.imageUrl) {
    const image = await fetchImage(request.imageUrl, signal).catch(() => null)
    if (!image) {
      yield { type: 'error', message: 'Gemini needs a JPEG, PNG or WebP image under 5 MB. Upload the cover to the media library, then try again.' }
      return
    }
    parts.push(image)
  }
  parts.push({ text: task })

  const response = await client().models.generateContent({
    model: geminiModel(),
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseJsonSchema: jsonSchema(schema),
      maxOutputTokens: 8192,
      ...thinking(ThinkingLevel.LOW),
      abortSignal: signal,
    },
  })

  const problemAnswer = blocked(response)
  if (problemAnswer) {
    yield { type: 'error', message: problemAnswer }
    return
  }
  let output: unknown = null
  try {
    output = JSON.parse(response.text ?? '')
  } catch {
    output = null
  }
  const parsed = schema.safeParse(output)
  yield finishShort(field, parsed.success ? parsed.data : null, request, context)
}

async function* streamBody(request: AiRequest, context: WriterContext, signal: AbortSignal, research: Research): AsyncGenerator<AiEvent> {
  yield { type: 'status', message: research === 'sources' ? 'Reading your sources…' : 'Planning the post…' }

  const stream = await client().models.generateContentStream({
    model: geminiModel(),
    contents: [{ role: 'user', parts: [{ text: postContext(request, context) }, { text: bodyTask(request, context, research) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      // URL context lets Gemini open the links listed under the editor's sources.
      ...(research === 'sources' ? { tools: [{ urlContext: {} }] } : {}),
      maxOutputTokens: 32_768,
      abortSignal: signal,
    },
  })

  let text = ''
  let finish: FinishReason | undefined
  let problem: string | null = null
  for await (const chunk of stream) {
    problem ??= blocked(chunk)
    const piece = chunk.text
    if (piece) {
      if (!text) yield { type: 'status', message: 'Writing…' }
      text += piece
      yield { type: 'text', text: piece }
    }
    finish = chunk.candidates?.[0]?.finishReason ?? finish
  }

  if (problem) {
    yield { type: 'error', message: problem }
    return
  }
  const body = cleanBody(text)
  if (!body) {
    yield { type: 'error', message: 'The AI did not return a body. Try again.' }
    return
  }
  if (finish === FinishReason.MAX_TOKENS) {
    yield { type: 'notice', message: 'The body may be cut short. Check the ending, or write it again.' }
  }
  yield { type: 'result', value: body }
}

async function* writeBody(request: AiRequest, context: WriterContext, signal: AbortSignal): AsyncGenerator<AiEvent> {
  // Gemini's free tier cannot search the web: research means reading the editor's sources.
  const sources = request.post.sources.filter((source) => /^https?:\/\//i.test(source.url)).slice(0, MAX_SOURCE_URLS)
  const research: Research = request.research && sources.length ? 'sources' : 'none'
  if (request.research && !sources.length) {
    yield {
      type: 'notice',
      message: 'Gemini cannot search the web on the free tier. Add a source link (such as the news story) for it to read, or check the facts carefully.',
    }
  }
  try {
    yield* streamBody({ ...request, post: { ...request.post, sources } }, context, signal, research)
  } catch (error) {
    // A model or tier without the URL context tool rejects the request before writing anything.
    if (research !== 'sources' || !(error instanceof ApiError) || error.status !== 400) throw error
    console.error(`[ai] gemini could not read the sources, writing without them: ${apiMessage(error)}`)
    yield { type: 'notice', message: 'Gemini could not open the sources, so the body was written without them. Check the facts.' }
    yield* streamBody(request, context, signal, 'none')
  }
}

/** The readable part of a Gemini error, e.g. "API key not valid". */
function apiMessage(error: ApiError): string {
  const start = error.message.indexOf('{')
  if (start >= 0) {
    try {
      const body = JSON.parse(error.message.slice(start)) as { error?: { message?: unknown } }
      if (typeof body.error?.message === 'string') return body.error.message.slice(0, 300)
    } catch {
      // Not JSON: fall through to the raw message.
    }
  }
  return error.message.slice(0, 300)
}

function describeError(error: unknown, field: AiField, signal: AbortSignal): string {
  if (signal.aborted) return 'Stopped.'
  if (!(error instanceof ApiError)) return 'Gemini could not be reached. Try again.'
  if (error.status === 429) {
    return "Gemini's free usage limit is used up for now. Try again later (free limits reset daily), or add a Claude key."
  }
  if (error.status === 401 || error.status === 403) return 'The Gemini API key was not accepted. Check GEMINI_API_KEY.'
  if (error.status === 404) {
    return `The Gemini model "${geminiModel()}" is not available. Set GEMINI_MODEL to a current model (see README → AI writer).`
  }
  if (error.status === 400) {
    return field === 'cover_alt'
      ? 'Gemini could not read the image. Upload the cover to the media library, then try again.'
      : `Gemini could not process this request: ${apiMessage(error)}`
  }
  if (error.status >= 500) return 'Gemini is having problems right now. Try again shortly.'
  return `Gemini returned an error (${error.status}). Try again.`
}

/** Writes one field (or every short field, for `meta`) with Gemini, as a stream of events. Never throws. */
export async function* writeWithGemini(request: AiRequest, context: WriterContext, signal: AbortSignal): AsyncGenerator<AiEvent> {
  try {
    if (request.field === 'body') yield* writeBody(request, context, signal)
    else yield* writeShort(request.field, request, context, signal)
  } catch (error) {
    if (!signal.aborted) {
      console.error(`[ai] gemini ${request.field} failed: ${error instanceof ApiError ? `${error.status} ${apiMessage(error)}` : String(error)}`)
    }
    yield { type: 'error', message: describeError(error, request.field, signal) }
  }
}

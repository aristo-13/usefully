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
  type StructuredResult,
  type WriterContext,
} from '@/lib/ai/prompts'
import { setting } from '@/lib/env'
import { isMediaLibraryUrl } from '@/lib/supabase/config'

// The AI writer on Google's Gemini API, whose free tier needs no card. On the
// free tier Gemini cannot search Google, so bodies are researched by reading
// the editor's sources (the URL context tool) instead.
//
// Free-tier limits are per model and per day (for example 20 requests a day
// for gemini-3.8-flash), shared by every site using the same key. So the
// stronger model writes only bodies, Flash-Lite writes everything short, and
// each takes over when the other's daily limit is used up.

/** Writes bodies. Models change often: GEMINI_MODEL overrides it. */
const DEFAULT_MODEL = 'gemini-3.8-flash'
/** Writes titles, summaries, search fields, tags, categories and alt text. GEMINI_LIGHT_MODEL overrides it. */
const DEFAULT_LIGHT_MODEL = 'gemini-3.5-flash-lite'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Image types Gemini accepts. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** The URL context tool reads at most this many links per request. */
const MAX_SOURCE_URLS = 20
/** A per-minute limit is waited out once when Google asks for at most this long. */
const MAX_WAIT_SECONDS = 30

export function geminiKey(): string | undefined {
  return setting(process.env.GEMINI_API_KEY)
}

export function geminiModel(): string {
  return setting(process.env.GEMINI_MODEL) ?? DEFAULT_MODEL
}

export function geminiLightModel(): string {
  return setting(process.env.GEMINI_LIGHT_MODEL) ?? DEFAULT_LIGHT_MODEL
}

let gemini: GoogleGenAI | null = null

function client(): GoogleGenAI {
  const key = geminiKey()
  if (!key) throw new Error('GEMINI_API_KEY is not set.')
  gemini ??= new GoogleGenAI({
    // Passed explicitly so a placeholder never reaches the API.
    apiKey: key,
    // Retry only server trouble; usage limits (429) are handled below.
    httpOptions: { retryOptions: { attempts: 2, httpStatusCodes: [500, 502, 503, 504] } },
  })
  return gemini
}

/** Gemini 3 models take a thinking level; older ones are left on their defaults. */
function thinking(model: string, level: ThinkingLevel) {
  return model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: level } } : {}
}

/** JSON Schema for Gemini's structured output, without the keywords it does not accept. */
function jsonSchema(schema: z.ZodType): unknown {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>
  void $schema
  return rest
}

// Usage limits -------------------------------------------------------------------

type GoogleError = {
  error?: {
    message?: unknown
    details?: { '@type'?: string; retryDelay?: string; violations?: { quotaId?: string; quotaValue?: string; quotaDimensions?: { model?: string } }[] }[]
  }
}

function googleError(error: ApiError): GoogleError {
  const start = error.message.indexOf('{')
  if (start < 0) return {}
  try {
    return JSON.parse(error.message.slice(start)) as GoogleError
  } catch {
    return {}
  }
}

/** The readable part of a Gemini error, e.g. "API key not valid". */
function apiMessage(error: ApiError): string {
  const message = googleError(error).error?.message
  return (typeof message === 'string' ? message : error.message).slice(0, 300)
}

type Quota = { daily: boolean; model: string | null; limit: string | null; retrySeconds: number | null }

/** Details of a usage-limit error (429): which limit, for which model, and when to retry. */
function quotaOf(error: unknown): Quota | null {
  if (!(error instanceof ApiError) || error.status !== 429) return null
  const details = googleError(error).error?.details ?? []
  const violation = details.find((detail) => detail['@type']?.endsWith('QuotaFailure'))?.violations?.[0]
  const delay = details.find((detail) => detail['@type']?.endsWith('RetryInfo'))?.retryDelay
  const seconds = delay ? Number.parseFloat(delay) : Number.NaN
  return {
    daily: /PerDay/i.test(violation?.quotaId ?? ''),
    model: violation?.quotaDimensions?.model ?? null,
    limit: violation?.quotaValue ?? null,
    retrySeconds: Number.isFinite(seconds) ? seconds : null,
  }
}

function inAbout(seconds: number | null): string {
  if (seconds === null) return 'later today'
  const minutes = Math.max(1, Math.round(seconds / 60))
  return minutes < 60 ? `in about ${minutes} min` : `in about ${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

/**
 * Runs a request on the first model, waiting out a short per-minute limit once,
 * and moving on to the next model when a model's daily limit is used up.
 */
async function withFallback<T>(models: string[], run: (model: string) => Promise<T>, signal?: AbortSignal): Promise<{ value: T; model: string }> {
  let lastError: unknown
  for (const model of [...new Set(models)]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return { value: await run(model), model }
      } catch (error) {
        const quota = quotaOf(error)
        if (!quota) throw error
        lastError = error
        const wait = quota.retrySeconds
        if (!quota.daily && attempt === 0 && wait !== null && wait <= MAX_WAIT_SECONDS) {
          await sleep(wait * 1000 + 500, signal)
          continue
        }
        break
      }
    }
  }
  throw lastError
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

/** One structured (JSON) answer on the light model, falling back to the main one. */
async function structured(parts: Part[], system: string, schema: z.ZodType, signal: AbortSignal): Promise<StructuredResult> {
  const { value: response } = await withFallback(
    [geminiLightModel(), geminiModel()],
    (model) =>
      client().models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema(schema),
          maxOutputTokens: 8192,
          ...thinking(model, ThinkingLevel.LOW),
          abortSignal: signal,
        },
      }),
    signal,
  )
  const problem = blocked(response)
  if (problem) return { ok: false, message: problem }
  let output: unknown = null
  try {
    output = JSON.parse(response.text ?? '')
  } catch {
    output = null
  }
  const parsed = schema.safeParse(output)
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, message: 'The AI returned an answer that could not be used. Try again.' }
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

  const answer = await structured(parts, SYSTEM_PROMPT, schema, signal)
  yield answer.ok ? finishShort(field, answer.data, request, context) : { type: 'error', message: answer.message }
}

async function* streamBody(request: AiRequest, context: WriterContext, signal: AbortSignal, research: Research): AsyncGenerator<AiEvent> {
  yield { type: 'status', message: research === 'sources' ? 'Reading your sources…' : 'Planning the post…' }

  const { value: stream, model } = await withFallback(
    [geminiModel(), geminiLightModel()],
    (candidate) =>
      client().models.generateContentStream({
        model: candidate,
        contents: [{ role: 'user', parts: [{ text: postContext(request, context) }, { text: bodyTask(request, context, research) }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          // URL context lets Gemini open the links listed under the editor's sources.
          ...(research === 'sources' ? { tools: [{ urlContext: {} }] } : {}),
          maxOutputTokens: 32_768,
          abortSignal: signal,
        },
      }),
    signal,
  )
  if (model !== geminiModel()) {
    yield {
      type: 'notice',
      message: `The free daily limit for ${geminiModel()} is used up, so this body was written with ${model}. Read it carefully.`,
    }
  }

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

function describeError(error: unknown, field: AiField, stopped: boolean): string {
  if (stopped) return 'Stopped.'
  if (!(error instanceof ApiError)) {
    return `Gemini could not be reached (${error instanceof Error ? error.message.slice(0, 120) : 'unknown error'}). Try again.`
  }
  const quota = quotaOf(error)
  if (quota) {
    const which = quota.model ? `${quota.model}${quota.limit ? ` (${quota.limit} requests a ${quota.daily ? 'day' : 'minute'})` : ''}` : 'Gemini'
    return quota.daily
      ? `The free daily limit for ${which} is used up on this API key, which your local and live sites share. It resets ${inAbout(quota.retrySeconds)}. To keep writing now, turn on billing for the key in Google AI Studio (a few cents per post) or add a Claude key.`
      : `Gemini's free per-minute limit for ${which} was reached. Wait a minute, then try again.`
  }
  if (error.status === 401 || error.status === 403) return 'The Gemini API key was not accepted. Check GEMINI_API_KEY.'
  if (error.status === 404) {
    return `A Gemini model is not available (${apiMessage(error)}). Set GEMINI_MODEL and GEMINI_LIGHT_MODEL to current models (see README → AI writer).`
  }
  if (error.status === 400) {
    return field === 'cover_alt'
      ? 'Gemini could not read the image. Upload the cover to the media library, then try again.'
      : `Gemini could not process this request: ${apiMessage(error)}`
  }
  if (error.status >= 500) return 'Gemini is having problems right now. Try again shortly.'
  return `Gemini returned an error (${error.status}). Try again.`
}

function logFailure(scope: string, error: unknown) {
  console.error(`[ai] gemini ${scope} failed: ${error instanceof ApiError ? `${error.status} ${apiMessage(error)}` : String(error)}`)
}

/** Writes one field (or every short field, for `meta`) with Gemini, as a stream of events. Never throws. */
export async function* writeWithGemini(request: AiRequest, context: WriterContext, signal: AbortSignal): AsyncGenerator<AiEvent> {
  try {
    if (request.field === 'body') yield* writeBody(request, context, signal)
    else yield* writeShort(request.field, request, context, signal)
  } catch (error) {
    if (!signal.aborted) logFailure(request.field, error)
    yield { type: 'error', message: describeError(error, request.field, signal.aborted) }
  }
}

/** One structured answer from Gemini for a task that is not about a single post. Never throws. */
export async function geminiStructured(system: string, prompt: string, schema: z.ZodType): Promise<StructuredResult> {
  const timeout = AbortSignal.timeout(120_000)
  try {
    return await structured([{ text: prompt }], system, schema, timeout)
  } catch (error) {
    logFailure('request', error)
    if (timeout.aborted) return { ok: false, message: 'Gemini took too long to answer. Try again.' }
    return { ok: false, message: describeError(error, 'meta', false) }
  }
}

'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { CircleAlert, CircleCheck, Info, Link2, LoaderCircle, Sparkles, Square, Undo2, X } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { readPostLink } from '@/lib/admin/ai-actions'
import {
  AI_ENDPOINT,
  AI_PROVIDER_NAMES,
  type AiEvent,
  type AiField,
  type AiMeta,
  type AiPost,
  type AiProvider,
  type AiReference,
  type AiTrend,
} from '@/lib/ai/fields'
import type { Source } from '@/lib/content/types'
import { cn } from '@/lib/utils'

/** A single field, or "Write the whole post". */
export type AiTarget = AiField | 'all'

export type AiFeedback = { tone: 'success' | 'notice' | 'error'; text: string }

export type AiResult = { value: string | string[] | AiMeta; sources: Source[]; notices: string[] }

type CallOptions = {
  imageUrl?: string | null
  /** Body only: text as it streams in, and a signal to discard it (it was a note between searches). */
  onText?: (text: string) => void
  onReset?: () => void
}

export type AiCall = (field: AiField, post: AiPost, options?: CallOptions) => Promise<AiResult>

class AiError extends Error {}

/** Reads the newline-delimited JSON events streamed by the AI route. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AiEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) yield JSON.parse(line) as AiEvent
      newline = buffer.indexOf('\n')
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as AiEvent
}

/**
 * Runs AI writer requests one at a time and tracks their progress. `settings`
 * is read when a request starts, so it always sends the latest instructions.
 */
export function useAiWriter(
  settings: () => { guidance: string; research: boolean; trend: AiTrend | null; reference: AiReference | null },
) {
  const [active, setActive] = useState<AiTarget | null>(null)
  const [status, setStatus] = useState('')
  const [feedback, setFeedback] = useState<AiFeedback | null>(null)
  const controller = useRef<AbortController | null>(null)

  const call: AiCall = async (field, post, options = {}) => {
    const { guidance, research, trend, reference } = settings()
    const abort = new AbortController()
    controller.current = abort
    // Stop (an abort) is reported as such; other network failures get a plain explanation.
    const network = (message: string) => (error: unknown): never => {
      if (abort.signal.aborted || error instanceof AiError) throw error
      throw new AiError(message)
    }
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({
        field,
        post,
        guidance,
        research: field === 'body' && research,
        trend,
        reference,
        imageUrl: options.imageUrl ?? null,
      }),
      signal: abort.signal,
      // A signed-out request is redirected to the sign-in page; report it instead of following it.
      redirect: 'manual',
    }).catch(network('The AI writer could not be reached. Check your internet connection and try again.'))
    if (response.type === 'opaqueredirect' || response.status === 401) {
      throw new AiError('Your session has ended. Sign in again in another tab, then retry.')
    }
    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      throw new AiError(data?.error ?? `The AI writer is not available right now (${response.status}).`)
    }

    let value: AiResult['value'] | null = null
    let sources: Source[] = []
    const notices: string[] = []
    try {
      for await (const event of readEvents(response.body)) {
        switch (event.type) {
          case 'status':
            setStatus(event.message)
            break
          case 'text':
            options.onText?.(event.text)
            break
          case 'reset':
            options.onReset?.()
            break
          case 'result':
            value = event.value
            break
          case 'sources':
            sources = event.sources
            break
          case 'notice':
            notices.push(event.message)
            break
          case 'error':
            throw new AiError(event.message)
          case 'ping':
            // Only keeps the connection open.
            break
        }
      }
    } catch (error) {
      network('The connection to the AI writer dropped before it finished, usually because of an unstable network. Try again.')(error)
    }
    if (value === null) throw new AiError('The AI writer stopped before it finished. Try again.')
    return { value, sources, notices }
  }

  /** Runs a task (one or more calls) unless another one is running. Returns null when it fails or is stopped. */
  async function run<T>(target: AiTarget, task: (call: AiCall) => Promise<T>): Promise<T | null> {
    if (active) return null
    setActive(target)
    setFeedback(null)
    setStatus('')
    try {
      return await task(call)
    } catch (error) {
      const stopped = error instanceof DOMException && error.name === 'AbortError'
      setFeedback(
        stopped
          ? { tone: 'notice', text: 'Stopped. Nothing was changed.' }
          : {
              tone: 'error',
              text: error instanceof AiError ? error.message : 'The AI writer could not be reached. Check your connection and try again.',
            },
      )
      return null
    } finally {
      controller.current = null
      setActive(null)
      setStatus('')
    }
  }

  return { active, status, feedback, setFeedback, run, stop: () => controller.current?.abort() }
}

/** The "Write with AI" control shown next to a field's label. */
export function AiButton({
  field,
  label,
  verb,
  active,
  busy,
  unavailable,
  onRun,
  onStop,
  onUndo,
}: {
  field: AiField
  /** Field name for screen readers, e.g. "meta description". */
  label: string
  verb: string
  active: AiTarget | null
  busy: boolean
  /** Why the button is off, e.g. "Add a cover image first". */
  unavailable?: string
  /** Gets the form the button is in, to read the rest of the post. */
  onRun: (form: HTMLFormElement | null) => void
  onStop: () => void
  onUndo?: () => void
}) {
  if (active === field) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircle aria-hidden className="size-3.5 animate-spin text-brand" />
        Writing…
        <button type="button" onClick={onStop} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
          <Square aria-hidden />
          Stop
        </button>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      {onUndo ? (
        <button type="button" onClick={onUndo} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
          <Undo2 aria-hidden />
          Undo
          <span className="sr-only"> the AI change to the {label}</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={(event) => onRun(event.currentTarget.form)}
        disabled={busy}
        title={unavailable}
        className={buttonVariants({ variant: 'outline', size: 'xs' })}
      >
        <Sparkles aria-hidden className="text-brand" />
        {verb}
        <span className="sr-only">
          {' '}
          the {label} with AI{unavailable ? ` (${unavailable})` : ''}
        </span>
      </button>
    </span>
  )
}

/** "26 Oct 2026" for ISO dates; other date text (as X writes it) is shown as it is. */
function postedOn(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) || !/^\d{4}-\d{2}-\d{2}/.test(value)
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** A post on X, TikTok, YouTube… or any page for the AI to write from: read from its link, text editable. */
function LinkReference({
  reference,
  onReference,
  onLinked,
  disabled,
}: {
  reference: AiReference | null
  onReference: (reference: AiReference | null) => void
  onLinked: (reference: AiReference) => void
  disabled: boolean
}) {
  const [link, setLink] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, startReading] = useTransition()

  function read() {
    const url = link.trim()
    if (!url || reading) return
    setError(null)
    startReading(async () => {
      const result = await readPostLink(url).catch(() => null)
      if (!result) {
        setError('The link could not be read. Check your connection and try again.')
      } else if (!result.ok) {
        setError(result.message)
      } else {
        onReference(result.reference)
        onLinked(result.reference)
        setNote(result.note)
        setLink('')
      }
    })
  }

  if (reference) {
    return (
      <div className="space-y-2 rounded-md border border-border bg-background p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p>
              <span className="font-medium text-foreground">Writing from {reference.source}</span>
              {reference.author ? <span className="text-muted-foreground"> · {reference.author}</span> : null}
              {reference.publishedAt ? <span className="text-muted-foreground"> · {postedOn(reference.publishedAt)}</span> : null}
            </p>
            <a href={reference.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-link hover:underline">
              {reference.url}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <button
            type="button"
            onClick={() => {
              onReference(null)
              setNote(null)
            }}
            disabled={disabled}
            className={buttonVariants({ variant: 'ghost', size: 'xs' })}
          >
            Remove
          </button>
        </div>
        {reference.title ? <p className="text-sm font-medium text-foreground">{reference.title}</p> : null}
        <Textarea
          aria-label="Text of the post"
          rows={4}
          maxLength={5000}
          value={reference.text}
          disabled={disabled}
          onChange={(event) => onReference({ ...reference, text: event.target.value })}
          placeholder="Paste the post's text here."
          className="min-h-20 text-sm"
        />
        {note && !reference.text.trim() ? (
          <p className="text-xs font-medium text-warning">{note}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Check or edit the text: the AI writes from it. The link has been added to Sources.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="ai-link" className="text-xs font-medium text-foreground">
        Write from a post or page (optional)
      </label>
      <div className="flex gap-2">
        <Input
          id="ai-link"
          type="url"
          inputMode="url"
          value={link}
          disabled={disabled || reading}
          onChange={(event) => setLink(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              read()
            }
          }}
          placeholder="Paste a link to a post on X, TikTok, YouTube, Facebook, Instagram, or any article"
          className="bg-background"
        />
        <button
          type="button"
          onClick={read}
          disabled={disabled || reading || !link.trim()}
          className={buttonVariants({ variant: 'outline', className: 'h-9 shrink-0' })}
        >
          {reading ? <LoaderCircle aria-hidden className="animate-spin" /> : <Link2 aria-hidden />}
          {reading ? 'Reading…' : 'Use link'}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Instructions for the AI and "Write the whole post", at the top of the editor. */
export function AiPanel({
  provider,
  trend,
  reference,
  onReference,
  onLinked,
  guidance,
  onGuidance,
  research,
  onResearch,
  active,
  status,
  onWriteAll,
  onStop,
  onUndo,
}: {
  /** Who writes; null when no AI key is set. */
  provider: AiProvider | null
  trend: AiTrend | null
  reference: AiReference | null
  onReference: (reference: AiReference | null) => void
  /** A link was read: add it to the sources. */
  onLinked: (reference: AiReference) => void
  guidance: string
  onGuidance: (value: string) => void
  research: boolean
  onResearch: (value: boolean) => void
  active: AiTarget | null
  status: string
  onWriteAll: (form: HTMLFormElement | null) => void
  onStop: () => void
  onUndo?: () => void
}) {
  if (!provider) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          The AI writer is off. Add a free Gemini API key as <code>GEMINI_API_KEY</code>, or a Claude API key as{' '}
          <code>ANTHROPIC_API_KEY</code> (see README → AI writer), to get Write with AI buttons on every field.
        </span>
      </p>
    )
  }

  return (
    // The panel's inputs are not part of the post: keep them from marking the form as edited.
    <fieldset
      onChange={(event) => event.stopPropagation()}
      className="space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4"
    >
      <legend className="sr-only">AI writer</legend>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles aria-hidden className="size-4 text-brand" />
          AI writer
        </p>
        <p className="text-xs text-muted-foreground">
          {AI_PROVIDER_NAMES[provider]} drafts. You read, fact-check and approve before publishing.
        </p>
      </div>

      {trend?.context ? (
        <p className="rounded-md bg-background/70 px-3 py-2 text-sm text-foreground">
          <span className="font-medium">From Trends:</span> {trend.context}
        </p>
      ) : null}

      <LinkReference reference={reference} onReference={onReference} onLinked={onLinked} disabled={active !== null} />

      <div className="space-y-1.5">
        <label htmlFor="ai-guidance" className="text-xs font-medium text-foreground">
          Instructions for the AI (optional)
        </label>
        <Textarea
          id="ai-guidance"
          rows={2}
          maxLength={2000}
          value={guidance}
          onChange={(event) => onGuidance(event.target.value)}
          placeholder="Angle, audience, points to cover, tone… e.g. “For first-time buyers in Accra; compare prices and where to buy.”"
          className="min-h-16 bg-background"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={research}
          onChange={(event) => onResearch(event.target.checked)}
          className="mt-1"
        />
        {provider === 'claude' ? (
          <span>
            Research the web before writing the body
            <span className="block text-xs text-muted-foreground">
              Recommended for news and trending topics. Pages it relies on are added to Sources.
            </span>
          </span>
        ) : (
          <span>
            Read the sources before writing the body
            <span className="block text-xs text-muted-foreground">
              Gemini opens the links under Sources, such as the news story, and takes its facts from them. On the free
              tier it cannot search the web, so add a source for news and trending topics.
            </span>
          </span>
        )}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {active === 'all' ? (
          <>
            <span className="inline-flex items-center gap-2 text-sm text-foreground" aria-live="polite">
              <LoaderCircle aria-hidden className="size-4 animate-spin text-brand" />
              {status || 'Starting…'}
            </span>
            <button type="button" onClick={onStop} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Square aria-hidden />
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={(event) => onWriteAll(event.currentTarget.form)}
            disabled={active !== null}
            className={buttonVariants({ size: 'sm' })}
          >
            <Sparkles aria-hidden />
            Write the whole post
          </button>
        )}
        {onUndo && active === null ? (
          <button type="button" onClick={onUndo} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Undo2 aria-hidden />
            Undo AI draft
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Writes the body, then the title, summary, search fields, keywords, tags and category. Each field also has its own
        AI button.
      </p>
    </fieldset>
  )
}

const feedbackIcons = { success: CircleCheck, notice: Info, error: CircleAlert } as const

/** Progress and results of AI requests, wherever the editor is scrolled. */
export function AiToast({
  active,
  status,
  feedback,
  onDismiss,
}: {
  active: AiTarget | null
  status: string
  feedback: AiFeedback | null
  onDismiss: () => void
}) {
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })

  // Confirmations disappear on their own; problems stay until dismissed.
  useEffect(() => {
    if (feedback?.tone !== 'success') return
    const timer = window.setTimeout(() => dismiss.current(), 8000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const Icon = feedback ? feedbackIcons[feedback.tone] : null
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm justify-end">
      {active ? (
        <p className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-lg">
          <LoaderCircle aria-hidden className="size-4 animate-spin text-brand" />
          {status || 'Writing…'}
        </p>
      ) : feedback && Icon ? (
        <div
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-lg',
            feedback.tone === 'error' ? 'border-destructive/40 text-destructive' : 'border-border text-foreground',
          )}
        >
          <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', feedback.tone === 'success' && 'text-success')} />
          <span className="min-w-0">{feedback.text}</span>
          <button type="button" onClick={onDismiss} className="-mr-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
            <X aria-hidden className="size-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

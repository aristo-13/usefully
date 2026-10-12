'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, LoaderCircle, Plus, Sparkles } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { idleState, type ActionState } from '@/lib/admin/action-state'
import { suggestCategories } from '@/lib/admin/ai-actions'
import { saveCategory } from '@/lib/admin/taxonomy-actions'
import { AI_PROVIDER_NAMES, type AiProvider, type CategoryAdvice, type CategorySuggestion } from '@/lib/ai/fields'
import { slugify } from '@/lib/utils'

type Status = 'idle' | 'saving' | 'done'

/** Saves a category through the same action as the forms on this page. */
function save(values: { id?: string; name: string; slug: string; description: string }): Promise<ActionState> {
  const data = new FormData()
  if (values.id) data.set('id', values.id)
  data.set('name', values.name)
  data.set('slug', values.slug)
  data.set('description', values.description)
  return saveCategory(idleState, data)
}

function problem(result: ActionState): string {
  return result.fieldErrors?.slug ?? result.fieldErrors?.name ?? result.fieldErrors?.description ?? result.message ?? 'It could not be saved.'
}

/** A suggested category, editable before it is added. */
function NewCategory({ suggestion, onSaved }: { suggestion: CategorySuggestion; onSaved: () => void }) {
  const [name, setName] = useState(suggestion.name)
  const [description, setDescription] = useState(suggestion.description)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setStatus('saving')
    setError(null)
    const result = await save({ name: name.trim(), slug: slugify(name, 80), description: description.trim() })
    if (result.status === 'success') {
      setStatus('done')
      onSaved()
    } else {
      setStatus('idle')
      setError(problem(result))
    }
  }

  return (
    <li className="space-y-2 rounded-md border border-border bg-background p-3">
      <Input
        aria-label="Category name"
        value={name}
        maxLength={80}
        disabled={status !== 'idle'}
        onChange={(event) => setName(event.target.value)}
      />
      <Textarea
        aria-label={`Description of ${name || 'the category'}`}
        rows={3}
        value={description}
        maxLength={1000}
        disabled={status !== 'idle'}
        onChange={(event) => setDescription(event.target.value)}
        className="min-h-16 text-sm"
      />
      {suggestion.reason ? <p className="text-xs text-muted-foreground">Why: {suggestion.reason}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {status === 'done' ? (
        <p className="inline-flex items-center gap-1 text-sm font-medium text-success">
          <Check aria-hidden className="size-4" />
          Added
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void add()}
          disabled={status === 'saving' || !name.trim()}
          className={buttonVariants({ size: 'sm' })}
        >
          <Plus aria-hidden />
          {status === 'saving' ? 'Adding…' : 'Add category'}
        </button>
      )}
    </li>
  )
}

/** Advice on an existing category, with a better description ready to use. */
function ExistingCategory({ advice, onSaved }: { advice: CategoryAdvice; onSaved: () => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function apply() {
    setStatus('saving')
    setError(null)
    const result = await save({ id: advice.id, name: advice.name, slug: advice.slug, description: advice.description })
    if (result.status === 'success') {
      setStatus('done')
      onSaved()
    } else {
      setStatus('idle')
      setError(problem(result))
    }
  }

  return (
    <li className="space-y-2 rounded-md border border-border bg-background p-3 text-sm">
      <p>
        <Link href={`/admin/categories/${advice.id}`} className="font-medium text-foreground hover:underline">
          {advice.name}
        </Link>
        {advice.note ? <span className="text-muted-foreground">: {advice.note}</span> : null}
      </p>
      {advice.description ? (
        <>
          <p className="rounded bg-muted/60 px-2 py-1.5 text-xs leading-relaxed text-foreground">{advice.description}</p>
          {error ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
          {status === 'done' ? (
            <p className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <Check aria-hidden className="size-3.5" />
              Description saved
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void apply()}
              disabled={status === 'saving'}
              className={buttonVariants({ variant: 'outline', size: 'xs' })}
            >
              {status === 'saving' ? 'Saving…' : 'Use this description'}
            </button>
          )}
        </>
      ) : null}
    </li>
  )
}

/**
 * AI review of the categories: advice on each existing one and new ones to
 * add. Nothing changes until the editor adds or applies a suggestion.
 */
export function CategorySuggestions({ provider }: { provider: AiProvider }) {
  const router = useRouter()
  const [guidance, setGuidance] = useState('')
  const [result, setResult] = useState<{ existing: CategoryAdvice[]; suggestions: CategorySuggestion[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function suggest() {
    setError(null)
    startTransition(async () => {
      const response = await suggestCategories(guidance)
      if (response.status === 'ok') setResult({ existing: response.existing, suggestions: response.suggestions })
      else setError(response.message)
    })
  }

  // Show the new or updated category in the table.
  const refresh = () => router.refresh()

  return (
    <section aria-labelledby="category-ai" className="space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <h2 id="category-ai" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles aria-hidden className="size-4 text-brand" />
        AI category suggestions
      </h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {AI_PROVIDER_NAMES[provider]} reviews your categories, your posts and what people are searching for now, then
        suggests improvements and new categories. Nothing changes until you add or apply one.
      </p>
      <Textarea
        aria-label="Instructions for the AI (optional)"
        rows={2}
        maxLength={1000}
        value={guidance}
        onChange={(event) => setGuidance(event.target.value)}
        placeholder="Optional: your focus and audience, e.g. “Mostly tech, money and jobs for young people in Ghana.”"
        className="min-h-16 bg-background text-sm"
      />
      <button type="button" onClick={suggest} disabled={pending} className={buttonVariants({ size: 'sm' })}>
        {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
        {pending ? 'Thinking…' : result ? 'Suggest again' : 'Suggest categories'}
      </button>
      <p className="sr-only" aria-live="polite">
        {pending ? 'Getting suggestions…' : result ? 'Suggestions ready.' : ''}
      </p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">New categories</h3>
            {result.suggestions.length ? (
              <ul className="space-y-2">
                {result.suggestions.map((suggestion) => (
                  <NewCategory key={suggestion.slug} suggestion={suggestion} onSaved={refresh} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No new categories needed right now.</p>
            )}
          </div>
          {result.existing.length ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your categories</h3>
              <ul className="space-y-2">
                {result.existing.map((advice) => (
                  <ExistingCategory key={advice.id} advice={advice} onSaved={refresh} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

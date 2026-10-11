'use client'

import { useState } from 'react'

import { CharacterCount, Field, FormMessage, fieldAria, useActionForm } from '@/components/admin/form'
import { buttonVariants } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { saveRedirect } from '@/lib/admin/redirect-actions'

type Redirect = {
  id: string
  slug: string
  destination_url: string
  is_active: boolean
  notes: string
}

export function RedirectForm({ item, siteUrl }: { item?: Redirect; siteUrl: string }) {
  const { state, pending, onSubmit } = useActionForm(saveRedirect)
  const errors = state.fieldErrors ?? {}
  const [slug, setSlug] = useState(item?.slug ?? '')
  const [destination, setDestination] = useState(item?.destination_url ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [active, setActive] = useState(item?.is_active ?? true)

  const [handledState, setHandledState] = useState(state)
  if (handledState !== state) {
    setHandledState(state)
    if (state.status === 'success' && !item) {
      setSlug('')
      setDestination('')
      setNotes('')
      setActive(true)
    }
  }

  const prefix = item ? `redirect-${item.id}` : 'new-redirect'

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <FormMessage state={state} />

      <Field
        name={`${prefix}-slug`}
        label="Short link"
        required
        error={errors.slug}
        hint={`${siteUrl.replace(/^https?:\/\//, '')}/go/${slug || 'slug'}`}
      >
        <Input
          id={`${prefix}-slug`}
          name="slug"
          required
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={slug}
          onChange={(event) => setSlug(event.target.value.toLowerCase())}
          {...fieldAria(`${prefix}-slug`, { hint: true, error: errors.slug })}
        />
      </Field>

      <Field name={`${prefix}-destination`} label="Destination" required error={errors.destination_url}>
        <Input
          id={`${prefix}-destination`}
          name="destination_url"
          type="url"
          required
          placeholder="https://"
          maxLength={2000}
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          {...fieldAria(`${prefix}-destination`, { error: errors.destination_url })}
        />
      </Field>

      <Field
        name={`${prefix}-notes`}
        label="Notes"
        error={errors.notes}
        counter={<CharacterCount value={notes} max={500} />}
        hint="Private. For example, where this link is used."
      >
        <Textarea
          id={`${prefix}-notes`}
          name="notes"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          {...fieldAria(`${prefix}-notes`, { hint: true, error: errors.notes })}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" checked={active} onChange={(event) => setActive(event.target.checked)} />
        Active (inactive links show a “not found” page)
      </label>

      <button type="submit" disabled={pending} className={buttonVariants()}>
        {pending ? 'Saving…' : item ? 'Save changes' : 'Add redirect'}
      </button>
    </form>
  )
}

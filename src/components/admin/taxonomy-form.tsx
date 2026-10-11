'use client'

import { useState } from 'react'

import { CharacterCount, Field, FormMessage, fieldAria, useActionForm } from '@/components/admin/form'
import { buttonVariants } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { saveCategory, saveTag } from '@/lib/admin/taxonomy-actions'
import { slugify } from '@/lib/utils'

type Item = { id: string; name: string; slug: string; description: string }

const config = {
  category: { action: saveCategory, nameMax: 80, slugMax: 80, descriptionMax: 1000, base: '/categories' },
  tag: { action: saveTag, nameMax: 50, slugMax: 60, descriptionMax: 500, base: '/tags' },
} as const

export function TaxonomyForm({ kind, item }: { kind: 'category' | 'tag'; item?: Item }) {
  const settings = config[kind]
  const { state, pending, onSubmit } = useActionForm(settings.action)
  const errors = state.fieldErrors ?? {}

  const [name, setName] = useState(item?.name ?? '')
  const [slug, setSlug] = useState(item?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(item))
  const [description, setDescription] = useState(item?.description ?? '')

  // Clear the "add" form after a successful create.
  const [handledState, setHandledState] = useState(state)
  if (handledState !== state) {
    setHandledState(state)
    if (state.status === 'success' && !item) {
      setName('')
      setSlug('')
      setSlugEdited(false)
      setDescription('')
    }
  }

  const prefix = item ? `${kind}-${item.id}` : `new-${kind}`

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <FormMessage state={state} />

      <Field name={`${prefix}-name`} label="Name" required error={errors.name}>
        <Input
          id={`${prefix}-name`}
          name="name"
          required
          maxLength={settings.nameMax}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (!slugEdited) setSlug(slugify(event.target.value, settings.slugMax))
          }}
          {...fieldAria(`${prefix}-name`, { error: errors.name })}
        />
      </Field>

      <Field
        name={`${prefix}-slug`}
        label="Slug"
        required
        error={errors.slug}
        hint={`${settings.base}/${slug || 'slug'}`}
      >
        <Input
          id={`${prefix}-slug`}
          name="slug"
          required
          maxLength={settings.slugMax}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true)
            setSlug(event.target.value.toLowerCase())
          }}
          {...fieldAria(`${prefix}-slug`, { hint: true, error: errors.slug })}
        />
      </Field>

      <Field
        name={`${prefix}-description`}
        label="Description"
        error={errors.description}
        counter={<CharacterCount value={description} max={settings.descriptionMax} />}
        hint={
          kind === 'category'
            ? 'Shown at the top of the category page and used as its meta description. Explain what readers will find here.'
            : 'Optional. Shown on the tag page.'
        }
      >
        <Textarea
          id={`${prefix}-description`}
          name="description"
          rows={kind === 'category' ? 4 : 3}
          maxLength={settings.descriptionMax}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          {...fieldAria(`${prefix}-description`, { hint: true, error: errors.description })}
        />
      </Field>

      <button type="submit" disabled={pending} className={buttonVariants()}>
        {pending ? 'Saving…' : item ? 'Save changes' : `Add ${kind}`}
      </button>
    </form>
  )
}

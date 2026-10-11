'use client'

import { useState } from 'react'

import { CharacterCount, Field, FormMessage, fieldAria, useActionForm } from '@/components/admin/form'
import { buttonVariants } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { changePassword, updateProfile } from '@/lib/admin/settings-actions'

export function ProfileForm({ displayName, bio }: { displayName: string; bio: string }) {
  const { state, pending, onSubmit } = useActionForm(updateProfile)
  const errors = state.fieldErrors ?? {}
  const [bioValue, setBioValue] = useState(bio)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <Field name="display_name" label="Display name" required error={errors.display_name} hint="Shown as the author byline.">
        <Input
          id="display_name"
          name="display_name"
          required
          maxLength={100}
          defaultValue={displayName}
          autoComplete="name"
          {...fieldAria('display_name', { hint: true, error: errors.display_name })}
        />
      </Field>
      <Field
        name="bio"
        label="Short bio"
        error={errors.bio}
        counter={<CharacterCount value={bioValue} max={600} />}
        hint="Optional. Shown under your articles. Mention relevant experience so readers know who wrote the page."
      >
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={600}
          value={bioValue}
          onChange={(event) => setBioValue(event.target.value)}
          {...fieldAria('bio', { hint: true, error: errors.bio })}
        />
      </Field>
      <button type="submit" disabled={pending} className={buttonVariants()}>
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}

export function PasswordForm() {
  const { state, pending, onSubmit } = useActionForm(changePassword)
  const errors = state.fieldErrors ?? {}

  const [handledState, setHandledState] = useState(state)
  const [formKey, setFormKey] = useState(0)
  if (handledState !== state) {
    setHandledState(state)
    if (state.status === 'success') setFormKey((key) => key + 1)
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <Field name="current_password" label="Current password" required error={errors.current_password}>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          {...fieldAria('current_password', { error: errors.current_password })}
        />
      </Field>
      <Field
        name="new_password"
        label="New password"
        required
        error={errors.new_password}
        hint="At least 12 characters. A long passphrase is easiest to remember."
      >
        <Input
          id="new_password"
          name="new_password"
          type="password"
          required
          minLength={12}
          maxLength={72}
          autoComplete="new-password"
          {...fieldAria('new_password', { hint: true, error: errors.new_password })}
        />
      </Field>
      <Field name="confirm_password" label="Confirm new password" required error={errors.confirm_password}>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          autoComplete="new-password"
          {...fieldAria('confirm_password', { error: errors.confirm_password })}
        />
      </Field>
      <button type="submit" disabled={pending} className={buttonVariants()}>
        {pending ? 'Changing…' : 'Change password'}
      </button>
    </form>
  )
}

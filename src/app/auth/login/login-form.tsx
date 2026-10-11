'use client'

import { Field, FormMessage, useActionForm } from '@/components/admin/form'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signIn } from '@/lib/auth-actions'

export function LoginForm({
  next,
  initialError,
  disabled,
}: {
  next: string
  initialError?: string
  disabled?: boolean
}) {
  const { state, pending, onSubmit } = useActionForm(signIn)

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.status === 'idle' && initialError ? (
        <FormMessage state={{ status: 'error', message: initialError }} />
      ) : (
        <FormMessage state={state} />
      )}
      <Field name="email" label="Email">
        <Input id="email" name="email" type="email" required autoComplete="email" disabled={disabled} />
      </Field>
      <Field name="password" label="Password">
        <Input id="password" name="password" type="password" required autoComplete="current-password" disabled={disabled} />
      </Field>
      <button type="submit" disabled={pending || disabled} className={buttonVariants({ size: 'lg', className: 'w-full' })}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

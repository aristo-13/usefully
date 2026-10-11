'use client'

import { startTransition, useActionState, type FormEvent, type ReactNode } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'

import { Label } from '@/components/ui/input'
import { idleState, type ActionState } from '@/lib/admin/action-state'
import { cn } from '@/lib/utils'

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>

/**
 * Runs a Server Action from onSubmit instead of the form `action` prop, so
 * React does not reset the fields afterwards and the editor keeps what the
 * user typed when validation fails. The clicked submit button's name/value
 * (e.g. intent=publish) is included in the FormData.
 */
export function useActionForm(action: FormAction, initialState: ActionState = idleState) {
  const [state, dispatch, pending] = useActionState(action, initialState)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter)
    startTransition(() => dispatch(formData))
  }

  return { state, pending, onSubmit }
}

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === 'idle' || !state.message) return null
  const success = state.status === 'success'
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        success
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
        className,
      )}
    >
      {success ? (
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{state.message}</span>
    </div>
  )
}

/** aria attributes linking an input to its hint and error text. */
export function fieldAria(name: string, options: { hint?: boolean; error?: string }) {
  const describedBy = [options.hint ? `${name}-hint` : null, options.error ? `${name}-error` : null]
    .filter(Boolean)
    .join(' ')
  return {
    'aria-invalid': options.error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const
}

export function Field({
  name,
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
  counter,
}: {
  name: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
  counter?: ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor ?? name}>
          {label}
          {required ? (
            <span className="text-destructive" aria-hidden>
              {' '}
              *
            </span>
          ) : null}
        </Label>
        {counter}
      </div>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function CharacterCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max
  return (
    <span className={cn('text-xs tabular-nums', over ? 'font-medium text-destructive' : 'text-muted-foreground')}>
      {value.length}/{max}
    </span>
  )
}

'use client'

import { startTransition, useActionState } from 'react'
import { Trash2 } from 'lucide-react'

import { FormMessage } from '@/components/admin/form'
import { buttonVariants } from '@/components/ui/button'
import { idleState, type ActionState } from '@/lib/admin/action-state'

export function DeleteButton({
  action,
  confirmMessage,
  label = 'Delete',
  size = 'default',
}: {
  action: (state: ActionState, payload: FormData) => Promise<ActionState>
  confirmMessage: string
  label?: string
  size?: 'default' | 'sm'
}) {
  const [state, dispatch, pending] = useActionState(action, idleState)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!window.confirm(confirmMessage)) return
        const formData = new FormData(event.currentTarget)
        startTransition(() => dispatch(formData))
      }}
      className="space-y-2"
    >
      <button type="submit" disabled={pending} className={buttonVariants({ variant: 'destructive', size })}>
        <Trash2 aria-hidden />
        {pending ? 'Deleting…' : label}
      </button>
      <FormMessage state={state} />
    </form>
  )
}

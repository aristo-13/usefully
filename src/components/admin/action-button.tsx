'use client'

import { useState, useTransition } from 'react'

import { FormMessage } from '@/components/admin/form'
import { buttonVariants } from '@/components/ui/button'
import { idleState, type ActionState } from '@/lib/admin/action-state'

/** A button that runs a Server Action and shows its result underneath. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = 'outline',
  disabled = false,
}: {
  action: () => Promise<ActionState>
  label: string
  pendingLabel: string
  variant?: 'default' | 'outline'
  disabled?: boolean
}) {
  const [state, setState] = useState<ActionState>(idleState)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => startTransition(async () => setState(await action()))}
        className={buttonVariants({ variant, size: 'sm' })}
      >
        {pending ? pendingLabel : label}
      </button>
      <FormMessage state={state} />
    </div>
  )
}

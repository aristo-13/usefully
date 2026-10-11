import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const tones = {
  neutral: 'border-border bg-muted text-muted-foreground',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-link/30 bg-link/10 text-link',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
} as const

export type BadgeTone = keyof typeof tones

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Container({
  className,
  size = 'wide',
  ...props
}: ComponentProps<'div'> & { size?: 'wide' | 'narrow' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6',
        size === 'wide' ? 'max-w-6xl' : 'max-w-3xl',
        className,
      )}
      {...props}
    />
  )
}

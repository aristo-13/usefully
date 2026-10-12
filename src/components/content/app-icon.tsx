import Image from 'next/image'

import type { ImageRef } from '@/lib/content/types'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: { box: 'size-12 rounded-xl', sizes: '48px' },
  lg: { box: 'size-16 rounded-2xl md:size-20', sizes: '80px' },
} as const

/** A download's app icon. Decorative: the app's name is always shown next to it. */
export function AppIcon({ image, size = 'sm', className }: { image: ImageRef; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn('relative block shrink-0 overflow-hidden border border-border bg-muted', SIZES[size].box, className)}>
      <Image src={image.src} alt="" fill sizes={SIZES[size].sizes} unoptimized={!image.optimize} className="object-cover" />
    </span>
  )
}

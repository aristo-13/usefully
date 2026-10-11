import Image from 'next/image'

import { siteConfig } from '@/lib/site'

// Brand files live in /public/logo. The wordmark's natural size is 417×112.
const WORDMARK_RATIO = 417 / 112

export function Logo({ height = 28, className }: { height?: number; className?: string }) {
  return (
    <Image
      src="/logo/usefully-logo.svg"
      alt={siteConfig.name}
      width={Math.round(height * WORDMARK_RATIO)}
      height={height}
      loading="eager"
      className={className}
    />
  )
}

export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return <Image src="/logo/usefully-mark.svg" alt="" width={size} height={size} className={className} />
}

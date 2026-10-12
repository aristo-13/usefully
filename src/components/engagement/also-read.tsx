import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { contentPath, contentTypeConfig, type ContentSummary } from '@/lib/content/types'

/** A related page between two sections of the body, where readers decide whether to go on. */
export function AlsoRead({ item }: { item: ContentSummary }) {
  return (
    <aside aria-label="Also read" className="interlude my-8 rounded-lg border border-l-4 border-border border-l-brand bg-muted/40 px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-brand uppercase">Also read</p>
      <Link href={contentPath(item.type, item.slug)} className="group mt-1 flex items-start justify-between gap-3">
        <span className="font-heading text-lg leading-snug font-semibold text-foreground group-hover:underline">
          {item.title}
        </span>
        <span className="mt-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {contentTypeConfig[item.type].label}
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </aside>
  )
}

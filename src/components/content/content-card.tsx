import Link from 'next/link'

import { contentPath, contentTypeConfig, type ContentSummary } from '@/lib/content/types'
import { cn, formatDate } from '@/lib/utils'

export function ContentCard({
  item,
  showType = false,
  headingLevel = 'h2',
  className,
}: {
  item: ContentSummary
  showType?: boolean
  headingLevel?: 'h2' | 'h3'
  className?: string
}) {
  const Heading = headingLevel
  return (
    <article className={cn('group relative flex flex-col gap-2 py-5', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {showType ? <span>{contentTypeConfig[item.type].label}</span> : null}
        {showType && item.category ? <span aria-hidden>·</span> : null}
        {item.category ? <span>{item.category.name}</span> : null}
      </div>
      <Heading className="text-lg leading-snug font-semibold text-foreground">
        <Link
          href={contentPath(item.type, item.slug)}
          className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4"
        >
          {item.title}
        </Link>
      </Heading>
      {item.excerpt ? (
        <p className="line-clamp-3 text-[0.95rem] leading-relaxed text-muted-foreground">{item.excerpt}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
      </p>
    </article>
  )
}

export function ContentList({
  items,
  showType = false,
  headingLevel = 'h2',
}: {
  items: ContentSummary[]
  showType?: boolean
  headingLevel?: 'h2' | 'h3'
}) {
  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <li key={item.id}>
          <ContentCard item={item} showType={showType} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  )
}

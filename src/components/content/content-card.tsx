import Link from 'next/link'

import { ShareButton } from '@/components/content/share-button'
import { contentPath, contentTypeConfig, type ContentSummary } from '@/lib/content/types'
import { cn, formatDate } from '@/lib/utils'

export type ListLayout = 'list' | 'grid-2' | 'grid-3'

/** Classes shared by server-rendered lists and items appended by "Load more". */
export const listClasses: Record<ListLayout, string> = {
  list: '',
  'grid-2': 'grid gap-x-8 md:grid-cols-2',
  'grid-3': 'grid gap-x-8 md:grid-cols-2 lg:grid-cols-3',
}

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
  const path = contentPath(item.type, item.slug)

  return (
    <article className={cn('group relative flex h-full flex-col gap-2 py-5', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {showType ? <span>{contentTypeConfig[item.type].label}</span> : null}
        {showType && item.category ? <span aria-hidden>·</span> : null}
        {item.category ? <span>{item.category.name}</span> : null}
      </div>
      <Heading className="text-lg leading-snug font-semibold text-foreground">
        <Link
          href={path}
          className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4"
        >
          {item.title}
        </Link>
      </Heading>
      {item.excerpt ? (
        <p className="line-clamp-3 text-[0.95rem] leading-relaxed text-muted-foreground">{item.excerpt}</p>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
        </p>
        <ShareButton path={path} title={item.title} className="-mr-1.5" />
      </div>
    </article>
  )
}

export function ContentList({
  items,
  showType = false,
  headingLevel = 'h2',
  layout = 'list',
}: {
  items: ContentSummary[]
  showType?: boolean
  headingLevel?: 'h2' | 'h3'
  layout?: ListLayout
}) {
  return (
    <ul className={cn('border-t border-border', listClasses[layout])}>
      {items.map((item) => (
        <li key={item.id} className="border-b border-border">
          <ContentCard item={item} showType={showType} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import { Play } from 'lucide-react'

import { AppIcon } from '@/components/content/app-icon'
import { ShareButton } from '@/components/content/share-button'
import { contentPath, contentTypeConfig, type ContentSummary, type ImageRef } from '@/lib/content/types'
import { cn, formatDate } from '@/lib/utils'

export type ListLayout = 'list' | 'grid-2' | 'grid-3'

/** Classes shared by server-rendered lists and items appended by "Load more". */
export const listClasses: Record<ListLayout, string> = {
  list: '',
  'grid-2': 'grid gap-x-8 md:grid-cols-2',
  'grid-3': 'grid gap-x-8 md:grid-cols-2 lg:grid-cols-3',
}

const coverSizes: Record<ListLayout, string> = {
  list: '10rem',
  'grid-2': '(min-width: 768px) 34rem, 100vw',
  'grid-3': '(min-width: 1024px) 22rem, (min-width: 768px) 34rem, 100vw',
}

/** Card image. Decorative: the title next to it is the link text. */
function CardImage({ image, video, sizes, className }: { image: ImageRef; video: boolean; sizes: string; className: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md border border-border bg-muted', className)}>
      <Image src={image.src} alt="" fill sizes={sizes} unoptimized={!image.optimize} className="object-cover" />
      {video ? (
        <span className="absolute bottom-2 left-2 grid size-8 place-items-center rounded-full bg-black/70 text-white">
          <Play aria-hidden className="ml-0.5 size-4 fill-current" />
        </span>
      ) : null}
    </div>
  )
}

export function ContentCard({
  item,
  showType = false,
  headingLevel = 'h2',
  layout = 'list',
  className,
}: {
  item: ContentSummary
  showType?: boolean
  headingLevel?: 'h2' | 'h3'
  layout?: ListLayout
  className?: string
}) {
  const Heading = headingLevel
  const path = contentPath(item.type, item.slug)
  const icon = item.thumbnail?.kind === 'icon' ? item.thumbnail : null
  const cover = item.thumbnail?.kind === 'cover' ? item.thumbnail : null
  // Grids show the cover above the text; single-column lists show it on the right.
  const stacked = layout !== 'list'

  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {showType ? <span>{contentTypeConfig[item.type].label}</span> : null}
      {showType && item.category ? <span aria-hidden>·</span> : null}
      {item.category ? <span>{item.category.name}</span> : null}
      {item.hasVideo && (showType || item.category) ? <span aria-hidden>·</span> : null}
      {item.hasVideo ? <span>Video</span> : null}
    </div>
  )
  const heading = (
    <Heading className="text-lg leading-snug font-semibold text-foreground">
      <Link
        href={path}
        className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4"
      >
        {item.title}
      </Link>
    </Heading>
  )

  return (
    <article className={cn('group relative flex h-full gap-4 py-5', stacked ? 'flex-col' : 'flex-row', className)}>
      {cover && stacked ? (
        <CardImage image={cover} video={item.hasVideo} sizes={coverSizes[layout]} className="aspect-[1.91/1] w-full" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {icon ? (
          <div className="flex items-center gap-3">
            <AppIcon image={icon} />
            <div className="min-w-0 space-y-1">
              {meta}
              {heading}
            </div>
          </div>
        ) : (
          <>
            {meta}
            {heading}
          </>
        )}
        {item.excerpt ? (
          <p className="line-clamp-3 text-[0.95rem] leading-relaxed text-muted-foreground">{item.excerpt}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
          </p>
          <ShareButton path={path} title={item.title} className="-mr-1.5" />
        </div>
      </div>
      {cover && !stacked ? (
        <CardImage
          image={cover}
          video={item.hasVideo}
          sizes={coverSizes.list}
          className="aspect-[4/3] w-24 shrink-0 self-start sm:w-40"
        />
      ) : null}
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
          <ContentCard item={item} showType={showType} headingLevel={headingLevel} layout={layout} />
        </li>
      ))}
    </ul>
  )
}

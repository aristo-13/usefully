import Image from 'next/image'
import Link from 'next/link'
import { Download, ExternalLink } from 'lucide-react'

import { Breadcrumbs } from '@/components/content/breadcrumbs'
import { ContentList } from '@/components/content/content-card'
import { MarkdownContent } from '@/components/content/markdown-content'
import { ShareButton } from '@/components/content/share-button'
import { JsonLd } from '@/components/seo/json-ld'
import { buttonVariants } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { getRelatedContent } from '@/lib/content/queries'
import {
  contentPath,
  contentTypeConfig,
  difficultyLabels,
  type ContentDetail,
  type Source,
} from '@/lib/content/types'
import { extractHeadings, type Heading } from '@/lib/markdown'
import { contentJsonLd } from '@/lib/seo'
import { mediaPublicUrl } from '@/lib/supabase/config'
import {
  fileTypeLabel,
  formatBytes,
  formatDate,
  hostnameOf,
  isSameDay,
  readingTimeMinutes,
} from '@/lib/utils'

function TableOfContents({ id, headings, className }: { id: string; headings: Heading[]; className?: string }) {
  return (
    <nav aria-labelledby={id} className={className}>
      <h2 id={id} className="text-sm font-semibold text-foreground">
        On this page
      </h2>
      <ol className="mt-3 space-y-1.5 border-l border-border text-sm">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? 'pl-6' : 'pl-3'}>
            <a href={`#${heading.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function ArticleMeta({ item }: { item: ContentDetail }) {
  const showUpdated = !isSameDay(item.publishedAt, item.updatedAt)
  const readable = item.type === 'article' || item.type === 'tutorial'

  return (
    <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
      {item.author ? (
        <div className="flex gap-1">
          <dt className="sr-only">Author</dt>
          <dd>
            By <span className="font-medium text-foreground">{item.author.name}</span>
          </dd>
        </div>
      ) : null}
      <div className="flex gap-1">
        <dt>Published</dt>
        <dd>
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
        </dd>
      </div>
      {showUpdated ? (
        <div className="flex gap-1">
          <dt>Updated</dt>
          <dd>
            <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
          </dd>
        </div>
      ) : null}
      {readable && item.body ? (
        <div className="flex gap-1">
          <dt className="sr-only">Reading time</dt>
          <dd>{readingTimeMinutes(item.body)} min read</dd>
        </div>
      ) : null}
      {item.difficulty ? (
        <div className="flex gap-1">
          <dt>Level</dt>
          <dd>{difficultyLabels[item.difficulty]}</dd>
        </div>
      ) : null}
    </dl>
  )
}

function ResourcePanel({ item, preview }: { item: ContentDetail; preview: boolean }) {
  if (!item.externalUrl) return null
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
      <div className="text-sm">
        <p className="font-medium text-foreground">Website</p>
        <p className="text-muted-foreground">{hostnameOf(item.externalUrl)}</p>
      </div>
      <a
        href={preview ? item.externalUrl : `/go/${item.slug}`}
        rel="nofollow noopener"
        className={buttonVariants({ size: 'lg', className: 'px-4' })}
      >
        Visit {hostnameOf(item.externalUrl)}
        <ExternalLink aria-hidden />
      </a>
    </div>
  )
}

function DownloadPanel({ item, preview }: { item: ContentDetail; preview: boolean }) {
  if (!item.hasFile && !item.externalUrl) return null
  const type = item.hasFile ? fileTypeLabel(item.fileMime, item.fileName) : ''
  const size = item.hasFile ? formatBytes(item.fileSize) : ''

  return (
    <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        {item.hasFile && item.fileName ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground">File</dt>
            <dd className="font-medium break-all text-foreground">{item.fileName}</dd>
          </div>
        ) : (
          <div className="col-span-2">
            <dt className="text-muted-foreground">Hosted on</dt>
            <dd className="font-medium text-foreground">{hostnameOf(item.externalUrl)}</dd>
          </div>
        )}
        {type ? (
          <div>
            <dt className="text-muted-foreground">Format</dt>
            <dd className="font-medium text-foreground">{type}</dd>
          </div>
        ) : null}
        {size ? (
          <div>
            <dt className="text-muted-foreground">Size</dt>
            <dd className="font-medium text-foreground">{size}</dd>
          </div>
        ) : null}
        {item.version ? (
          <div>
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-medium text-foreground">{item.version}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Last updated</dt>
          <dd className="font-medium text-foreground">
            <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
          </dd>
        </div>
      </dl>
      {preview ? (
        <p className="mt-4 text-sm text-muted-foreground">The download button is active once published.</p>
      ) : (
        <a
          href={`/go/${item.slug}`}
          rel="nofollow"
          className={buttonVariants({ size: 'lg', className: 'mt-4 px-4' })}
        >
          <Download aria-hidden />
          {item.hasFile ? 'Download' : `Download from ${hostnameOf(item.externalUrl)}`}
        </a>
      )}
    </div>
  )
}

function SourcesList({ sources }: { sources: Source[] }) {
  return (
    <section aria-labelledby="sources-heading" className="mt-10 border-t border-border pt-6">
      <h2 id="sources-heading" className="font-heading text-xl font-semibold text-foreground">
        Sources
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        {sources.map((source, index) => (
          <li key={`${source.url}-${index}`} className="text-muted-foreground">
            <a href={source.url} rel="noopener noreferrer" className="text-link underline underline-offset-2">
              {source.title}
            </a>
            {source.publisher ? <span>, {source.publisher}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}

function ReviewNote({ item }: { item: ContentDetail }) {
  if (!item.aiGenerated) return null
  return (
    <p className="mt-8 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      This page was drafted with AI assistance and reviewed
      {item.reviewer ? <> by {item.reviewer.name}</> : null}
      {item.reviewedAt ? <> on {formatDate(item.reviewedAt)}</> : null} before publication.
    </p>
  )
}

function TagList({ item }: { item: ContentDetail }) {
  if (!item.tags.length) return null
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Tags:</span>
      <ul className="flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <li key={tag.slug}>
            <Link
              href={`/tags/${tag.slug}`}
              className="inline-block rounded-md border border-border px-2 py-0.5 text-sm text-foreground hover:bg-accent"
            >
              {tag.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AuthorBox({ author }: { author: NonNullable<ContentDetail['author']> }) {
  if (!author.bio) return null
  return (
    <section aria-label="About the author" className="mt-10 rounded-lg border border-border p-5">
      <p className="text-sm font-semibold text-foreground">About {author.name}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{author.bio}</p>
    </section>
  )
}

function CoverImage({ item }: { item: ContentDetail }) {
  const src = item.cover ? mediaPublicUrl(item.cover.path) : null
  if (!item.cover || !src) return null
  const { width, height, alt } = item.cover
  const sizes = '(min-width: 1024px) 48rem, 100vw'

  return (
    <figure className="mt-8 overflow-hidden rounded-lg border border-border bg-muted">
      {width && height ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          loading="eager"
          fetchPriority="high"
          className="h-auto w-full"
        />
      ) : (
        <div className="relative aspect-[1.91/1]">
          <Image src={src} alt={alt} fill sizes={sizes} loading="eager" fetchPriority="high" className="object-cover" />
        </div>
      )}
    </figure>
  )
}

export async function ContentArticle({ item, preview = false }: { item: ContentDetail; preview?: boolean }) {
  const config = contentTypeConfig[item.type]
  const headings = extractHeadings(item.body)
  const showToc = headings.length >= 3
  const related = preview
    ? []
    : await getRelatedContent({ id: item.id, type: item.type, categoryId: item.categoryId })

  return (
    <Container className="py-8 md:py-10">
      {preview ? null : (
        <>
          <Breadcrumbs items={[{ name: config.plural, path: config.path }, { name: item.title }]} />
          <JsonLd data={contentJsonLd(item)} />
        </>
      )}

      <div className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <article className="max-w-3xl min-w-0">
          <header>
            <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              <Link href={config.path} className="hover:text-foreground hover:underline">
                {config.label}
              </Link>
              {item.category ? (
                <>
                  <span aria-hidden> · </span>
                  <Link href={`/categories/${item.category.slug}`} className="hover:text-foreground hover:underline">
                    {item.category.name}
                  </Link>
                </>
              ) : null}
            </p>
            <h1 className="mt-2 font-heading text-3xl leading-tight font-semibold text-foreground md:text-[2.6rem]">
              {item.title}
            </h1>
            {item.excerpt ? (
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground md:text-xl">{item.excerpt}</p>
            ) : null}
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <ArticleMeta item={item} />
              {preview ? null : <ShareButton path={contentPath(item.type, item.slug)} title={item.title} withLabel />}
            </div>
          </header>

          {item.type === 'resource' ? <ResourcePanel item={item} preview={preview} /> : null}
          {item.type === 'download' ? <DownloadPanel item={item} preview={preview} /> : null}

          <CoverImage item={item} />

          {showToc ? (
            <TableOfContents
              id="toc-inline"
              headings={headings}
              className="mt-8 rounded-lg border border-border p-4 lg:hidden"
            />
          ) : null}

          <MarkdownContent source={item.body} className="mt-8" />

          {item.sources.length ? <SourcesList sources={item.sources} /> : null}
          <ReviewNote item={item} />
          <TagList item={item} />
          {item.author ? <AuthorBox author={item.author} /> : null}
        </article>

        {showToc ? (
          <aside className="hidden lg:block">
            <TableOfContents id="toc-sidebar" headings={headings} className="sticky top-24" />
          </aside>
        ) : null}
      </div>

      {related.length ? (
        <section aria-labelledby="related-heading" className="mt-16 border-t border-border pt-8">
          <h2 id="related-heading" className="font-heading text-2xl font-semibold text-foreground">
            Related reading
          </h2>
          <div className="mt-2">
            <ContentList items={related} showType headingLevel="h3" layout="grid-3" />
          </div>
        </section>
      ) : null}
    </Container>
  )
}

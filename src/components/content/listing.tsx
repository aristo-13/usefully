import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumbs } from '@/components/content/breadcrumbs'
import { ContentList } from '@/components/content/content-card'
import { Pagination } from '@/components/content/pagination'
import { Container } from '@/components/ui/container'
import { getCategories, getContentPage } from '@/lib/content/queries'
import { contentTypeConfig, paginatedPath, type ContentSummary, type ContentType, type Paginated } from '@/lib/content/types'
import type { BreadcrumbItem } from '@/lib/seo'

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {children ? <div className="mt-2 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  )
}

async function CategorySidebar({ activeSlug }: { activeSlug?: string }) {
  const categories = (await getCategories()).filter((category) => category.count > 0)
  if (!categories.length) return null

  return (
    <aside aria-labelledby="browse-categories" className="lg:sticky lg:top-24 lg:self-start">
      <h2 id="browse-categories" className="text-sm font-semibold text-foreground">
        Browse by category
      </h2>
      <ul className="mt-3 space-y-1 text-sm">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/categories/${category.slug}`}
              aria-current={category.slug === activeSlug ? 'page' : undefined}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
            >
              <span>{category.name}</span>
              <span className="text-xs tabular-nums">{category.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/** Shared frame for listing pages: breadcrumbs, heading, list, pagination and category sidebar. */
export async function ListingLayout({
  breadcrumbs,
  title,
  description,
  result,
  basePath,
  showType,
  activeCategory,
  emptyMessage,
}: {
  breadcrumbs: BreadcrumbItem[]
  title: string
  description: React.ReactNode
  result: Paginated<ContentSummary>
  basePath: string
  showType: boolean
  activeCategory?: string
  emptyMessage: string
}) {
  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={breadcrumbs} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <header className="max-w-3xl">
            <h1 className="font-heading text-3xl font-semibold text-foreground md:text-[2.6rem]">{title}</h1>
            <div className="mt-3 text-lg leading-relaxed text-muted-foreground">{description}</div>
            {result.page > 1 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </p>
            ) : null}
          </header>
          <div className="mt-8">
            {result.items.length ? (
              <ContentList items={result.items} showType={showType} />
            ) : (
              <EmptyState title={emptyMessage} />
            )}
            <Pagination basePath={basePath} page={result.page} totalPages={result.totalPages} />
          </div>
        </div>
        <CategorySidebar activeSlug={activeCategory} />
      </div>
    </Container>
  )
}

export async function ContentTypeListing({ type, page }: { type: ContentType; page: number }) {
  const config = contentTypeConfig[type]
  const result = await getContentPage({ type }, page)
  if (page > 1 && result.items.length === 0) notFound()

  return (
    <ListingLayout
      breadcrumbs={
        page > 1 ? [{ name: config.plural, path: config.path }, { name: `Page ${page}` }] : [{ name: config.plural }]
      }
      title={config.plural}
      description={config.description}
      result={result}
      basePath={config.path}
      showType={false}
      emptyMessage={`No ${config.plural.toLowerCase()} have been published yet.`}
    />
  )
}

export function listingTitle(title: string, page: number) {
  return page > 1 ? `${title} – Page ${page}` : title
}

export function listingPath(basePath: string, page: number) {
  return paginatedPath(basePath, page)
}

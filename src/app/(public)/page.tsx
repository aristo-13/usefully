import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ContentList } from '@/components/content/content-card'
import { EmptyState } from '@/components/content/listing'
import { LoadMore } from '@/components/content/load-more'
import { JsonLd } from '@/components/seo/json-ld'
import { SearchBox } from '@/components/site/search-box'
import { Container } from '@/components/ui/container'
import { getCategories, getContentPage } from '@/lib/content/queries'
import {
  CONTENT_TYPES,
  contentTypeConfig,
  type ContentSummary,
  type ContentType,
  type Paginated,
} from '@/lib/content/types'
import { openGraphBase, websiteJsonLd } from '@/lib/seo'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: { absolute: siteConfig.name },
  description: siteConfig.description,
  alternates: { canonical: '/' },
  openGraph: {
    ...openGraphBase('/'),
    type: 'website',
    title: siteConfig.name,
    description: siteConfig.description,
  },
}

function Section({ type, result }: { type: ContentType; result: Paginated<ContentSummary> }) {
  if (!result.items.length) return null
  const config = contentTypeConfig[type]
  const headingId = `latest-${type}`

  return (
    <section aria-labelledby={headingId} className="border-t border-border pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-heading text-2xl font-semibold text-foreground">
          {config.plural}
        </h2>
        <Link href={config.path} className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          View all
          <span className="sr-only">{config.plural.toLowerCase()}</span>
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <div className="mt-2">
        <ContentList items={result.items} headingLevel="h3" layout="grid-3" />
        <LoadMore
          feed={{ kind: 'type', type }}
          nextPage={2}
          hasMore={result.totalPages > 1}
          hrefTemplate={`${config.path}/page/{page}`}
          seenIds={result.items.map((item) => item.id)}
          headingLevel="h3"
          layout="grid-3"
          label={`Load more ${config.plural.toLowerCase()}`}
        />
      </div>
    </section>
  )
}

export default async function HomePage() {
  const [results, categories] = await Promise.all([
    Promise.all(CONTENT_TYPES.map((type) => getContentPage({ type }, 1))),
    getCategories(),
  ])
  const activeCategories = categories.filter((category) => category.count > 0)
  const hasContent = results.some((result) => result.items.length > 0)

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">
        {siteConfig.name}: {siteConfig.description}
      </h1>

      <section aria-label="Search" className="border-b border-border bg-muted/40">
        <Container className="py-8 md:py-10">
          <SearchBox id="home-search" size="lg" className="max-w-2xl" />
        </Container>
      </section>

      <Container className="space-y-12 py-10 md:py-12">
        {hasContent ? (
          CONTENT_TYPES.map((type, index) => <Section key={type} type={type} result={results[index]} />)
        ) : (
          <EmptyState title="Nothing has been published yet.">
            New articles, tutorials, resources and downloads will appear here.
          </EmptyState>
        )}

        {activeCategories.length ? (
          <section aria-labelledby="home-categories" className="border-t border-border pt-8">
            <h2 id="home-categories" className="font-heading text-2xl font-semibold text-foreground">
              Browse by category
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {activeCategories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
                  >
                    {category.name}
                    <span className="text-xs text-muted-foreground tabular-nums">{category.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </>
  )
}

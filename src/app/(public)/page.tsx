import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ContentCard } from '@/components/content/content-card'
import { EmptyState } from '@/components/content/listing'
import { JsonLd } from '@/components/seo/json-ld'
import { SearchBox } from '@/components/site/search-box'
import { Container } from '@/components/ui/container'
import { getCategories, getLatestContent } from '@/lib/content/queries'
import { contentTypeConfig, type ContentSummary, type ContentType } from '@/lib/content/types'
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

function Section({
  type,
  items,
  columns,
}: {
  type: ContentType
  items: ContentSummary[]
  columns: 2 | 3
}) {
  if (!items.length) return null
  const config = contentTypeConfig[type]
  const headingId = `latest-${type}`

  return (
    <section aria-labelledby={headingId} className="border-t border-border pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id={headingId} className="font-heading text-2xl font-semibold text-foreground">
            {config.plural}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <Link
          href={config.path}
          className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline"
        >
          All {config.plural.toLowerCase()}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <ul className={columns === 3 ? 'mt-2 grid gap-x-8 md:grid-cols-2 lg:grid-cols-3' : 'mt-2 grid gap-x-8 md:grid-cols-2'}>
        {items.map((item) => (
          <li key={item.id} className="border-b border-border">
            <ContentCard item={item} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function HomePage() {
  const [articles, tutorials, resources, downloads, categories] = await Promise.all([
    getLatestContent('article', 6),
    getLatestContent('tutorial', 4),
    getLatestContent('resource', 6),
    getLatestContent('download', 4),
    getCategories(),
  ])
  const activeCategories = categories.filter((category) => category.count > 0)
  const hasContent = articles.length + tutorials.length + resources.length + downloads.length > 0

  return (
    <>
      <JsonLd data={websiteJsonLd()} />

      <section className="border-b border-border bg-muted/40">
        <Container className="py-12 md:py-16">
          <div className="max-w-3xl">
            <h1 className="font-heading text-4xl leading-tight font-semibold text-foreground md:text-5xl">
              {siteConfig.description}
            </h1>
            <SearchBox id="home-search" size="lg" className="mt-8" />
          </div>
        </Container>
      </section>

      <Container className="space-y-12 py-10 md:py-12">
        {hasContent ? (
          <>
            <Section type="article" items={articles} columns={3} />
            <Section type="tutorial" items={tutorials} columns={2} />
            <Section type="resource" items={resources} columns={3} />
            <Section type="download" items={downloads} columns={2} />
          </>
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

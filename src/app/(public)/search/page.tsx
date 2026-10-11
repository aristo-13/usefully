import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { Breadcrumbs } from '@/components/content/breadcrumbs'
import { ContentList } from '@/components/content/content-card'
import { EmptyState } from '@/components/content/listing'
import { SearchBox } from '@/components/site/search-box'
import { Container } from '@/components/ui/container'
import { searchContent } from '@/lib/content/queries'
import { CONTENT_TYPES, contentTypeConfig, isContentType, type ContentType } from '@/lib/content/types'
import { siteConfig } from '@/lib/site'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Search',
  description: `Search all published articles, tutorials, resources and downloads on ${siteConfig.name}.`,
  alternates: { canonical: '/search' },
  // Result pages are thin and endless; keep them out of search engines.
  robots: { index: false, follow: true },
}

function firstValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return (raw ?? '').trim().slice(0, 200)
}

function searchHref(query: string, type: ContentType | null) {
  const params = new URLSearchParams({ q: query })
  if (type) params.set('type', type)
  return `/search?${params.toString()}`
}

async function SearchResults({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
  const params = await searchParams
  const query = firstValue(params.q)
  const typeParam = firstValue(params.type)
  const type = isContentType(typeParam) ? typeParam : null
  const searched = query.length >= 2
  const { ok, results } = searched ? await searchContent(query, type) : { ok: true, results: [] }

  return (
    <>
      <SearchBox id="search-page-input" size="lg" defaultValue={query} className="mt-6 max-w-2xl" />

      {searched ? (
        <>
          <nav aria-label="Filter by type" className="mt-6">
            <ul className="flex flex-wrap gap-2 text-sm">
              {[null, ...CONTENT_TYPES].map((option) => {
                const current = option === type
                return (
                  <li key={option ?? 'all'}>
                    <Link
                      href={searchHref(query, option)}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'inline-block rounded-md border px-3 py-1.5 hover:bg-accent',
                        current ? 'border-primary bg-primary text-primary-foreground hover:bg-primary' : 'border-border',
                      )}
                    >
                      {option ? contentTypeConfig[option].plural : 'All'}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <p role="status" className="mt-6 text-sm text-muted-foreground">
            {ok
              ? `${results.length === 30 ? '30+' : results.length} ${results.length === 1 ? 'result' : 'results'} for “${query}”`
              : 'Search is temporarily unavailable. Please try again in a moment.'}
          </p>

          <div className="mt-4">
            {results.length ? (
              <ContentList items={results} showType />
            ) : ok ? (
              <EmptyState title="No matching pages found.">
                Try fewer or different words, or browse the{' '}
                <Link href="/categories" className="text-link underline">
                  categories
                </Link>
                .
              </EmptyState>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Enter at least two characters to search titles, summaries, keywords and full text.
        </p>
      )}
    </>
  )
}

function SearchFallback() {
  return (
    <div aria-hidden className="mt-6 space-y-4">
      <div className="h-12 max-w-2xl animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-md bg-muted" />
    </div>
  )
}

export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ name: 'Search' }]} />
      <h1 className="mt-6 font-heading text-3xl font-semibold text-foreground md:text-[2.6rem]">Search</h1>
      <Suspense fallback={<SearchFallback />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </Container>
  )
}

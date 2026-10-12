import type { Metadata } from 'next'
import Link from 'next/link'

import { SearchBox } from '@/components/site/search-box'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { Container } from '@/components/ui/container'
import { CONTENT_TYPES, contentTypeConfig } from '@/lib/content/types'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 *:animate-page-fade">
        <Container size="narrow" className="py-16 md:py-24">
          <p className="text-sm font-medium text-muted-foreground">404</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground">Page not found</h1>
          <p className="mt-4 text-muted-foreground">
            The page you were looking for doesn’t exist or is no longer available. Try searching, or
            start from one of the sections below.
          </p>
          <SearchBox id="not-found-search" className="mt-6 max-w-md" />
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/" className="text-link underline-offset-2 hover:underline">
                Home
              </Link>
            </li>
            {CONTENT_TYPES.map((type) => (
              <li key={type}>
                <Link
                  href={contentTypeConfig[type].path}
                  className="text-link underline-offset-2 hover:underline"
                >
                  {contentTypeConfig[type].plural}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </main>
      <SiteFooter />
    </>
  )
}

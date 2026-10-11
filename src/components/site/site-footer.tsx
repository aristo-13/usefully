import Link from 'next/link'
import { cacheLife } from 'next/cache'

import { Logo } from '@/components/site/logo'
import { CONTENT_TYPES, contentTypeConfig } from '@/lib/content/types'
import { siteConfig } from '@/lib/site'

async function CopyrightYear() {
  'use cache'
  cacheLife('days')
  return <>{new Date().getFullYear()}</>
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6">
        <div className="max-w-sm space-y-2">
          <Logo height={26} />
          <p className="text-sm text-muted-foreground">{siteConfig.description}</p>
        </div>
        <nav aria-label="Footer" className="sm:justify-self-end">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
            {CONTENT_TYPES.map((type) => (
              <li key={type}>
                <Link
                  href={contentTypeConfig[type].path}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {contentTypeConfig[type].plural}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/categories" className="text-muted-foreground hover:text-foreground hover:underline">
                Categories
              </Link>
            </li>
            <li>
              <Link href="/search" className="text-muted-foreground hover:text-foreground hover:underline">
                Search
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © <CopyrightYear /> {siteConfig.name}
        </p>
      </div>
    </footer>
  )
}

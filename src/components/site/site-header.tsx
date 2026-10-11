import Link from 'next/link'

import { Logo } from '@/components/site/logo'
import { DesktopNav, MobileNav, type NavItem } from '@/components/site/nav-links'
import { SearchBox } from '@/components/site/search-box'
import { CONTENT_TYPES, contentTypeConfig } from '@/lib/content/types'

const navItems: NavItem[] = [
  ...CONTENT_TYPES.map((type) => ({
    href: contentTypeConfig[type].path,
    label: contentTypeConfig[type].plural,
    segment: contentTypeConfig[type].path.slice(1),
  })),
  { href: '/categories', label: 'Categories', segment: 'categories' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-sm">
          <Logo height={30} />
        </Link>
        <div className="flex items-center gap-4">
          <DesktopNav items={navItems} />
          <SearchBox className="hidden w-56 lg:block" id="header-search" />
          <MobileNav items={navItems} searchSlot={<SearchBox id="mobile-search" />} />
        </div>
      </div>
    </header>
  )
}

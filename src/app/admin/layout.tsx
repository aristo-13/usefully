import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { AccountMenu } from '@/components/admin/account-menu'
import { AdminNav, AdminNavLinks } from '@/components/admin/admin-nav'
import { LogoMark } from '@/components/site/logo'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: `%s · ${siteConfig.name} admin` },
  robots: { index: false, follow: false },
}

// Every admin page checks the admin role itself (layouts are not re-run on
// client navigation) and the database enforces it again through RLS. Each page
// also renders its data inside <Suspense fallback={<AdminPageSkeleton />}>:
// fallbacks in this layout or in loading.tsx do not cover navigations between
// admin pages, which would otherwise wait for the data before showing anything.
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-muted/30 md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex flex-col gap-4 p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
          <Link href="/admin" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <LogoMark size={22} />
            <span>
              {siteConfig.name} <span className="font-normal text-muted-foreground">admin</span>
            </span>
          </Link>
          <details className="group md:hidden">
            <summary className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm font-medium">
              Menu
            </summary>
            <div className="mt-3">
              <Suspense fallback={<AdminNavLinks />}>
                <AdminNav />
              </Suspense>
            </div>
          </details>
          <div className="hidden md:block">
            <Suspense fallback={<AdminNavLinks />}>
              <AdminNav />
            </Suspense>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-end border-b border-border px-4 py-2 md:px-8">
          <Suspense fallback={null}>
            <AccountMenu />
          </Suspense>
        </header>
        <main id="main" className="flex-1 px-4 py-6 *:animate-page-fade md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}

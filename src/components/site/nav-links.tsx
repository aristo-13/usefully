'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

import { cn } from '@/lib/utils'

export type NavItem = { href: string; label: string; segment: string }

function useActiveSegment() {
  // Segment below the public layout, e.g. "articles" for /articles/foo.
  return useSelectedLayoutSegment()
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const active = useActiveSegment()
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const current = active === item.segment
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  current && 'text-foreground underline decoration-brand decoration-2 underline-offset-[10px]',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function MobileNav({ items, searchSlot }: { items: NavItem[]; searchSlot: React.ReactNode }) {
  const active = useActiveSegment()
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
      </button>
      <div
        id="mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-background shadow-sm"
      >
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-4 sm:px-6">
          {searchSlot}
          <nav aria-label="Main">
            <ul className="grid gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active === item.segment ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'block rounded-md px-3 py-2 text-base font-medium hover:bg-accent',
                      active === item.segment ? 'bg-accent text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  )
}

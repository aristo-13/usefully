'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  FolderTree,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  Settings,
  Tags,
} from 'lucide-react'

import { cn } from '@/lib/utils'

const sections = [
  {
    label: 'Content',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/articles', label: 'Articles', icon: FileText },
      { href: '/admin/tutorials', label: 'Tutorials', icon: GraduationCap },
      { href: '/admin/resources', label: 'Resources', icon: BookOpen },
      { href: '/admin/downloads', label: 'Downloads', icon: Download },
    ],
  },
  {
    label: 'Organize',
    items: [
      { href: '/admin/categories', label: 'Categories', icon: FolderTree },
      { href: '/admin/tags', label: 'Tags', icon: Tags },
      { href: '/admin/media', label: 'Media', icon: ImageIcon },
      { href: '/admin/redirects', label: 'Redirects', icon: Link2 },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/admin/settings', label: 'Settings', icon: Settings }],
  },
]

/** Section segment for an admin URL: /admin/articles/123 -> "articles", /admin -> null. */
function segmentOf(href: string): string | null {
  return href.split('/')[2] ?? null
}

/**
 * Highlights the current section. The segment is request data on dynamic
 * routes, so the layout renders this inside <Suspense> with the plain
 * <AdminNavLinks /> as the prerendered fallback.
 */
export function AdminNav() {
  return <AdminNavLinks segment={useSelectedLayoutSegment()} />
}

export function AdminNavLinks({ segment }: { segment?: string | null }) {
  return (
    <nav aria-label="Dashboard" className="space-y-5">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {section.label}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {section.items.map((item) => {
              const active = segment !== undefined && segmentOf(item.href) === segment
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <div className="border-t border-border pt-4">
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ExternalLink aria-hidden className="size-4" />
          View site
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </nav>
  )
}

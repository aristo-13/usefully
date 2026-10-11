import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbJsonLd, type BreadcrumbItem } from '@/lib/seo'

/** Visible breadcrumb trail plus matching BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const trail: BreadcrumbItem[] = [{ name: 'Home', path: '/' }, ...items]

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {trail.map((item, index) => {
            const last = index === trail.length - 1
            return (
              <li key={`${item.name}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0" /> : null}
                {item.path && !last ? (
                  <Link href={item.path} className="hover:text-foreground hover:underline">
                    {item.name}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className="line-clamp-1 text-foreground">
                    {item.name}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </>
  )
}

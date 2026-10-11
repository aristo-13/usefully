import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { paginatedPath } from '@/lib/content/types'
import { cn } from '@/lib/utils'

/** Returns the page numbers to show, with null marking a gap. */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const result: (number | null)[] = []
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push(null)
    result.push(p)
  })
  return result
}

const linkClass =
  'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border border-border px-3 text-sm font-medium hover:bg-accent'

export function Pagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-between gap-3">
      <div>
        {page > 1 ? (
          <Link href={paginatedPath(basePath, page - 1)} rel="prev" className={linkClass}>
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </Link>
        ) : null}
      </div>
      <ol className="flex flex-wrap items-center gap-1">
        {pageWindow(page, totalPages).map((p, index) =>
          p === null ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={paginatedPath(basePath, p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={cn(linkClass, p === page && 'border-primary bg-primary text-primary-foreground hover:bg-primary')}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ol>
      <div>
        {page < totalPages ? (
          <Link href={paginatedPath(basePath, page + 1)} rel="next" className={linkClass}>
            Next
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  )
}

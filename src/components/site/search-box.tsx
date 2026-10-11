import Form from 'next/form'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'

/** GET form to /search. Works without JavaScript; next/form adds client navigation. */
export function SearchBox({
  defaultValue,
  className,
  id = 'site-search',
  size = 'sm',
}: {
  defaultValue?: string
  className?: string
  id?: string
  size?: 'sm' | 'lg'
}) {
  return (
    <Form action="/search" role="search" className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        Search the site
      </label>
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground',
          size === 'lg' ? 'size-5' : 'size-4',
        )}
      />
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search articles, tutorials, resources…"
        maxLength={200}
        autoComplete="off"
        className={cn(
          'w-full rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none',
          size === 'lg' ? 'h-12 pr-24 pl-10 text-base' : 'h-9 pr-3 pl-9 text-sm',
        )}
      />
      {size === 'lg' ? (
        <button
          type="submit"
          className="absolute top-1.5 right-1.5 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      ) : null}
    </Form>
  )
}

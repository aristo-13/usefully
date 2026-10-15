'use client'

import Image from 'next/image'
import { useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StockPhoto } from '@/lib/admin/types'
import { cn } from '@/lib/utils'

const newTab = <span className="sr-only"> (opens in a new tab)</span>

/**
 * Free photos from Pexels for the cover, found by the AI or searched for here.
 * Clicking one makes it the cover. Pexels asks for a visible link to it wherever
 * its search results are shown.
 */
export function CoverPhotos({
  initialQuery,
  photos,
  message,
  current,
  searching,
  disabled,
  onSearch,
  onPick,
}: {
  /** The AI's first search, so the editor can refine it. */
  initialQuery: string
  /** Null until the first search. */
  photos: StockPhoto[] | null
  message: string | null
  /** The cover's web address, to mark the photo in use. */
  current: string | null
  searching: boolean
  disabled: boolean
  onSearch: (query: string) => void
  onPick: (photo: StockPhoto) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const chosen = photos?.find((photo) => photo.src === current) ?? null

  function search() {
    const text = query.trim()
    if (text && !searching && !disabled) onSearch(text)
  }

  return (
    // The search box is not part of the post: keep it from marking the form as edited.
    <fieldset onChange={(event) => event.stopPropagation()} className="space-y-2 border-t border-border pt-4">
      <legend className="sr-only">Free photos from Pexels</legend>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor="photo-search" className="text-sm font-medium text-foreground">
          Free photos
        </label>
        <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="text-xs text-link hover:underline">
          Photos provided by Pexels
          {newTab}
        </a>
      </div>
      <div className="flex gap-2">
        <Input
          id="photo-search"
          type="search"
          maxLength={100}
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              search()
            }
          }}
          placeholder="What should the photo show? e.g. Accra market"
        />
        <button
          type="button"
          onClick={search}
          disabled={disabled || searching || !query.trim()}
          className={buttonVariants({ variant: 'outline', className: 'h-9 shrink-0' })}
        >
          {searching ? <LoaderCircle aria-hidden className="animate-spin" /> : <Search aria-hidden />}
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}

      {photos?.length ? (
        // Sized by the space it has: the editor's sidebar on wide screens, the full width below that.
        <div className="@container space-y-2">
          <ul className={cn('grid grid-cols-3 gap-2 @lg:grid-cols-4 @3xl:grid-cols-6', searching && 'opacity-60')}>
            {photos.map((photo) => {
              const inUse = photo.src === current
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => onPick(photo)}
                    disabled={disabled || inUse}
                    aria-pressed={inUse}
                    title={photo.alt ? `${photo.alt} (by ${photo.photographer})` : `By ${photo.photographer}`}
                    className={cn(
                      'relative block aspect-[1.4/1] w-full overflow-hidden rounded-md border bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      inUse ? 'border-brand ring-2 ring-brand' : 'border-border hover:border-foreground/40',
                    )}
                  >
                    <Image src={photo.thumb} alt="" fill sizes="160px" unoptimized className="object-cover" />
                    <span className="sr-only">
                      {inUse ? 'The cover now: ' : 'Use as the cover: '}
                      {photo.alt || 'photo'}, by {photo.photographer}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {chosen ? (
              <>
                Cover: photo by{' '}
                <a href={chosen.photographerUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
                  {chosen.photographer}
                  {newTab}
                </a>{' '}
                on{' '}
                <a href={chosen.page} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
                  Pexels
                  {newTab}
                </a>
                , credited under Sources. Click another photo to use it instead.
              </>
            ) : (
              'Click a photo to use it as the cover. Pexels photos are free to use, including on sites with ads.'
            )}
          </p>
        </div>
      ) : null}
    </fieldset>
  )
}

import 'server-only'

import type { PhotoSearchResult, StockPhoto } from '@/lib/admin/types'
import { setting } from '@/lib/env'

// Free cover photos from Pexels (https://www.pexels.com/api/). Its licence
// allows commercial use without attribution; the API guidelines ask for a link
// to Pexels where results are shown and a credit to the photographer when
// possible, which the editor adds to the post's sources.

const SEARCH_URL = 'https://api.pexels.com/v1/search'
const MAX_PHOTOS = 12

export const PHOTOS_OFF_MESSAGE =
  'Add a free Pexels API key as PEXELS_API_KEY to search for cover photos (see README → Cover photos).'

function pexelsKey(): string | undefined {
  return setting(process.env.PEXELS_API_KEY)
}

export function photosEnabled(): boolean {
  return Boolean(pexelsKey())
}

type PexelsPhoto = {
  id?: unknown
  url?: unknown
  alt?: unknown
  photographer?: unknown
  photographer_url?: unknown
  src?: { landscape?: unknown; tiny?: unknown }
}

class PhotoError extends Error {}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** An https link on one of Pexels' own hosts, or null. */
function pexelsUrl(value: unknown, host: string): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === host ? url.toString() : null
  } catch {
    return null
  }
}

/** The fields the editor needs from a Pexels search result; null when it is incomplete. */
export function toStockPhoto(photo: PexelsPhoto): StockPhoto | null {
  const src = pexelsUrl(photo.src?.landscape, 'images.pexels.com')
  const page = pexelsUrl(photo.url, 'www.pexels.com')
  if (typeof photo.id !== 'number' || !Number.isSafeInteger(photo.id) || !src || !page) return null
  return {
    id: photo.id,
    src,
    thumb: pexelsUrl(photo.src?.tiny, 'images.pexels.com') ?? src,
    alt: text(photo.alt, 300),
    photographer: text(photo.photographer, 100) || 'a Pexels photographer',
    photographerUrl: pexelsUrl(photo.photographer_url, 'www.pexels.com') ?? page,
    page,
  }
}

async function search(query: string, perPage: number, key: string): Promise<StockPhoto[]> {
  const url = `${SEARCH_URL}?${new URLSearchParams({ query, orientation: 'landscape', per_page: String(perPage) })}`
  let response: Response
  try {
    response = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) })
  } catch {
    throw new PhotoError('Pexels could not be reached. Try again in a moment.')
  }
  if (response.status === 401 || response.status === 403) {
    throw new PhotoError('Pexels did not accept the API key. Check PEXELS_API_KEY (see README → Cover photos).')
  }
  if (response.status === 429) {
    throw new PhotoError('The Pexels limit of 200 searches an hour has been reached. Try again later, or upload a photo.')
  }
  if (!response.ok) throw new PhotoError(`Pexels is not answering (error ${response.status}). Try again in a few minutes.`)
  const data = (await response.json().catch(() => null)) as { photos?: unknown } | null
  const photos = Array.isArray(data?.photos) ? (data.photos as PexelsPhoto[]) : []
  return photos.flatMap((photo) => toStockPhoto(photo) ?? [])
}

/** Landscape photos for up to three searches, best first: most from the first search, then the others. */
export async function searchStockPhotos(searches: string[]): Promise<PhotoSearchResult> {
  const key = pexelsKey()
  if (!key) return { ok: false, message: PHOTOS_OFF_MESSAGE }
  const queries = [...new Set(searches.map((entry) => entry.replace(/\s+/g, ' ').trim().slice(0, 100)).filter(Boolean))].slice(0, 3)
  if (!queries.length) return { ok: false, message: 'Type what the photo should show.' }

  const results = await Promise.allSettled(queries.map((query, index) => search(query, index === 0 ? 8 : 4, key)))
  const found = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  if (!found.length) {
    const failure = (results[0] as PromiseRejectedResult).reason
    if (!(failure instanceof PhotoError)) console.error('[photos] search failed:', failure)
    return { ok: false, message: failure instanceof PhotoError ? failure.message : 'The photo search failed. Try again.' }
  }
  const seen = new Set<number>()
  const photos = found.flat().filter((photo) => !seen.has(photo.id) && Boolean(seen.add(photo.id)))
  return { ok: true, photos: photos.slice(0, MAX_PHOTOS) }
}

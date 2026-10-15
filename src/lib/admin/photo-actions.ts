'use server'

import type { PhotoSearchResult } from '@/lib/admin/types'
import { getAuthState } from '@/lib/auth'
import { searchStockPhotos } from '@/lib/stock-photos'

/** Free photos from Pexels for a post's cover, for searches written by the AI or typed by the editor. */
export async function searchCoverPhotos(searches: unknown): Promise<PhotoSearchResult> {
  // Reported rather than redirected, so an expired session does not take the editor away from unsaved work.
  if ((await getAuthState()).status !== 'admin') {
    return { ok: false, message: 'Your session has ended. Sign in again in another tab, then retry.' }
  }
  if (!Array.isArray(searches) || !searches.every((entry) => typeof entry === 'string' && entry.length <= 100)) {
    return { ok: false, message: 'Type what the photo should show.' }
  }
  return searchStockPhotos(searches.slice(0, 3))
}

'use server'

import { updateTag } from 'next/cache'

import { errorState, successState, type ActionState } from '@/lib/admin/validation'
import { requireAdmin } from '@/lib/auth'
import { getSitemapContent } from '@/lib/content/queries'
import { contentPath } from '@/lib/content/types'
import { SEARCH_CONSOLE_TAG, submitSitemapToGoogle, submitToIndexNowEngines } from '@/lib/search-engines'
import { TRENDS_TAG } from '@/lib/trends'

/** Fetches every trends source again on the next view, instead of waiting up to 15 minutes. */
export async function refreshTrends(): Promise<void> {
  await requireAdmin()
  updateTag(TRENDS_TAG)
}

/** Reads Search Console again on the next view instead of using the copy from earlier today. */
export async function refreshSearchData(): Promise<void> {
  await requireAdmin()
  updateTag(SEARCH_CONSOLE_TAG)
}

export async function submitSitemap(): Promise<ActionState> {
  await requireAdmin()
  const result = await submitSitemapToGoogle()
  if (!result.ok) return errorState(result.message)
  updateTag(SEARCH_CONSOLE_TAG)
  return successState(result.message)
}

/** Sends every indexable published page to Bing and the other IndexNow search engines. */
export async function submitAllToIndexNow(): Promise<ActionState> {
  await requireAdmin()
  const pages = await getSitemapContent()
  const paths = ['/', ...pages.filter((page) => !page.noindex && !page.canonicalUrl).map((page) => contentPath(page.type, page.slug))]
  const result = await submitToIndexNowEngines(paths)
  return result.ok ? successState(result.message) : errorState(result.message)
}

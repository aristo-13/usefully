'use server'

import { listPostCategories, listTaxonomy } from '@/lib/admin/queries'
import { CATEGORY_SYSTEM, categoryAdviceSchema, categoryPrompt, cleanCategoryAdvice, type CategoryInput } from '@/lib/ai/categories'
import type { CategoryAdviceResult, LinkReadResult } from '@/lib/ai/fields'
import { aiSetup, generateStructured } from '@/lib/ai/writer'
import { getAuthState, requireAdmin } from '@/lib/auth'
import { readLink } from '@/lib/social-link'
import { getSearchTrends } from '@/lib/trends'

/** Reads a link to a post on X, TikTok, YouTube… or any page, for the AI writer to write from. */
export async function readPostLink(url: unknown): Promise<LinkReadResult> {
  // Reported rather than redirected, so an expired session does not take the editor away from unsaved work.
  if ((await getAuthState()).status !== 'admin') {
    return { ok: false, message: 'Your session has ended. Sign in again in another tab, then retry.' }
  }
  if (typeof url !== 'string' || !url.trim() || url.length > 2000) {
    return { ok: false, message: 'Paste the full link, starting with https://' }
  }
  return readLink(url)
}

/** What people search for now in Ghana and worldwide (cached by the Trends page); empty if unavailable. */
async function trendingSearches(): Promise<string[]> {
  const results = await Promise.all([getSearchTrends('ghana'), getSearchTrends('global')])
  const terms = results.flatMap((result) => (result.status === 'ok' ? result.items.slice(0, 12).map((trend) => trend.term) : []))
  return [...new Set(terms)]
}

/** Asks the AI to review the existing categories and suggest new ones. Nothing is changed until the editor applies a suggestion. */
export async function suggestCategories(guidance: unknown): Promise<CategoryAdviceResult> {
  await requireAdmin()
  const setup = aiSetup()
  if (!setup.enabled) return { status: 'error', message: setup.message }

  let input: CategoryInput
  try {
    const [categories, posts, trends] = await Promise.all([
      listTaxonomy('categories'),
      listPostCategories(),
      trendingSearches().catch(() => []),
    ])
    input = {
      categories,
      posts,
      trends,
      guidance: typeof guidance === 'string' ? guidance.slice(0, 1000) : '',
      today: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date()),
    }
  } catch {
    return { status: 'error', message: 'The site data the AI needs could not be loaded. Try again.' }
  }

  const answer = await generateStructured(CATEGORY_SYSTEM, categoryPrompt(input), categoryAdviceSchema)
  if (!answer.ok) return { status: 'error', message: answer.message }
  const parsed = categoryAdviceSchema.safeParse(answer.data)
  if (!parsed.success) return { status: 'error', message: 'The AI returned an answer that could not be used. Try again.' }
  return { status: 'ok', ...cleanCategoryAdvice(parsed.data, input.categories) }
}

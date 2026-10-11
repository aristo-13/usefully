import 'server-only'

import { getCategories, getPageCount, getPublishedSlugs, getTags } from '@/lib/content/queries'
import { PAGE_SIZE, type ContentType } from '@/lib/content/types'

/**
 * With Cache Components, generateStaticParams must return at least one entry.
 * When nothing is published yet we return this value, which fails slug and
 * page validation and therefore renders a 404 without touching the database.
 */
export const PLACEHOLDER_PARAM = '__none__'

/** Paginated listing pages prerendered at build time; later pages render on first visit. */
const MAX_PRERENDERED_PAGES = 20

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= 100 && SLUG_PATTERN.test(value)
}

/** Parses a `/page/[page]` segment. Only 2..9999 are valid (page 1 is the base URL). */
export function parsePageParam(value: string): number | null {
  if (!/^\d{1,4}$/.test(value)) return null
  const page = Number(value)
  return page >= 2 ? page : null
}

function pagesFrom(totalPages: number): number[] {
  const pages: number[] = []
  for (let page = 2; page <= Math.min(totalPages, MAX_PRERENDERED_PAGES); page++) pages.push(page)
  return pages
}

export async function contentSlugParams(type: ContentType) {
  const slugs = await getPublishedSlugs(type)
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: PLACEHOLDER_PARAM }]
}

export async function contentPageParams(type: ContentType) {
  const pages = pagesFrom(await getPageCount({ type }))
  return pages.length ? pages.map((page) => ({ page: String(page) })) : [{ page: PLACEHOLDER_PARAM }]
}

export async function categorySlugParams() {
  const categories = await getCategories()
  return categories.length
    ? categories.map((category) => ({ slug: category.slug }))
    : [{ slug: PLACEHOLDER_PARAM }]
}

export async function categoryPageParams() {
  const categories = await getCategories()
  const params = categories.flatMap((category) =>
    pagesFrom(Math.ceil(category.count / PAGE_SIZE)).map((page) => ({
      slug: category.slug,
      page: String(page),
    })),
  )
  return params.length ? params : [{ slug: PLACEHOLDER_PARAM, page: PLACEHOLDER_PARAM }]
}

export async function tagSlugParams() {
  const tags = (await getTags()).filter((tag) => tag.count > 0)
  return tags.length ? tags.map((tag) => ({ slug: tag.slug })) : [{ slug: PLACEHOLDER_PARAM }]
}

export async function tagPageParams() {
  const tags = await getTags()
  const params = tags.flatMap((tag) =>
    pagesFrom(Math.ceil(tag.count / PAGE_SIZE)).map((page) => ({ slug: tag.slug, page: String(page) })),
  )
  return params.length ? params : [{ slug: PLACEHOLDER_PARAM, page: PLACEHOLDER_PARAM }]
}

// Content checks for published posts: things that hold pages back in search
// results or when shared. No project imports, so this can be tested on its own.

export type AuditItem = {
  id: string
  type: 'article' | 'tutorial' | 'resource' | 'download'
  title: string
  slug: string
  excerpt: string
  words: number
  seoTitle: string | null
  seoDescription: string | null
  noindex: boolean
  hasCover: boolean
  coverAlt: string
  sources: number
  hasCategory: boolean
  tags: number
  updatedAt: string
}

export type AuditIssue = {
  code: string
  /** "fix" likely hurts the page now; "improve" is a worthwhile gain. */
  level: 'fix' | 'improve'
  message: string
}

export type AuditResult = { item: AuditItem; issues: AuditIssue[] }

const LONG_FORM = new Set(['article', 'tutorial'])

export function auditContent(items: AuditItem[], { siteName, now = new Date() }: { siteName: string; now?: Date }): AuditResult[] {
  const titleCounts = new Map<string, number>()
  for (const item of items) {
    const key = item.title.trim().toLocaleLowerCase()
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1)
  }

  const results = items.map((item) => {
    const issues: AuditIssue[] = []
    const add = (code: string, level: AuditIssue['level'], message: string) => issues.push({ code, level, message })

    if (item.noindex) {
      add('noindex', 'fix', 'Hidden from search engines (noindex is on). Turn it off unless that is intentional.')
    }
    if ((titleCounts.get(item.title.trim().toLocaleLowerCase()) ?? 0) > 1) {
      add('duplicate-title', 'fix', 'Another post has the same title. Give each post a distinct title.')
    }

    const description = (item.seoDescription || item.excerpt).trim()
    if (description.length < 50) {
      add('short-description', 'fix', `The search result description is only ${description.length} characters. Write 120–160 characters that answer what the page is about.`)
    } else if (description.length > 160) {
      add('long-description', 'improve', `The search result description is ${description.length} characters and may be cut off. Aim for 160 or fewer.`)
    }

    const shownTitle = item.seoTitle || `${item.title} | ${siteName}`
    if (shownTitle.length > 60) {
      add('long-title', 'improve', `The title in search results is ${shownTitle.length} characters and may be cut off. Set a shorter SEO title (60 or fewer).`)
    }

    const minWords = LONG_FORM.has(item.type) ? 300 : 120
    if (item.words < minWords) {
      add('thin', 'improve', `Only ${item.words} words. Pages that fully answer the question do better; aim for at least ${minWords}.`)
    }
    if (LONG_FORM.has(item.type) && item.sources === 0) {
      add('no-sources', 'improve', 'No sources cited. Linking to the sources you used builds trust with readers and search engines.')
    }
    if (!item.hasCover) {
      add('no-cover', 'improve', 'No cover image, so shares and Google Discover show no picture.')
    } else if (!item.coverAlt.trim()) {
      add('no-alt', 'improve', 'The cover image has no alt text.')
    }
    if (!item.hasCategory) add('no-category', 'improve', 'No category. Category pages link related posts together.')
    if (item.tags === 0) add('no-tags', 'improve', 'No tags. Tags connect related posts across categories.')

    const daysSinceUpdate = (now.getTime() - Date.parse(item.updatedAt)) / 86_400_000
    if (daysSinceUpdate > 365) {
      add('stale', 'improve', 'Not updated for over a year. Check the facts and dates, then save to show a fresh Updated date.')
    }

    issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'fix' ? -1 : 1))
    return { item, issues }
  })

  const fixes = (result: AuditResult) => result.issues.filter((issue) => issue.level === 'fix').length
  return results
    .filter((result) => result.issues.length)
    .sort((a, b) => fixes(b) - fixes(a) || b.issues.length - a.issues.length)
}

/** Words a reader sees: code blocks, images, link targets and bare URLs are not counted. */
export function countWords(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_`~[\]()!|-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}

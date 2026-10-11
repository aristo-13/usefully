function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return new URL(candidate).origin
    } catch {
      // Ignore malformed values and fall through to the next candidate.
    }
  }

  return 'http://localhost:3000'
}

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'Usefully',
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() ||
    'Practical articles, step-by-step tutorials, reviewed resources and useful downloads.',
  url: resolveSiteUrl(),
  locale: 'en_US',
  language: 'en',
} as const

/** Builds an absolute URL on the public site from a path such as `/articles/foo`. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, siteConfig.url).toString()
}

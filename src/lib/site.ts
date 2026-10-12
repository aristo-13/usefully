import { setting } from '@/lib/env'

function resolveSiteUrl(): string {
  const candidates = [
    setting(process.env.NEXT_PUBLIC_SITE_URL),
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
  name: setting(process.env.NEXT_PUBLIC_SITE_NAME) || 'Usefully',
  description:
    setting(process.env.NEXT_PUBLIC_SITE_DESCRIPTION) ||
    'Practical articles, step-by-step tutorials, reviewed resources and useful downloads.',
  url: resolveSiteUrl(),
  locale: 'en_US',
  language: 'en',
} as const

/** Whether NEXT_PUBLIC_SITE_URL holds a real address (not empty or a placeholder). */
export const siteUrlConfigured = Boolean(setting(process.env.NEXT_PUBLIC_SITE_URL))

/** Builds an absolute URL on the public site from a path such as `/articles/foo`. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, siteConfig.url).toString()
}

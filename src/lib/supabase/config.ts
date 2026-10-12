export type SupabaseConfig = { url: string; key: string }

/**
 * Reads the public Supabase settings. Returns null when they are missing or
 * still contain the placeholder values from `.env.local.example`, so the site
 * can render (empty) instead of crashing before setup is complete.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  // Referenced literally so Next.js can inline them into client bundles.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key || key.startsWith('your-')) return null

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return { url: parsed.origin, key }
  } catch {
    return null
  }
}

/**
 * Auth cookie settings. The session is only ever read on the server (the
 * dashboard uploads files with short-lived signed URLs instead of a browser
 * session), so the cookies can be httpOnly: scripts on the page cannot read
 * the tokens even if one were injected.
 */
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null
}

/** Public URL of an object in the `media` bucket. */
export function mediaPublicUrl(storagePath: string): string | null {
  const config = getSupabaseConfig()
  if (!config) return null
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/')
  return `${config.url}/storage/v1/object/public/media/${encodedPath}`
}

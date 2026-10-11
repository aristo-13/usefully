import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/lib/database.types'
import { getSupabaseConfig } from '@/lib/supabase/config'

/**
 * Supabase client bound to the visitor's auth cookies. Use it for admin pages
 * and Server Actions only; public pages use the cookie-free client in
 * `public.ts` so they can be prerendered and cached.
 */
export async function createClient() {
  const config = getSupabaseConfig()
  if (!config) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes sessions for /admin and /auth requests.
        }
      },
    },
  })
}

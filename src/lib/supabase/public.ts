import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'
import { getSupabaseConfig } from '@/lib/supabase/config'

let publicClient: SupabaseClient<Database> | null | undefined

/**
 * Anonymous, cookie-free client for public reads. Row Level Security limits
 * it to published content, and because it never touches request data it can
 * be used inside `'use cache'` functions.
 */
export function getPublicClient(): SupabaseClient<Database> | null {
  if (publicClient !== undefined) return publicClient

  const config = getSupabaseConfig()
  publicClient = config
    ? createClient<Database>(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null

  return publicClient
}

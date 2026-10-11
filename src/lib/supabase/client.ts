import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/database.types'
import { getSupabaseConfig } from '@/lib/supabase/config'

/** Browser client used by the admin dashboard for direct file uploads. */
export function createClient() {
  const config = getSupabaseConfig()
  if (!config) {
    throw new Error('Supabase is not configured.')
  }
  return createBrowserClient<Database>(config.url, config.key)
}

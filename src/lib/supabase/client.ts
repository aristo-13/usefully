import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'
import { getSupabaseConfig } from '@/lib/supabase/config'

/**
 * Browser client used only to send files to signed upload URLs. It has no
 * session: a Server Action checks the admin role and returns a one-time upload
 * token, so the auth cookies can stay httpOnly.
 */
export function createUploadClient() {
  const config = getSupabaseConfig()
  if (!config) throw new Error('Supabase is not configured.')
  return createClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

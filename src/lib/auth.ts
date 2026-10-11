import 'server-only'

import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { cache } from 'react'

import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

export type AdminUser = {
  id: string
  email: string | null
  displayName: string
  bio: string
}

export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'forbidden'; email: string | null }
  | { status: 'admin'; user: AdminUser }

/**
 * Verifies the session JWT (getClaims) and looks up the admin role in the
 * database. Memoised per request so layouts, pages and actions share one check.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  // Session checks compare token expiry with the current time, so they must
  // run for each request and never during a prerender.
  await connection()
  if (!isSupabaseConfigured()) return { status: 'unconfigured' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return { status: 'signed-out' }

  const email = typeof claims.email === 'string' ? claims.email : null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, bio, role')
    .eq('id', claims.sub)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') return { status: 'forbidden', email }

  return {
    status: 'admin',
    user: { id: profile.id, email, displayName: profile.display_name, bio: profile.bio },
  }
})

/** Use at the top of every admin page and Server Action. */
export async function requireAdmin(): Promise<AdminUser> {
  const state = await getAuthState()
  switch (state.status) {
    case 'admin':
      return state.user
    case 'forbidden':
      redirect('/auth/login?error=forbidden')
    case 'unconfigured':
      redirect('/auth/login?error=unconfigured')
    default:
      redirect('/auth/login')
  }
}

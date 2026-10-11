import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/database.types'
import { getSupabaseConfig } from '@/lib/supabase/config'

/**
 * Refreshes the Supabase session cookie and keeps signed-out visitors out of
 * /admin. Authorization (the admin role) is checked again on every admin page
 * and Server Action, and enforced by RLS in the database.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const config = getSupabaseConfig()
  if (!config) return response

  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
        // Responses that set auth cookies must never be cached by a CDN.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Do not run code between creating the client and this call: it refreshes
  // an expired session and verifies the JWT.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  const { pathname, search } = request.nextUrl
  if (pathname.startsWith('/admin') && !signedIn) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', `${pathname}${search}`)

    const redirect = NextResponse.redirect(loginUrl)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    redirect.headers.set('Cache-Control', 'private, no-store')
    return redirect
  }

  return response
}

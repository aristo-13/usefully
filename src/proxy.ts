import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Only the dashboard and sign-in pages use the auth session. Keeping the
  // proxy off public routes avoids an auth round trip on every page view and
  // lets public pages be served straight from the static cache.
  matcher: ['/admin/:path*', '/auth/:path*'],
}

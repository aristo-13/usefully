import { NextResponse, type NextRequest } from 'next/server'

import { getAuthState } from '@/lib/auth'
import { CONTENT_TYPES, contentTypeConfig } from '@/lib/content/types'
import { createClient } from '@/lib/supabase/server'

// "Edit" on a live page links here with the page's path (/articles/my-post)
// and lands in the editor for that post. Signed-out visitors are sent to the
// sign-in page by the proxy first, and come back here afterwards.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function go(request: NextRequest, pathname: string, search = '') {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = search
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const auth = await getAuthState()
  if (auth.status === 'forbidden') return go(request, '/auth/login', '?error=forbidden')
  if (auth.status !== 'admin') return go(request, '/auth/login')

  const path = request.nextUrl.searchParams.get('path') ?? ''
  const type = CONTENT_TYPES.find((value) => path.startsWith(`${contentTypeConfig[value].path}/`))
  const slug = type ? path.slice(contentTypeConfig[type].path.length + 1) : ''
  if (!type || !SLUG.test(slug)) return go(request, '/admin')

  const supabase = await createClient()
  const { data, error } = await supabase.from('content_items').select('id').eq('type', type).eq('slug', slug).maybeSingle()
  if (error) console.error(`[admin] edit lookup failed: ${error.message}`)
  return go(request, data ? `${contentTypeConfig[type].adminPath}/${data.id}` : contentTypeConfig[type].adminPath)
}

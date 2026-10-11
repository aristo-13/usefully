import { NextResponse, type NextRequest } from 'next/server'

import { isValidSlug } from '@/lib/content/routes'
import { siteConfig } from '@/lib/site'
import { getPublicClient } from '@/lib/supabase/public'

// Outbound links and downloads: /go/<slug>
//   1. an active custom redirect with that slug, otherwise
//   2. a published resource's website or a published download's file/link.
// Each hit increments a click counter inside the database function.

const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
}

function messagePage(title: string, message: string, status: number) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6;color:#2b2a29}a{color:#b3402a}</style>
</head>
<body>
<h1>${title}</h1>
<p>${message}</p>
<p><a href="/">Go to ${escapeHtml(siteConfig.name)}</a></p>
</body>
</html>`
  return new NextResponse(html, {
    status,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

function notFound() {
  return messagePage('Link not found', 'This link does not exist or is no longer available.', 404)
}

function unavailable() {
  return messagePage('Link temporarily unavailable', 'Please try again in a moment.', 503)
}

function redirectTo(url: string) {
  const response = NextResponse.redirect(url, 307)
  Object.entries(PRIVATE_HEADERS).forEach(([key, value]) => response.headers.set(key, value))
  return response
}

export async function GET(_request: NextRequest, { params }: RouteContext<'/go/[slug]'>) {
  const { slug } = await params
  if (!isValidSlug(slug)) return notFound()

  const supabase = getPublicClient()
  if (!supabase) return notFound()

  const { data, error } = await supabase.rpc('resolve_go_link', { link_slug: slug })
  if (error) {
    console.error(`[go] could not resolve "${slug}": ${error.message}`)
    return unavailable()
  }

  const link = data?.[0]
  if (!link) return notFound()

  if (link.link_kind === 'file') {
    // Short-lived URL; storage policies only allow files of published downloads.
    const { data: signed, error: signError } = await supabase.storage
      .from('downloads')
      .createSignedUrl(link.link_target, 60, { download: link.link_file_name || true })
    if (signError || !signed?.signedUrl) {
      console.error(`[go] could not sign download for "${slug}": ${signError?.message ?? 'no URL'}`)
      return unavailable()
    }
    return redirectTo(signed.signedUrl)
  }

  // Destinations are constrained to http(s) in the database; check again here.
  if (!/^https?:\/\//i.test(link.link_target)) return notFound()
  return redirectTo(link.link_target)
}

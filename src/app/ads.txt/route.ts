import { adsTxt, adsense } from '@/lib/ads'

// Authorises Google (and only Google) to sell ads on this site. AdSense checks
// this file; without it, earnings can be limited. Built when the site is built.
export function GET() {
  if (!adsense.client) return new Response('Not found', { status: 404 })
  return new Response(adsTxt(adsense.client), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}

import { setting } from '@/lib/env'
import { isValidIndexNowKey } from '@/lib/search-engines/indexnow'

// IndexNow search engines fetch this file to confirm that pings with this key
// come from the site's owner. The key is public by design.
export function GET() {
  const key = setting(process.env.INDEXNOW_KEY)
  if (!isValidIndexNowKey(key)) return new Response('Not found', { status: 404 })
  return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' } })
}

import { adsense } from '@/lib/ads'

/**
 * Loads AdSense on public pages (Auto ads, and the units in AdSlot). A plain
 * async script: React places it in <head> once, and AdSense does not accept
 * the extra attributes next/script adds. Nothing is rendered without a
 * publisher ID, and the dashboard never loads it.
 */
export function AdSenseScript() {
  if (!adsense.client) return null
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense.client}`}
      crossOrigin="anonymous"
    />
  )
}

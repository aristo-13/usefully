import type { NextConfig } from 'next'

import { adsense } from './src/lib/ads'
import { setting } from './src/lib/env'

const isProduction = process.env.NODE_ENV === 'production'
const servedOverHttps = setting(process.env.NEXT_PUBLIC_SITE_URL)?.startsWith('https://') ?? false
const adsEnabled = adsense.client !== null

function supabaseOrigin(): string | null {
  const url = setting(process.env.NEXT_PUBLIC_SUPABASE_URL)
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

/** Allows next/image to optimise images from the Supabase `media` bucket. */
function supabaseMediaPattern(): URL[] {
  const origin = supabaseOrigin()
  return origin ? [new URL('/storage/v1/object/public/media/**', origin)] : []
}

/**
 * Content Security Policy. Scripts and connections are limited to this site
 * (plus Supabase, which the dashboard uploads to). 'unsafe-inline' is needed
 * for the inline scripts Next.js uses on statically generated pages; nonces
 * would force every page to render per request. Images and video files may
 * come from any HTTPS host because posts can link media from other sites; only
 * the YouTube (privacy-enhanced) and Vimeo players may be embedded. The Supabase
 * origin is listed explicitly for a local (plain http) development database.
 *
 * With AdSense on, scripts, frames and connections may also use any HTTPS host:
 * the ad code loads from many Google hosts, including country domains such as
 * adservice.google.com.gh, that an allowlist cannot cover, and ads render in
 * frames from Google's ad servers. Since inline scripts are already allowed,
 * this adds little exposure.
 */
function contentSecurityPolicy(): string {
  const supabase = supabaseOrigin()
  const ads = adsEnabled ? ' https:' : ''
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${ads}${isProduction ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${supabase ? ` ${supabase}` : ''}`,
    `media-src 'self' blob: https:${supabase ? ` ${supabase}` : ''}`,
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? ` ${supabase}` : ''}${ads}${isProduction ? '' : ' ws:'}`,
    adsEnabled ? 'frame-src https:' : 'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    ...(isProduction && servedOverHttps ? ['upgrade-insecure-requests'] : []),
  ]
  return directives.join('; ')
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Ad clicks open the advertiser's site in a new window; allow-popups keeps them working.
  { key: 'Cross-Origin-Opener-Policy', value: adsEnabled ? 'same-origin-allow-popups' : 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  // Browsers only honour HSTS over HTTPS. Add includeSubDomains/preload once every subdomain serves HTTPS.
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }] : []),
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseMediaPattern(),
  },
  experimental: {
    serverActions: {
      // Long Markdown bodies can approach the 1 MB default.
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig

import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'
const servedOverHttps = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') ?? false

function supabaseOrigin(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null
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
 */
function contentSecurityPolicy(): string {
  const supabase = supabaseOrigin()
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${supabase ? ` ${supabase}` : ''}`,
    `media-src 'self' blob: https:${supabase ? ` ${supabase}` : ''}`,
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? ` ${supabase}` : ''}${isProduction ? '' : ' ws:'}`,
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
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
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
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

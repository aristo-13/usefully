import type { NextConfig } from 'next'

/** Allows next/image to optimise images from the Supabase `media` bucket. */
function supabaseMediaPattern(): URL[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return []
  try {
    return [new URL('/storage/v1/object/public/media/**', url)]
  } catch {
    return []
  }
}

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
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
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

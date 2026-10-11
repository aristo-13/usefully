import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private areas, outbound redirects and internal search results.
        disallow: ['/admin', '/auth', '/go/', '/search'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}

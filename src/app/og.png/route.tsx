import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

import { siteConfig } from '@/lib/site'
import { hostnameOf, truncate } from '@/lib/utils'

// Default social sharing image (pages with a cover image use that instead).
// Served from a route rather than opengraph-image.tsx because file-based
// metadata would override every page's own Open Graph image. It is generated
// once at build time.

function loadWordmark(): string | null {
  try {
    const svg = readFileSync(join(process.cwd(), 'public', 'logo', 'usefully-logo.svg'))
    return `data:image/svg+xml;base64,${svg.toString('base64')}`
  } catch {
    return null
  }
}

const wordmark = loadWordmark()

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px 88px 72px',
          background: '#ffffff',
          color: '#2B2A29',
          borderBottom: '16px solid #E8553D',
        }}
      >
        {wordmark ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser
          <img src={wordmark} width={521} height={140} alt="" />
        ) : (
          <div style={{ display: 'flex', fontSize: 88, fontWeight: 700 }}>{siteConfig.name}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 44, lineHeight: 1.3, maxWidth: 980 }}>
            {truncate(siteConfig.description, 110)}
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 28, color: '#66625E' }}>
            {hostnameOf(siteConfig.url)}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// The logo mark (public/logo/usefully-mark.svg, an 80×80 grid of four rounded
// squares) redrawn as a PNG, because Apple touch icons cannot be SVG.
const SCALE = 180 / 80
const squares = [
  { x: 6, y: 6, color: '#2B2A29', rotate: 0 },
  { x: 44, y: 6, color: '#E8553D', rotate: 14 },
  { x: 6, y: 44, color: '#2B2A29', rotate: 0 },
  { x: 44, y: 44, color: '#2B2A29', rotate: 0 },
]

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#ffffff' }}>
        {squares.map((square) => (
          <div
            key={`${square.x}-${square.y}`}
            style={{
              position: 'absolute',
              left: square.x * SCALE,
              top: square.y * SCALE,
              width: 30 * SCALE,
              height: 30 * SCALE,
              borderRadius: 8 * SCALE,
              background: square.color,
              transform: square.rotate ? `rotate(${square.rotate}deg)` : undefined,
            }}
          />
        ))}
      </div>
    ),
    size,
  )
}

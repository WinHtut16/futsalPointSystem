import { ImageResponse } from 'next/og'

// Link preview for Viber, Facebook and Messenger shares (the channels
// Myanmar visitors actually use). Applies to every park page.
export const alt = 'MyaThida Park: pool, food, futsal, games and billiards'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const TITLE = 'MyaThida Park'
const LINE = 'Pool, poolside food, futsal, games and billiards. Stay the whole day.'

// Young Serif, subset to just the glyphs on the card. Fetched server-side at
// render time; if Google Fonts is unreachable the title falls back to serif.
async function loadTitleFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Young+Serif&text=${encodeURIComponent(TITLE + LINE)}`)
    ).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  const font = await loadTitleFont()
  // Sun on the arc at mid-morning, matching the hero's open-now card.
  const cx = 930
  const cy = 470
  const r = 230
  const a = Math.PI * 0.62
  const sx = cx + r * Math.cos(a)
  const sy = cy - r * Math.sin(a)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0f4d3c',
          color: '#eef6f0',
          position: 'relative',
          fontFamily: font ? 'Young Serif' : 'serif',
        }}
      >
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: 'absolute', inset: 0 }}>
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#2b7a5c"
            strokeWidth="6"
            strokeDasharray="14 18"
          />
          <circle cx={sx} cy={sy} r="72" fill="#ffcb47" opacity="0.16" />
          <circle cx={sx} cy={sy} r="48" fill="#ffcb47" />
          <line x1={cx - r - 40} y1={cy} x2={cx + r + 40} y2={cy} stroke="#eef6f0" strokeWidth="6" strokeLinecap="round" />
          <rect x="0" y={cy + 3} width="1200" height={630 - cy} fill="#2bb3c0" />
          <path d={`M 0 ${cy + 60} Q 150 ${cy + 40} 300 ${cy + 60} T 600 ${cy + 60} T 900 ${cy + 60} T 1200 ${cy + 60}`} fill="none" stroke="#7fd3d9" strokeWidth="6" />
          <path d={`M 0 ${cy + 110} Q 150 ${cy + 90} 300 ${cy + 110} T 600 ${cy + 110} T 900 ${cy + 110} T 1200 ${cy + 110}`} fill="none" stroke="#7fd3d9" strokeWidth="6" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '84px 80px', gap: 24, position: 'relative' }}>
          <div style={{ fontSize: 112, lineHeight: 1, letterSpacing: -2 }}>{TITLE}</div>
          <div style={{ fontSize: 40, color: '#cfe3d8', maxWidth: 620, lineHeight: 1.3 }}>{LINE}</div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: 'Young Serif', data: font, weight: 400, style: 'normal' }] : undefined },
  )
}

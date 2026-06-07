import { ImageResponse } from 'next/og'

export const runtime = 'edge'

/**
 * 512×512 maskable icon.
 * Maskable icons must keep content within the inner 80% safe zone (410×410 px).
 * The outer 10% on each side can be clipped by the OS.
 */
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1A3A4A 0%, #2E7D5B 100%)',
      }}
    >
      {/* Content stays within ~380px centred — well inside the 410px safe zone */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '28px',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: '210px',
            fontWeight: '900',
            lineHeight: '1',
            letterSpacing: '-8px',
            fontFamily: 'sans-serif',
          }}
        >
          TF
        </span>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#60A5FA' }}
          />
          <div
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F4A836' }}
          />
          <div
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#4ADE80' }}
          />
        </div>
      </div>
    </div>,
    { width: 512, height: 512 }
  )
}

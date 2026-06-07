import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Apple touch icon — appears on iOS home screen when added as PWA. */
export default function AppleIcon() {
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: '72px',
            fontWeight: '900',
            lineHeight: '1',
            letterSpacing: '-2px',
            fontFamily: 'sans-serif',
          }}
        >
          TF
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#60A5FA' }}
          />
          <div
            style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#F4A836' }}
          />
          <div
            style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#4ADE80' }}
          />
        </div>
      </div>
    </div>,
    { ...size }
  )
}

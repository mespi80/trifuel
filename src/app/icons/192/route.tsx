import { ImageResponse } from 'next/og'

export const runtime = 'edge'

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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Wordmark */}
        <span
          style={{
            color: 'white',
            fontSize: '78px',
            fontWeight: '900',
            lineHeight: '1',
            letterSpacing: '-3px',
            fontFamily: 'sans-serif',
          }}
        >
          TF
        </span>
        {/* Three discipline dots: swim / bike / run */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#60A5FA' }}
          />
          <div
            style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#F4A836' }}
          />
          <div
            style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#4ADE80' }}
          />
        </div>
      </div>
    </div>,
    { width: 192, height: 192 }
  )
}

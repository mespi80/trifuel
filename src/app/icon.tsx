import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/** Favicon — used in browser tabs and bookmark bars. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1A3A4A 0%, #2E7D5B 100%)',
        borderRadius: '6px',
      }}
    >
      <span
        style={{
          color: 'white',
          fontSize: '16px',
          fontWeight: '900',
          letterSpacing: '-0.5px',
          fontFamily: 'sans-serif',
        }}
      >
        TF
      </span>
    </div>,
    { ...size }
  )
}

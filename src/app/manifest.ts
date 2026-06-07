import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TriFuel',
    short_name: 'TriFuel',
    description: 'AI-powered triathlon training & vegan nutrition for triathletes.',
    start_url: '/en/dashboard',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#1A3A4A',
    theme_color: '#1A3A4A',
    categories: ['health', 'fitness', 'sports'],
    icons: [
      {
        src: '/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'narrow',
      },
    ],
  }
}

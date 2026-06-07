// @ts-check
import createNextIntlPlugin from 'next-intl/plugin'
import withSerwist from '@serwist/next'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {}

const withSerwistConfig = withSerwist({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  // Disable SW in development to avoid confusing cache behaviour
  disable: process.env.NODE_ENV === 'development',
})

export default withSerwistConfig(withNextIntl(nextConfig))

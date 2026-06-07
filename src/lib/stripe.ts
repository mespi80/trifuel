import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia',
  typescript: true,
})

// ── Price IDs (set via env) ────────────────────────────────────────────────────
export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY_ID ?? ''
export const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL_ID ?? ''

// ── Product prices (mirrors env — used for display only) ──────────────────────
export const PRICE_MONTHLY_CENTS = 999 // $9.99
export const PRICE_ANNUAL_CENTS = 7999 // $79.99

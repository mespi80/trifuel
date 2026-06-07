import Stripe from 'stripe'
import { BILLING_ENABLED } from '@/lib/features'

// ── Lazy client — only instantiated when billing is enabled ───────────────────

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!BILLING_ENABLED) throw new Error('Billing is not enabled (ENABLE_BILLING != true)')
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia',
    typescript: true,
  }))
}

// ── Price IDs (set via env) ────────────────────────────────────────────────────
export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY_ID ?? ''
export const STRIPE_PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL_ID ?? ''

// ── Product prices (mirrors env — used for display only) ──────────────────────
export const PRICE_MONTHLY_CENTS = 999 // $9.99
export const PRICE_ANNUAL_CENTS = 7999 // $79.99

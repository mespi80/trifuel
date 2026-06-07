'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { subscriptions, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SubscriptionDetails {
  tier: 'free' | 'premium'
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete'
  periodEnd: Date | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getSubscription(): Promise<SubscriptionDetails | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
  })

  if (!row) {
    return {
      tier: 'free',
      status: 'active',
      periodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    }
  }

  return {
    tier: row.tier,
    status: row.status,
    periodEnd: row.periodEnd,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
  }
}

export async function getSubscriptionTier(): Promise<'free' | 'premium'> {
  const sub = await getSubscription()
  // Treat past_due as still premium (grace period)
  if (
    sub?.tier === 'premium' &&
    (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due')
  ) {
    return 'premium'
  }
  return 'free'
}

// ── Stripe Checkout ────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  priceId: string,
  lang: string
): Promise<{ url: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthenticated' }

  const userId = session.user.id
  const userEmail = session.user.email ?? undefined

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // Get or create Stripe customer
  let stripeCustomerId: string | undefined
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    columns: { stripeCustomerId: true },
  })
  if (existing?.stripeCustomerId) {
    stripeCustomerId = existing.stripeCustomerId
  } else {
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, email: true },
    })
    const customer = await stripe.customers.create({
      email: userEmail ?? userRow?.email ?? undefined,
      name: userRow?.name ?? undefined,
      metadata: { userId },
    })
    stripeCustomerId = customer.id

    // Upsert subscription row with the new customer ID
    await db
      .insert(subscriptions)
      .values({ userId, stripeCustomerId: customer.id })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { stripeCustomerId: customer.id, updatedAt: new Date() },
      })
  }

  const checkout = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/${lang}/dashboard/settings/subscription?upgraded=1`,
    cancel_url: `${baseUrl}/${lang}/pricing`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId },
      trial_period_days: 7,
    },
  })

  if (!checkout.url) return { error: 'Failed to create checkout session' }
  return { url: checkout.url }
}

// ── Stripe Billing Portal ──────────────────────────────────────────────────────

export async function createBillingPortalSession(
  lang: string
): Promise<{ url: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthenticated' }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
    columns: { stripeCustomerId: true },
  })

  if (!sub?.stripeCustomerId) return { error: 'No Stripe customer found' }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${baseUrl}/${lang}/dashboard/settings/subscription`,
  })

  return { url: portal.url }
}

// ── Upsert from webhook (called by webhook route, not directly by users) ───────

export async function upsertSubscriptionFromStripe(
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  tier: 'free' | 'premium',
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete',
  periodEnd: Date | null
): Promise<void> {
  // Find userId by Stripe customer ID
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeCustomerId, stripeCustomerId),
    columns: { userId: true },
  })
  if (!row) return

  await db
    .update(subscriptions)
    .set({
      tier,
      status,
      stripeSubscriptionId,
      periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, row.userId))

  revalidatePath('/[lang]/dashboard', 'layout')
}

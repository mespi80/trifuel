import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { upsertSubscriptionFromStripe } from '@/actions/subscription'

// ── Stripe webhook secret ──────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

// ── Map Stripe status to our DB enum ──────────────────────────────────────────

function mapStatus(
  s: Stripe.Subscription['status']
): 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete' {
  switch (s) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'cancelled'
    default:
      return 'incomplete'
  }
}

/** In API version 2026-03-25.dahlia, period_end moved to the subscription item level */
function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.items.data[0]?.current_period_end
  return ts ? new Date(ts * 1000) : null
}

// ── Webhook handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      // ── Checkout completed ─────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription' || !session.subscription) break

        const sub = await getStripe().subscriptions.retrieve(session.subscription as string)
        await upsertSubscriptionFromStripe(
          sub.id,
          sub.customer as string,
          'premium',
          mapStatus(sub.status),
          getPeriodEnd(sub)
        )
        break
      }

      // ── Subscription updated ────────────────────────────────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const tier: 'free' | 'premium' =
          sub.status === 'active' || sub.status === 'trialing' ? 'premium' : 'free'

        await upsertSubscriptionFromStripe(
          sub.id,
          sub.customer as string,
          tier,
          mapStatus(sub.status),
          getPeriodEnd(sub)
        )
        break
      }

      // ── Subscription cancelled / deleted ────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await upsertSubscriptionFromStripe(
          sub.id,
          sub.customer as string,
          'free',
          'cancelled',
          null
        )
        break
      }

      // ── Invoice payment failed (grace period) ───────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.parent?.subscription_details?.subscription
        if (!subscriptionId) break

        const sub = await getStripe().subscriptions.retrieve(
          typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id
        )
        await upsertSubscriptionFromStripe(
          sub.id,
          sub.customer as string,
          'premium', // keep premium during grace period
          'past_due',
          getPeriodEnd(sub)
        )
        break
      }

      default:
        // Unknown event type — log and ignore
        break
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

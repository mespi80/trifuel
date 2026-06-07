'use client'

import { createContext, useContext } from 'react'
import { canAccess, type Feature } from '@/lib/features'

// ── Context ────────────────────────────────────────────────────────────────────

interface SubscriptionContextValue {
  tier: 'free' | 'premium'
  isPremium: boolean
  canAccess: (feature: Feature) => boolean
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  tier: 'free',
  isPremium: false,
  canAccess: () => false,
})

// ── Provider ───────────────────────────────────────────────────────────────────

interface SubscriptionProviderProps {
  children: React.ReactNode
  tier: 'free' | 'premium'
}

export function SubscriptionProvider({ children, tier }: SubscriptionProviderProps) {
  const value: SubscriptionContextValue = {
    tier,
    isPremium: tier === 'premium',
    canAccess: (feature: Feature) => canAccess(tier, feature),
  }

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext)
}

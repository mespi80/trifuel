/**
 * Feature flag definitions for the freemium gating system.
 *
 * Every string here is a stable key used by canAccess(feature) in the
 * SubscriptionProvider and server-side checks alike.
 */

export const FEATURES = {
  // Training
  ADAPTIVE_REPLANNING: 'adaptive_replanning',
  DRAG_RESCHEDULE: 'drag_reschedule',
  PLAN_PHASE_MAP: 'plan_phase_map',
  AVAILABILITY_EDITOR: 'availability_editor',

  // Wearables
  WEARABLE_AUTO_SYNC: 'wearable_auto_sync',

  // Nutrition
  MICRONUTRIENT_PANEL: 'micronutrient_panel',
  MEAL_TEMPLATES: 'meal_templates',
  SUPPLEMENT_RECS: 'supplement_recs',
  MEAL_SUGGESTIONS: 'meal_suggestions',
  FUELING_GUIDE: 'fueling_guide',

  // Analytics
  PMC_CHART: 'pmc_chart',
  TRAINING_ANALYTICS: 'training_analytics',
  NUTRITION_ANALYTICS: 'nutrition_analytics',
  BODY_COMPOSITION: 'body_composition',
} as const

export type Feature = (typeof FEATURES)[keyof typeof FEATURES]

/** Every feature in this set requires premium. */
const PREMIUM_FEATURES = new Set<Feature>(Object.values(FEATURES))

export function requiresPremium(feature: Feature): boolean {
  return PREMIUM_FEATURES.has(feature)
}

export function canAccess(tier: 'free' | 'premium', feature: Feature): boolean {
  if (tier === 'premium') return true
  return !requiresPremium(feature)
}

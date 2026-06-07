/**
 * Garmin-specific rate limiter.
 *
 * Garmin Health API: 15 requests per 15-minute rolling window per consumer key.
 * We track per-user to distribute the budget fairly across concurrent users.
 *
 * Delegates to the existing generic rateLimit() helper which uses a Redis
 * sorted-set sliding window.
 */

import { rateLimit } from '@/lib/rate-limit'

const GARMIN_LIMIT = 15
const GARMIN_WINDOW = 15 * 60 // 15 minutes in seconds

export class GarminRateLimitError extends Error {
  constructor(
    message: string,
    public readonly resetAt: Date
  ) {
    super(message)
    this.name = 'GarminRateLimitError'
  }
}

/**
 * Check and record one Garmin API request against the rate limit.
 *
 * @param userId  Internal user ID — used to scope the bucket
 * @throws GarminRateLimitError when the limit is exceeded
 */
export async function checkGarminRateLimit(userId: string): Promise<void> {
  const result = await rateLimit(`garmin:api:${userId}`, GARMIN_LIMIT, GARMIN_WINDOW)

  if (!result.success) {
    const resetAt = new Date(result.resetAt)
    throw new GarminRateLimitError(
      `Garmin API rate limit exceeded (${GARMIN_LIMIT} req/${GARMIN_WINDOW / 60} min). ` +
        `Resets at ${resetAt.toISOString()}.`,
      resetAt
    )
  }
}

/**
 * Wraps an async function with Garmin rate limit enforcement.
 * Call this before every outbound Garmin API request.
 */
export async function withGarminRateLimit<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await checkGarminRateLimit(userId)
  return fn()
}

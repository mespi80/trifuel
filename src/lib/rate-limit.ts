import { redis } from './redis'

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number // unix timestamp (ms)
}

/**
 * Sliding-window rate limiter using Redis.
 *
 * @param key       Unique identifier, e.g. `"auth:login:192.168.1.1"`
 * @param limit     Max requests allowed in the window
 * @param windowSec Window size in seconds
 */
export async function rateLimit(key: string, limit = 5, windowSec = 60): Promise<RateLimitResult> {
  const now = Date.now()
  const windowMs = windowSec * 1000
  const windowStart = now - windowMs

  // Use a sorted set: score = timestamp, member = timestamp:random
  const redisKey = `rl:${key}`

  try {
    const pipeline = redis.pipeline()
    // Remove entries outside the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart)
    // Count current entries
    pipeline.zcard(redisKey)
    // Add current request
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`)
    // Reset TTL
    pipeline.pexpire(redisKey, windowMs)
    const results = await pipeline.exec()

    const count = (results?.[1]?.[1] as number) ?? 0
    const remaining = Math.max(0, limit - count - 1)
    const resetAt = now + windowMs

    return { success: count < limit, remaining, resetAt }
  } catch {
    // If Redis is unavailable, allow the request (fail open)
    return { success: true, remaining: limit - 1, resetAt: now + windowMs }
  }
}

/**
 * Convenience helpers for common rate limit scenarios.
 */
export const authRateLimit = {
  /** 5 attempts per minute per IP */
  login: (ip: string) => rateLimit(`auth:login:${ip}`, 5, 60),
  /** 3 signup attempts per 10 minutes per IP */
  signup: (ip: string) => rateLimit(`auth:signup:${ip}`, 3, 600),
  /** 3 password reset requests per 10 minutes per email */
  forgotPassword: (email: string) => rateLimit(`auth:forgot:${email}`, 3, 600),
  /** 10 verify-email attempts per hour per token */
  verifyEmail: (token: string) => rateLimit(`auth:verify:${token}`, 10, 3600),
}

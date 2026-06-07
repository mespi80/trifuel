import Redis from 'ioredis'

declare global {
  var _redis: Redis | undefined
}

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  })

  client.on('error', (err) => {
    // Log error but don't crash — Redis being unavailable should degrade gracefully
    console.error('[Redis] connection error', err.message)
  })

  return client
}

// Singleton to avoid creating multiple connections in dev (hot reload)
export const redis: Redis =
  process.env.NODE_ENV === 'production'
    ? createRedisClient()
    : (globalThis._redis ??= createRedisClient())

import { CacheManager } from "@IRIS/cache"

/**
 * Shared CacheManager instance for @IRIS/elysia.
 * Automatically connects to Redis if available, or seamlessly falls back
 * to an in-memory LRU cache when offline or unconfigured.
 */
export const cache = new CacheManager({
  autoEnv: false,
  redis: process.env.REDIS_URL
    ? { url: process.env.REDIS_URL }
    : {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined,
      },
  defaultTtlSeconds: process.env.CACHE_DEFAULT_TTL
    ? Number(process.env.CACHE_DEFAULT_TTL)
    : 300,
  fallbackToMemory: true,
  logger: true,
})

export type CacheInstance = typeof cache

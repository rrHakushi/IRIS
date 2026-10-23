import { CacheManager } from "@IRIS/cache"

/**
 * Shared CacheManager instance for @IRIS/elysia.
 * Automatically connects to Redis if available, or seamlessly falls back
 * to an in-memory LRU cache when offline or unconfigured.
 */
export const cache = new CacheManager({
  autoEnv: false,
  redis: Bun.env.REDIS_URL
    ? { url: Bun.env.REDIS_URL }
    : {
        host: Bun.env.REDIS_HOST,
        port: Number(Bun.env.REDIS_PORT),
        password: Bun.env.REDIS_PASSWORD,
        db: Number(Bun.env.REDIS_DB),
      },
  defaultTtlSeconds: Bun.env.CACHE_DEFAULT_TTL
    ? Number(Bun.env.CACHE_DEFAULT_TTL)
    : 300,
  fallbackToMemory: true,
  logger: false,
})

export type CacheInstance = typeof cache

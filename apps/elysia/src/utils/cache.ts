import { CacheManager } from "@IRIS/cache"

/**
 * Shared CacheManager instance for @IRIS/elysia.
 * Automatically connects to Redis if available, or seamlessly falls back
 * to an in-memory LRU cache when offline or unconfigured.
 */
const redisHost = Bun.env.REDIS_HOST
const redisPort = Bun.env.REDIS_PORT

if (!redisHost || !redisPort) {
  throw new Error("Missing required Redis environment variable(s): REDIS_HOST and/or REDIS_PORT")
}

export const cache = new CacheManager({
  autoEnv: false,
  redis: {
    host: redisHost,
    port: Number(redisPort),
    password: Bun.env.REDIS_PASSWORD || undefined,
    db: Bun.env.REDIS_DB ? Number(Bun.env.REDIS_DB) : 0,
  },
  defaultTtlSeconds: Bun.env.CACHE_DEFAULT_TTL
    ? Number(Bun.env.CACHE_DEFAULT_TTL)
    : 300,
  fallbackToMemory: true,
  logger: false,
})

export type CacheInstance = typeof cache

import type { CacheOptions, RedisConfig } from '../types.js';
/**
 * Fully resolved and normalized cache options with guaranteed defaults.
 */
export interface ResolvedCacheOptions extends Required<Omit<CacheOptions, 'redis' | 'logger'>> {
    /**
     * Normalized Redis connection configuration.
     */
    redis: RedisConfig;
    /**
     * Custom logger or boolean flag.
     */
    logger: CacheOptions['logger'];
}
/**
 * Resolves Redis and Cache configuration by merging explicitly provided options
 * with environment variables.
 *
 * Reads:
 * - `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_USERNAME`, `REDIS_DB`, `REDIS_TLS`
 * - `CACHE_DEFAULT_TTL`
 * - `CACHE_MEMORY_MAX_ITEMS`
 *
 * @param options - User-provided CacheOptions
 * @returns Fully populated `ResolvedCacheOptions`
 * @throws {MissingEnvError} If required environment variables are absent in autoEnv mode
 *
 * @example
 * ```typescript
 * const config = resolveCacheOptions({ defaultTtlSeconds: 600 });
 * console.log(config.redis.host);
 * ```
 */
export declare function resolveCacheOptions(options?: CacheOptions): ResolvedCacheOptions;

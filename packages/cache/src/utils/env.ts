import { MissingEnvError } from '../errors.js';
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
export function resolveCacheOptions(options: CacheOptions = {}): ResolvedCacheOptions {
  const autoEnv = options.autoEnv ?? true;

  let redisConfig: RedisConfig = {};

  if (typeof options.redis === 'string') {
    redisConfig = { url: options.redis };
  } else if (options.redis) {
    redisConfig = { ...options.redis };
  }

  const hasExplicitTarget = Boolean(redisConfig.url || redisConfig.host);

  if (autoEnv) {
    const envUrl = process.env['REDIS_URL'];
    const envHost = process.env['REDIS_HOST'];
    const envPort = process.env['REDIS_PORT'];
    const envPassword = process.env['REDIS_PASSWORD'];
    const envUsername = process.env['REDIS_USERNAME'];
    const envDb = process.env['REDIS_DB'];
    const envTls = process.env['REDIS_TLS'];

    if (!redisConfig.url && envUrl) {
      redisConfig.url = envUrl;
    }

    if (!redisConfig.url) {
      if (!redisConfig.host && envHost) {
        redisConfig.host = envHost;
      }
      if (!redisConfig.port && envPort) {
        const parsedPort = parseInt(envPort, 10);
        if (Number.isNaN(parsedPort)) {
          throw new MissingEnvError(
            ['REDIS_PORT'],
            `Invalid REDIS_PORT environment variable value: "${envPort}". Expected a number.`,
          );
        }
        redisConfig.port = parsedPort;
      }
      if (!redisConfig.password && envPassword) {
        redisConfig.password = envPassword;
      }
      if (!redisConfig.username && envUsername) {
        redisConfig.username = envUsername;
      }
      if (redisConfig.db === undefined && envDb) {
        const parsedDb = parseInt(envDb, 10);
        if (Number.isNaN(parsedDb)) {
          throw new MissingEnvError(
            ['REDIS_DB'],
            `Invalid REDIS_DB environment variable value: "${envDb}". Expected an integer.`,
          );
        }
        redisConfig.db = parsedDb;
      }
      if (redisConfig.tls === undefined && (envTls === 'true' || envTls === '1')) {
        redisConfig.tls = {};
      }
    }

    // If no explicit target was given and neither REDIS_URL nor REDIS_HOST was found in env
    if (!hasExplicitTarget && !redisConfig.url && !redisConfig.host) {
      throw new MissingEnvError(
        ['REDIS_URL', 'REDIS_HOST'],
        'Neither REDIS_URL nor REDIS_HOST is defined in environment variables, and no explicit redis config was provided.',
      );
    }
  }

  // Fallback defaults if autoEnv is false and explicit host was provided without port
  if (!redisConfig.url && redisConfig.host && !redisConfig.port) {
    redisConfig.port = 6379;
  }

  let defaultTtlSeconds = options.defaultTtlSeconds ?? 300;
  if (options.defaultTtlSeconds === undefined && autoEnv && process.env['CACHE_DEFAULT_TTL']) {
    const parsedTtl = parseInt(process.env['CACHE_DEFAULT_TTL'], 10);
    if (Number.isNaN(parsedTtl)) {
      throw new MissingEnvError(
        ['CACHE_DEFAULT_TTL'],
        `Invalid CACHE_DEFAULT_TTL environment variable value: "${process.env['CACHE_DEFAULT_TTL']}". Expected a number.`,
      );
    }
    defaultTtlSeconds = parsedTtl;
  }

  let maxMemoryItems = options.memory?.maxItems ?? 5000;
  if (options.memory?.maxItems === undefined && autoEnv && process.env['CACHE_MEMORY_MAX_ITEMS']) {
    const parsedMax = parseInt(process.env['CACHE_MEMORY_MAX_ITEMS'], 10);
    if (Number.isNaN(parsedMax)) {
      throw new MissingEnvError(
        ['CACHE_MEMORY_MAX_ITEMS'],
        `Invalid CACHE_MEMORY_MAX_ITEMS environment variable value: "${process.env['CACHE_MEMORY_MAX_ITEMS']}". Expected a number.`,
      );
    }
    maxMemoryItems = parsedMax;
  }

  return {
    redis: redisConfig,
    memory: {
      maxItems: maxMemoryItems,
      defaultTtlSeconds: options.memory?.defaultTtlSeconds ?? defaultTtlSeconds,
      updateAgeOnGet: options.memory?.updateAgeOnGet ?? false,
    },
    defaultTtlSeconds,
    keyPrefix: options.keyPrefix ?? '',
    autoEnv,
    fallbackToMemory: options.fallbackToMemory ?? true,
    logger: options.logger ?? false,
  };
}

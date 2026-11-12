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
 * - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_USERNAME`, `REDIS_DB`, `REDIS_TLS`
 * - `CACHE_DEFAULT_TTL`
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
    const envHost = Bun.env['REDIS_HOST'];
    const envPort = Bun.env['REDIS_PORT'];
    const envPassword = Bun.env['REDIS_PASSWORD'];
    const envUsername = Bun.env['REDIS_USERNAME'];
    const envDb = Bun.env['REDIS_DB'];
    const envTls = Bun.env['REDIS_TLS'];

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

    // If no explicit target was given and REDIS_HOST was not found in env
    if (!hasExplicitTarget && !redisConfig.host) {
      throw new MissingEnvError(
        ['REDIS_HOST'],
        'REDIS_HOST is not defined in environment variables, and no explicit redis config was provided.',
      );
    }
  }

  // Fallback defaults if autoEnv is false and explicit host was provided without port
  if (!redisConfig.url && redisConfig.host && !redisConfig.port) {
    redisConfig.port = 6379;
  }

  let defaultTtlSeconds = options.defaultTtlSeconds ?? 300;
  if (options.defaultTtlSeconds === undefined && autoEnv && Bun.env['CACHE_DEFAULT_TTL']) {
    const parsedTtl = parseInt(Bun.env['CACHE_DEFAULT_TTL'], 10);
    if (Number.isNaN(parsedTtl)) {
      throw new MissingEnvError(
        ['CACHE_DEFAULT_TTL'],
        `Invalid CACHE_DEFAULT_TTL environment variable value: "${Bun.env['CACHE_DEFAULT_TTL']}". Expected a number.`,
      );
    }
    defaultTtlSeconds = parsedTtl;
  }

  const maxMemoryItems = options.memory?.maxItems ?? 5000;

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

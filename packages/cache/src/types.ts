import type { RedisOptions } from 'ioredis';

/**
 * Basic JSON-compatible primitive value (string, number, boolean, or null).
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON-compatible composite value supporting objects, arrays, and primitives.
 */
export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

/**
 * Serializable data type accepted by the cache engine.
 */
export type SerializableValue =
  | JsonValue
  | Date
  | Record<string, JsonValue>
  | Array<JsonValue>
  | object;

/**
 * Permissible data types passed to cache telemetry and logging methods.
 */
export type LoggableValue =
  | string
  | number
  | boolean
  | Error
  | Record<string, string | number | boolean>;

/**
 * Current operational status of the cache manager.
 * - `redis`: Connected to Redis and operating as primary store.
 * - `memory`: Operating in local in-memory fallback mode.
 * - `connecting`: Attempting to establish a connection to Redis.
 * - `error`: Encountered a critical error and fallback is disabled.
 */
export type CacheStatus = 'redis' | 'memory' | 'connecting' | 'error';

/**
 * Configuration options for the Redis connection.
 */
export interface RedisConfig extends Omit<RedisOptions, 'keyPrefix'> {
  /**
   * Redis connection URI (e.g. `redis://:password@localhost:6379/0`).
   */
  url?: string;
  /**
   * Connection timeout in milliseconds before failing or triggering fallback.
   * @default 5000
   */
  connectTimeout?: number;
  /**
   * Maximum reconnect attempts before remaining in fallback state.
   * @default 10
   */
  maxRetries?: number;
}

/**
 * Configuration options for the in-memory LRU cache fallback.
 */
export interface MemoryConfig {
  /**
   * Maximum number of items to keep in memory before LRU eviction.
   * @default 5000
   */
  maxItems?: number;
  /**
   * Default time-to-live for memory cache items (in seconds).
   * @default 300
   */
  defaultTtlSeconds?: number;
  /**
   * If true, retrieving an item updates its age and extends its lifetime.
   * @default false
   */
  updateAgeOnGet?: boolean;
}

/**
 * Logger interface for cache telemetry and event diagnostics.
 */
export interface ICacheLogger {
  /**
   * Output fine-grained debug details.
   * @param message - Diagnostic message
   * @param args - Additional contextual metadata
   */
  debug?(message: string, ...args: LoggableValue[]): void;
  /**
   * Output informational lifecycle updates.
   * @param message - Informational message
   * @param args - Additional contextual metadata
   */
  info?(message: string, ...args: LoggableValue[]): void;
  /**
   * Output warning diagnostics (such as failover events).
   * @param message - Warning message
   * @param args - Additional contextual metadata
   */
  warn?(message: string, ...args: LoggableValue[]): void;
  /**
   * Output error diagnostics.
   * @param message - Error message
   * @param args - Additional contextual metadata
   */
  error?(message: string, ...args: LoggableValue[]): void;
}

/**
 * Main configuration options for CacheManager.
 */
export interface CacheOptions {
  /**
   * Redis configuration object or Redis connection URL string.
   */
  redis?: RedisConfig | string;
  /**
   * In-memory LRU cache configuration.
   */
  memory?: MemoryConfig;
  /**
   * Default TTL in seconds for cached values if not specified per method call.
   * Set to 0 or undefined for indefinite caching.
   * @default 300
   */
  defaultTtlSeconds?: number;
  /**
   * Global key prefix/namespace (e.g. `iris:cache:`).
   * @default ''
   */
  keyPrefix?: string;
  /**
   * Whether to automatically read missing Redis options from environment variables
   * (e.g., REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB).
   * @default true
   */
  autoEnv?: boolean;
  /**
   * Whether to automatically fall back to local in-memory LRU cache on Redis outage/error.
   * @default true
   */
  fallbackToMemory?: boolean;
  /**
   * Custom logger implementation or boolean flag (true uses standard console logging).
   * @default false
   */
  logger?: ICacheLogger | boolean;
}

/**
 * Low-level cache store interface implemented by RedisStore and MemoryStore.
 */
export interface ICacheStore {
  /**
   * The identifier name of the store ('redis' or 'memory').
   */
  readonly name: 'redis' | 'memory';

  /**
   * Retrieve a typed value from the store by key.
   * @template T - The expected return type
   * @param key - Cache key
   * @returns The cached value, or null if missing/expired
   */
  get<T = SerializableValue>(key: string): Promise<T | null>;

  /**
   * Store a typed value with an optional TTL in seconds.
   * @template T - The type of value being stored
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time-to-live in seconds
   */
  set<T = SerializableValue>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete one or more keys from the store.
   * @param key - Single key or array of keys to delete
   * @returns Number of deleted keys
   */
  del(key: string | string[]): Promise<number>;

  /**
   * Check if a key exists in the store.
   * @param key - Cache key
   * @returns True if the key exists, false otherwise
   */
  has(key: string): Promise<boolean>;

  /**
   * Retrieve multiple values in a single batch operation.
   * @template T - The expected return type
   * @param keys - Array of cache keys
   * @returns Array containing cached values or nulls in corresponding order
   */
  mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Store multiple key-value entries in a single batch operation.
   * @template T - The type of values being stored
   * @param entries - Array of entries containing key, value, and optional TTL
   */
  mset<T = SerializableValue>(
    entries: Array<{ key: string; value: T; ttlSeconds?: number }>,
  ): Promise<void>;

  /**
   * Clear keys matching an optional pattern.
   * @param pattern - Glob-style wildcard pattern (e.g. `user:*`)
   */
  clear(pattern?: string): Promise<void>;

  /**
   * Ping the store to verify connectivity and readiness.
   * @returns True if the store is reachable and healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Close connections and clean up resources.
   */
  close(): Promise<void>;
}

/**
 * Event map for CacheManager lifecycle and state transition notifications.
 */
export interface CacheEvents {
  /**
   * Emitted when Redis encounters a failure and the manager activates in-memory fallback.
   * @param error - The root cause error that initiated the fallback
   */
  fallback: (error: Error) => void;

  /**
   * Emitted when Redis connection recovers after having fallen back to memory.
   */
  reconnect: () => void;

  /**
   * Emitted when Redis is connected and ready to accept commands.
   */
  ready: () => void;

  /**
   * Emitted when a connection or command error occurs.
   * @param error - The error encountered
   */
  error: (error: Error) => void;

  /**
   * Emitted when the cache manager has closed all connections and shut down.
   */
  close: () => void;
}

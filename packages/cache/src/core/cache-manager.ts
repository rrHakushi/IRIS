import { EventEmitter } from 'node:events';
import type { Redis as RedisClient } from 'ioredis';
import { CacheError, RedisConnectionError } from '../errors.js';
import type {
  CacheEvents,
  CacheOptions,
  CacheStatus,
  ICacheLogger,
  ICacheStore,
  SerializableValue,
} from '../types.js';
import { resolveCacheOptions } from '../utils/env.js';
import { MemoryStore } from './memory-store.js';
import { RedisStore } from './redis-store.js';
import { defaultSerializer, type ISerializer } from './serializer.js';

/**
 * Interface merging for strictly typed EventEmitter on CacheManager.
 */
export interface CacheManager {
  /**
   * Registers a listener for cache lifecycle events.
   * @param event - Lifecycle event name
   * @param listener - Event callback function
   */
  on<U extends keyof CacheEvents>(event: U, listener: CacheEvents[U]): this;

  /**
   * Emits a typed cache lifecycle event.
   * @param event - Lifecycle event name
   * @param args - Event parameters
   */
  emit<U extends keyof CacheEvents>(
    event: U,
    ...args: Parameters<CacheEvents[U]>
  ): boolean;
}

/**
 * Main cache orchestrator managing Redis connectivity with automatic in-memory fallback,
 * cache stampede (thundering herd) protection, namespaces, and lifecycle event telemetry.
 *
 * @example
 * ```typescript
 * const cache = new CacheManager({
 *   redis: { host: 'localhost', port: 6379 },
 *   defaultTtlSeconds: 300,
 *   fallbackToMemory: true,
 * });
 *
 * // Standard operations
 * await cache.set('key', { message: 'hello' });
 * const val = await cache.get<{ message: string }>('key');
 *
 * // Stampede-protected get-or-set
 * const user = await cache.getOrSet('user:1', async () => fetchUser(1), 600);
 * ```
 */
export class CacheManager extends EventEmitter {
  /**
   * Normalized cache options.
   */
  private readonly options: ReturnType<typeof resolveCacheOptions>;

  /**
   * Redis store instance.
   */
  private readonly redisStore?: RedisStore;

  /**
   * Memory store fallback instance.
   */
  private readonly memoryStore: MemoryStore;

  /**
   * Serializer instance.
   */
  private readonly serializer: ISerializer;

  /**
   * Optional logger instance.
   */
  private readonly logger?: ICacheLogger;

  /**
   * Current operating status of the cache.
   */
  private _status: CacheStatus = 'connecting';

  /**
   * Map of currently in-flight factory promises for getOrSet stampede coalescing.
   */
  private readonly inFlightPromises = new Map<string, Promise<SerializableValue>>();

  /**
   * Closed flag.
   */
  private isClosed = false;

  /**
   * Constructs a new CacheManager.
   * @param options - Cache configuration options
   * @param serializer - Value serializer
   * @param sharedStores - Internal parameter for child namespaces to reuse parent stores
   */
  constructor(
    options: CacheOptions = {},
    serializer: ISerializer = defaultSerializer,
    sharedStores?: { memoryStore: MemoryStore; redisStore?: RedisStore; status: CacheStatus },
  ) {
    super();
    this.options = resolveCacheOptions(options);
    this.serializer = serializer;

    if (this.options.logger === true || (this.options.logger === undefined && process.env['NODE_ENV'] !== 'production')) {
      this.logger = {
        debug: (msg, ...args) => console.log('\x1b[36m[IRIS:Cache]\x1b[0m', msg, ...args),
        info: (msg, ...args) => console.log('\x1b[32m[IRIS:Cache]\x1b[0m', msg, ...args),
        warn: (msg, ...args) => console.warn('\x1b[33m[IRIS:Cache]\x1b[0m', msg, ...args),
        error: (msg, ...args) => console.error('\x1b[31m[IRIS:Cache]\x1b[0m', msg, ...args),
      };
    } else if (this.options.logger) {
      this.logger = this.options.logger;
    }

    if (sharedStores) {
      this.memoryStore = sharedStores.memoryStore;
      this.redisStore = sharedStores.redisStore;
      this._status = sharedStores.status;
      return;
    }

    this.memoryStore = new MemoryStore(this.options.memory);

    // Initialize Redis store
    if (this.options.redis?.url || this.options.redis?.host) {
      this.redisStore = new RedisStore(
        this.options.redis,
        {
          onReady: () => this.handleRedisReady(),
          onError: (err) => this.handleRedisError(err),
          onClose: () => this.handleRedisClose(),
          onReconnect: () => this.handleRedisReconnect(),
        },
        this.serializer,
      );

      // Initial connection attempt
      this.redisStore.connect().catch((err: Error) => {
        this.handleRedisError(err);
      });
    } else {
      this._status = 'memory';
      this.logger?.info?.('\x1b[32m[INIT]\x1b[0m Operating on in-memory LRU cache (Redis unconfigured).');
    }
  }

  /**
   * Current operational status of the cache manager ('redis' | 'memory' | 'connecting' | 'error').
   */
  public get status(): CacheStatus {
    if (this.redisStore && this.redisStore.ready) {
      return 'redis';
    }
    return this._status;
  }

  /**
   * Global key prefix applied to all cache keys.
   */
  public get keyPrefix(): string {
    return this.options.keyPrefix;
  }

  /**
   * Default time-to-live in seconds.
   */
  public get defaultTtlSeconds(): number {
    return this.options.defaultTtlSeconds;
  }

  /**
   * Access to the raw underlying `ioredis` Redis instance (or null if unconfigured).
   */
  public get redis(): RedisClient | null {
    return this.redisStore ? this.redisStore.rawClient : null;
  }

  /**
   * Access to the underlying local memory store.
   */
  public get memory(): MemoryStore {
    return this.memoryStore;
  }

  /**
   * Name of the currently active store ('redis' or 'memory').
   */
  public get activeStoreName(): 'redis' | 'memory' {
    return this.redisStore && this.redisStore.ready ? 'redis' : 'memory';
  }

  /**
   * Returns the active store instance based on current connection state.
   */
  private get activeStore(): ICacheStore {
    if (this.redisStore && this.redisStore.ready) {
      return this.redisStore;
    }
    return this.memoryStore;
  }

  /**
   * Handles Redis ready event and triggers reconnection telemetry.
   */
  private handleRedisReady(): void {
    if (this.isClosed) return;
    const previousStatus = this._status;
    this._status = 'redis';
    const target = this.options.redis.url || `${this.options.redis.host || '127.0.0.1'}:${this.options.redis.port || 6379}`;
    this.logger?.info?.(`\x1b[32m[CONNECTED]\x1b[0m Redis cache connected and ready (${target})`);

    if (previousStatus === 'memory' || previousStatus === 'error') {
      this.emit('reconnect');
    }
    this.emit('ready');
  }

  /**
   * Handles Redis reconnecting event.
   */
  private handleRedisReconnect(): void {
    if (this.isClosed) return;
    this._status = 'connecting';
    this.logger?.warn?.('\x1b[33m[RECONNECTING]\x1b[0m Redis reconnecting...');
  }

  /**
   * Handles Redis error event and seamlessly falls back to memory.
   * @param err - Redis error
   */
  private handleRedisError(err: Error): void {
    if (this.isClosed) return;
    if (this.listenerCount('error') > 0) {
      this.emit('error', err);
    }

    if (this.options.fallbackToMemory) {
      if (this._status !== 'memory') {
        this._status = 'memory';
        this.logger?.warn?.(`\x1b[33m[FALLBACK]\x1b[0m Redis unavailable (${err.message}). Switched to local in-memory LRU cache.`);
        this.emit('fallback', err);
      }
    } else {
      this._status = 'error';
      this.logger?.error?.(`\x1b[31m[ERROR]\x1b[0m Redis connection error:`, err);
    }
  }

  /**
   * Handles Redis connection close event.
   */
  private handleRedisClose(): void {
    if (this.isClosed) return;
    if (this.options.fallbackToMemory && this._status !== 'memory') {
      this._status = 'memory';
      this.logger?.warn?.('\x1b[33m[FALLBACK]\x1b[0m Redis closed. Switched to local in-memory LRU cache.');
      this.emit('fallback', new CacheError('Redis connection closed'));
    }
  }

  /**
   * Prepends the global key prefix to the given key.
   * @param key - Raw key
   * @returns Fully prefixed key
   */
  private prefixKey(key: string): string {
    return this.options.keyPrefix ? `${this.options.keyPrefix}${key}` : key;
  }

  /**
   * Executes a cache operation on the active store, automatically falling back
   * to memory if Redis fails during the operation.
   * @template T - Result type
   * @param operation - Store operation function
   * @returns Operation result
   */
  private async executeWithFallback<T>(
    operation: (store: ICacheStore) => Promise<T>,
  ): Promise<T> {
    if (this._status === 'error') {
      throw new RedisConnectionError('Redis is disconnected and in-memory fallback is disabled');
    }

    const store = this.activeStore;
    try {
      return await operation(store);
    } catch (err) {
      if (store.name === 'redis' && this.options.fallbackToMemory) {
        const handledError = err instanceof Error ? err : new CacheError(String(err));
        this.handleRedisError(handledError);
        return await operation(this.memoryStore);
      }
      throw err;
    }
  }

  /**
   * Retrieves a typed value from the cache.
   *
   * @template T - Expected return type
   * @param key - Cache key
   * @returns The cached value or null if absent or expired
   *
   * @example
   * ```typescript
   * const user = await cache.get<UserDto>('user:123');
   * ```
   */
  public async get<T = SerializableValue>(key: string): Promise<T | null> {
    const fullKey = this.prefixKey(key);
    const result = await this.executeWithFallback((store) => store.get<T>(fullKey));
    if (this.logger) {
      if (result !== null && result !== undefined) {
        this.logger.debug?.(`\x1b[32m[GET:HIT]\x1b[0m key="${fullKey}" (store=${this.activeStoreName})`);
      } else {
        this.logger.debug?.(`\x1b[33m[GET:MISS]\x1b[0m key="${fullKey}" (store=${this.activeStoreName})`);
      }
    }
    return result;
  }

  /**
   * Stores a value in the cache with an optional TTL.
   *
   * @template T - Value type
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time-to-live in seconds (defaults to defaultTtlSeconds)
   *
   * @example
   * ```typescript
   * await cache.set('session:token', { userId: '123' }, 3600);
   * ```
   */
  public async set<T = SerializableValue>(
    key: string,
    value: T,
    ttlSeconds: number = this.options.defaultTtlSeconds,
  ): Promise<void> {
    const fullKey = this.prefixKey(key);
    await this.executeWithFallback((store) => store.set<T>(fullKey, value, ttlSeconds));
    if (this.logger) {
      this.logger.debug?.(`\x1b[35m[SET]\x1b[0m key="${fullKey}" ttl=${ttlSeconds}s (store=${this.activeStoreName})`);
    }
  }

  /**
   * Deletes one or more keys from the cache.
   *
   * @param key - Key or array of keys to delete
   * @returns Number of keys removed
   *
   * @example
   * ```typescript
   * await cache.del('user:123');
   * await cache.del(['user:1', 'user:2']);
   * ```
   */
  public async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key)
      ? key.map((k) => this.prefixKey(k))
      : this.prefixKey(key);
    const count = await this.executeWithFallback((store) => store.del(keys));
    if (this.logger) {
      const keysStr = Array.isArray(keys) ? keys.join(', ') : keys;
      this.logger.debug?.(`\x1b[31m[DEL]\x1b[0m key="${keysStr}" deleted=${count} (store=${this.activeStoreName})`);
    }
    return count;
  }

  /**
   * Checks if a key exists in the cache.
   *
   * @param key - Cache key
   * @returns True if key exists and has not expired
   *
   * @example
   * ```typescript
   * if (await cache.has('lock:payment')) { ... }
   * ```
   */
  public async has(key: string): Promise<boolean> {
    const fullKey = this.prefixKey(key);
    return this.executeWithFallback((store) => store.has(fullKey));
  }

  /**
   * Atomic get-or-set with cache stampede (thundering herd) protection.
   * If multiple callers request the same missing key simultaneously, the factory is
   * only executed once and all callers share the resolved result.
   *
   * @template T - Value type
   * @param key - Cache key
   * @param factory - Async computation function returning the fresh value
   * @param ttlSeconds - Time-to-live in seconds
   * @returns The existing or freshly generated value
   *
   * @example
   * ```typescript
   * const product = await cache.getOrSet('product:42', async () => {
   *   return db.product.findUnique({ where: { id: 42 } });
   * }, 600);
   * ```
   */
  public async getOrSet<T = SerializableValue>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = this.options.defaultTtlSeconds,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fullKey = this.prefixKey(key);
    if (this.logger) {
      this.logger.debug?.(`\x1b[34m[GET_OR_SET:FETCHING]\x1b[0m key="${fullKey}" executing factory query... (store=${this.activeStoreName})`);
    }

    const existingInFlight = this.inFlightPromises.get(fullKey);
    if (existingInFlight) {
      return (await existingInFlight) as T;
    }

    const promise = (async (): Promise<SerializableValue> => {
      try {
        const freshValue = await factory();
        if (freshValue !== undefined && freshValue !== null) {
          await this.set<T>(key, freshValue, ttlSeconds);
        }
        return freshValue as SerializableValue;
      } finally {
        this.inFlightPromises.delete(fullKey);
      }
    })();

    this.inFlightPromises.set(fullKey, promise);
    return (await promise) as T;
  }

  /**
   * Batch retrieves multiple keys in a single operation.
   *
   * @template T - Expected value type
   * @param keys - Array of keys
   * @returns Array of retrieved values or nulls
   *
   * @example
   * ```typescript
   * const [user1, user2] = await cache.mget<UserDto>(['user:1', 'user:2']);
   * ```
   */
  public async mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const fullKeys = keys.map((k) => this.prefixKey(k));
    return this.executeWithFallback((store) => store.mget<T>(fullKeys));
  }

  /**
   * Batch stores multiple key-value entries in a single operation.
   *
   * @template T - Value type
   * @param entries - Array of entries containing key, value, and optional TTL
   *
   * @example
   * ```typescript
   * await cache.mset([
   *   { key: 'conf:a', value: '1' },
   *   { key: 'conf:b', value: '2', ttlSeconds: 60 },
   * ]);
   * ```
   */
  public async mset<T = SerializableValue>(
    entries: Array<{ key: string; value: T; ttlSeconds?: number }>,
  ): Promise<void> {
    if (entries.length === 0) return;
    const fullEntries = entries.map((entry) => ({
      ...entry,
      key: this.prefixKey(entry.key),
      ttlSeconds: entry.ttlSeconds ?? this.options.defaultTtlSeconds,
    }));
    return this.executeWithFallback((store) => store.mset<T>(fullEntries));
  }

  /**
   * Clears keys matching an optional pattern.
   *
   * @param pattern - Glob-style wildcard pattern (e.g. `users:*`)
   *
   * @example
   * ```typescript
   * await cache.clear('session:*');
   * ```
   */
  public async clear(pattern?: string): Promise<void> {
    const fullPattern = pattern
      ? this.prefixKey(pattern)
      : this.options.keyPrefix
        ? `${this.options.keyPrefix}*`
        : '*';
    await this.executeWithFallback((store) => store.clear(fullPattern));
    if (this.logger) {
      this.logger.debug?.(`\x1b[31m[CLEAR]\x1b[0m pattern="${fullPattern}" (store=${this.activeStoreName})`);
    }
  }

  /**
   * Creates an isolated namespaced child cache manager sharing the same connection and memory stores.
   *
   * @param namespace - Sub-namespace prefix (e.g. `users`)
   * @returns Child CacheManager automatically prefixing keys with `${namespace}:`
   *
   * @example
   * ```typescript
   * const userCache = cache.withNamespace('users');
   * await userCache.set('1', { name: 'Alice' }); // Stored as "users:1"
   * ```
   */
  public withNamespace(namespace: string): CacheManager {
    const combinedPrefix = `${this.options.keyPrefix}${namespace}:`;
    return new CacheManager(
      {
        ...this.options,
        keyPrefix: combinedPrefix,
        logger: this.options.logger,
      },
      this.serializer,
      {
        memoryStore: this.memoryStore,
        redisStore: this.redisStore,
        status: this._status,
      },
    );
  }

  /**
   * Checks if the active store is reachable and healthy.
   *
   * @returns True if healthy, false otherwise
   */
  public async isHealthy(): Promise<boolean> {
    return this.executeWithFallback((store) => store.isHealthy());
  }

  /**
   * Gracefully closes connections, clears in-flight state, and releases resources.
   */
  public async close(): Promise<void> {
    this.isClosed = true;
    this.inFlightPromises.clear();
    await Promise.all([
      this.redisStore?.close(),
      this.memoryStore.close(),
    ]);
    this.emit('close');
  }
}

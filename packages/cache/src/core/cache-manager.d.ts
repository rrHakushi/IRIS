import { EventEmitter } from 'node:events';
import type { Redis as RedisClient } from 'ioredis';
import type { CacheEvents, CacheOptions, CacheStatus, SerializableValue } from '../types.js';
import { MemoryStore } from './memory-store.js';
import { RedisStore } from './redis-store.js';
import { type ISerializer } from './serializer.js';
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
    emit<U extends keyof CacheEvents>(event: U, ...args: Parameters<CacheEvents[U]>): boolean;
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
export declare class CacheManager extends EventEmitter {
    /**
     * Normalized cache options.
     */
    private readonly options;
    /**
     * Redis store instance.
     */
    private readonly redisStore?;
    /**
     * Memory store fallback instance.
     */
    private readonly memoryStore;
    /**
     * Serializer instance.
     */
    private readonly serializer;
    /**
     * Optional logger instance.
     */
    private readonly logger?;
    /**
     * Current operating status of the cache.
     */
    private _status;
    /**
     * Map of currently in-flight factory promises for getOrSet stampede coalescing.
     */
    private readonly inFlightPromises;
    /**
     * Closed flag.
     */
    private isClosed;
    /**
     * Constructs a new CacheManager.
     * @param options - Cache configuration options
     * @param serializer - Value serializer
     * @param sharedStores - Internal parameter for child namespaces to reuse parent stores
     */
    constructor(options?: CacheOptions, serializer?: ISerializer, sharedStores?: {
        memoryStore: MemoryStore;
        redisStore?: RedisStore;
        status: CacheStatus;
    });
    /**
     * Current operational status of the cache manager ('redis' | 'memory' | 'connecting' | 'error').
     */
    get status(): CacheStatus;
    /**
     * Global key prefix applied to all cache keys.
     */
    get keyPrefix(): string;
    /**
     * Default time-to-live in seconds.
     */
    get defaultTtlSeconds(): number;
    /**
     * Access to the raw underlying `ioredis` Redis instance (or null if unconfigured).
     */
    get redis(): RedisClient | null;
    /**
     * Access to the underlying local memory store.
     */
    get memory(): MemoryStore;
    /**
     * Name of the currently active store ('redis' or 'memory').
     */
    get activeStoreName(): 'redis' | 'memory';
    /**
     * Returns the active store instance based on current connection state.
     */
    private get activeStore();
    /**
     * Handles Redis ready event and triggers reconnection telemetry.
     */
    private handleRedisReady;
    /**
     * Handles Redis reconnecting event.
     */
    private handleRedisReconnect;
    /**
     * Handles Redis error event and seamlessly falls back to memory.
     * @param err - Redis error
     */
    private handleRedisError;
    /**
     * Handles Redis connection close event.
     */
    private handleRedisClose;
    /**
     * Prepends the global key prefix to the given key.
     * @param key - Raw key
     * @returns Fully prefixed key
     */
    private prefixKey;
    private executeWithFallback;
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
    get<T = SerializableValue>(key: string): Promise<T | null>;
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
    set<T = SerializableValue>(key: string, value: T, ttlSeconds?: number): Promise<void>;
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
    del(key: string | string[]): Promise<number>;
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
    has(key: string): Promise<boolean>;
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
    getOrSet<T = SerializableValue>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>;
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
    mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]>;
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
    mset<T = SerializableValue>(entries: Array<{
        key: string;
        value: T;
        ttlSeconds?: number;
    }>): Promise<void>;
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
    clear(pattern?: string): Promise<void>;
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
    withNamespace(namespace: string): CacheManager;
    /**
     * Checks if the active store is reachable and healthy.
     *
     * @returns True if healthy, false otherwise
     */
    isHealthy(): Promise<boolean>;
    /**
     * Gracefully closes connections, clears in-flight state, and releases resources.
     */
    close(): Promise<void>;
}

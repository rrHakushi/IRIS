import type { ICacheStore, MemoryConfig, SerializableValue } from '../types.js';
/**
 * Local in-memory bounded cache store utilizing `lru-cache` with TTL and LRU eviction.
 * Used as the automatic failover layer when Redis is offline.
 *
 * @example
 * ```typescript
 * const store = new MemoryStore({ maxItems: 1000, defaultTtlSeconds: 300 });
 * await store.set('key', { name: 'Iris' });
 * const item = await store.get('key');
 * ```
 */
export declare class MemoryStore implements ICacheStore {
    /**
     * Name identifier for the store.
     */
    readonly name: 'memory';
    /**
     * Internal LRUCache instance.
     */
    private readonly cache;
    /**
     * Default time-to-live in milliseconds.
     */
    private readonly defaultTtlMs;
    /**
     * Constructs a new MemoryStore.
     * @param config - Memory cache configuration options
     */
    constructor(config?: MemoryConfig);
    /**
     * Retrieves a typed value from the memory cache.
     * @template T - Expected output type
     * @param key - Cache key
     * @returns Stored value or null if not found or expired
     */
    get<T = SerializableValue>(key: string): Promise<T | null>;
    /**
     * Stores a typed value in memory with an optional TTL.
     * @template T - Value type
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttlSeconds - Optional custom TTL in seconds
     */
    set<T = SerializableValue>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    /**
     * Deletes one or more keys from the memory cache.
     * @param key - Key or array of keys to delete
     * @returns Total number of entries removed
     */
    del(key: string | string[]): Promise<number>;
    /**
     * Checks if a key exists and has not expired in memory.
     * @param key - Cache key
     * @returns True if key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Batch retrieves multiple keys from memory.
     * @template T - Expected output type
     * @param keys - Array of cache keys
     * @returns Array of cached values or nulls
     */
    mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]>;
    /**
     * Batch sets multiple key-value entries in memory.
     * @template T - Value type
     * @param entries - Array of entries containing key, value, and optional TTL
     */
    mset<T = SerializableValue>(entries: Array<{
        key: string;
        value: T;
        ttlSeconds?: number;
    }>): Promise<void>;
    /**
     * Clears memory cache entries.
     * If a glob pattern (e.g. `user:*`) is provided, only matching keys are removed.
     * @param pattern - Optional wildcard pattern
     */
    clear(pattern?: string): Promise<void>;
    /**
     * Verifies health status of the in-memory store (always true).
     * @returns Always resolves to true
     */
    isHealthy(): Promise<boolean>;
    /**
     * Closes the memory store and frees all stored memory.
     */
    close(): Promise<void>;
    /**
     * Current number of entries in memory cache.
     */
    get size(): number;
}

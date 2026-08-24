import { type OnModuleDestroy } from '@nestjs/common';
import { CacheManager } from '../core/cache-manager.js';
import type { CacheStatus, SerializableValue } from '../types.js';
/**
 * NestJS Injectable service wrapping the `CacheManager` with lifecycle hooks.
 * Implements `OnModuleDestroy` to ensure Redis and memory connections close cleanly on shutdown.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly cache: CacheService) {}
 *
 *   async getUser(id: string): Promise<UserDto> {
 *     return this.cache.getOrSet(`user:${id}`, () => this.db.find(id));
 *   }
 * }
 * ```
 */
export declare class CacheService implements OnModuleDestroy {
    readonly manager: CacheManager;
    /**
     * Constructs a new CacheService.
     * @param manager - Injected CacheManager instance
     */
    constructor(manager: CacheManager);
    /**
     * Operational connection status of the cache ('redis' | 'memory' | 'connecting' | 'error').
     */
    get status(): CacheStatus;
    /**
     * Name of the currently active store ('redis' or 'memory').
     */
    get activeStoreName(): 'redis' | 'memory';
    /**
     * Retrieves a typed value from the cache.
     * @template T - Return type
     * @param key - Cache key
     * @returns Value or null if missing
     */
    get<T = SerializableValue>(key: string): Promise<T | null>;
    /**
     * Stores a typed value in the cache with an optional TTL.
     * @template T - Value type
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttlSeconds - Time-to-live in seconds
     */
    set<T = SerializableValue>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    /**
     * Deletes one or more keys from the cache.
     * @param key - Key or array of keys
     * @returns Total count of removed keys
     */
    del(key: string | string[]): Promise<number>;
    /**
     * Checks if a key exists in the cache.
     * @param key - Cache key
     * @returns True if exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Atomic get-or-set with cache stampede (thundering herd) protection.
     * @template T - Value type
     * @param key - Cache key
     * @param factory - Async computation function
     * @param ttlSeconds - Time-to-live in seconds
     * @returns Cached or newly computed value
     */
    getOrSet<T = SerializableValue>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>;
    /**
     * Batch retrieves multiple keys.
     * @template T - Value type
     * @param keys - Array of keys
     * @returns Array of retrieved values or nulls
     */
    mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]>;
    /**
     * Batch stores multiple entries.
     * @template T - Value type
     * @param entries - Array of entries
     */
    mset<T = SerializableValue>(entries: Array<{
        key: string;
        value: T;
        ttlSeconds?: number;
    }>): Promise<void>;
    /**
     * Clears keys matching an optional pattern.
     * @param pattern - Wildcard pattern (e.g. `users:*`)
     */
    clear(pattern?: string): Promise<void>;
    /**
     * Creates an isolated namespaced child cache manager sharing the same connection.
     * @param namespace - Namespace string
     * @returns Child CacheManager
     */
    withNamespace(namespace: string): CacheManager;
    /**
     * Pings the active store to verify health.
     * @returns True if healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * NestJS lifecycle hook called when application shuts down.
     */
    onModuleDestroy(): Promise<void>;
}

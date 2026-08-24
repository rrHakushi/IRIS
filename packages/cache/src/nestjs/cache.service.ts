import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { CacheManager } from '../core/cache-manager.js';
import type { CacheStatus, SerializableValue } from '../types.js';
import { CACHE_MANAGER } from './cache.constants.js';

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
@Injectable()
export class CacheService implements OnModuleDestroy {
  /**
   * Constructs a new CacheService.
   * @param manager - Injected CacheManager instance
   */
  constructor(
    @Inject(CACHE_MANAGER)
    public readonly manager: CacheManager,
  ) {}

  /**
   * Operational connection status of the cache ('redis' | 'memory' | 'connecting' | 'error').
   */
  public get status(): CacheStatus {
    return this.manager.status;
  }

  /**
   * Name of the currently active store ('redis' or 'memory').
   */
  public get activeStoreName(): 'redis' | 'memory' {
    return this.manager.activeStoreName;
  }

  /**
   * Retrieves a typed value from the cache.
   * @template T - Return type
   * @param key - Cache key
   * @returns Value or null if missing
   */
  public async get<T = SerializableValue>(key: string): Promise<T | null> {
    return this.manager.get<T>(key);
  }

  /**
   * Stores a typed value in the cache with an optional TTL.
   * @template T - Value type
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time-to-live in seconds
   */
  public async set<T = SerializableValue>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    return this.manager.set<T>(key, value, ttlSeconds);
  }

  /**
   * Deletes one or more keys from the cache.
   * @param key - Key or array of keys
   * @returns Total count of removed keys
   */
  public async del(key: string | string[]): Promise<number> {
    return this.manager.del(key);
  }

  /**
   * Checks if a key exists in the cache.
   * @param key - Cache key
   * @returns True if exists
   */
  public async has(key: string): Promise<boolean> {
    return this.manager.has(key);
  }

  /**
   * Atomic get-or-set with cache stampede (thundering herd) protection.
   * @template T - Value type
   * @param key - Cache key
   * @param factory - Async computation function
   * @param ttlSeconds - Time-to-live in seconds
   * @returns Cached or newly computed value
   */
  public async getOrSet<T = SerializableValue>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    return this.manager.getOrSet<T>(key, factory, ttlSeconds);
  }

  /**
   * Batch retrieves multiple keys.
   * @template T - Value type
   * @param keys - Array of keys
   * @returns Array of retrieved values or nulls
   */
  public async mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]> {
    return this.manager.mget<T>(keys);
  }

  /**
   * Batch stores multiple entries.
   * @template T - Value type
   * @param entries - Array of entries
   */
  public async mset<T = SerializableValue>(
    entries: Array<{ key: string; value: T; ttlSeconds?: number }>,
  ): Promise<void> {
    return this.manager.mset<T>(entries);
  }

  /**
   * Clears keys matching an optional pattern.
   * @param pattern - Wildcard pattern (e.g. `users:*`)
   */
  public async clear(pattern?: string): Promise<void> {
    return this.manager.clear(pattern);
  }

  /**
   * Creates an isolated namespaced child cache manager sharing the same connection.
   * @param namespace - Namespace string
   * @returns Child CacheManager
   */
  public withNamespace(namespace: string): CacheManager {
    return this.manager.withNamespace(namespace);
  }

  /**
   * Pings the active store to verify health.
   * @returns True if healthy
   */
  public async isHealthy(): Promise<boolean> {
    return this.manager.isHealthy();
  }

  /**
   * NestJS lifecycle hook called when application shuts down.
   */
  public async onModuleDestroy(): Promise<void> {
    await this.manager.close();
  }
}

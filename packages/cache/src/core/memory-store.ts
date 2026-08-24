import { LRUCache } from 'lru-cache';
import type { ICacheStore, MemoryConfig, SerializableValue } from '../types.js';

/**
 * Internal container record used for storing items in the LRU cache.
 */
interface MemoryRecord {
  /**
   * The actual stored value.
   */
  value: SerializableValue;
}

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
export class MemoryStore implements ICacheStore {
  /**
   * Name identifier for the store.
   */
  public readonly name = 'memory' as const;

  /**
   * Internal LRUCache instance.
   */
  private readonly cache: LRUCache<string, MemoryRecord>;

  /**
   * Default time-to-live in milliseconds.
   */
  private readonly defaultTtlMs: number;

  /**
   * Constructs a new MemoryStore.
   * @param config - Memory cache configuration options
   */
  constructor(config: MemoryConfig = {}) {
    const maxItems = config.maxItems ?? 5000;
    const defaultTtlSeconds = config.defaultTtlSeconds ?? 300;
    this.defaultTtlMs = defaultTtlSeconds * 1000;

    this.cache = new LRUCache<string, MemoryRecord>({
      max: maxItems,
      ttl: this.defaultTtlMs > 0 ? this.defaultTtlMs : undefined,
      updateAgeOnGet: config.updateAgeOnGet ?? false,
    });
  }

  /**
   * Retrieves a typed value from the memory cache.
   * @template T - Expected output type
   * @param key - Cache key
   * @returns Stored value or null if not found or expired
   */
  public async get<T = SerializableValue>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    return entry.value as T;
  }

  /**
   * Stores a typed value in memory with an optional TTL.
   * @template T - Value type
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Optional custom TTL in seconds
   */
  public async set<T = SerializableValue>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const ttlMs = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(
      key,
      { value: value as SerializableValue },
      { ttl: ttlMs > 0 ? ttlMs : undefined },
    );
  }

  /**
   * Deletes one or more keys from the memory cache.
   * @param key - Key or array of keys to delete
   * @returns Total number of entries removed
   */
  public async del(key: string | string[]): Promise<number> {
    if (Array.isArray(key)) {
      let count = 0;
      for (const k of key) {
        if (this.cache.delete(k)) {
          count++;
        }
      }
      return count;
    }
    return this.cache.delete(key) ? 1 : 0;
  }

  /**
   * Checks if a key exists and has not expired in memory.
   * @param key - Cache key
   * @returns True if key exists
   */
  public async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * Batch retrieves multiple keys from memory.
   * @template T - Expected output type
   * @param keys - Array of cache keys
   * @returns Array of cached values or nulls
   */
  public async mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]> {
    return keys.map((key) => {
      const entry = this.cache.get(key);
      return entry ? (entry.value as T) : null;
    });
  }

  /**
   * Batch sets multiple key-value entries in memory.
   * @template T - Value type
   * @param entries - Array of entries containing key, value, and optional TTL
   */
  public async mset<T = SerializableValue>(
    entries: Array<{ key: string; value: T; ttlSeconds?: number }>,
  ): Promise<void> {
    for (const entry of entries) {
      const ttlMs =
        entry.ttlSeconds !== undefined ? entry.ttlSeconds * 1000 : this.defaultTtlMs;
      this.cache.set(
        entry.key,
        { value: entry.value as SerializableValue },
        { ttl: ttlMs > 0 ? ttlMs : undefined },
      );
    }
  }

  /**
   * Clears memory cache entries.
   * If a glob pattern (e.g. `user:*`) is provided, only matching keys are removed.
   * @param pattern - Optional wildcard pattern
   */
  public async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Convert simple redis pattern (e.g. `user:*`) to RegExp
    const regexPattern =
      '^' +
      pattern
        .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&')
        .replace(/\*/g, '.*') +
      '$';
    const regex = new RegExp(regexPattern);

    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Verifies health status of the in-memory store (always true).
   * @returns Always resolves to true
   */
  public async isHealthy(): Promise<boolean> {
    return true;
  }

  /**
   * Closes the memory store and frees all stored memory.
   */
  public async close(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Current number of entries in memory cache.
   */
  public get size(): number {
    return this.cache.size;
  }
}

import { Redis, type Redis as RedisClient } from 'ioredis';
import type { ICacheStore, RedisConfig, SerializableValue } from '../types.js';
import { defaultSerializer, type ISerializer } from './serializer.js';

/**
 * Event callbacks provided by CacheManager to track Redis connection lifecycle.
 */
export interface RedisStoreCallbacks {
  /**
   * Invoked when Redis connection is established and ready to process commands.
   */
  onReady?: () => void;
  /**
   * Invoked when an error occurs on the Redis client.
   * @param err - Error encountered
   */
  onError?: (err: Error) => void;
  /**
   * Invoked when the Redis connection closes.
   */
  onClose?: () => void;
  /**
   * Invoked when Redis begins reconnecting.
   */
  onReconnect?: () => void;
}

/**
 * Redis-backed cache store wrapping `ioredis` with auto-reconnect,
 * lifecycle event callbacks, and piped batch operations.
 *
 * @example
 * ```typescript
 * const store = new RedisStore({ host: 'localhost', port: 6379 });
 * await store.connect();
 * await store.set('key', { message: 'hello' });
 * ```
 */
export class RedisStore implements ICacheStore {
  /**
   * Store name identifier.
   */
  public readonly name = 'redis' as const;

  /**
   * Underlying ioredis client instance.
   */
  private readonly client: RedisClient;

  /**
   * Data serializer for transforming objects to strings.
   */
  private readonly serializer: ISerializer;

  /**
   * Internal connection state flag.
   */
  private isConnected = false;

  /**
   * Constructs a new RedisStore.
   * @param config - Redis connection configuration
   * @param callbacks - Lifecycle event handlers
   * @param serializer - Value serializer
   */
  constructor(
    config: RedisConfig = {},
    callbacks: RedisStoreCallbacks = {},
    serializer: ISerializer = defaultSerializer,
  ) {
    this.serializer = serializer;

    const { url, connectTimeout = 5000, maxRetries = 10, ...restConfig } = config;

    const redisOptions = {
      connectTimeout,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      retryStrategy: (times: number): number | null => {
        if (times > maxRetries) {
          return null; // Stop retrying and remain in fallback
        }
        return Math.min(times * 200, 3000);
      },
      ...restConfig,
    };

    if (url) {
      this.client = new Redis(url, redisOptions);
    } else {
      this.client = new Redis(redisOptions);
    }

    this.setupEventHandlers(callbacks);
  }

  /**
   * Sets up internal event listeners on the ioredis client.
   * @param callbacks - Lifecycle callbacks
   */
  private setupEventHandlers(callbacks: RedisStoreCallbacks): void {
    this.client.on('ready', () => {
      this.isConnected = true;
      callbacks.onReady?.();
    });

    this.client.on('connect', () => {
      // Socket connected, awaiting ready check
    });

    this.client.on('reconnecting', () => {
      this.isConnected = false;
      callbacks.onReconnect?.();
    });

    this.client.on('error', (err: Error) => {
      this.isConnected = false;
      callbacks.onError?.(err);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      callbacks.onClose?.();
    });

    this.client.on('end', () => {
      this.isConnected = false;
      callbacks.onClose?.();
    });
  }

  /**
   * Connects the Redis client to the server.
   */
  public async connect(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'close') {
      try {
        await this.client.connect();
      } catch {
        this.isConnected = false;
        // Suppress initial unhandled rejection since fallback handles it
      }
    }
  }

  /**
   * Whether the Redis client is currently connected and in ready state.
   */
  public get ready(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Direct access to the raw underlying `ioredis` Redis instance.
   */
  public get rawClient(): RedisClient {
    return this.client;
  }

  /**
   * Retrieves a typed value from Redis.
   * @template T - Expected output type
   * @param key - Cache key
   * @returns Deserialized value or null if not found
   */
  public async get<T = SerializableValue>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null || raw === undefined) {
      return null;
    }
    return this.serializer.deserialize<T>(raw);
  }

  /**
   * Stores a typed value in Redis with an optional TTL.
   * @template T - Value type
   * @param key - Cache key
   * @param value - Value to store
   * @param ttlSeconds - Time-to-live in seconds
   */
  public async set<T = SerializableValue>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const serialized = this.serializer.serialize<T>(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, serialized);
    }
  }

  /**
   * Deletes one or more keys from Redis.
   * @param key - Key or array of keys
   * @returns Number of removed keys
   */
  public async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return 0;
    return await this.client.del(...keys);
  }

  /**
   * Checks if a key exists in Redis.
   * @param key - Cache key
   * @returns True if key exists
   */
  public async has(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  /**
   * Batch retrieves multiple values from Redis.
   * @template T - Expected output type
   * @param keys - Array of keys
   * @returns Array of deserialized values or nulls
   */
  public async mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const results = await this.client.mget(...keys);
    return results.map((val: string | null) =>
      val !== null && val !== undefined ? this.serializer.deserialize<T>(val) : null,
    );
  }

  /**
   * Batch sets multiple key-value entries in Redis using a pipelined command.
   * @template T - Value type
   * @param entries - Array of entries
   */
  public async mset<T = SerializableValue>(
    entries: Array<{ key: string; value: T; ttlSeconds?: number }>,
  ): Promise<void> {
    if (entries.length === 0) return;

    const pipeline = this.client.pipeline();
    for (const entry of entries) {
      const serialized = this.serializer.serialize<T>(entry.value);
      if (entry.ttlSeconds && entry.ttlSeconds > 0) {
        pipeline.set(entry.key, serialized, 'EX', entry.ttlSeconds);
      } else {
        pipeline.set(entry.key, serialized);
      }
    }
    await pipeline.exec();
  }

  /**
   * Clears keys matching a pattern via SCAN cursor pagination.
   * @param pattern - Wildcard pattern (defaults to '*')
   */
  public async clear(pattern = '*'): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  }

  /**
   * Pings the Redis server to verify connectivity.
   * @returns True if Redis responds with PONG
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const ping = await this.client.ping();
      return ping === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Gracefully quits the Redis connection or force disconnects.
   */
  public async close(): Promise<void> {
    this.isConnected = false;
    try {
      if (this.client.status !== 'end' && this.client.status !== 'close') {
        await this.client.quit();
      }
    } catch {
      this.client.disconnect();
    }
  }
}

import { type Redis as RedisClient } from 'ioredis';
import type { ICacheStore, RedisConfig, SerializableValue } from '../types.js';
import { type ISerializer } from './serializer.js';
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
export declare class RedisStore implements ICacheStore {
    /**
     * Store name identifier.
     */
    readonly name: 'redis';
    /**
     * Underlying ioredis client instance.
     */
    private readonly client;
    /**
     * Data serializer for transforming objects to strings.
     */
    private readonly serializer;
    /**
     * Internal connection state flag.
     */
    private isConnected;
    /**
     * Constructs a new RedisStore.
     * @param config - Redis connection configuration
     * @param callbacks - Lifecycle event handlers
     * @param serializer - Value serializer
     */
    constructor(config?: RedisConfig, callbacks?: RedisStoreCallbacks, serializer?: ISerializer);
    /**
     * Sets up internal event listeners on the ioredis client.
     * @param callbacks - Lifecycle callbacks
     */
    private setupEventHandlers;
    /**
     * Connects the Redis client to the server.
     */
    connect(): Promise<void>;
    /**
     * Whether the Redis client is currently connected and in ready state.
     */
    get ready(): boolean;
    /**
     * Direct access to the raw underlying `ioredis` Redis instance.
     */
    get rawClient(): RedisClient;
    /**
     * Retrieves a typed value from Redis.
     * @template T - Expected output type
     * @param key - Cache key
     * @returns Deserialized value or null if not found
     */
    get<T = SerializableValue>(key: string): Promise<T | null>;
    /**
     * Stores a typed value in Redis with an optional TTL.
     * @template T - Value type
     * @param key - Cache key
     * @param value - Value to store
     * @param ttlSeconds - Time-to-live in seconds
     */
    set<T = SerializableValue>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    /**
     * Deletes one or more keys from Redis.
     * @param key - Key or array of keys
     * @returns Number of removed keys
     */
    del(key: string | string[]): Promise<number>;
    /**
     * Checks if a key exists in Redis.
     * @param key - Cache key
     * @returns True if key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Batch retrieves multiple values from Redis.
     * @template T - Expected output type
     * @param keys - Array of keys
     * @returns Array of deserialized values or nulls
     */
    mget<T = SerializableValue>(keys: string[]): Promise<(T | null)[]>;
    /**
     * Batch sets multiple key-value entries in Redis using a pipelined command.
     * @template T - Value type
     * @param entries - Array of entries
     */
    mset<T = SerializableValue>(entries: Array<{
        key: string;
        value: T;
        ttlSeconds?: number;
    }>): Promise<void>;
    /**
     * Clears keys matching a pattern via SCAN cursor pagination.
     * @param pattern - Wildcard pattern (defaults to '*')
     */
    clear(pattern?: string): Promise<void>;
    /**
     * Pings the Redis server to verify connectivity.
     * @returns True if Redis responds with PONG
     */
    isHealthy(): Promise<boolean>;
    /**
     * Gracefully quits the Redis connection or force disconnects.
     */
    close(): Promise<void>;
}

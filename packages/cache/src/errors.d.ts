/**
 * Base error class for all `@IRIS/cache` operations.
 *
 * @example
 * ```typescript
 * try {
 *   await cache.get('key');
 * } catch (err) {
 *   if (err instanceof CacheError) {
 *     console.error('Cache operation failed:', err.message);
 *   }
 * }
 * ```
 */
export declare class CacheError extends Error {
    readonly cause?: (Error | string) | undefined;
    /**
     * Constructs a new CacheError.
     * @param message - Descriptive error message
     * @param cause - Optional root cause error or explanation
     */
    constructor(message: string, cause?: (Error | string) | undefined);
}
/**
 * Thrown when required environment variables for Redis or cache are missing in auto-env mode.
 *
 * @example
 * ```typescript
 * try {
 *   const cache = new CacheManager({ autoEnv: true });
 * } catch (err) {
 *   if (err instanceof MissingEnvError) {
 *     console.error('Missing env vars:', err.missingVariables);
 *   }
 * }
 * ```
 */
export declare class MissingEnvError extends CacheError {
    readonly missingVariables: string[];
    /**
     * Constructs a new MissingEnvError.
     * @param missingVariables - Array of missing environment variable names
     * @param customMessage - Optional custom error message
     */
    constructor(missingVariables: string[], customMessage?: string);
}
/**
 * Thrown when Redis connection fails and fallback to in-memory caching is disabled.
 *
 * @example
 * ```typescript
 * const cache = new CacheManager({ fallbackToMemory: false });
 * ```
 */
export declare class RedisConnectionError extends CacheError {
    /**
     * Constructs a new RedisConnectionError.
     * @param message - Descriptive error message
     * @param cause - Optional root cause error or explanation
     */
    constructor(message: string, cause?: Error | string);
}
/**
 * Thrown when serialization or deserialization of cached data fails.
 *
 * @example
 * ```typescript
 * try {
 *   await cache.set('bad', circularReference);
 * } catch (err) {
 *   if (err instanceof SerializationError) {
 *     console.error('Failed to serialize:', err.message);
 *   }
 * }
 * ```
 */
export declare class SerializationError extends CacheError {
    /**
     * Constructs a new SerializationError.
     * @param message - Descriptive error message
     * @param cause - Optional root cause error or explanation
     */
    constructor(message: string, cause?: Error | string);
}

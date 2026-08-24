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
export class CacheError extends Error {
  /**
   * Constructs a new CacheError.
   * @param message - Descriptive error message
   * @param cause - Optional root cause error or explanation
   */
  constructor(message: string, public readonly cause?: Error | string) {
    super(message);
    this.name = 'CacheError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
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
export class MissingEnvError extends CacheError {
  /**
   * Constructs a new MissingEnvError.
   * @param missingVariables - Array of missing environment variable names
   * @param customMessage - Optional custom error message
   */
  constructor(public readonly missingVariables: string[], customMessage?: string) {
    const defaultMsg = `Required cache environment variable(s) missing: ${missingVariables.join(', ')}. Define them in your .env or provide configuration explicitly.`;
    super(customMessage ?? defaultMsg);
    this.name = 'MissingEnvError';
  }
}

/**
 * Thrown when Redis connection fails and fallback to in-memory caching is disabled.
 *
 * @example
 * ```typescript
 * const cache = new CacheManager({ fallbackToMemory: false });
 * ```
 */
export class RedisConnectionError extends CacheError {
  /**
   * Constructs a new RedisConnectionError.
   * @param message - Descriptive error message
   * @param cause - Optional root cause error or explanation
   */
  constructor(message: string, cause?: Error | string) {
    super(message, cause);
    this.name = 'RedisConnectionError';
  }
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
export class SerializationError extends CacheError {
  /**
   * Constructs a new SerializationError.
   * @param message - Descriptive error message
   * @param cause - Optional root cause error or explanation
   */
  constructor(message: string, cause?: Error | string) {
    super(message, cause);
    this.name = 'SerializationError';
  }
}

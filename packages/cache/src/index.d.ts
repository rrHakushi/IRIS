/**
 * @IRIS/cache
 *
 * Unified caching package providing Redis connection management with automatic,
 * zero-downtime in-memory LRU fallback, stampede protection, and NestJS dynamic module integration.
 *
 * @module @IRIS/cache
 */
export * from './core/cache-manager.js';
export * from './core/memory-store.js';
export * from './core/redis-store.js';
export * from './core/serializer.js';
export * from './errors.js';
export * from './types.js';
export * from './utils/env.js';
export * from './nestjs/index.js';

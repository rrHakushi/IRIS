/**
 * @IRIS/cache
 *
 * Unified caching package providing Redis connection management with automatic,
 * zero-downtime in-memory LRU fallback, stampede protection, and NestJS dynamic module integration.
 *
 * @module @IRIS/cache
 */

// Core exports
export * from './core/cache-manager.js';
export * from './core/memory-store.js';
export * from './core/redis-store.js';
export * from './core/serializer.js';

// Error exports
export * from './errors.js';

// Types
export * from './types.js';

// Utils
export * from './utils/env.js';

// NestJS integration
export * from './nestjs/index.js';

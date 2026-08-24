import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CacheManager } from '../src/core/cache-manager';
import { MissingEnvError } from '../src/errors';
import { resolveCacheOptions } from '../src/utils/env';

describe('CacheManager', () => {
  it('should throw MissingEnvError when autoEnv is true and no Redis env vars or config are present', () => {
    const originalEnv = { ...process.env };
    try {
      delete process.env['REDIS_URL'];
      delete process.env['REDIS_HOST'];

      assert.throws(
        () => {
          resolveCacheOptions({ autoEnv: true });
        },
        (err: Error) => {
          assert.equal(err instanceof MissingEnvError, true);
          assert.equal(
            (err as MissingEnvError).missingVariables.includes('REDIS_URL'),
            true,
          );
          return true;
        },
      );
    } finally {
      process.env = originalEnv;
    }
  });

  it('should automatically fall back to memory store when Redis is unavailable', async () => {
    const cache = new CacheManager({
      redis: { host: '127.0.0.1', port: 59999, connectTimeout: 300, maxRetries: 0 },
      fallbackToMemory: true,
      defaultTtlSeconds: 10,
      autoEnv: false,
    });

    try {
      await cache.set('hero:1', { name: 'Iris' });
      const result = await cache.get<{ name: string }>('hero:1');
      assert.deepEqual(result, { name: 'Iris' });
      assert.equal(cache.activeStoreName, 'memory');
    } finally {
      await cache.close();
    }
  });

  it('should prevent cache stampede with getOrSet', async () => {
    const cache = new CacheManager({
      redis: { host: '127.0.0.1', port: 59999, connectTimeout: 300, maxRetries: 0 },
      fallbackToMemory: true,
      autoEnv: false,
    });

    try {
      let factoryExecutionCount = 0;
      const slowFactory = async (): Promise<{ count: number; data: string }> => {
        factoryExecutionCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { count: factoryExecutionCount, data: 'computed' };
      };

      // 5 concurrent calls for the same missing key
      const results = await Promise.all([
        cache.getOrSet('stampede:key', slowFactory),
        cache.getOrSet('stampede:key', slowFactory),
        cache.getOrSet('stampede:key', slowFactory),
        cache.getOrSet('stampede:key', slowFactory),
        cache.getOrSet('stampede:key', slowFactory),
      ]);

      // Factory should have only executed once!
      assert.equal(factoryExecutionCount, 1);
      assert.deepEqual(results[0], { count: 1, data: 'computed' });
      assert.deepEqual(results[1], { count: 1, data: 'computed' });
      assert.deepEqual(results[2], { count: 1, data: 'computed' });
      assert.deepEqual(results[3], { count: 1, data: 'computed' });
      assert.deepEqual(results[4], { count: 1, data: 'computed' });
    } finally {
      await cache.close();
    }
  });

  it('should support namespaced child managers', async () => {
    const cache = new CacheManager({
      redis: { host: '127.0.0.1', port: 59999, connectTimeout: 300, maxRetries: 0 },
      fallbackToMemory: true,
      autoEnv: false,
    });

    try {
      const userCache = cache.withNamespace('users');
      await userCache.set('profile:100', { username: 'alex' });

      assert.deepEqual(await userCache.get('profile:100'), { username: 'alex' });
      // Root cache should have the key prefixed
      assert.deepEqual(await cache.get('users:profile:100'), { username: 'alex' });
    } finally {
      await cache.close();
    }
  });

  it('should delete and clear keys in fallback mode', async () => {
    const cache = new CacheManager({
      redis: { host: '127.0.0.1', port: 59999, connectTimeout: 300, maxRetries: 0 },
      fallbackToMemory: true,
      autoEnv: false,
    });

    try {
      await cache.set('item:1', 'A');
      await cache.set('item:2', 'B');

      assert.equal(await cache.has('item:1'), true);
      await cache.del('item:1');
      assert.equal(await cache.has('item:1'), false);

      await cache.clear();
      assert.equal(await cache.has('item:2'), false);
    } finally {
      await cache.close();
    }
  });
});

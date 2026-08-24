import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Test, TestingModule } from '@nestjs/testing';
import { CacheManager } from '../src/core/cache-manager';
import { CACHE_MANAGER } from '../src/nestjs/cache.constants';
import { CacheModule } from '../src/nestjs/cache.module';
import { CacheService } from '../src/nestjs/cache.service';

describe('CacheModule (NestJS)', () => {
  it('should compile synchronously with forRoot and inject CacheService', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        CacheModule.forRoot({
          redis: { host: '127.0.0.1', port: 59999, connectTimeout: 200, maxRetries: 0 },
          fallbackToMemory: true,
          autoEnv: false,
        }),
      ],
    }).compile();

    try {
      const cacheService = moduleRef.get<CacheService>(CacheService);
      const cacheManager = moduleRef.get<CacheManager>(CACHE_MANAGER);

      assert.equal(cacheService !== null && cacheService !== undefined, true);
      assert.equal(cacheManager !== null && cacheManager !== undefined, true);
      assert.equal(cacheService.manager, cacheManager);

      await cacheService.set('nest:key', { ok: true });
      assert.deepEqual(await cacheService.get('nest:key'), { ok: true });
    } finally {
      await moduleRef.close();
    }
  });

  it('should compile asynchronously with forRootAsync', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        CacheModule.forRootAsync({
          useFactory: () => ({
            redis: { host: '127.0.0.1', port: 59999, connectTimeout: 200, maxRetries: 0 },
            fallbackToMemory: true,
            autoEnv: false,
          }),
        }),
      ],
    }).compile();

    try {
      const cacheService = moduleRef.get<CacheService>(CacheService);
      assert.equal(cacheService !== null && cacheService !== undefined, true);

      await cacheService.set('async:key', 'hello-async');
      assert.deepEqual(await cacheService.get('async:key'), 'hello-async');
    } finally {
      await moduleRef.close();
    }
  });
});

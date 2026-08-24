---
name: IRIS-cache
description: Comprehensive guide for caching in IRIS using @IRIS/cache. Covers Redis connection management with automatic in-memory LRU fallback, strict TypeScript typing (zero any/unknown), cache stampede protection via getOrSet, key namespaces, TTL policies, dynamic NestJS CacheModule integration (forRoot/forRootAsync/@InjectCache()), environment variable configuration, and error handling (MissingEnvError, RedisConnectionError). Use this skill whenever the user mentions @IRIS/cache, Redis caching, in-memory fallback, cache stampede prevention, NestJS cache module in IRIS, or asks how to cache database queries/API responses/computations.
---

# @IRIS/cache Guide

`@IRIS/cache` is the unified caching package for the IRIS ecosystem. It combines primary high-throughput distributed caching in **Redis** (powered by `ioredis`) with seamless, zero-downtime automatic failover to a local bounded **in-memory LRU cache** (`lru-cache`) whenever Redis is disconnected, starting up, or encountering network issues.

---

## 1. Core Architecture & Features

- **Automatic Failover & Recovery**: Seamlessly routes cache calls to bounded in-memory LRU cache if Redis goes offline, and automatically switches back to Redis when the connection is restored.
- **Strictly Typed**: Fully generic APIs with zero `any` or `unknown` types.
- **Cache Stampede (Thundering Herd) Protection**: Built-in atomic in-flight promise coalescing in `getOrSet()` guarantees expensive query factories run only once during concurrent cache misses.
- **Namespaces**: Easily create isolated sub-caches using `.withNamespace('users')` without opening additional network connections.
- **Dual Runtime Support**: Standalone framework-agnostic client (`CacheManager`) + first-class **NestJS 11** dynamic module (`CacheModule`).
- **Environment Validation**: Validates environment variables and throws `MissingEnvError` when required variables are absent in auto-mode.

---

## 2. Environment Variables

When `autoEnv: true` (default), `@IRIS/cache` reads configuration from `.env`:

| Variable | Description | Example |
|---|---|---|
| `REDIS_URL` | Full Redis connection URI (takes precedence) | `redis://:secret@127.0.0.1:6379/0` |
| `REDIS_HOST` | Redis host (required if `REDIS_URL` is omitted) | `127.0.0.1` or `IRIS-cache` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Optional Redis authentication password | `yourpassword` |
| `REDIS_DB` | Redis database index | `0` |
| `REDIS_TLS` | Enable TLS/SSL connection (`true` or `1`) | `true` |
| `CACHE_DEFAULT_TTL` | Default cache TTL in seconds | `300` |
| `CACHE_MEMORY_MAX_ITEMS` | Maximum in-memory LRU items in fallback | `5000` |

> [!IMPORTANT]
> If neither `REDIS_URL` nor `REDIS_HOST` is defined and no explicit config is passed, `@IRIS/cache` throws a `MissingEnvError`.

---

## 3. NestJS Integration (`apps/server`)

### Step 1: Register `CacheModule` in `AppModule`

```typescript
// apps/server/src/app.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@IRIS/cache';

@Module({
  imports: [
    CacheModule.forRoot({
      isGlobal: true, // makes CacheService available across all modules
      defaultTtlSeconds: 300,
    }),
  ],
})
export class AppModule {}
```

#### Asynchronous Configuration (e.g. via `ConfigService`):

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@IRIS/cache';

@Module({
  imports: [
    CacheModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          url: config.get<string>('REDIS_URL'),
        },
        defaultTtlSeconds: 600,
        fallbackToMemory: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

### Step 2: Inject `CacheService` into Controllers & Services

```typescript
// apps/server/src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { CacheService } from '@IRIS/cache';
import { PrismaService } from '@IRIS/database';

export interface UserDto {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class UserService {
  constructor(
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  public async getUserById(id: string): Promise<UserDto | null> {
    // Atomic stampede-protected caching for 10 minutes
    return this.cache.getOrSet<UserDto | null>(
      `user:${id}`,
      async () => {
        return this.prisma.user.findUnique({ where: { id } });
      },
      600,
    );
  }

  public async updateUser(id: string, data: Partial<UserDto>): Promise<UserDto> {
    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    // Invalidate or update cache
    await this.cache.del(`user:${id}`);
    return updated;
  }
}
```

---

## 4. Standalone TypeScript Usage

Use `CacheManager` outside NestJS (e.g., workers, standalone scripts, Next.js API routes):

```typescript
import { CacheManager } from '@IRIS/cache';

interface SessionData {
  userId: string;
  roles: string[];
}

const cache = new CacheManager({
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
  keyPrefix: 'iris:session:',
  defaultTtlSeconds: 3600,
  fallbackToMemory: true,
});

// Basic Operations
await cache.set<SessionData>('token_abc', {
  userId: 'user_123',
  roles: ['admin'],
});

const session = await cache.get<SessionData>('token_abc');
console.log(session?.userId); // "user_123"

// Check Status
console.log(cache.status); // 'redis' | 'memory' | 'connecting' | 'error'
console.log(cache.activeStoreName); // 'redis' | 'memory'

// Cleanup
await cache.close();
```

---

## 5. API Reference

### `get<T>(key: string): Promise<T | null>`
Retrieve a typed value from the cache. Returns `null` on cache miss.

### `set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>`
Store a typed value with optional TTL (defaults to `defaultTtlSeconds`).

### `getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>`
Retrieve existing cached value or execute the `factory()` function, store the result, and return it.
Prevents **Cache Stampede / Thundering Herd** by ensuring concurrent calls for the same missing key share a single execution of `factory()`.

### `del(key: string | string[]): Promise<number>`
Delete one or multiple keys. Returns number of keys removed.

### `has(key: string): Promise<boolean>`
Check if key exists in cache without reading its entire payload.

### `mget<T>(keys: string[]): Promise<(T | null)[]>`
Batch retrieve multiple keys in a single operation.

### `mset<T>(entries: Array<{ key: string; value: T; ttlSeconds?: number }>): Promise<void>`
Batch store multiple key-value pairs with individual TTLs.

### `clear(pattern?: string): Promise<void>`
Clear all keys, or keys matching a wildcard pattern (e.g. `user:*`).

### `withNamespace(namespace: string): CacheManager`
Create a lightweight child manager that automatically prefixes all keys with `<namespace>:`. Shares the underlying Redis/Memory connections.

### `isHealthy(): Promise<boolean>`
Ping the active store to verify health.

### `close(): Promise<void>`
Gracefully closes connections and clears resources.

---

## 6. Best Practices

1. **Always provide generic types**:
   ```typescript
   // Recommended
   const user = await cache.get<UserProfile>(`user:${userId}`);

   // Avoid omitting types
   const user = await cache.get(`user:${userId}`);
   ```

2. **Always prefer `getOrSet` for database queries**:
   Prevents thundering herd when hundreds of simultaneous requests hit an expired or cold cache key.

3. **Use Namespaces for sub-domains**:
   ```typescript
   const authCache = cache.withNamespace('auth');
   await authCache.set('jwt:xyz', session); // Stores as "iris:auth:jwt:xyz"
   ```

4. **Structured Error Handling**:
   Catch specific error classes from `@IRIS/cache`:
   - `MissingEnvError`: Missing required environment configuration.
   - `RedisConnectionError`: Redis is offline and memory fallback is disabled.
   - `SerializationError`: Failed to serialize or parse data.

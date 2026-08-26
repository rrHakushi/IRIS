---
name: IRIS-cache
description: Guide for distributed and in-memory caching in IRIS via @IRIS/cache with Redis and automatic LRU fallback. Use when caching queries, responses, or using getOrSet.
---

# @IRIS/cache Guide

`@IRIS/cache` is the unified caching package for the IRIS ecosystem. It combines primary high-throughput distributed caching in **Redis** (powered by `ioredis`) with seamless, zero-downtime automatic failover to a local bounded **in-memory LRU cache** (`lru-cache`) whenever Redis is disconnected, starting up, or encountering network issues.

---

## 1. Core Architecture & Features

- **Automatic Failover & Recovery**: Seamlessly routes cache calls to bounded in-memory LRU cache if Redis goes offline, and automatically switches back to Redis when the connection is restored.
- **Strictly Typed**: Fully generic APIs with zero `any` or `unknown` types.
- **Cache Stampede (Thundering Herd) Protection**: Built-in atomic in-flight promise coalescing in `getOrSet()` guarantees expensive query factories run only once during concurrent cache misses.
- **Namespaces**: Easily create isolated sub-caches using `.withNamespace('users')` without opening additional network connections.
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

## 3. Elysia 2.0 Route Caching (`@IRIS/elysia`)

In Elysia route handlers, use `CacheManager` to protect expensive database operations from stampedes:

```typescript
import { defineRoute, t } from "@/router";
import { CacheManager } from "@IRIS/cache";

const cache = new CacheManager({
  keyPrefix: "iris:users:",
  defaultTtlSeconds: 300,
});

export default defineRoute({
  schema: {
    params: t.Object({ id: t.Number() }),
  },

  async GET({ params, prisma }) {
    // Stampede-protected cached query
    const user = await cache.getOrSet(`user:${params.id}`, async () => {
      return await prisma.user.findUnique({
        where: { id: String(params.id) },
      });
    }, 300);

    return { user };
  },

  async POST({ params, body, prisma }) {
    const updated = await prisma.user.update({
      where: { id: String(params.id) },
      data: body as any,
    });

    // Invalidate cache
    await cache.del(`user:${params.id}`);

    return { success: true, user: updated };
  },
});
```

---

## 4. Next.js & Server Actions Usage

```typescript
import { CacheManager } from "@IRIS/cache";
import { prisma } from "@IRIS/database";

const statsCache = new CacheManager({
  keyPrefix: "iris:stats:",
  defaultTtlSeconds: 60,
});

export async function getGlobalStats() {
  return await statsCache.getOrSet("global", async () => {
    const [userCount, postCount] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
    ]);
    return { userCount, postCount };
  }, 60);
}
```

---

## 5. Standalone TypeScript Usage

Use `CacheManager` for workers, queues, or standalone scripts:

```typescript
import { CacheManager } from "@IRIS/cache";

interface SessionData {
  userId: string;
  roles: string[];
}

const cache = new CacheManager({
  redis: {
    host: "127.0.0.1",
    port: 6379,
  },
  keyPrefix: "iris:session:",
  defaultTtlSeconds: 3600,
  fallbackToMemory: true,
});

// Basic Operations
await cache.set("sess_123", { userId: "u1", roles: ["admin"] }, 3600);
const session = await cache.get<SessionData>("sess_123");
await cache.del("sess_123");

// Cache Stampede Prevention with getOrSet
const data = await cache.getOrSet(
  "expensive:computation",
  async () => {
    return await computeHeavyReport();
  },
  600 // TTL in seconds
);

// Check Status
console.log(cache.status); // 'redis' | 'memory' | 'connecting' | 'error'
```

---

## 6. Full API Reference (`CacheManager`)

### `get<T>(key: string): Promise<T | null>`
Retrieve a typed value from the cache. Returns `null` on cache miss.

### `set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>`
Store a value with an optional TTL in seconds (overrides default TTL).

### `getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>`
Retrieve existing key, or execute the async factory function, cache the result, and return it. Includes in-flight coalescing to eliminate cache stampedes.

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

## 7. Best Practices

1. **Always provide generic types**:
   ```typescript
   const user = await cache.get<UserProfile>(`user:${userId}`);
   ```

2. **Always prefer `getOrSet` for database queries**:
   Prevents thundering herd when hundreds of simultaneous requests hit an expired or cold cache key.

3. **Use Namespaces for sub-domains**:
   ```typescript
   const authCache = cache.withNamespace("auth");
   await authCache.set("jwt:xyz", session); // Stores as "iris:auth:jwt:xyz"
   ```

4. **Structured Error Handling**:
   Catch specific error classes from `@IRIS/cache`:
   - `MissingEnvError`: Missing required environment configuration.
   - `RedisConnectionError`: Redis is offline and memory fallback is disabled.
   - `SerializationError`: Failed to serialize or parse data.

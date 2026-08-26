---
name: IRIS-Elysia/rateLimiter
description: Guide for Token Bucket rate limiting in IRIS (@IRIS/elysia) with multi-tier identity resolution (user, API key, device ID, IP) and HTTP 429 headers. Use when configuring rate limits, quotas, or 429 errors.
---

# IRIS Elysia Rate Limiter Guide

The IRIS Elysia Rate Limiter Plugin (`@IRIS/elysia`) is an in-memory, zero-dependency **Token Bucket** rate limiting system designed for sub-millisecond overhead and strict multi-tier traffic control.

---

## 1. Core Architecture & Features

- **Token Bucket Algorithm**: Continuous, smooth replenishment based on `refillRate = capacity / (duration / 1000)` tokens per second. Allows bursts up to `capacity` without the cliff-edge window resets of fixed-window counters.
- **Multi-Tier Identity Resolution Hierarchy**: Automatically identifies incoming traffic from most specific to least specific:
  1. **Authenticated User**: `usr:<userId>` (isolated per logged-in account).
  2. **API Key**: `key:<apiKeyId>` or SHA-256 hash (isolated per issued key).
  3. **Device ID + IP**: `dev:<ip>:<deviceId>` (supports headers `x-device-id`, `device-id`, `x-client-id`).
  4. **Anonymous Fingerprint**: `ip:<ip>:<uaHash>` (combines client IP with User-Agent hash to prevent IP spoofing or proxy collisions).
- **Hierarchical Overrides**:
  - **Global Server Level**: Applied across the entire server (`app.use(rateLimiter())`).
  - **Route Level**: Overridden per route file (`defineRoute({ rateLimit: { ... } })`).
  - **Method Level**: Overridden per HTTP method (`GET: { rateLimit: { ... }, handler }`).
- **RFC-Compliant HTTP Headers**:
  - `ratelimit-limit`: Maximum token bucket capacity.
  - `ratelimit-remaining`: Tokens currently available in the bucket.
  - `ratelimit-reset`: Seconds until the bucket is completely full.
  - `retry-after`: (On HTTP 429) Exact seconds until enough tokens are refilled to satisfy the request.

---

## 2. Quick Start

### Global Server Registration

The rate limiter is mounted as a global plugin in `apps/elysia/src/index.ts`:

```typescript
import { Elysia } from "elysia";
import { rateLimiter } from "./plugins";

export const app = new Elysia()
  .use(
    rateLimiter({
      capacity: 100, // Maximum burst allowance
      duration: 60_000, // 1 minute refill window
      cost: 1, // 1 token per request
    })
  );
```

---

## 3. Multi-Tier Identity Resolution

The `resolveRateLimitKey()` utility extracts the client identity automatically:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Authenticated User (session.user.id)                │
│    -> usr:01928374-abcd-7890-bcde-0192837465ef         │
├─────────────────────────────────────────────────────────┤
│ 2. API Key (session.apiKey.id or Authorization header)  │
│    -> key:iris_dev_key_0192837465abcdef01928374         │
├─────────────────────────────────────────────────────────┤
│ 3. Client Device ID (x-device-id / device-id) + IP      │
│    -> dev:192.168.1.50:ios-client-uuid-1234             │
├─────────────────────────────────────────────────────────┤
│ 4. Fallback IP + User-Agent Hash                        │
│    -> ip:192.168.1.50:a1b2c3d4                          │
└─────────────────────────────────────────────────────────┘
```

> [!TIP]
> This hierarchy guarantees that mobile apps or web clients with different device IDs behind the same NAT/corporate router do not throttle each other, while ensuring authenticated users are throttled across devices.

---

## 4. Route & Method Overrides

You can customize rate limits per route or per method in your file-based routes:

### Route-Level Override

Applies to all HTTP methods in this route file:

```typescript
// apps/elysia/src/modules/search/route.ts
import { defineRoute } from "@/router";

export default defineRoute({
  // Tighter bucket for expensive search queries
  rateLimit: {
    capacity: 20,
    duration: 60_000, // 20 requests per minute
  },

  GET({ query }) {
    return { results: [] };
  },
});
```

### Method-Level Override

Applies only to a specific HTTP method (e.g. strict limits on `POST /auth/login`, relaxed on `GET`):

```typescript
// apps/elysia/src/modules/auth/login/route.ts
import { defineRoute, t } from "@/router";

export default defineRoute({
  // Method object form with local rate limit
  POST: {
    schema: {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
    },
    rateLimit: {
      capacity: 5, // Only 5 login attempts
      duration: 60_000, // per minute
      errorMessage: "Too many login attempts. Please try again in a minute.",
    },
    handler({ body }) {
      return { success: true };
    },
  },

  // GET route retains global server rate limits
  GET() {
    return { loginEnabled: true };
  },
});
```

---

## 5. Configuration Options (`RateLimitConfig`)

```typescript
export interface RateLimitConfig {
  /**
   * Maximum capacity of the token bucket (burst ceiling).
   * @default 100
   */
  capacity?: number;

  /**
   * Time window in milliseconds to completely refill the bucket.
   * Refill rate = capacity / (duration / 1000) tokens/sec.
   * @default 60_000 (1 minute)
   */
  duration?: number;

  /**
   * Direct refill rate in tokens per second.
   * If specified, overrides the capacity / duration calculation.
   */
  refillRate?: number;

  /**
   * Number of tokens consumed per request.
   * @default 1
   */
  cost?: number;

  /**
   * Custom error message returned in the 429 response body.
   * @default "Too Many Requests"
   */
  errorMessage?: string;

  /**
   * Custom key generator function.
   */
  keyGenerator?: (ctx: Context) => string;

  /**
   * Predicate function to bypass rate limiting (e.g. for health checks or admin IPs).
   */
  skip?: (ctx: Context) => boolean;
}
```

### Custom Key Generator & Bypass Example

```typescript
rateLimiter({
  capacity: 100,
  duration: 60_000,
  // Bypass internal Docker health checks
  skip(ctx) {
    const url = new URL(ctx.request.url);
    return url.pathname === "/health";
  },
  // Custom tenant-based grouping
  keyGenerator(ctx) {
    const tenantId = ctx.request.headers.get("x-tenant-id") || "default";
    return `tenant:${tenantId}`;
  },
})
```

---

## 6. HTTP 429 Response Format

When tokens are exhausted, the rate limiter immediately aborts the request with:

- **HTTP Status**: `429 Too Many Requests`
- **Headers**:
  ```http
  ratelimit-limit: 100
  ratelimit-remaining: 0
  ratelimit-reset: 42
  retry-after: 5
  content-type: application/json;charset=utf-8
  ```
- **Body**:
  ```json
  {
    "error": "Too Many Requests",
    "message": "Rate limit exceeded. Please try again in 5 seconds.",
    "retryAfter": 5
  }
  ```

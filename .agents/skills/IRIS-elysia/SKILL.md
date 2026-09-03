---
name: IRIS-elysia
description: Comprehensive master architectural guide for the IRIS backend (@IRIS/elysia) built on Bun and Elysia 2.0 beta. Covers file-based routing (modules), stateful singleton services (WebSocketHub, queues, notifications), cross-cutting utils (RFC 9457 HttpErrors, caching, request-scoped logger), plugins (session, rateLimiter, cron, cors), router generator (Eden Treaty, Insomnium sync), fast end-to-end type safety, Elysia 2 beta breaking changes, and troubleshooting.
---

# IRIS Elysia Backend Architecture & Development Guide

The IRIS backend (`@IRIS/elysia`) is a high-performance, modular API server built on **Bun** and **Elysia 2.0 (beta)**. It delivers sub-millisecond execution, end-to-end type safety via **Eden Treaty**, file-based routing, and a clean separation of concerns.

---

## 1. Architectural Overview & Component Map

The backend is organized into five distinct architectural layers inside `apps/elysia/src/`:

```
apps/elysia/src/
├── index.ts                # Server entry point, global plugin assembly, and WS endpoint
├── modules/                # File-based HTTP routes organized by domain module
│   ├── <module-name>/      # Module folder (e.g. core, auth, resources)
│   │   └── <path>/route.ts # Route handler definitions with TypeBox schemas
├── services/               # Stateful singletons (WebSockets, notification delivery, worker queues)
├── utils/                  # Cross-cutting utilities (RFC 9457 errors, cache, request logger, crypto)
├── plugins/                # Core Elysia plugins (session auth, token bucket rate limiter, cron, cors)
└── router/                 # Dynamic route loader, Eden Treaty generator, and Insomnium syncer
```

### Layer Responsibilities

| Layer | Directory | Purpose | Statefulness |
|---|---|---|---|
| **Modules** | `src/modules/` | HTTP request handlers, validation schemas, input parsing, error dispatching | Stateless |
| **Services** | `src/services/` | Long-lived business logic, background workers, WebSocket connections, pub/sub | Stateful Singletons |
| **Utils** | `src/utils/` | Shared helpers: RFC 9457 `HttpError` classes, cache manager, request loggers | Stateless / Scoped |
| **Plugins** | `src/plugins/` | Elysia server extensions: authentication, rate limiting, task scheduling, CORS | Lifecycle Hooks |
| **Router** | `src/router/` | Route discovery, static manifest compilation, Eden Treaty client type export | Build & Watch Time |

---

## 2. Modules & File-Based Routing (`src/modules`)

Every file named `route.ts` or `route.js` inside `src/modules/` automatically becomes an API endpoint.

### Route Path Mapping Rules

The route parser (`parseRoutePath`) converts module directory hierarchies into URL paths:
1. **Module Name Stripped**: The top-level module directory is omitted from the URL path.
   - `src/modules/core/health/route.ts` $\rightarrow$ `/health`
   - `src/modules/identity/users/[id]/route.ts` $\rightarrow$ `/users/:id`
2. **Route Groups Ignored**: Folder names enclosed in parentheses `(group)` are ignored in the final URL path:
   - `src/modules/billing/(public)/pricing/route.ts` $\rightarrow$ `/pricing`
3. **Dynamic Parameters**: `[param]` converts to `:param`:
   - `src/modules/resource/[id]/items/[itemId]/route.ts` $\rightarrow$ `/resource/:id/items/:itemId`
4. **Catch-All Wildcards**: `[...slug]` converts to `*`:
   - `src/modules/storage/files/[...slug]/route.ts` $\rightarrow$ `/files/*`
5. **Module Root**: `src/modules/core/route.ts` $\rightarrow$ `/`

---

### Defining Routes with `defineRoute()`

Routes are declared using `defineRoute()`, providing compile-time type inference for path parameters, query strings, and JSON request bodies:

```typescript
// apps/elysia/src/modules/sample/items/[id]/route.ts
import { defineRoute, t } from "@/router";
import { NotFound, BadRequest } from "@/utils/errors";

export default defineRoute({
  // 1. Shared validation schemas (OpenAPI compliant)
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1, description: "Numeric resource ID" }),
    }),
  },

  // 2. Bodyless handler: GET (body is omitted from context)
  async GET({ params, prisma, cache, session }) {
    const item = await cache.getOrSet(
      `item:${params.id}`,
      async () => {
        return await prisma.item.findUnique({
          where: { id: params.id },
        });
      },
      300 // 5 minutes TTL
    );

    if (!item) {
      throw new NotFound(`Item ${params.id} does not exist`);
    }

    return { success: true, data: item };
  },

  // 3. Mutation handler: PUT (accepts typed body)
  PUT: {
    schema: {
      body: t.Object({
        title: t.String({ minLength: 3, maxLength: 100 }),
        status: t.Union([t.Literal("active"), t.Literal("archived")]),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          data: t.Any(),
        }),
      },
    },
    rateLimit: {
      capacity: 10,
      duration: 60_000,
    },
    async handler({ params, body, prisma, session }) {
      if (!session.isAuthenticated) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }

      const updated = await prisma.item.update({
        where: { id: params.id },
        data: { title: body.title, status: body.status },
      });

      return { success: true, data: updated };
    },
  },
});
```

### Handler Context (`Context`)

Route handlers receive a rich context object with injected utilities:

| Property | Type | Description |
|---|---|---|
| `params` | `TParams` | Inferred path parameters (e.g. `params.id`) |
| `query` | `TQuery` | Inferred query parameters (e.g. `query.page`) |
| `body` | `TBody` | Inferred request body (omitted on `GET`, `HEAD`, `OPTIONS`) |
| `prisma` | `PrismaClient` | Database client from `@IRIS/database` |
| `cache` | `CacheManager` | Redis/LRU Cache manager from `@IRIS/cache` |
| `session` | `Session` | Resolved session (user, auth method, permissions) |
| `logger` | `RequestLogger` | Request-scoped logger grouped under HTTP request output |
| `cacheKeys` | `GlobalCacheKeys`| Strongly-typed cross-route cache key builders |
| `set` | `ElysiaContext['set']`| HTTP response headers and status mutator |
| `request` | `Request` | Standard Web Request object |

---

## 3. Services (`src/services`)

Services are **stateful singletons** initialized once on server startup via `initServices()` in `src/index.ts`. They manage long-lived connections, background workers, and real-time events.

### Core Built-in Services

1. **`WebSocketHub` (`src/services/websocket-hub.ts`)**:
   - Manages active client sockets connected to `/ws`.
   - Maps `userId -> Set<ElysiaWS>` for direct user notifications.
   - Pub/Sub channel management: `wsHub.subscribe(ws, "topic")`, `wsHub.broadcast("topic", event, payload)`.
   - Automatic private user channel subscription: `user:<userId>`.
2. **`NotificationService` (`src/services/notification.service.ts`)**:
   - Multi-channel notification dispatch: In-app, push, and email.
   - Encrypts sensitive notification content via AES-256-GCM (`encryptNotificationContent`).
   - Dispatches real-time events over `wsHub` when recipient is online.
3. **`MediaQueueService` & `MediaDbSyncer` (`src/services/media-queue/`)**:
   - High-throughput asynchronous background job processing.
   - Concurrency limits, provider-specific rate limiting, and exponential retry backoff.
   - Periodic database synchronization workers.

### Pattern: Creating a New Service

When creating new services, follow the singleton pattern with explicit status logging and lifecycle hooks:

```typescript
// apps/elysia/src/services/generic-data.service.ts
import { logger } from "../utils/logger";

export class GenericDataService {
  private static instance: GenericDataService;
  private isRunning = false;

  private constructor() {
    GenericDataService.logStatus();
  }

  public static logStatus(): void {
    logger.service("generic-data", "data synchronization worker service");
  }

  public static getInstance(): GenericDataService {
    if (!GenericDataService.instance) {
      GenericDataService.instance = new GenericDataService();
    }
    return GenericDataService.instance;
  }

  public async processQueue(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      // Process background queue...
    } finally {
      this.isRunning = false;
    }
  }
}

export const genericDataService = GenericDataService.getInstance();
```

Register your service in `apps/elysia/src/services/index.ts`:
```typescript
import { genericDataService, GenericDataService } from "./generic-data.service";

export function initServices(): void {
  // Existing service status logs...
  GenericDataService.logStatus();
}
```

---

## 4. Utils (`src/utils`)

Shared utilities live in `src/utils/` and supply cross-cutting capabilities across routes and services.

### 1. RFC 9457 Problem Details & HTTP Errors (`src/utils/errors.ts`)

Standardized HTTP error classes inheriting from `ElysiaError<Status>`:

```typescript
import {
  BadRequest,          // 400
  Unauthorized,        // 401
  Forbidden,           // 403
  NotFound,            // 404
  Conflict,            // 409
  TooManyRequests,     // 429
  InternalServerError, // 500
  isHttpError,
} from "@/utils/errors";

// Throw inside any route handler or service
if (!item) {
  throw new NotFound("Item not found");
}
if (hasConflict) {
  throw new Conflict("Resource with this identifier already exists");
}
```

### 2. Distributed & In-Memory Cache (`src/utils/cache.ts`)

Shared `CacheManager` from `@IRIS/cache`:
- Connects to Redis when `REDIS_URL` or `REDIS_HOST` is present.
- Seamlessly falls back to an in-memory LRU cache when Redis is offline.
- Helper `cache.getOrSet(key, fetcher, ttlSeconds)` prevents cache stampedes.

### 3. Request-Scoped Logger (`src/utils/request-logger.ts` & `src/utils/logger.ts`)

Leverages Node.js `AsyncLocalStorage` (`requestLogStorage`):
- When routes log via `ctx.logger.info(...)` or `console.log`, logs are collected in memory for the duration of the request.
- The global `.afterResponse()` hook in `src/index.ts` prints the HTTP access log line and flushes the grouped logs underneath it, preventing interleaved log lines in high-concurrency environments.

### 4. Other Utilities
- `auth-crypto.ts`: Password hashing (PBKDF2/scrypt), Argon2, and JWT signing/verification.
- `dev-account.ts`: Development environment auto-seeder creating a dev administrator user and writing a non-expiring API key to `dev-account.json`.
- `mailer.ts`: Nodemailer transporter with HTML template rendering.
- `s3.ts`: S3 client wrapper for object storage.

---

## 5. Plugins (`src/plugins`)

Elysia plugins configure server-wide middleware and decorate contexts in `apps/elysia/src/index.ts`:

### Built-in Core Plugins

1. **`session` (`src/plugins/session.ts`)**:
   - Resolves caller identity in priority order:
     1. `Authorization: Bearer <token>` (JWT or database API key)
     2. Cookies (`__Secure-next-auth.session-token` or `next-auth.session-token`)
     3. Header (`x-api-key` or `api-key`)
   - Binds `ctx.session` with helpers: `session.isAuthenticated`, `session.getUser()`, `session.hasPermission(flag)`.
   - Auto-bypasses permission checks for users with `IRISFlags.ADMINISTRATOR`.
2. **`rateLimiter` (`src/plugins/rate-limiter.ts`)**:
   - In-memory zero-dependency **Token Bucket** rate limiting.
   - Multi-tier identity resolution: `usr:<id>` $\rightarrow$ `key:<keyId>` $\rightarrow$ `dev:<ip>:<deviceId>` $\rightarrow$ `ip:<ip>:<uaHash>`.
   - Returns RFC-compliant headers: `ratelimit-limit`, `ratelimit-remaining`, `retry-after`.
3. **`cron` (`src/plugins/cron.ts`)**:
   - High-precision, zero-dependency task scheduler replacing broken `@elysia/cron`.
   - Bound to `store.cron[name]` with helper builders in `Patterns`.
   - Standalone `schedule()` API for jobs outside plugin definitions.
4. **`cors` (`src/plugins/cors.ts`)**:
   - Handles credentialed cross-origin requests with origin matching rules, preflight caching (`maxAge`), and header reflection.

---

## 6. Router & Manifest Generation (`src/router`)

The file-based router bridges dynamic filesystem routes with Elysia's static type system.

### Runtime Route Loader (`src/router/index.ts`)

Called during server boot (`await createRouterModule()`):
1. Recursively traverses `src/modules/` via `findRouteFiles()`.
2. Parses URL paths and dynamic parameters.
3. Dynamically imports each route module.
4. Validates and merges `cacheKeys` into a global registry.
5. Mounts route handlers and method-level rate limiters onto an internal Elysia router instance.

### Static Code Generator (`src/router/generator.ts`)

Generates two critical files:
1. `src/router/routes.generated.ts`: Statically imports all route files and chains `.get()`, `.post()`, etc. on an Elysia instance. This enables **Eden Treaty** to infer full client types without running runtime code.
2. `src/router/cache-keys.generated.ts`: Emits the typed `GlobalCacheKeyStorage` interface for cross-route cache keys.

> [!TIP]
> **Idempotent Write Protection**:
> `generator.ts` checks if file content has changed before writing:
> ```typescript
> if (fs.existsSync(outputFile) && fs.readFileSync(outputFile, "utf-8") === fileContent) {
>   return; // Content unchanged, prevent bun --watch restart loop
> }
> ```

### API Client Synchronization (`src/router/insomnium.ts`)

Generates `insomnium.json` containing pre-configured request collections, complete with sample JSON bodies and development API keys for instant API testing.

---

## 7. Fast End-to-End (E2E) Type Safety with Eden Treaty

IRIS achieves type safety between backend and frontend without slowing down build times or developer workflows.

### Client-Side Consumption

In `apps/web/lib/elysia.ts`, Eden Treaty consumes `App = typeof routes`:

```typescript
// apps/web/lib/elysia.ts
import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "@IRIS/elysia";

export const elysia = treaty<App>("http://localhost:4000", {
  fetch: { credentials: "include" },
});
```

Using the client in frontend components or Server Actions:
```typescript
// Frontend: Fully type-checked at compile time
const { data, error } = await elysia.items({ id: 42 }).get({
  query: { details: true },
});

if (error) {
  console.error("Error status:", error.status, error.value);
} else {
  console.log("Item title:", data.data.title); // fully typed
}
```

### Why IRIS E2E Type Safety is Fast

1. **Pre-Generated Static Route Manifest**: Because `routes.generated.ts` chains all routes into a single typed Elysia instance, TypeScript inspects an existing type AST rather than dynamically evaluating runtime filesystem lookups on every request.
2. **Decoupled Route Definition Types**: In `src/router/types.ts`, `defineRoute()` casts the returned object to `DefinedRoute<S, K>`, severing circular references between Elysia's `Context` and route return types. This prevents TypeScript compiler slowdowns.
3. **Zero-Overhead Schema Compilation**: Elysia uses TypeBox (`t`), which compiles validation schemas into optimized JavaScript validator functions at startup, executing at native speed in Bun (>250k req/sec) without runtime parse latency.

---

## 8. Elysia 2.0 Beta Gotchas, Nuances & Troubleshooting

We are running `elysia@2.0.0-beta.6`. Be mindful of these breaking changes and architectural fixes:

### 1. WebSocket Import
- **Do NOT use** `@elysiajs/websocket` (Elysia 1.x plugin).
- **Use native** `elysia/websocket` (or `elysia/ws`):
  ```typescript
  import { websocket } from "elysia/websocket";
  app.use(websocket()).ws("/ws", { ... });
  ```

### 2. BigInt JSON Serialization
- PostgreSQL/Prisma query results often contain native `BigInt` values. Native `JSON.stringify()` throws `TypeError: Do not know how to serialize a BigInt`.
- Fixed globally in `src/index.ts`:
  ```typescript
  (BigInt.prototype as any).toJSON = function () {
    const intVal = Number(this);
    return Number.isSafeInteger(intVal) ? intVal : this.toString();
  };
  ```

### 3. Response Status Propagation
- When returning a standard Web standard `Response` object inside a route handler, Elysia 2.0 beta might not automatically synchronize `ctx.set.status`:
  ```typescript
  const res = await handler.call(instance, ctx);
  if (res instanceof Response) {
    ctx.set.status = res.status;
  }
  return res;
  ```

### 4. Avoiding Watch Loops During Manifest Generation
- When `fs.watch` detects changes in `src/modules/`, it triggers `generateRoutes()`.
- If `generateRoutes()` overwrites `routes.generated.ts` unconditionally, the timestamp changes, triggering `bun --watch` or Turbopack in an infinite restart loop.
- **Rule**: Always compare disk content before calling `fs.writeFileSync`.

### 5. CLI Route Scaffolding
- Always use the CLI generator to scaffold new routes to ensure schemas, tests, and manifests stay in sync:
  ```bash
  pnpm route:create "items/[id]" -m core -X GET,PUT --auth
  ```

---

## 9. Companion Backend Skills Directory

For detailed implementations of specific sub-systems, refer to these dedicated companion skills:

| Skill | Path | Description |
|---|---|---|
| **`IRIS-elysia/createRoute`** | [SKILL.md](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-createRoute/SKILL.md) | CLI scaffolding guide for file-based routes (`pnpm route:create`) |
| **`IRIS-elysia/cron`** | [SKILL.md](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-cron/SKILL.md) | Background task scheduler, cron patterns, and programmatic jobs |
| **`IRIS-elysia/rateLimiter`**| [SKILL.md](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-rateLimiter/SKILL.md) | Token Bucket rate limiter with multi-tier identity resolution |
| **`IRIS-elysia/session`** | [SKILL.md](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-session/SKILL.md) | Multi-source authentication resolver (JWT, cookies, API keys) |
| **`IRIS-cache`** | [SKILL.md](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-cache/SKILL.md) | Distributed Redis caching with in-memory LRU fallback |
| **`IRIS-permissions`** | [SKILL.md](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-permissions/SKILL.md) | Bitfield RBAC permission flags and validation |
| **`IRIS-connections`** | [SKILL.md](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-connections/SKILL.md) | Third-party integrations, OAuth, and credential encryption |

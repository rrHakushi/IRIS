---
name: IRIS-elysia/createRoute
description: Guide for scaffolding new file-based Elysia routes in IRIS using the CLI generator script (`pnpm route:create`). Use when creating, generating, or scaffolding new Elysia endpoints.
---

# IRIS Elysia Route Scaffolding Guide

The IRIS Route Generator (`pnpm route:create`) scaffolds strongly-typed, file-based Elysia routes with validation schemas, authentication guards, and rate limiting templates, while automatically synchronizing Eden Treaty and Insomnium manifests.

---

## 1. Quick Start

Run the generator from the repository root:

```bash
# Interactive mode (prompts for module, path, methods, auth)
pnpm route:create

# Direct CLI scaffolding with generic entity path
pnpm route:create "items/[id]" -m core -X GET,POST,PUT --auth
```

---

## 2. CLI Options

| Flag | Description | Default |
|---|---|---|
| `route-path` | Target URL path (e.g. `items/[id]` or `metrics`) | Prompts |
| `-m, --module <name>` | Target module in `apps/elysia/src/modules/` | `core` |
| `-X, --methods <list>` | Comma-separated HTTP methods (`GET,POST,DELETE`) | `GET` |
| `-a, --auth` | Adds session authentication guard | `false` |
| `--admin` | Adds `ADMINISTRATOR` permission check | `false` |
| `-r, --rate-limit <n>` | Route-level token capacity per minute (e.g. `15`) | None |
| `-f, --force` | Overwrite existing `route.ts` | `false` |
| `-h, --help` | Show CLI help message | |

---

## 3. Common Recipes

### 1. Simple Public GET Route
```bash
pnpm route:create health -m system -X GET
```
Generates `apps/elysia/src/modules/system/health/route.ts` with pagination query schema.

### 2. CRUD Route with Path Parameter & Auth
```bash
pnpm route:create "items/[id]" -m resources -X GET,PUT,DELETE --auth
```
- Automatically infers `id: t.Number({ minimum: 1 })` into `schema.params`.
- Omits `body` from `GET` handler while including `body` in `PUT` handler.
- Adds `if (!session.isAuthenticated) return 401`.

### 3. Admin-Only Endpoint with Custom Rate Limiting
```bash
pnpm route:create "admin/audit-logs" -m identity -X GET --admin -r 10
```
- Adds `if (!session.hasPermission(IRISFlags.ADMINISTRATOR)) return 403`.
- Injects `rateLimit: { capacity: 10, duration: 60000 }`.

---

## 4. Automatic Manifest Synchronization

Every time `pnpm route:create` runs, it automatically executes:
1. `generateRoutes()`: Updates `apps/elysia/src/router/routes.generated.ts` for instant Eden Treaty client types (`elysia.items({ id: 1 }).get()`).
2. `generateInsomniumConfig()`: Updates `apps/elysia/insomnium.json` with pre-filled test requests.

---

## 5. Related Backend Skills

- [IRIS-elysia](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia/SKILL.md): Master backend architecture guide covering modules, services, utils, plugins, router, and Elysia 2.0 beta.
- [IRIS-elysia/cron](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-cron/SKILL.md): Background job scheduling.
- [IRIS-elysia/rateLimiter](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-rateLimiter/SKILL.md): Token Bucket rate limiting.
- [IRIS-elysia/session](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-session/SKILL.md): Authentication and session resolution.


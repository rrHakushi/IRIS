---
name: IRIS-elysia/session
description: Guide for authentication and session resolution in IRIS (@IRIS/elysia) across Bearer tokens, NextAuth cookies, and API keys. Use when working with Elysia session, currentUser, API keys, dev account, or endpoint security.
---

# IRIS Elysia Session Plugin Guide

The IRIS Elysia Session Plugin (`@IRIS/elysia`) is a unified, multi-source authentication resolver that bridges NextAuth cookies, Bearer JWTs, and database-backed API keys into a single typed `session` object on every request.

---

## 1. Core Architecture & Features

- **Multi-Source Authentication**: Automatically inspects and resolves credentials in priority order:
  1. **Bearer Token** (`Authorization: Bearer <token>`): Decodes JWT tokens or database API keys.
  2. **NextAuth Cookies**: Reads `__Secure-next-auth.session-token` (HTTPS) and `next-auth.session-token` (HTTP/Dev).
  3. **API Key Header**: Inspects `x-api-key` and `api-key` headers.
- **Unified `SessionContext`**: Provides consistent helpers across all authentication methods:
  - `session.status`: `"authenticated" | "unauthenticated" | "invalid"`
  - `session.method`: `"bearer" | "cookie" | "api_key" | "none"`
  - `session.getUser()`: Returns the Prisma `User` record or `null`.
  - `session.getApiKey()`: Returns the Prisma `ApiKey` record or `null`.
  - `session.isAuthenticated()`: Boolean check.
  - `session.hasPermission(flag)`: Checks permissions against `@IRIS/permissions`.
- **Automatic Dev Account & Insomnium Sync**:
  - In development mode, automatically provisions a dedicated `dev` account with full `ADMINISTRATOR` privileges and a non-expiring API key stored in `dev-account.json`.
  - Automatically writes and updates Insomnium workspace environment files with the active API key.

---

## 2. Using Session in File-Based Routes

Every file-based route handler in `apps/elysia/src/modules/` receives `session` in its context:

```typescript
// apps/elysia/src/modules/user/[id]/profile/route.ts
import { defineRoute, t } from "@/router";

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number(),
    }),
  },

  async GET({ params, session, prisma }) {
    // 1. Guard against unauthenticated calls
    if (!session.isAuthenticated()) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    // 2. Access the resolved user
    const currentUser = session.getUser();
    console.log("Logged-in user:", currentUser?.username);
    console.log("Auth method:", session.method); // "bearer" | "cookie" | "api_key"

    // 3. Return protected user data
    return {
      userId: params.id,
      currentUser: currentUser?.username,
      authMethod: session.method,
      status: session.status,
    };
  },
});
```

---

## 3. Session Resolution Hierarchy

```
Incoming Request
       │
       ├─► Authorization: Bearer <token>
       │        ├─► Is JWT? ──────────────► Verify & Resolve User
       │        └─► Is API Key? ──────────► Query DB for ApiKey & User
       │
       ├─► Cookies: (next-auth.session-token)
       │        └─► Decode NextAuth JWT ──► Query DB for Session & User
       │
       ├─► Headers: (x-api-key / api-key)
       │        └─► Query DB ─────────────► Validate Key, Scope & Expiry
       │
       └─► None matched ──────────────────► session.status = "unauthenticated"
```

---

## 4. `SessionContext` API Reference

| Property / Method | Return Type | Description |
|---|---|---|
| `session.status` | `"authenticated" \| "unauthenticated" \| "invalid"` | Current authentication state |
| `session.method` | `"bearer" \| "cookie" \| "api_key" \| "none"` | Detected authentication mechanism |
| `session.token` | `string \| null` | Raw extracted token or key |
| `session.getUser()` | `User \| null` | Prisma `User` record associated with the request |
| `session.getApiKey()` | `ApiKey \| null` | Prisma `ApiKey` record if authenticated via API key |
| `session.isAuthenticated()` | `boolean` | `true` if `status === "authenticated"` |
| `session.hasPermission(flag)` | `boolean` | Verifies bitwise permission against `@IRIS/permissions` (Administrators bypass all checks) |

---

## 5. Development Mode Auto-Seeding (`dev-account.json`)

When running in `NODE_ENV=development`:

1. **Check Cache**: Checks if `dev-account.json` exists on disk.
2. **If missing**:
   - Creates a user `dev` in PostgreSQL with:
     - Password: 16 characters, $\ge 2$ numbers, $\ge 1$ special character.
     - Email: Random temporary email (`dev-<random>@iris.internal`).
     - Permissions: `ADMINISTRATOR` flag (`IRISFlags.ADMINISTRATOR`).
   - Issues a dedicated API key with **no expiration date** (`expiresAt: null`).
   - Persists credentials to `dev-account.json` (gitignored).
3. **If present**:
   - Reads the API key directly from `dev-account.json` without querying or recreating users on every restart.
4. **Insomnium Sync**:
   - Synchronizes the key into the local Insomnium SQLite database (`insomnium.workspace.db`), configuring the `Authorization: Bearer <key>` header automatically so developer requests work out of the box.

---

## 6. Permissions Integration (`@IRIS/permissions`)

The session plugin seamlessly links with `@IRIS/permissions`:

```typescript
import { IRISFlags } from "@IRIS/permissions";

// Inside a route handler
if (!session.hasPermission(IRISFlags.MANAGE_USERS)) {
  return new Response(JSON.stringify({ error: "Forbidden: Missing MANAGE_USERS permission" }), {
    status: 403,
  });
}
```

> [!NOTE]
> If the user has `IRISFlags.ADMINISTRATOR`, `session.hasPermission()` will always return `true` regardless of which flag is requested.

---

## 7. Related Backend Skills

- [IRIS-elysia](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia/SKILL.md): Master backend architecture guide covering modules, services, utils, plugins, router, and Elysia 2.0 beta.
- [IRIS-elysia/createRoute](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-createRoute/SKILL.md): Scaffolding file-based routes via CLI (`pnpm route:create`).
- [IRIS-elysia/cron](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-cron/SKILL.md): Background job scheduling.
- [IRIS-elysia/rateLimiter](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-elysia-rateLimiter/SKILL.md): Token Bucket rate limiting.
- [IRIS-permissions](file:///c:/Users/yki/Documents/GitHub/IRIS/.agents/skills/IRIS-permissions/SKILL.md): Guide for permission checking and RBAC in IRIS via @IRIS/permissions.


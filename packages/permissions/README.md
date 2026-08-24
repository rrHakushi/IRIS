# `@IRIS/permissions`

Unified permission bitfield evaluation and authorization package for the IRIS ecosystem.

Stores permissions as an array of 32-bit integers (`Int[]` in PostgreSQL/Prisma) and provides high-performance BigInt bitmask checks for Next.js Server Components, API routes, and NestJS services.

---

## 1. Core Architecture

- **`IRISFlags`**: Centralized bitwise permission definitions (powered by `bigint` bitmasks).
- **`ADMINISTRATOR`**: Superuser permission (`1n << 0n`) granting unrestricted access.
- **Direct Database Integration**: Evaluates raw `Int[]` integer arrays directly from Prisma (`user.permissions`).
- **Strict TypeScript Types**: Zero `any` or `unknown` types.
- **Null Safety**: API designed with `null`-only handling (no `undefined`).
- **Framework Support**: Standalone helper `hasPermission()`, `IRISBitField` class, and first-class NestJS guards/decorators (`@RequirePermissions()`, `PermissionsGuard`).

---

## 2. Flags & Permissions

| Flag | BigInt Value | Raw DB Value (`Int[]`) | Description |
|---|---|---|---|
| `ADMINISTRATOR` | `1n << 0n` | `[1]` | Grants unrestricted administrative access across all IRIS systems and endpoints. |

---

## 3. Usage Guide

### Basic Permission Checking (`hasPermission`)

In Next.js Server Components, Route Handlers, or services:

```typescript
import { hasPermission, IRISFlags } from "@IRIS/permissions";

// From database user: user.permissions = [1]
const isAdmin = hasPermission(user.permissions, IRISFlags.ADMINISTRATOR);
// true

// Unauthenticated / null user:
const isAuth = hasPermission(null, IRISFlags.ADMINISTRATOR);
// false
```

### Direct `IRISBitField` Class Usage

```typescript
import { IRISBitField, IRISFlags } from "@IRIS/permissions";

// Create from database raw integer array
const bitfield = IRISBitField.fromRaw(user.permissions);

// Check permission
if (bitfield.has(IRISFlags.ADMINISTRATOR)) {
  console.log("User is an administrator");
}

// Mutate permissions
bitfield.add(IRISFlags.ADMINISTRATOR);
console.log(bitfield.raw); // [1]

bitfield.remove(IRISFlags.ADMINISTRATOR);
console.log(bitfield.raw); // []
```

---

## 4. NestJS Integration (`@IRIS/permissions/nestjs`)

### Endpoint Authorization with `@RequirePermissions()`

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { IRISFlags } from "@IRIS/permissions";
import { RequirePermissions, PermissionsGuard } from "@IRIS/permissions/nestjs";

@Controller("admin")
@UseGuards(PermissionsGuard)
export class AdminController {
  @Get("metrics")
  @RequirePermissions(IRISFlags.ADMINISTRATOR)
  public getSystemMetrics() {
    return { status: "operational" };
  }
}
```

---

## 5. Testing & Verification

```bash
# Type check
pnpm run typecheck

# Run unit tests
pnpm run test

# Run demo script
pnpm run demo
```

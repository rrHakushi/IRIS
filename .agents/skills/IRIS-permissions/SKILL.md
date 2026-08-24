---
name: IRIS-permissions
description: Comprehensive guide for permission checking and authorization in IRIS using @IRIS/permissions. Covers IRISFlags (ADMINISTRATOR), IRISBitField, direct Prisma Int[] database array integration, strict TypeScript typing (zero any/unknown, null-only semantics), Next.js Server Components authorization (hasPermission), and NestJS endpoint protection (@RequirePermissions(), PermissionsGuard). Use this skill whenever the user mentions @IRIS/permissions, user permissions, ADMINISTRATOR bypass, role-based/permission-based access control (RBAC), PermissionsGuard in NestJS, hasPermission helper, or asks how to verify permissions in IRIS.
---

# @IRIS/permissions Guide

`@IRIS/permissions` is the unified permission evaluation and authorization package for the IRIS ecosystem. It combines high-performance `bigint` bitwise logic with direct database storage in PostgreSQL/Prisma as 32-bit integer arrays (`Int[]`), providing fast and type-safe permission checks across Next.js Server Components and NestJS controllers.

---

## 1. Core Architecture & Concepts

- **Centralized `IRISFlags`**: Single dictionary containing all bitwise permission flags (each stored as a 64-bit `bigint` bitmask).
- **Direct Database Integration**: Reads and writes raw `Int[]` integer arrays directly from the Prisma `User.permissions` field without needing session token re-serialization.
- **Strictly Typed (Zero `any` / `unknown`)**: All parameters, returns, and generics are explicitly typed.
- **Null Safety**: API methods accept and return `null` rather than `undefined`.
- **Framework Agnostic**: Works out of the box in Next.js Server/Client Components, standalone scripts/workers, and NestJS 11 controllers.
- **NestJS Integration**: Subpath export `@IRIS/permissions/nestjs` providing `@RequirePermissions()` / `@Permissions()` and `PermissionsGuard`.

---

## 2. Permission Flags (`IRISFlags`)

| Flag | BigInt Value | Raw DB Value (`Int[]`) | Description |
|---|---|---|---|
| `ADMINISTRATOR` | `1n << 0n` | `[1]` | Superuser permission granting unrestricted access across all IRIS routes, actions, and services. |

---

## 3. Database Integration (Prisma)

In the IRIS database schema (`packages/database/schema/user.prisma`):

```prisma
model User {
    id          String   @id @default(uuid())
    username    String   @unique @db.Char(32)
    email       String   @unique
    permissions Int[]    @default([])
    // ...
}
```

- Standard users without elevated permissions have `permissions = []`.
- Users granted `ADMINISTRATOR` have `permissions = [1]`.

---

## 4. Next.js & Server Component Usage

### Using `hasPermission` Helper

The `hasPermission` utility evaluates permission arrays fetched from the database:

```typescript
import { hasPermission, IRISFlags } from '@IRIS/permissions';

// Example: In a Next.js Server Component or Server Action
export async function AdminDashboard({ user }: { user: { permissions: number[] } | null }) {
  const isAuthorized = hasPermission(
    user?.permissions ?? null,
    IRISFlags.ADMINISTRATOR,
  );

  if (!isAuthorized) {
    return <div>Access Denied. Administrator permissions required.</div>;
  }

  return <div>Welcome to the Admin Dashboard</div>;
}
```

#### Checking by String Flag Key or Arrays:

```typescript
// By Flag Key Name
const isAuthorized = hasPermission(user.permissions, 'ADMINISTRATOR');

// By Array of Flags
const isAuthorized = hasPermission(user.permissions, [IRISFlags.ADMINISTRATOR]);
```

---

## 5. NestJS Integration (`apps/server`)

### Step 1: Protect Endpoints with `@RequirePermissions()` and `PermissionsGuard`

Import guards and decorators from `@IRIS/permissions/nestjs` (or `apps/server/src/common`):

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { IRISFlags } from '@IRIS/permissions';
import { RequirePermissions, PermissionsGuard } from '@IRIS/permissions/nestjs';

@Controller('admin')
@UseGuards(PermissionsGuard)
export class AdminController {
  @Get('metrics')
  @RequirePermissions(IRISFlags.ADMINISTRATOR)
  public getSystemMetrics() {
    return { status: 'operational', timestamp: new Date().toISOString() };
  }
}
```

### Multiple Permissions Operator

You can specify `'all'` (default) or `'any'`:

```typescript
@RequirePermissions([IRISFlags.ADMINISTRATOR], 'any')
@Get('reports')
public getReports() {
  return [];
}
```

---

## 6. Standalone `IRISBitField` Class Reference

For programmatic permission mutations, checks, and bitwise algebra:

```typescript
import { IRISBitField, IRISFlags } from '@IRIS/permissions';

// 1. Instantiate from DB raw array
const userPerms = IRISBitField.fromRaw(user.permissions);

// 2. Check permissions
const isAdmin = userPerms.has(IRISFlags.ADMINISTRATOR); // boolean

// 3. Grant permissions
userPerms.add(IRISFlags.ADMINISTRATOR);
console.log(userPerms.raw); // [1] -> Save userPerms.raw to Prisma DB

// 4. Revoke permissions
userPerms.remove(IRISFlags.ADMINISTRATOR);
console.log(userPerms.raw); // [] -> Save userPerms.raw to Prisma DB

// 5. Inspect granted flag keys
const activeKeys = userPerms.toArray(); // ['ADMINISTRATOR'] or []

// 6. Convert to BigInt
const bitmask = userPerms.toBigInt(); // 1n or 0n
```

---

## 7. API Reference

### `hasPermission(permissions: readonly number[] | number[] | null, permission: IRISBitFieldResolvable, checkType?: 'all' | 'any'): boolean`
Evaluates if a user's permissions array satisfies the required permission check. Returns `false` if `permissions` is `null` or empty.

### `IRISBitField`
- `constructor(resolvable: IRISBitFieldResolvable | null = null)`
- `raw: readonly number[]`: Underlying 32-bit integer array.
- `has(resolvable: IRISBitFieldResolvable): boolean`: Verifies all requested bits are set. Automatically bypasses for administrators.
- `any(resolvable: IRISBitFieldResolvable): boolean`: Verifies at least one requested bit is set.
- `add(...resolvables: readonly IRISBitFieldResolvable[]): this`: Grants permissions.
- `remove(...resolvables: readonly IRISBitFieldResolvable[]): this`: Revokes permissions.
- `toArray(): IRISFlagKey[]`: Returns string names of all active flags.
- `toBigInt(): bigint`: Converts bitfield words to a single BigInt.
- `equals(other: IRISBitFieldResolvable): boolean`: Compares bitfield equality.
- `clone(): IRISBitField`: Creates an independent copy.
- `static fromRaw(raw: readonly number[] | null): IRISBitField`: Rehydrates from database `Int[]`.
- `static fromBigInt(value: bigint | null): IRISBitField`: Rehydrates from BigInt.
- `static resolve(resolvable: IRISBitFieldResolvable | null): number[]`: Polymorphic resolver.

### NestJS Exports (`@IRIS/permissions/nestjs`)
- `@RequirePermissions(flags: IRISBitFieldResolvable | readonly IRISBitFieldResolvable[], operator?: 'all' | 'any')`
- `@Permissions(...)`: Alias for `@RequirePermissions`.
- `PermissionsGuard`: Authorization guard implementing `CanActivate`.

---

## 8. Best Practices

1. **Always use `null` for unauthenticated states**:
   ```typescript
   // Recommended
   const isAuth = hasPermission(session?.user?.permissions ?? null, IRISFlags.ADMINISTRATOR);
   ```

2. **Save `bitfield.raw` directly to Prisma**:
   ```typescript
   await prisma.user.update({
     where: { id: userId },
     data: { permissions: [...bitfield.raw] },
   });
   ```

3. **Check permissions at API boundaries**:
   Use `PermissionsGuard` with `@RequirePermissions(IRISFlags.ADMINISTRATOR)` on all sensitive administrative controllers and endpoints.

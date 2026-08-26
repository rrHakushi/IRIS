---
name: IRIS-permissions
description: Guide for permission checking and RBAC in IRIS via @IRIS/permissions, IRISFlags (ADMINISTRATOR), IRISBitField, Prisma Int[], Next.js, and Elysia session authorization.
---

# @IRIS/permissions Guide

`@IRIS/permissions` is the unified permission evaluation and authorization package for the IRIS ecosystem. It combines high-performance `bigint` bitwise logic with direct database storage in PostgreSQL/Prisma as 32-bit integer arrays (`Int[]`), providing fast and type-safe permission checks across Next.js Server Components and Elysia route handlers.

---

## 1. Core Architecture & Concepts

- **Centralized `IRISFlags`**: Single dictionary containing all bitwise permission flags (each stored as a 64-bit `bigint` bitmask).
- **Direct Database Integration**: Reads and writes raw `Int[]` integer arrays directly from the Prisma `User.permissions` field without needing session token re-serialization.
- **Strictly Typed (Zero `any` / `unknown`)**: All parameters, returns, and generics are explicitly typed.
- **Null Safety**: API methods accept and return `null` rather than `undefined`.
- **Framework Agnostic**: Works out of the box in Next.js Server/Client Components, Elysia endpoints, standalone scripts, and workers.

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

## 4. Elysia 2.0 Route Authorization (`@IRIS/elysia`)

In Elysia route handlers, permissions are evaluated directly against the request's typed `session`:

```typescript
import { defineRoute } from "@/router";
import { IRISFlags } from "@IRIS/permissions";

export default defineRoute({
  async GET({ session }) {
    // Check permission (ADMINISTRATOR automatically bypasses all checks)
    if (!session.hasPermission(IRISFlags.ADMINISTRATOR)) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin required" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    return { status: "admin-access-granted" };
  },
});
```

> [!TIP]
> You can scaffold admin-guarded routes automatically using the CLI:
> `pnpm route:create "admin/settings" -m IRIS-account --admin`

---

## 5. Next.js & Server Component Usage

### Using `hasPermission` Helper

The `hasPermission` utility evaluates permission arrays fetched from the database:

```typescript
import { hasPermission, IRISFlags } from "@IRIS/permissions";

// In a Next.js Server Component or Server Action
export async function AdminDashboard({ user }: { user: { permissions: number[] } | null }) {
  const isAuthorized = hasPermission(
    user?.permissions ?? null,
    IRISFlags.ADMINISTRATOR,
  );

  if (!isAuthorized) {
    return <div>Access Denied: Administrator role required.</div>;
  }

  return <div>Welcome to Admin Panel</div>;
}
```

### Multiple Permissions Evaluation

```typescript
import { hasPermission, IRISFlags } from "@IRIS/permissions";

// Match ALL flags
const hasAll = hasPermission(user.permissions, [IRISFlags.ADMINISTRATOR], "all");

// Match ANY flag
const hasAny = hasPermission(user.permissions, [IRISFlags.ADMINISTRATOR], "any");
```

---

## 6. Standalone `IRISBitField` Class Reference

For programmatic permission mutations, checks, and bitwise algebra:

```typescript
import { IRISBitField, IRISFlags } from "@IRIS/permissions";

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

## 7. Full API Reference

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

---

## 8. Best Practices

1. **Always use `null` for unauthenticated states**:
   ```typescript
   const isAuth = hasPermission(session?.user?.permissions ?? null, IRISFlags.ADMINISTRATOR);
   ```

2. **Save `bitfield.raw` directly to Prisma**:
   ```typescript
   await prisma.user.update({
     where: { id: userId },
     data: { permissions: [...bitfield.raw] },
   });
   ```

3. **Check permissions at Elysia route boundaries**:
   Use `session.hasPermission(IRISFlags.ADMINISTRATOR)` at the top of any sensitive route handlers.

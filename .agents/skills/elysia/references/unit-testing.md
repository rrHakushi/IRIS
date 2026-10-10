# Elysia Unit Testing with Eden Treaty

In IRIS, **Eden Treaty (`treaty(app)`) is the mandatory standard for testing all routes and controllers**.

> [!IMPORTANT]
> **Strict Mandate: Only Use Eden for Calling Routes**
> Never use raw `app.handle(new Request(...))` or `fetch()` in route tests. Calling routes via `treaty(app)` ensures 100% end-to-end type safety, autocompletion, compile-time schema validation, and in-memory execution without network socket overhead.

---

## 1. Why Eden Treaty is Mandatory for Testing

| Capability | Eden Treaty (`treaty(app)`) | Raw `app.handle(new Request(...))` |
| :--- | :--- | :--- |
| **Type Safety** | ✅ Full compile-time input & output types | ❌ Untyped string URLs, untyped response |
| **Refactor Safety** | ✅ Renamed routes/params cause compile errors | ❌ Silent runtime test failures |
| **Body & Query Autocomplete** | ✅ Exact schema types enforced by IDE | ❌ Manual `JSON.stringify` serialization |
| **Execution Speed** | ✅ In-memory direct call (no TCP socket) | ✅ In-memory direct call |
| **Status-Based Type Narrowing** | ✅ Automatically narrows `data` vs `error` | ❌ Manual status check & response parsing |

---

## 2. Basic Setup with `bun:test`

Import `treaty` from `@elysiajs/eden` (or `@elysia/eden`) and pass the Elysia instance directly:

```typescript
// test/modules/auth.test.ts
import { describe, expect, it } from 'bun:test'
import { treaty } from '@elysiajs/eden'
import { auth } from '@/modules/auth'

// Pass controller directly — runs in-memory without starting a live server
const api = treaty(auth)

describe('Auth Controller', () => {
    it('signs in successfully with valid credentials', async () => {
        const { data, error, status } = await api.auth['sign-in'].post({
            username: 'yuuno',
            password: 'securePassword123'
        })

        expect(status).toBe(200)
        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data?.username).toBe('yuuno')
        expect(data?.token).toBeDefined()
    })
})
```

Run tests using Bun:

```bash
bun test
```

---

## 3. Testing Patterns

### 1. Negative Tests & Error Responses
When an endpoint returns a non-2xx status code, Eden Treaty populates `error` and narrows types based on your route's `response` schema:

```typescript
it('returns 400 when given invalid credentials', async () => {
    const { data, error, status } = await api.auth['sign-in'].post({
        username: 'yuuno',
        password: 'wrongPassword'
    })

    expect(status).toBe(400)
    expect(data).toBeNull()
    expect(error).toBeDefined()
    expect(error?.value).toBe('Invalid username or password')
})
```

### 2. Path Parameters & Query Parameters
Eden Treaty generates strongly typed method signatures for dynamic routes:

```typescript
import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'

const userModule = new Elysia({ prefix: '/users' })
    .get('/:id', ({ params: { id }, query }) => ({
        id,
        includeDetails: query.details === 'true'
    }), {
        params: t.Object({ id: t.String() }),
        query: t.Object({ details: t.Optional(t.String()) })
    })

const api = treaty(userModule)

it('fetches user with path params and query', async () => {
    const { data, status } = await api.users({ id: 'usr_42' }).get({
        query: { details: 'true' }
    })

    expect(status).toBe(200)
    expect(data?.id).toBe('usr_42')
    expect(data?.includeDetails).toBe(true)
})
```

### 3. Headers & Authenticated Testing
Pass headers on a per-request basis or create an authenticated client instance:

```typescript
// Per-request headers
it('accepts custom headers', async () => {
    const { data, status } = await api.protected.get({
        headers: {
            authorization: 'Bearer valid_jwt_token'
        }
    })

    expect(status).toBe(200)
})

// Scoped authenticated client
const authedApi = treaty(app, {
    headers: {
        authorization: 'Bearer test_token'
    }
})
```

### 4. Inspecting Response Headers & Cookies
Eden Treaty returns the raw `response` object alongside typed `data` and `error`:

```typescript
it('sets session cookie header', async () => {
    const { status, response } = await api.auth['sign-in'].post({
        username: 'yuuno',
        password: 'password123'
    })

    expect(status).toBe(200)
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('session=')
})
```

---

## 4. Testing Scope: Controller vs Full App

### Isolated Feature Controller (Recommended for Unit Tests)
Test the feature module in isolation without bootstrapping the entire application:

```typescript
import { auth } from '@/modules/auth'
const api = treaty(auth)
```
- **Fastest execution**: Only boots routes, services, and hooks registered on `auth`.
- **Decoupled**: Tests do not break when unrelated modules change.

### Full Root Application (Recommended for Integration Tests)
Test the entire mounted server including global plugins, root OpenAPI, and CORS:

```typescript
import { app } from '@/index'
const api = treaty(app)
```
- **End-to-end integration**: Tests cross-module middleware, global `onError`, and full prefix resolution.

---

## 5. Type-Level Testing (`tsc --noEmit`)

Because Eden Treaty provides compile-time verification, run TypeScript checks across your test files to catch regressions:

```bash
tsc --noEmit test/**/*.test.ts
```

If a backend route changes its input payload or response signature, TypeScript immediately flags the invalid test call during CI before runtime tests are even executed.

---
name: elysia
description: Master architectural and implementation guide for ElysiaJS (v2) in IRIS (@IRIS/elysia, Bun). Use whenever creating, reviewing, refactoring, or building backend routes, controllers, services, TypeBox validation schemas, lifecycle hooks, plugins, guards, error handling, OpenAPI documentation, or writing unit tests with Eden Treaty. Enforces decoupled MVC feature-based modules (controller/service/model), static abstract service classes, single-source-of-truth TypeBox validation, never-throw HTTP status response handling, strict end-to-end type safety, and exclusive use of Eden Treaty for testing routes.
---

# IRIS ElysiaJS (v2) Architecture & Development Guide

`@IRIS/elysia` is the high-performance backend powering the IRIS ecosystem, built on **Bun** and **ElysiaJS v2**.

---

## 1. Golden Rules (Non-Negotiable)

### 1. Feature-Based Modular Architecture (Controller / Service / Model)
Every domain feature lives in `apps/elysia2/src/modules/<feature>/` with three distinct files:
- **`index.ts` (Controller)**: Handles HTTP routes, prefixes, cookies, and binds DTO schemas.
- **`service.ts` (Service)**: Implements business logic, database queries, and external APIs. Decoupled from Elysia `Context`.
- **`model.ts` (Model)**: Single source of truth for runtime validation and static TypeScript types.

### 2. 1 Elysia Instance = 1 Controller (Never Pass `Context` to Controller Classes)
- **Always define routes directly on Elysia instances**:
  ```typescript
  export const auth = new Elysia({ prefix: '/auth' })
      .post('/sign-in', ({ body }) => Auth.signIn(body))
  ```
- **Never create a controller class that accepts `Context`**: `Context` is deeply dynamic and heavily inferred through plugins. Manually annotating `Context` breaks type inference and Eden Treaty client types.

### 3. Use `abstract class` with `static` Methods for Services
- Services without internal state should be `abstract class` with `static` methods to avoid unnecessary object allocation on every request:
  ```typescript
  export abstract class Auth {
      static async signIn({ username, password }: AuthModel['signInBody']) { ... }
  }
  ```

### 4. Single Source of Truth Validation (`Elysia.t` / TypeBox)
- Never create separate TypeScript interfaces for request bodies or query params.
- Define schemas with `t.Object`, `t.String`, `t.Number`, and derive types using `UnwrapSchema`:
  ```typescript
  export const UserModel = {
      user: t.Object({ id: t.String(), name: t.String() })
  } as const

  export type UserModel = {
      [K in keyof typeof UserModel]: UnwrapSchema<typeof UserModel[K]>
  }
  ```

### 5. Enforce Explicit Response Schemas Per Status Code
- Always declare response schemas for both success and error status codes (`response: { 200: ..., 400: ... }`).
- This allows Eden Treaty in `@IRIS/web` to automatically narrow types without casting.

### 6. Never-Throw Response Handling in Route Handlers
- Return `status(code, data)` instead of throwing errors for expected business outcomes (e.g. 400, 404).
- Throwing exceptions is reserved for unexpected failures or deep service errors caught by `onError`.

### 7. Explicit Dependencies & Scoped Plugins
- Give reusable plugins a `name` for deduplication.
- Remember that lifecycle hooks are **isolated to their instance by default** (`local`). To share hooks with parents, explicitly export them via `{ as: 'scoped' }` or `.as('scoped')`.

### 8. Unit Testing: Exclusively Use Eden Treaty (`treaty(app)`)
- When testing routes or controllers, pass the Elysia instance directly to Eden Treaty (`treaty(app)` or `treaty(controller)`).
- **Never use raw `app.handle(new Request(...))` or `fetch()`** for calling routes. Eden Treaty executes requests in-memory without TCP overhead while providing 100% compile-time type safety, IDE autocompletion, and status-based type narrowing.

---


## 2. Canonical Module Pattern

### `model.ts` (DTOs & Types)
```typescript
import { t, type UnwrapSchema } from 'elysia'

export const AuthModel = {
    signInBody: t.Object({
        username: t.String({ minLength: 3 }),
        password: t.String({ minLength: 8 })
    }),
    signInResponse: t.Object({
        username: t.String(),
        token: t.String()
    }),
    signInInvalid: t.Literal('Invalid username or password')
} as const

export type AuthModel = {
    [K in keyof typeof AuthModel]: UnwrapSchema<typeof AuthModel[K]>
}
```

### `service.ts` (Business Logic)
```typescript
import { status } from 'elysia'
import type { AuthModel } from './model'

export abstract class Auth {
    static async signIn({ username, password }: AuthModel['signInBody']) {
        const user = await sql`SELECT id, password FROM users WHERE username = ${username} LIMIT 1`

        if (!user || !(await Bun.password.verify(password, user.password))) {
            throw status(400, 'Invalid username or password' satisfies AuthModel['signInInvalid'])
        }

        return {
            username,
            token: await generateSessionToken(user.id)
        }
    }
}
```

### `index.ts` (Controller)
```typescript
import { Elysia } from 'elysia'
import { Auth } from './service'
import { AuthModel } from './model'

export const auth = new Elysia({ prefix: '/auth' })
    .post(
        '/sign-in',
        {
            body: AuthModel.signInBody,
            response: {
                200: AuthModel.signInResponse,
                400: AuthModel.signInInvalid
            }
        },
        async ({ body, cookie: { session } }) => {
            const response = await Auth.signIn(body)

            // Elysia cookie is a Proxy object; always defined
            session.value = response.token

            return response
        }
    )
```

---

## 3. Quick Reference & Cheatsheet

### Context Destructuring
```typescript
app.get('/example/:id', ({
    params: { id },          // Route parameters (:id, *)
    query,                   // Query parameters (?key=val)
    body,                    // Parsed body (JSON, FormData, text)
    headers,                 // Request headers (all keys lower-case)
    cookie: { session },     // Cookie signal proxy (read .value, write .value = x)
    status,                  // Typed status helper: status(201, data)
    set,                     // Mutable headers & status: set.headers['x-key'] = 'val'
    redirect,                // Redirect helper: redirect(url, 302)
    request,                 // Web Standard Request object
    server                   // Bun Server instance (server.requestIP(request))
}) => { ... })
```

### Response Helpers
- **Return custom status**: `return status(201, { id })`
- **Set response header**: `set.headers['content-type'] = 'application/json'`
- **Redirect**: `return redirect('/login', 302)`
- **Serve file**: `import { file } from 'elysia'; return file('path/to/asset.png')`
- **Return FormData**: `import { form, file } from 'elysia'; return form({ file: file('...') })`
- **Streaming**:
  ```typescript
  app.get('/stream', function* () {
      yield 'chunk 1\n'
      yield 'chunk 2\n'
  })
  ```
- **Server-Sent Events (SSE)**:
  ```typescript
  import { sse } from 'elysia'
  app.get('/sse', function* () {
      yield sse({ event: 'ping', data: 'hello' })
  })
  ```

### Cookie Helpers
- **Read cookie**: `session.value`
- **Set cookie**: `session.value = 'token'`
- **Configure attributes**: `session.httpOnly = true; session.secure = true; session.maxAge = 86400`
- **Batch set / add**: `session.set({ httpOnly: true, secure: true })` / `session.add({ maxAge: 3600 })`
- **Delete cookie**: `session.remove()` or `delete cookie.session`
- **Cookie Schema**: `cookie: t.Cookie({ session: t.Optional(t.String()) })` (eliminates need for non-null `!` assertion)

---

## 4. Deep-Dive References

When working on specific subsystems, consult the corresponding reference document:

- **Architecture & Separation of Concerns**:
  [references/best-practices.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/best-practices.md)
  *MVC feature modules, service abstract classes, request vs non-request services, dependency management.*

- **Unit Testing with Eden Treaty**:
  [references/unit-testing.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/unit-testing.md)
  *Exclusively using `treaty(app)` for testing routes, negative status checks, param/query handling, auth headers, and type-level checks (`tsc --noEmit`).*

- **Routing, Pathing & Handlers**:
  [references/routing-handlers.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/routing-handlers.md)
  *Dynamic params, wildcards, priority rules, custom verbs (`.route()`), streaming, SSE, and context API.*

- **Validation, TypeBox & Schemas**:
  [references/validation-typebox.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/validation-typebox.md)
  *Elysia.t types (`Numeric`, `File`, `Cookie`, `UnionEnum`), automatic coercion, Standard Schema (Zod), and reference models (`.model()`).*

- **Cookie Management & Signatures**:
  [references/cookies.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/cookies.md)
  *Reactive cookies, auto-JSON serialization, cookie schemas (`t.Cookie`), cryptographic signing, key rotation, and security attributes.*

- **Request Lifecycle & Middleware**:
  [references/lifecycle-middleware.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/lifecycle-middleware.md)
  *8 lifecycle stages in order (`onRequest`, `onParse`, `onTransform`/`derive`, validation, `onBeforeHandle`/`resolve`, handler, `onAfterHandle`, `mapResponse`, `onAfterResponse`), PreContext, hook registration ordering.*

- **Plugins, Dependency Injection & Scoping**:
  [references/plugins-scope.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/plugins-scope.md)
  *Plugin deduplication with `name`, scope isolation (`local`, `scoped`, `global`), scope lifting with `.as()`, guards, and deferred modules.*

- **Error Handling & Validation Formatting**:
  [references/error-handling.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/error-handling.md)
  *`onError` hook, built-in error codes, custom error classes, `validationDetail`, production security (`allowUnsafeValidationDetails`), throwing vs returning `status()`.*

- **OpenAPI, Scalar & Documentation**:
  [references/openapi.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/openapi.md)
  *Scalar UI, `fromTypes()`, route `detail`, response headers with `withHeader`, Standard Schema mappings (`zod`, `valibot`, `effect`), and security schemes (bearerAuth).*



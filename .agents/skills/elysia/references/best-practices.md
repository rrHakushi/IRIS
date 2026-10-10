# Elysia Best Practices & Architecture

This guide details the recommended architectural patterns, directory conventions, and separation of concerns when building backend services with ElysiaJS in the IRIS monorepo.

---

## 1. Feature-Based Directory Structure

Elysia is pattern-agnostic, but in IRIS we follow a **feature-based modular structure** combining the Model-View-Controller (MVC) pattern adapted for Elysia's type system:

```
src/
├── index.ts                 # Root Elysia server, global plugins, module registration
├── modules/
│   ├── auth/
│   │   ├── index.ts         # Elysia controller / router (HTTP, cookies, schemas)
│   │   ├── service.ts       # Business logic (DB queries, password hashing, tokens)
│   │   └── model.ts         # TypeBox schemas (DTOs) & TypeScript types
│   ├── user/
│   │   ├── index.ts
│   │   ├── service.ts
│   │   └── model.ts
│   └── ...
└── utils/                   # Shared helpers, database client, logger
```

### File Responsibilities

| File | Role | Responsibilities |
|---|---|---|
| `index.ts` (Module) | **Controller** | Defines route endpoints, HTTP verbs, attaches DTO schemas, handles cookies, and delegates to Service. |
| `service.ts` | **Service** | Executes business logic, database queries, hashing, external API calls. Decoupled from Elysia `Context`. |
| `model.ts` | **Model / DTO** | Single source of truth for runtime validation and static TypeScript types using `t.Object` and `UnwrapSchema`. |

---

## 2. Canonical Module Implementation

### Model: `src/modules/auth/model.ts`

Define request and response schemas using Elysia's `t` builder, and export TypeScript types using `UnwrapSchema`:

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

// Derive static TypeScript types from schemas
export type AuthModel = {
    [k in keyof typeof AuthModel]: UnwrapSchema<typeof AuthModel[k]>
}
```

### Service: `src/modules/auth/service.ts`

Isolate business logic inside static methods on an `abstract class`. This avoids unnecessary object allocations on every request:

```typescript
import { status } from 'elysia'
import type { AuthModel } from './model'

export abstract class Auth {
    static async signIn({ username, password }: AuthModel['signInBody']) {
        const user = await sql`
            SELECT id, password
            FROM users
            WHERE username = ${username}
            LIMIT 1
        `

        if (!user || !(await Bun.password.verify(password, user.password))) {
            // Throwing status() directly propagates an HTTP error to onError
            throw status(
                400,
                'Invalid username or password' satisfies AuthModel['signInInvalid']
            )
        }

        const token = await generateAndSaveTokenToDB(user.id)

        return {
            username,
            token
        }
    }
}
```

### Controller: `src/modules/auth/index.ts`

Treat each module's `new Elysia({ prefix: '...' })` instance as the controller:

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

            // Elysia cookie is a Proxy object; it is always defined
            session.value = response.token

            return response
        }
    )
```

---

## 3. Controller Architecture Rules

### Rule 1: 1 Elysia Instance = 1 Controller

Define routes directly on Elysia instances. Do **NOT** create traditional class controllers that accept `Context`:

```typescript
// ✅ DO: Elysia instance is the controller
import { Elysia } from 'elysia'
import { UserService } from './service'

export const userController = new Elysia({ prefix: '/user' })
    .get('/:id', ({ params: { id } }) => UserService.findById(id))

// ❌ DON'T: Traditional controller class taking Context
import { type Context } from 'elysia'

abstract class UserController {
    static getById(context: Context) {
        return UserService.findById(context.params.id) // Breaks type soundness!
    }
}
```

**Why**: Elysia's `Context` is highly dynamic and heavily derived through type-level chaining (decorators, store, plugins, derive). Attempting to manually annotate `Context` destroys type inference, breaks Eden Treaty client safety, and causes brittle type errors.

### Rule 2: NEVER Pass Entire `Context` to Services

Services should receive only the specific typed arguments they need:

```typescript
// ✅ DO: Pass destructured arguments
new Elysia()
    .get('/profile', ({ user }) => UserService.getProfile(user.id))

// ❌ DON'T: Pass context to service
new Elysia()
    .get('/profile', (context) => UserService.getProfile(context))
```

---

## 4. Service Architecture: Request vs Non-Request Services

There are two categories of services:

### 1. Non-Request-Dependent Service (Pure Business Logic)
If a service does not need direct access to HTTP request objects (cookies, IP, raw headers), implement it as an `abstract class` with `static` methods:

```typescript
export abstract class MathService {
    static fibonacci(n: number): number {
        if (n < 2) return n
        return MathService.fibonacci(n - 1) + MathService.fibonacci(n - 2)
    }
}
```

### 2. Request-Dependent Service (Elysia Plugin)
If a service requires request-level context (e.g. session extraction, auth macros, IP extraction), implement it as an Elysia plugin using `.macro()`, `.derive()`, or `.resolve()`:

```typescript
import { Elysia } from 'elysia'

export const AuthService = new Elysia({ name: 'Auth.Service' })
    .macro({
        isSignIn: {
            resolve({ cookie, status }) {
                if (!cookie.session.value) {
                    return status(401, 'Unauthorized')
                }
                return {
                    sessionToken: cookie.session.value
                }
            }
        }
    })

// Usage in controller:
export const user = new Elysia()
    .use(AuthService)
    .get('/me', ({ sessionToken }) => {
        return { token: sessionToken }
    }, {
        isSignIn: true
    })
```

---

## 5. Decorating: Request-Dependent Only

Only use `.decorate()` for request-dependent metadata or singleton utilities. Overusing `.decorate()` creates tight framework coupling:

```typescript
// ✅ DO: Decorate request-dependent properties
new Elysia()
    .decorate('requestIP', ({ request }) => request.headers.get('x-forwarded-for') || request.ip)
    .decorate('requestTime', () => Date.now())

// ❌ DON'T: Decorate standard stateless utility functions that could just be imported
new Elysia()
    .decorate('formatDate', (d: Date) => d.toISOString()) // Just import formatDate!
```

---

## 6. Unit Testing Controllers Exclusively with Eden Treaty

In IRIS, **only use Eden Treaty (`treaty(app)`) to call routes in tests**. Never use raw `app.handle(new Request(...))` or `fetch()`. Passing an Elysia instance to `treaty` executes requests in-memory with complete end-to-end type safety:

```typescript
import { describe, it, expect } from 'bun:test'
import { treaty } from '@elysiajs/eden'
import { auth } from './index'

const api = treaty(auth)

describe('Auth Controller', () => {
    it('returns 200 on valid credentials', async () => {
        const { data, error, status } = await api.auth['sign-in'].post({
            username: 'testuser',
            password: 'password123'
        })

        expect(status).toBe(200)
        expect(error).toBeNull()
        expect(data?.username).toBe('testuser')
        expect(data?.token).toBeDefined()
    })

    it('returns 400 on invalid credentials', async () => {
        const { data, error, status } = await api.auth['sign-in'].post({
            username: 'testuser',
            password: 'wrongpassword'
        })

        expect(status).toBe(400)
        expect(data).toBeNull()
        expect(error?.value).toBe('Invalid username or password')
    })
})
```

For full details, header mocking, and type-level checks, see [references/unit-testing.md](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/references/unit-testing.md).


# Elysia Plugins, Dependency Injection & Scoping

This guide explains how Elysia composes micro-apps into a cohesive server, controls lifecycle encapsulation, deduplicates plugins, and manages scope levels.

---

## 1. Modular Mini-Apps & Explicit Dependencies

Every Elysia instance can run independently as a standalone server or be mounted inside another instance via `.use()`:

```typescript
// auth.ts
import { Elysia } from 'elysia'

export const auth = new Elysia({ prefix: '/auth' })
    .get('/session', ({ cookie }) => cookie.session.value)

// index.ts
import { Elysia } from 'elysia'
import { auth } from './auth'

new Elysia()
    .use(auth)
    .listen(3000)
```

### Explicit vs Global Dependencies

| Dependency Type | When to Use | Examples |
|---|---|---|
| **Global Plugin** | Adds no custom types, or introduces global cross-cutting concerns that every route must have. | CORS, Helmet, OpenTelemetry, Compression, Swagger/OpenAPI. |
| **Explicit Dependency** | Introduces typed context, state, macros, models, or domain business logic. | Auth session, Database client, User module, Cache. |

---

## 2. Plugin Deduplication (Singleton Pattern)

By default, applying a plugin multiple times causes its lifecycle hooks to execute repeatedly.

To convert a plugin into a **deduplicated singleton**, provide a unique `name` (and optional `seed`):

```typescript
export const ipPlugin = new Elysia({ name: 'ip-plugin' })
    .derive({ as: 'global' }, ({ server, request }) => ({
        clientIP: server?.requestIP(request) ?? '127.0.0.1'
    }))

// When router1 and router2 both .use(ipPlugin),
// Elysia deduplicates it so the derive hook runs exactly ONCE per request.
const router1 = new Elysia().use(ipPlugin).get('/r1', ({ clientIP }) => clientIP)
const router2 = new Elysia().use(ipPlugin).get('/r2', ({ clientIP }) => clientIP)

const server = new Elysia()
    .use(router1)
    .use(router2)
```

---

## 3. Scope Hierarchy (`local`, `scoped`, `global`)

Elysia **encapsulates lifecycle hooks within their own instance by default**. A hook in a child instance will NOT leak to the parent unless explicitly exported via its scope level:

```
┌───────────────────────────────────────────────┐
│ Root Instance (Parent)                        │
│                                               │
│   ┌─────────────────────────────────────────┐ │
│   │ Sub-Module (Current)                    │ │
│   │                                         │ │
│   │   ┌───────────────────────────────────┐ │ │
│   │   │ Sub-Route (Child / Descendant)    │ │ │
│   │   └───────────────────────────────────┘ │ │
│   └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

### Scope Levels

| Scope | Visibility | Behavior |
|---|---|---|
| **`local`** *(Default)* | Current + Descendants | Hook applies only to the instance where it is defined and any sub-instances it mounts. Parent instances DO NOT inherit it. |
| **`scoped`** | Parent + Current + Descendants | Hook applies to the current instance, its descendants, and the immediate parent instance that mounts it. |
| **`global`** | Entire Elysia tree | Hook applies to all parents, siblings, and descendants across the whole application. |

---

## 4. Exporting Hooks via Scope Casting

### 1. Inline Scope
Add `{ as: 'scoped' }` or `{ as: 'global' }` to a hook or derive call:

```typescript
export const sessionPlugin = new Elysia({ name: 'session' })
    .derive({ as: 'scoped' }, ({ cookie }) => ({
        sessionUser: cookie.session.value ? decodeSession(cookie.session.value) : null
    }))
```

### 2. Guard Scope
Apply scoping to all hooks and schemas contained in a guard:

```typescript
export const adminGuard = new Elysia()
    .guard({
        as: 'scoped',
        beforeHandle({ currentUser, status }) {
            if (!currentUser?.isAdmin) return status(403, 'Admins only')
        }
    })
```

### 3. Instance Scope Lifting (`.as()`)
Lift all hooks, schemas, and decorators of an entire instance up to `scoped` or `global`:

```typescript
export const metricsPlugin = new Elysia()
    .onBeforeHandle(() => recordHit())
    .as('scoped') // Lifts all lifecycle hooks in this plugin to the mounting parent!
```

---

## 5. Guards & Grouped Guards

### Standalone vs Override Guards

When guards collide, Elysia provides two resolution modes via the `schema` parameter:

1. **`override`** *(Default)*: The latest guard schema overwrites the previous one.
2. **`standalone`**: Merges both guard schemas, validating both independently:

```typescript
app.guard({
    schema: 'standalone',
    response: t.Object({ title: t.String() })
})
```

### Combined Group + Guard Syntax
Merge prefix routing and guard schemas in a single declaration:

```typescript
app.group(
    '/v1/protected',
    {
        headers: t.Object({
            authorization: t.String()
        }),
        beforeHandle({ headers, status }) {
            if (!headers.authorization.startsWith('Bearer ')) {
                return status(401, 'Unauthorized')
            }
        }
    },
    (app) => app
        .get('/data', () => fetchSecretData())
        .post('/update', ({ body }) => updateSecretData(body))
)
```

---

## 6. Async & Deferred Modules (Non-Blocking Startup)

For resource-heavy modules (e.g. scanning hundreds of route files, establishing large caches), use async functional plugins to prevent blocking initial server boot:

```typescript
// deferredStatic.ts
import { Elysia, file } from 'elysia'

export const loadStaticAssets = async (app: Elysia) => {
    const assets = await scanAssetDirectory()
    assets.forEach((path) => {
        app.get(`/assets/${path}`, file(`public/${path}`))
    })
    return app
}

// index.ts
new Elysia()
    .use(loadStaticAssets) // Registered asynchronously without blocking
    .listen(3000)
```

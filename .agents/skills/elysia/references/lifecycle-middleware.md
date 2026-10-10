# Elysia Request Lifecycle & Middleware

This guide details Elysia's 8-stage request lifecycle pipeline, context transformations (`derive` vs `resolve`), body parsing control, and hook execution ordering.

---

## 1. Lifecycle Execution Order

Elysia separates request handling into discrete lifecycle phases. If an early stage returns a response or throws an error, downstream stages are bypassed:

```
Incoming HTTP Request
       │
       ▼
 1. onRequest         ──[ returns value? ]──► (Response returned immediately)
       │
       ▼
 2. onParse           ── (Determines/parses body: JSON, FormData, custom)
       │
       ▼
 3. onTransform       ── (Mutates existing context before validation)
    & derive          ── (Appends new request-scoped properties before validation)
       │
       ▼
 4. Validation        ──[ invalid? ]──► onError (VALIDATION)
       │
       ▼
 5. onBeforeHandle    ──[ returns value? ]──► Skip handler, proceed to afterHandle
    & resolve         ── (Appends secure request properties after validation)
       │
       ▼
 6. Handler           ── (Main route controller function)
       │
       ▼
 7. onAfterHandle     ── (Transforms handler return value or headers)
       │
       ▼
 8. mapResponse       ── (Maps response to Web Standard Response, compression)
       │
       ▼
 Response Sent to Client
       │
       ▼
 9. onAfterResponse   ── (Async cleanup, telemetry, access logging)

 * onError intercepts exceptions at ANY stage of the pipeline *
```

---

## 2. Lifecycle Events Breakdown

### 1. `onRequest` (Pre-Routing & Gateway)
The first event executed for any incoming request.
- **Context**: Typed as `PreContext` (`request`, `set`, `store`, `decorators`). Does NOT include `params`, `query`, or `body`.
- **Primary uses**: Global rate limiting, IP whitelisting, CORS headers, early caching.
- If a value is returned, the rest of the lifecycle is skipped.

```typescript
app.onRequest(({ request, set, status }) => {
    const apiKey = request.headers.get('x-gateway-key')
    if (!apiKey) return status(403, 'Forbidden Gateway')
})
```

### 2. `onParse` & Body Parsing Control
Elysia automatically infers body parsers ahead of time based on schema types:
- `t.Object()` -> `application/json`
- `t.Object()` with `t.File()` -> `multipart/form-data`
- `t.URLEncoded()` -> `application/x-www-form-urlencoded`
- Primitive string -> `text/plain`

#### Explicit Parsing & Skipping (`parse: 'none'`)
Web standard `Request.body` can only be read once. When integrating third-party handlers (e.g. tRPC, oRPC, custom stream parsers), skip Elysia's parsing:

```typescript
app.post('/api/trpc/*', ({ request }) => trpcHandler(request), {
    parse: 'none' // Prevents "Body is already used" errors
})
```

#### Custom Body Parser
```typescript
app.parser('custom-proto', ({ request, contentType }) => {
    if (contentType === 'application/x-protobuf') return request.arrayBuffer()
})
```

### 3. `onTransform` & `derive` (Pre-Validation Mutation)
Executed before schema validation.
- `derive`: Appends new properties to `Context` per request.
- Use `derive` when validation schemas need to check a derived property (e.g. extracted token).

```typescript
app.derive(({ headers }) => {
    const auth = headers['authorization']
    return {
        bearerToken: auth?.startsWith('Bearer ') ? auth.slice(7) : null
    }
})
```

### 4. `onBeforeHandle` & `resolve` (Post-Validation Guards)
Executed **after** request validation passes, but **before** the main route handler.
- If a value is returned, the handler is skipped and the value becomes the response.
- `resolve`: Like `derive`, but runs **after validation**. This is much safer because request headers, query, and body have already been validated.

```typescript
app.guard(
    {
        headers: t.Object({
            authorization: t.String()
        })
    },
    (app) =>
        app
            .resolve(({ headers }) => {
                const user = verifyToken(headers.authorization)
                return { currentUser: user }
            })
            .get('/me', ({ currentUser }) => currentUser)
)
```

### 5. `onAfterHandle` (Response Interceptor)
Intercepts the value returned from the route handler.
- If a value is returned from `afterHandle`, it replaces the response.
- Note: Unlike `beforeHandle`, returning a value from `afterHandle` does **NOT** skip subsequent `afterHandle` hooks.

```typescript
app.onAfterHandle(({ response, set }) => {
    if (typeof response === 'string' && response.startsWith('<!DOCTYPE html>')) {
        set.headers['content-type'] = 'text/html; charset=utf-8'
    }
})
```

### 6. `mapResponse` (Custom Protocol & Compression)
Transforms the response value into a Web Standard `Response` before sending.
- Useful for gzip/brotli compression or custom binary packing.

```typescript
app.mapResponse(({ responseValue, set }) => {
    if (responseValue instanceof Uint8Array) {
        return new Response(responseValue, {
            headers: { 'Content-Type': 'application/octet-stream' }
        })
    }
})
```

### 7. `onAfterResponse` (Post-Flight Telemetry)
Executed after the client has received the response.
- Ideal for logging, metrics, audit trails, and releasing database connections.
- Accesses `responseValue` and final `set.status` / `set.headers`.

```typescript
app.onAfterResponse(({ path, set, responseValue }) => {
    logger.info(`Completed ${path} with status ${set.status}`)
})
```

---

## 3. Local Hooks vs Interceptor Hooks

### Local Hooks (Route-Scoped)
Inlined directly into the route configuration object:

```typescript
app.get('/admin', () => getAdminData(), {
    beforeHandle({ status, currentUser }) {
        if (!currentUser.isAdmin) return status(403, 'Forbidden')
    }
})
```

### Interceptor Hooks (Instance-Scoped)
Registered via `.on*` methods. Appended to all subsequent routes registered on that instance:

```typescript
app.onBeforeHandle(({ request }) => {
    auditLog(request.url)
})
```

---

## 4. Hook Registration Order Rules

Elysia enforces strict procedural registration order:

> **CRITICAL RULE**: Lifecycle hooks only apply to routes and plugins defined **AFTER** the hook is registered.

```typescript
const app = new Elysia()
    .get('/unprotected', () => 'no hook') // ❌ Not intercepted!
    .onBeforeHandle(() => checkAuth())
    .get('/protected', () => 'hook active') // ✅ Intercepted!
```

This also applies to sub-plugins:
```typescript
const app = new Elysia()
    .use(pluginA)                       // ❌ pluginA will NOT receive the hook below
    .onBeforeHandle(() => checkAuth())
    .use(pluginB)                       // ✅ pluginB WILL receive the hook
```

*(Exception: `onRequest` executes at the socket level for all requests).*

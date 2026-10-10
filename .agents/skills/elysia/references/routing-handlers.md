# Elysia Routing & Handlers

This guide covers routing definitions, path resolution rules, HTTP verbs, context handling, and response mechanics in ElysiaJS.

---

## 1. Route Definitions & Path Types

Elysia supports three types of paths, resolved according to a strict priority hierarchy:

1. **Static Paths** (Highest Priority)
2. **Dynamic Paths**
3. **Wildcards** (Lowest Priority)

```typescript
import { Elysia } from 'elysia'

new Elysia()
    .get('/id/1', 'static path')        // 1. Matches /id/1 only
    .get('/id/:id', 'dynamic path')     // 2. Matches /id/2, /id/abc, etc.
    .get('/id/*', 'wildcard path')      // 3. Matches /id/a/b/c
```

### Dynamic Paths

- **Single Parameter**:
  ```typescript
  app.get('/users/:id', ({ params: { id } }) => id)
  ```
- **Multiple Parameters**:
  ```typescript
  app.get('/users/:orgId/:userId', ({ params: { orgId, userId } }) => `${orgId}:${userId}`)
  ```
- **Optional Parameters**: Add a `?` after the parameter name:
  ```typescript
  app.get('/posts/:id?', ({ params: { id } }) => id ?? 'all')
  ```

### Wildcards

Use `*` to capture any trailing path segments. Access via `params['*']`:

```typescript
app.get('/files/*', ({ params }) => params['*'])
// GET /files/images/avatar.png -> params['*'] is "images/avatar.png"
```

---

## 2. HTTP Verbs & Routing Methods

Elysia provides built-in methods for standard HTTP verbs:

```typescript
new Elysia()
    .get('/resource', () => getItems())
    .post('/resource', ({ body }) => createItem(body))
    .put('/resource/:id', ({ params, body }) => updateItem(params.id, body))
    .patch('/resource/:id', ({ params, body }) => patchItem(params.id, body))
    .delete('/resource/:id', ({ params }) => deleteItem(params.id))
```

### Custom HTTP Verbs

Use `.route()` for non-standard or protocol-specific HTTP methods (must be uppercase per RFC 7231):

```typescript
app.route('M-SEARCH', '/discovery', () => 'UPnP Device Discovery')
```

### Catch-All Methods (`.all()`)

Use `.all()` to match all HTTP methods on a given path:

```typescript
app.all('/health', () => ({ status: 'healthy' }))
```

---

## 3. Route Organization & Prefixes

### Prefix in Constructor (Recommended for Modules)

```typescript
export const authController = new Elysia({ prefix: '/auth' })
    .post('/login', () => login())
    .post('/register', () => register())
```

### Route Groups (`.group()`)

Nest routes under a shared prefix:

```typescript
app.group('/api/v1', (v1) =>
    v1
        .use(authController)
        .use(userController)
)
```

### Group with Guard

Apply schemas or hooks directly to all routes within a group:

```typescript
app.group(
    '/admin',
    {
        headers: t.Object({
            'x-admin-key': t.String()
        })
    },
    (admin) => admin.get('/dashboard', () => getDashboardData())
)
```

---

## 4. Handler Context

The `Context` object is unique per request (except for `store` which is global). Context contains:

| Property | Type | Description |
|---|---|---|
| `body` | `any` | Parsed request payload (JSON, FormData, text, buffer) |
| `query` | `Record<string, any>` | Parsed query string parameters (`?key=val`) |
| `params` | `Record<string, string>` | Route path parameters (`:id`, `*`) |
| `headers` | `Record<string, string>` | Request HTTP headers (keys are lowercase) |
| `cookie` | `Record<string, Cookie>` | Mutable cookie signal proxy |
| `store` | `Record<string, any>` | Global mutable instance state |
| `status` | `Function` | Typed response status narrowing function |
| `set` | `Object` | Response mutable state (`set.headers`, `set.status`) |
| `redirect` | `Function` | Helper to redirect to another URL |
| `request` | `Request` | Web Standard Request instance |
| `server` | `Server` | Bun server instance (available when listening) |
| `path` | `string` | URL pathname |

---

## 5. Response Mechanics & Utilities

### Returning Status Codes (`status()`)

Prefer returning `status(code, data)` rather than throwing for expected error outcomes:

```typescript
app.get(
    '/item/:id',
    {
        response: {
            200: t.Object({ id: t.String(), name: t.String() }),
            404: t.Object({ error: t.String() })
        }
    },
    ({ params: { id }, status }) => {
        const item = findItem(id)
        if (!item) {
            return status(404, { error: 'Item not found' })
        }
        return item
    }
)
```

**Benefits:**
- TypeScript enforces that return values match the declared schema for that status code.
- Eden Treaty automatically narrows types on client calls based on status codes.

### Response Headers (`set.headers`)

```typescript
app.get('/custom', ({ set }) => {
    set.headers['x-custom-header'] = 'value'
    set.headers['cache-control'] = 'max-age=3600'
    return 'ok'
})
```

### Redirects (`redirect()`)

```typescript
app.get('/legacy', ({ redirect }) => {
    return redirect('https://example.com/new-path', 301)
})
```

### Serving Files (`file()`)

```typescript
import { Elysia, file } from 'elysia'

app.get('/avatar', file('public/avatar.webp'))
```

### FormData Responses (`form()`)

```typescript
import { Elysia, form, file } from 'elysia'

app.get('/bundle', () =>
    form({
        name: 'Report',
        attachment: file('reports/export.pdf')
    })
)
```

---

## 6. Streaming & Server-Sent Events (SSE)

### Generator Streams

Return an async generator function using `function* ()`:

```typescript
app.get('/stream', function* () {
    yield 'chunk 1\n'
    yield 'chunk 2\n'
    yield 'chunk 3\n'
})
```

### Server-Sent Events (`sse()`)

Wrap yielded chunks in `sse()` to automatically format as `text/event-stream`:

```typescript
import { Elysia, sse } from 'elysia'

app.get('/events', function* ({ set }) {
    // Custom headers MUST be set before the first chunk is yielded
    set.headers['x-event-source'] = 'iris-core'

    yield sse('connected')
    yield sse({
        event: 'message',
        data: { time: Date.now(), text: 'Live update' }
    })
})
```

### Eden Treaty Client Stream Consumption

Eden Treaty treats stream endpoints as `AsyncGenerator`:

```typescript
const { data, error } = await elysia.stream.get()
if (error) throw error

for await (const chunk of data) {
    console.log('Stream chunk:', chunk)
}
```

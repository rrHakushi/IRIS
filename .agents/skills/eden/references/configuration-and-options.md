# Eden Treaty: Configuration & Client Options

Complete reference for initializing Eden Treaty with URL endpoints or Elysia instances, headers resolution, request/response interceptors, and error behavior.

---

## 1. Initializing Eden Treaty: `urlOrInstance`

The first argument to `treaty(...)` accepts either a URL string or an Elysia server instance:

```typescript
treaty<App>(urlOrInstance, options?)
```

### Pattern A: URL Endpoint (Remote Server)
When passed a string, Eden Treaty creates network requests using Web Standard `fetch`:

```typescript
import { treaty } from '@elysia/eden'
import type { App } from './server'

export const api = treaty<App>('localhost:3000')
```

#### Protocol Resolution Rules:
1. If an explicit protocol is provided (`https://api.domain.com`), it is used directly.
2. If omitted and hostname is `localhost` (and `NODE_ENV !== 'production'`), Eden defaults to `http://` (and `ws://` for WebSockets).
3. Otherwise, Eden defaults to `https://` (and `wss://`).

---

### Pattern B: Elysia Instance (In-Memory / Unit Tests)
When passed an Elysia app instance, Eden executes requests directly in memory via `app.handle(request)` with **zero network/TCP overhead**:

```typescript
import { Elysia } from 'elysia'
import { treaty } from '@elysia/eden'

const app = new Elysia()
    .get('/ping', () => 'pong')

// No generic <App> needed — inferred automatically from the instance!
const api = treaty(app)

const { data } = await api.ping.get()
```

> [!TIP]
> Always use `treaty(app)` for backend unit tests. It provides complete type safety and tests the exact Elysia routing and lifecycle pipeline without needing a live listening port.

---

## 2. Client Options (`treaty(..., options)`)

Eden Treaty accepts an optional options object as the second argument:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `fetch` | `RequestInit` | `{}` | Default fetch options appended to all requests. |
| `fetcher` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation (e.g. Axios adapter, custom engine). |
| `headers` | `Record \| Function \| Array` | `undefined` | Default headers (supports static objects, functions, or arrays). |
| `onRequest` | `Function \| Array` | `undefined` | Intercept and mutate request options before firing. |
| `onResponse` | `Function \| Array` | `undefined` | Intercept and mutate the Web Standard Response. |
| `parseDate` | `boolean` | `true` | Automatically parse ISO date strings into JavaScript `Date` objects. |
| `throwHttpError` | `boolean \| ((res) => boolean)` | `false` | Automatically throw an exception on non-2xx HTTP status codes. |

---

## 3. Headers Configuration & Priority

### 1. Static Headers Object
```typescript
const api = treaty<App>('localhost:3000', {
    headers: {
        'x-client-id': 'iris-web'
    }
})
```

### 2. Dynamic Headers Function
Accepts `(path: string, options: RequestInit)` (note: `path` excludes the hostname):
```typescript
const api = treaty<App>('localhost:3000', {
    headers(path, options) {
        if (path.startsWith('/admin')) {
            return {
                authorization: `Bearer ${getAdminToken()}`
            }
        }
    }
})
```

### 3. Array of Headers Functions
All functions are executed in order, merging returned headers:
```typescript
const api = treaty<App>('localhost:3000', {
    headers: [
        () => ({ 'x-timestamp': Date.now().toString() }),
        (path) => path.startsWith('/auth') ? { 'x-auth-source': 'web' } : undefined
    ]
})
```

### Headers Priority Resolution
When duplicate headers are specified, Eden Treaty prioritizes them in this exact order:
1. **Inline Method**: Defined directly in the request call (`api.user.get({ headers: ... })`).
2. **`config.headers`**: Top-level headers configuration (later entries in arrays take precedence).
3. **`config.fetch.headers`**: Headers inside the `fetch` options object.

---

## 4. Lifecycle Interceptors (`onRequest` & `onResponse`)

### `onRequest`
Called immediately before sending the request. Returns an object shallow-merged into `RequestInit`:

```typescript
const api = treaty<App>('localhost:3000', {
    onRequest(path, options) {
        console.log(`[HTTP Outgoing] ${options.method || 'GET'} ${path}`)
        return {
            headers: {
                'x-request-id': crypto.randomUUID()
            }
        }
    }
})
```

### `onResponse`
Called immediately after receiving the Web Standard `Response`. Loops through functions until a replacement value is returned:

```typescript
const api = treaty<App>('localhost:3000', {
    onResponse(response) {
        if (!response.ok) {
            console.warn(`[HTTP Error] ${response.status} ${response.statusText}`)
        }
    }
})
```

---

## 5. Automatic Date Parsing (`parseDate`)

Enabled by default (`true`). Automatically converts ISO-8601 date strings in JSON payloads into `Date` instances:

```typescript
const api = treaty<App>('localhost:3000', {
    parseDate: true // Set to false to leave dates as raw strings
})
```

---

## 6. HTTP Error Throwing (`throwHttpError`)

By default, Eden Treaty returns errors inside the `{ error }` property instead of throwing. To enable throwing on non-2xx responses:

### Boolean Flag
```typescript
const api = treaty<App>('localhost:3000', {
    throwHttpError: true // Throws an error whenever status is >= 300
})
```

### Conditional Function
```typescript
const api = treaty<App>('localhost:3000', {
    throwHttpError(response) {
        // Only throw for critical 5xx server errors; return 4xx in { error }
        return response.status >= 500
    }
})
```

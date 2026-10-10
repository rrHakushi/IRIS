# Eden Treaty: Request Parameters, Query, Headers & Payloads

How to pass request bodies, query strings, custom headers, abort signals, and file uploads using Eden Treaty.

---

## 1. Parameter Signatures Overview

Eden Treaty methods accept parameters based on whether the HTTP method expects a body:

### Methods with a Body (`POST`, `PUT`, `PATCH`)
Accept up to **two** arguments:
1. `body`: Request body data (JSON object, string, FormData, etc.)
2. `options` (optional): Object containing `query`, `headers`, and `fetch` configuration

```typescript
// POST with body only
await api.user.post({ name: 'Elysia' })

// POST with body AND additional options (query, headers)
await api.user.post(
    { name: 'Elysia' },
    {
        query: { notify: 'true' },
        headers: { authorization: 'Bearer secret_token' }
    }
)
```

### Methods without a Body (`GET`, `DELETE`, `HEAD`)
Accept **one** optional argument:
1. `options` (optional): Object containing `query`, `headers`, and `fetch` configuration

```typescript
// GET without parameters
await api.hello.get()

// GET with query and custom headers
await api.users.get({
    query: {
        page: 1,
        limit: 20
    },
    headers: {
        'x-client-version': '2.0.0'
    }
})
```

---

## 2. Empty Body Handling (`null` / `undefined`)

If a route uses `POST` or `PUT` without requiring a body (or with an optional body), but requires query parameters or headers, pass `null` or `undefined` as the first argument:

```typescript
// Server:
// app.post('/logout', () => 'Logged out', { query: t.Object({ redirect: t.String() }) })

// Client:
await api.logout.post(null, {
    query: {
        redirect: '/home'
    }
})
```

---

## 3. Query Parameter Serialization

Eden Treaty handles array serialization and encoding for query strings automatically:

```typescript
// Server:
// query: t.Object({
//     tags: t.Array(t.String()),
//     active: t.Boolean()
// })

// Client:
await api.articles.get({
    query: {
        tags: ['typescript', 'elysia'],
        active: true
    }
})
```

---

## 4. Request Cancellation (`AbortController` & `fetch.signal`)

Eden Treaty wraps standard Web `fetch`. You can pass any standard `RequestInit` property into `fetch`:

```typescript
const controller = new AbortController()

const timeoutId = setTimeout(() => {
    controller.abort()
}, 5000)

try {
    const { data, error } = await api.heavyReport.get({
        fetch: {
            signal: controller.signal
        }
    })
} finally {
    clearTimeout(timeoutId)
}
```

---

## 5. File Uploads (`multipart/form-data`)

Eden Treaty automatically converts requests containing binary types into `multipart/form-data`. You do not need to manually construct `FormData` or set `Content-Type` headers.

### Supported File Types:
- `File`
- `File[]`
- `FileList`
- `Blob`

### Example: Single & Multiple File Uploads

#### Backend Schema (Elysia):
```typescript
import { Elysia, t } from 'elysia'

export const app = new Elysia()
    .post('/upload', ({ body: { title, documents } }) => ({ count: documents.length, title }), {
        body: t.Object({
            title: t.String(),
            documents: t.Files()
        })
    })
```

#### Frontend Client (Eden Treaty):
```typescript
import { api } from '@/lib/elysia'

const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

const { data, error } = await api.upload.post({
    title: 'Financial Q3 Statements',
    documents: fileInput.files! // FileList passed directly
})

if (error) {
    console.error('Upload failed:', error.value)
} else {
    console.log('Uploaded successfully:', data.count)
}
```

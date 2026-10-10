---
name: elysia/eden
description: Master architectural and implementation guide for Eden Treaty (@elysia/eden) in ElysiaJS. Use whenever writing, reviewing, or refactoring client-side API requests, type-safe RPC communication, unit testing Elysia servers with treaty(app), parameter and query handling, type-narrowed error handling with status codes, streaming responses, Server-Sent Events (SSE), configuring fetch interceptors/headers, or establishing real-time WebSockets with .subscribe(). Exclusively covers Eden Treaty (omits Eden Fetch).
---

# Eden Treaty Architecture & Development Guide

**Eden Treaty** (`@elysia/eden`) is an RPC client that turns an ElysiaJS backend into a fully typed, tree-like JavaScript proxy with end-to-end type safety, compile-time validation, and auto-completion without code generation.

---

## 1. Golden Rules (Non-Negotiable)

### 1. Exclusively Use Eden Treaty (`treaty`) — Never Use Eden Fetch, Raw `fetch()`, or `axios`
- Always import and initialize `treaty` from `@elysia/eden`:
  ```typescript
  import { treaty } from '@elysia/eden'
  export const api = treaty<App>('localhost:3000')
  ```
- **Never use Eden Fetch (`edenFetch`)**, raw `fetch()`, or `axios`. Eden Treaty provides superior IDE autocompletion, status-code-based type narrowing, streaming, and WebSocket support.

### 2. Single Source of Truth: Export `typeof app` from Server
- The backend must export its Elysia instance type using method chaining:
  ```typescript
  export type App = typeof app
  ```
- Never declare redundant manual interfaces for routes or DTOs on the client. Let TypeScript infer everything from `App`.

### 3. Handle Errors First to Unwrap `data`
- Eden Treaty returns `{ data, error, response, status, headers }`.
- When status is `>= 300`, `data` is `null` and `error` contains `{ status, value }`.
- Always guard `if (error)` before accessing `data` so TypeScript safely unwraps `data` from `T | null` to `T`:
  ```typescript
  const { data, error } = await api.user.get()
  if (error) {
      throw new Error(`Request failed (${error.status}): ${JSON.stringify(error.value)}`)
  }
  // data is now unwrapped and non-null
  ```

### 4. Unit Testing: Pass Elysia Instance Directly (`treaty(app)`)
- For server tests, pass the Elysia app directly to `treaty(app)` without spinning up a network listener:
  ```typescript
  const api = treaty(app)
  const { data, status } = await api.auth['sign-in'].post({ ... })
  expect(status).toBe(200)
  ```
- This executes in-memory via `app.handle()`, eliminating port binding, TCP latency, and teardown cleanup.

### 5. Enforce TypeScript Strict Mode & Matching Elysia Version
- Ensure `"strict": true` and TypeScript `>= 5.0` in `tsconfig.json`.
- The `elysia` package must be installed as a client dev dependency (`pnpm add -D elysia`) with the exact same version as the server.

### 6. File Uploads: Pass `File` / `FileList` Directly
- Do not manually construct `FormData` or manually set `multipart/form-data` headers. Pass `File`, `File[]`, or `FileList` directly in the payload; Eden Treaty serializes it automatically.

### 7. Empty Body Handling on `POST` / `PUT`
- If an endpoint accepts no body (or optional body) but requires headers or query params, pass `null` or `undefined` as the first parameter:
  ```typescript
  await api.auth.logout.post(null, { query: { redirect: '/login' } })
  ```

---

## 2. Quick Reference Cheatsheet

### Client Setup
```typescript
import { treaty } from '@elysia/eden'
import type { App } from '@IRIS/elysia'

export const api = treaty<App>('localhost:3000', {
    fetch: { credentials: 'include' }
})
```

### Route Calls & Parameters
```typescript
// GET /
const { data } = await api.get()

// GET /users?page=1&limit=10
const { data } = await api.users.get({
    query: { page: 1, limit: 10 }
})

// POST /users with body and headers
const { data, error } = await api.users.post(
    { name: 'Elysia', role: 'admin' },
    { headers: { authorization: 'Bearer token' } }
)

// Dynamic path: GET /users/:id
const { data } = await api.users({ id: 1895 }).get()

// Nested dynamic path: DELETE /org/:orgId/repo/:repoId
const { data } = await api.org({ orgId: 'elysiajs' }).repo({ repoId: 'eden' }).delete()

// File upload: POST /upload
const { data } = await api.upload.post({
    title: 'Avatar',
    image: fileInput.files![0]
})
```

### Consuming Streams & SSE
```typescript
const { data, error } = await api.chat.stream.get()
if (error) throw error

for await (const chunk of data) {
    console.log('Chunk:', chunk)
}
```

### Real-Time WebSockets
```typescript
const chat = api.chat.subscribe({
    query: { room: 'general' }
})

chat.subscribe((msg) => console.log('Message:', msg))
chat.on('open', () => chat.send({ text: 'Hello!' }))
```

---

## 3. Deep-Dive References

When implementing specific client features or troubleshooting, consult the corresponding reference:

- **[Installation & Common Gotchas](file:///home/hakushi/Documents/IRIS/.agents/skills/eden/references/installation-and-gotchas.md)**
  *Dependencies (`@elysia/eden`, `elysia`), server type export (`export type App`), TypeScript strict mode, version parity, method chaining requirement, and monorepo path alias troubleshooting.*

- **[Tree-Like Syntax & Dynamic Paths](file:///home/hakushi/Documents/IRIS/.agents/skills/eden/references/treaty-syntax-and-paths.md)**
  *Mapping REST endpoints to property accessors, handling dynamic route parameters (`:id`), wildcards (`*`), and IDE autocompletion.*

- **[Request Parameters & Payloads](file:///home/hakushi/Documents/IRIS/.agents/skills/eden/references/parameters-and-payloads.md)**
  *Passing request body, query strings, headers, request cancellation (`AbortController`), empty bodies (`null`), and automatic multipart file uploads.*

- **[Response, Error Handling & Streaming](file:///home/hakushi/Documents/IRIS/.agents/skills/eden/references/response-and-error-handling.md)**
  *The `{ data, error, response, status, headers }` structure, status-code type narrowing, consuming streams and SSE with `for await`, and utility types (`Treaty.Data`, `Treaty.Error`).*

- **[Configuration & Options](file:///home/hakushi/Documents/IRIS/.agents/skills/eden/references/configuration-and-options.md)**
  *Remote URL vs in-memory instance (`treaty(app)` for testing), default fetch options, custom fetcher, headers priority, lifecycle interceptors (`onRequest`, `onResponse`), `parseDate`, and `throwHttpError`.*

- **[Real-Time WebSockets](file:///home/hakushi/Documents/IRIS/.agents/skills/eden/references/websockets.md)**
  *Subscribing with `.subscribe()`, event listeners (`open`, `message`, `close`, `error`), sending typed messages (`chat.send`), handshake query/headers, and accessing native `raw` WebSocket.*

---

## 4. Companion Skills

- **[elysia](file:///home/hakushi/Documents/IRIS/.agents/skills/elysia/SKILL.md)**: Master backend architecture guide for ElysiaJS v2, controllers, services, models, and TypeBox schemas.
- **[IRIS-web](file:///home/hakushi/Documents/IRIS/.agents/skills/IRIS-web/SKILL.md)**: Next.js App Router guidelines, client data fetching patterns, and UI components.

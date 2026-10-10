# Eden Treaty: Response, Error Handling & Streaming

How Eden Treaty processes HTTP responses, handles errors with TypeScript type narrowing, consumes streams/SSE, and extracts utility types.

---

## 1. Response Object Anatomy

Every Eden Treaty request returns a `Promise` resolving to an object with five properties:

```typescript
const {
    data,     // Value returned when status is 2xx (T | null)
    error,    // Error details when status >= 300 ({ status: number, value: any } | null)
    response, // Standard Web Response object
    status,   // HTTP status code (e.g. 200, 201, 400, 404, 500)
    headers   // Response headers map
} = await api.users.get()
```

### The 2xx vs >= 300 Rule
- **If status is 2xx**: `error` is `null`, and `data` contains the typed payload.
- **If status is >= 300**: `data` is `null`, and `error` contains `{ status, value }`.

---

## 2. Type Narrowing & Safe Error Handling

Before checking for errors, TypeScript types `data` as `T | null`. Guarding against `error` automatically narrows `data` to its non-null return type:

```typescript
import { api } from '@/lib/elysia'

async function submitProfile(username: string) {
    const { data, error } = await api.users.post({ name: username })

    // 1. Guard against error
    if (error) {
        // TypeScript narrows error.status and error.value based on Elysia response schema:
        switch (error.status) {
            case 400:
                console.error('Validation error:', error.value)
                break
            case 409:
                console.error('User already exists:', error.value)
                break
            default:
                console.error('Unexpected server error:', error.value)
        }
        return null
    }

    // 2. data is now strictly unwrapped without null!
    // typeof data === { id: string, name: string }
    return data
}
```

---

## 3. Streaming Responses

When an Elysia endpoint yields chunks using a generator (`function*` or `async function*`), Eden Treaty exposes the response as an `AsyncGenerator`. You consume chunks in real time using `for await (... of ...)`:

### Backend Generator:
```typescript
import { Elysia } from 'elysia'

export const app = new Elysia()
    .get('/stream', function* () {
        yield 'Chunk A\n'
        yield 'Chunk B\n'
        yield 'Chunk C\n'
    })
```

### Frontend Eden Client:
```typescript
import { treaty } from '@elysia/eden'
import type { App } from './server'

const api = treaty<App>('localhost:3000')

const { data, error } = await api.stream.get()
if (error) throw new Error(error.value)

for await (const chunk of data) {
    console.log('Received chunk:', chunk)
}
```

---

## 4. Server-Sent Events (SSE)

Elysia's `sse()` helper is also consumed as an `AsyncGenerator` in Eden Treaty:

### Backend SSE:
```typescript
import { Elysia, sse } from 'elysia'

export const app = new Elysia()
    .get('/events', function* () {
        yield sse({ event: 'connected', data: { time: Date.now() } })
        yield sse({ event: 'ping', data: 'heartbeat' })
    })
```

### Frontend Client:
```typescript
const { data, error } = await api.events.get()
if (error) throw error

for await (const event of data) {
    // Typed event data
    console.log('SSE message:', event)
}
```

---

## 5. Treaty Utility Types (`Treaty.Data` & `Treaty.Error`)

Eden Treaty exports the `Treaty` namespace providing helper types to extract response and error types without manually redeclaring interfaces.

```typescript
import { treaty, type Treaty } from '@elysia/eden'
import type { App } from './server'

const api = treaty<App>('localhost:3000')

// 1. Extract data type from endpoint method
type UserPostData = Treaty.Data<typeof api.users.post>

// 2. Extract error type from endpoint method
type UserPostError = Treaty.Error<typeof api.users.post>

// 3. Extract data type from an executed response
const response = await api.users({ id: '1' }).get()
type UserData = Treaty.Data<typeof response>
```

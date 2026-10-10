# Eden Treaty: Real-Time WebSockets (`.subscribe`)

Eden Treaty provides first-class type safety for Elysia WebSockets using the `.subscribe()` method.

---

## 1. Server-Side WebSocket Definition (Elysia)

Define a WebSocket endpoint on the Elysia server with TypeBox message and response validation:

```typescript
// server.ts
import { Elysia, t } from 'elysia'

export const app = new Elysia()
    .ws('/chat', {
        body: t.Object({
            message: t.String()
        }),
        response: t.Object({
            from: t.String(),
            text: t.String(),
            timestamp: t.Number()
        }),
        open(ws) {
            console.log('Client connected')
        },
        message(ws, data) {
            // Echo back to client
            ws.send({
                from: 'Server',
                text: data.message,
                timestamp: Date.now()
            })
        },
        close(ws) {
            console.log('Client disconnected')
        }
    })
    .listen(3000)

export type App = typeof app
```

---

## 2. Client Connection via Eden Treaty

Use `.subscribe()` on the matching treaty path to establish a typed WebSocket connection:

```typescript
import { treaty } from '@elysia/eden'
import type { App } from './server'

const api = treaty<App>('localhost:3000')

// Initiate WebSocket connection
const chat = api.chat.subscribe()
```

---

## 3. Handling Events & Messages

Eden Treaty's `EdenWS` client supports both direct callback subscriptions and standard event listener syntax:

### Direct Message Subscription
```typescript
chat.subscribe((message) => {
    // message is fully typed according to the Elysia 'response' schema
    console.log(`[${message.from}]: ${message.text}`)
})
```

### Event Listeners (`on`)
```typescript
// Connection opened
chat.on('open', () => {
    console.log('Connected to chat server')
    // Send typed message once connected
    chat.send({ message: 'Hello from client!' })
})

// Message received
chat.on('message', (event) => {
    console.log('Raw message payload:', event.data)
})

// Connection closed
chat.on('close', (event) => {
    console.log('Connection closed:', event.code, event.reason)
})

// Error occurred
chat.on('error', (error) => {
    console.error('WebSocket error:', error)
})
```

---

## 4. Sending Messages (`send`)

The `chat.send()` method enforces the payload type defined in the server's `body` schema:

```typescript
chat.send({
    message: 'Greetings from Eden Treaty'
})
```

---

## 5. Query Parameters & Headers on Handshake

`.subscribe()` accepts the exact same parameter options as `get()` and `head()`. You can pass query parameters and handshake headers:

```typescript
const chat = api.chat.subscribe({
    query: {
        room: 'general'
    },
    headers: {
        authorization: 'Bearer user_token'
    }
})
```

---

## 6. Accessing Native WebSocket API (`.raw`)

The instance returned by `.subscribe()` is an `EdenWS` wrapper. If you need low-level access to the underlying browser `WebSocket` object (e.g. for inspection or binary type overrides):

```typescript
const rawSocket: WebSocket = chat.raw
console.log('WebSocket ready state:', rawSocket.readyState)
```

# Elysia Error Handling & Validation Errors

This guide explains Elysia's error interception pipeline, custom error classes, validation error formatting, and the distinction between throwing and returning HTTP status codes.

---

## 1. The `onError` Lifecycle Hook

Elysia catches all unhandled exceptions thrown anywhere in the request lifecycle and forwards them to `onError`:

```typescript
import { Elysia } from 'elysia'

new Elysia()
    .onError(({ code, error, status }) => {
        switch (code) {
            case 'NOT_FOUND':
                return status(404, { error: 'Resource not found' })

            case 'VALIDATION':
                return status(400, {
                    error: 'Validation failed',
                    message: error.message
                })

            case 'INTERNAL_SERVER_ERROR':
                console.error(error)
                return status(500, { error: 'Internal server error' })

            default:
                return status(500, { error: error.message })
        }
    })
```

### Built-in Error Codes

| Error Code | HTTP Status | Trigger Condition |
|---|---|---|
| `NOT_FOUND` | 404 | No route matches the requested path or `NotFoundError` was thrown. |
| `PARSE` | 400 | Request body parsing failed (malformed JSON, corrupted form). |
| `VALIDATION` | 400 / 422 | Schema validation failed (`body`, `query`, `params`, `headers`, `response`). |
| `INVALID_COOKIE_SIGNATURE` | 400 | Signed cookie verification failed or secret mismatch. |
| `INVALID_FILE_TYPE` | 400 | Uploaded file failed format or MIME type check. |
| `INTERNAL_SERVER_ERROR` | 500 | Uncaught server exception. |
| `UNKNOWN` | 500 | Generic unclassified error. |
| `number` | Status Code | Error thrown via `throw status(code, ...)`. |

---

## 2. Type-Safe Custom Error Classes

Elysia allows registering custom error classes to unlock automatic type narrowing and IDE autocomplete in `onError`:

```typescript
import { Elysia } from 'elysia'

// 1. Define custom error classes
export class EntityNotFoundError extends Error {
    status = 404

    constructor(public entity: string, public id: string) {
        super(`${entity} with ID '${id}' was not found`)
    }
}

export class UnauthorizedError extends Error {
    status = 401

    constructor(message = 'Authentication required') {
        super(message)
    }
}

// 2. Register errors on the Elysia instance
export const app = new Elysia()
    .error({
        EntityNotFoundError,
        UnauthorizedError
    })
    .onError(({ code, error, status }) => {
        // TypeScript automatically narrows `code` and `error`
        switch (code) {
            case 'EntityNotFoundError':
                return status(404, {
                    error: 'Not Found',
                    entity: error.entity,
                    id: error.id
                })

            case 'UnauthorizedError':
                return status(401, {
                    error: 'Unauthorized',
                    message: error.message
                })
        }
    })
```

### Custom `toResponse()` Method
An error class can supply its own `toResponse()` method to encapsulate its HTTP serialization:

```typescript
export class PaymentRequiredError extends Error {
    status = 402

    toResponse() {
        return Response.json(
            { error: 'Payment required', invoiceUrl: 'https://billing.example.com' },
            { status: 402 }
        )
    }
}
```

---

## 3. Custom Validation Error Messages

### Field-Level Error Messages
Provide custom error strings directly inside schema definitions:

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
    .post(
        '/register',
        {
            body: t.Object({
                email: t.String({
                    format: 'email',
                    error: 'Please enter a valid corporate email address'
                }),
                password: t.String({
                    minLength: 8,
                    error: 'Password must contain at least 8 characters'
                })
            })
        },
        ({ body }) => register(body)
    )
```

### Programmatic Error Messages
Pass a function to `error` to inspect validation context:

```typescript
t.Number({
    error({ value, type }) {
        return `Expected a number, received ${typeof value}`
    }
})
```

### Validation Details (`validationDetail`)
By default, custom error strings replace validation metadata. Use `validationDetail()` or inspect `error.all` to retain schema path details:

```typescript
import { Elysia, validationDetail } from 'elysia'

t.String({
    error: validationDetail('Username is required and must be alphanumeric')
})
```

### Production Security (`allowUnsafeValidationDetails`)
In `NODE_ENV === 'production'`, Elysia strips raw validation error internals to prevent exposing backend schema structure to attackers.

If you intentionally want verbose validation details in production, set:
```typescript
new Elysia({
    allowUnsafeValidationDetails: true
})
```

---

## 4. Throwing vs Returning `status()`

In Elysia, `status()` can be either **returned** or **thrown**. Choose according to how you want the error handled:

```typescript
import { Elysia, status } from 'elysia'

new Elysia()
    .get('/return-status', () => {
        // ✅ RETURN: Bypasses onError. Formatted directly as HTTP response.
        // Fully typed in Eden Treaty and checked against route response schema.
        return status(400, { message: 'Expected invalid input' })
    })
    .get('/throw-status', () => {
        // ❌ THROW: Intercepted by onError hook.
        // Useful for bubbling up errors through deep helper functions or guards.
        throw status(403, 'Forbidden action')
    })
```

### Best Practice
- **In Route Handlers**: Prefer **returning** `status(code, data)` so that TypeScript validates your response against the declared route schema.
- **In Services / Deep Helpers**: Throw custom error classes or `throw status(...)` so the controller or `onError` hook catches and formats them consistently.

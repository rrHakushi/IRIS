# Elysia Cookie Management & Reactive Signals

This guide details Elysia's reactive cookie signal model, property assignment, deletion, schema validation (`t.Cookie`), cryptographic signing, key rotation, and security attributes.

---

## 1. The Reactive Cookie Model

In Elysia, cookies are managed through a **reactive signal Proxy** available via `context.cookie`.

There are no traditional `getCookie()` or `setCookie()` methods. Instead, you directly read or assign the `.value` property:

```typescript
import { Elysia } from 'elysia'

new Elysia()
    .get('/cookie-demo', ({ cookie: { session } }) => {
        // 1. Read cookie value
        console.log(session.value)

        // 2. Set / update cookie value (automatically sets Set-Cookie response header)
        session.value = 'token_abc123'
    })
```

### Auto JSON Encoding & Decoding
Elysia automatically serializes and deserializes objects to and from JSON in cookies without manual `JSON.stringify` or `JSON.parse`:

```typescript
app.get('/user-state', ({ cookie: { userState } }) => {
    // Automatically stringified to cookie and parsed back to object
    userState.value = {
        theme: 'dark',
        visits: 42
    }
})
```

### Why `cookie.name` is Never Undefined at Runtime
Because `cookie` is backed by a JavaScript `Proxy`, accessing any arbitrary property (e.g. `cookie.session`, `cookie.whatever`) **always returns a `Cookie` proxy object**. Only `cookie.name.value` will be `undefined` if the client did not send the cookie.

---

## 2. Modifying Cookie Attributes

You can configure cookie attributes (`httpOnly`, `secure`, `sameSite`, `maxAge`, `domain`, `path`) using three patterns:

### 1. Direct Property Assignment
```typescript
app.get('/login', ({ cookie: { session } }) => {
    session.value = 'token_xyz'
    session.httpOnly = true
    session.secure = true
    session.sameSite = 'lax'
    session.maxAge = 60 * 60 * 24 * 7 // 7 days in seconds
})
```

### 2. `cookie.set()` (Reset and Overwrite)
Resets all cookie attributes and replaces them with the new configuration:

```typescript
session.set({
    value: 'new_token',
    httpOnly: true,
    secure: true,
    maxAge: 86400
})
```

### 3. `cookie.add()` (Merge Attributes)
Updates specified attributes without resetting existing ones:

```typescript
session.add({
    maxAge: 3600
})
```

---

## 3. Removing Cookies

To expire/delete a cookie from the client browser:

```typescript
app.post('/logout', ({ cookie, cookie: { session } }) => {
    // Method 1: Using .remove()
    session.remove()

    // Method 2: Using JavaScript delete keyword
    delete cookie.session
})
```

Both methods instruct the client browser to immediately expire and remove the cookie by setting `Expires` to the past and `Max-Age` to `0`.

---

## 4. Cookie Validation Schemas (`t.Cookie`)

Without a cookie schema, TypeScript in strict mode assumes `cookie.session` might be undefined (`Cookie | undefined`), requiring non-null assertions (`session!.value`).

Defining a cookie schema with `t.Cookie` provides:
1. **Complete Type Safety**: `session` is guaranteed to exist on `cookie`; no `!` needed.
2. **Value Validation**: Enforces that cookie values match expected primitives or complex objects.
3. **Optional / Nullable Support**: Use `t.Optional(...)` for cookies that might not be sent on initial requests.

### Route Schema Example

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
    .post(
        '/profile',
        {
            cookie: t.Cookie({
                // Optional string cookie
                session: t.Optional(t.String()),
                // Structured object cookie with automatic coercion
                preferences: t.Optional(
                    t.Object({
                        theme: t.UnionEnum(['light', 'dark']),
                        fontSize: t.Numeric()
                    })
                )
            })
        },
        ({ cookie: { session, preferences } }) => {
            if (session.value) {
                // Fully typed string
                console.log(session.value)
            }

            if (preferences.value) {
                // Fully typed { theme: 'light' | 'dark', fontSize: number }
                console.log(preferences.value.theme)
            }
        }
    )
```

---

## 5. Signed Cookies & Cryptographic Verification

Cookie signatures append a cryptographic hash to the cookie value, verifying authenticity and preventing client tampering.

### Route-Level Signing

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
    .post(
        '/sign-in',
        {
            cookie: t.Cookie(
                {
                    authSession: t.String()
                },
                {
                    secrets: 'super-secret-signature-key',
                    sign: ['authSession'], // Array of cookie names to sign
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax'
                }
            )
        },
        ({ cookie: { authSession } }) => {
            authSession.value = 'user_id_123'
            // Elysia automatically signs the cookie on set
            // and verifies/unsigns it when received
        }
    )
```

### Global Signing in Elysia Constructor (Recommended)
Set cookie secrets globally so all routes inherit signing configuration:

```typescript
export const app = new Elysia({
    cookie: {
        secrets: process.env.COOKIE_SECRET ?? 'iris-default-secret',
        sign: ['session', 'refresh_token']
    }
})
```

If a client alters a signed cookie, Elysia detects tampering and throws an `INVALID_COOKIE_SIGNATURE` error caught by `onError`.

---

## 6. Key Rotation & Graceful Migration

### Key Rotation
When rotating security keys, supply an array of secrets. Elysia **signs with the first secret** but can **verify with any of the secrets**:

```typescript
new Elysia({
    cookie: {
        secrets: [
            'new-secret-2026',    // Active key: used for signing new cookies
            'old-secret-2025'     // Retired key: still valid for verifying existing cookies
        ]
    }
})
```

### Transitioning from Unsigned to Signed Cookies
To migrate users from legacy unsigned cookies to signed cookies without logging everyone out, append `null` to the secrets array:

```typescript
new Elysia({
    cookie: {
        secrets: [
            'new-secret-key', // Signs new cookies
            null              // Permits legacy unsigned cookies during migration
        ]
    }
})
```

---

## 7. Cookie Attributes Reference

| Property | Default | Type | Description |
|---|---|---|---|
| `httpOnly` | `false` | `boolean` | When `true`, client-side JS cannot access `document.cookie`. Protects against XSS. |
| `secure` | `false` | `boolean` | When `true`, cookie is only transmitted over HTTPS connections. |
| `sameSite` | `false` | `'lax' \| 'strict' \| 'none' \| boolean` | Controls cross-site cookie behavior. `'lax'` recommended for auth cookies. |
| `maxAge` | `undefined` | `number` | Expiration lifetime in **seconds** (e.g. `86400` = 1 day). |
| `expires` | `undefined` | `Date` | Absolute expiration date timestamp. |
| `domain` | `undefined` | `string` | Domain scope for the cookie (e.g. `iris.domain.com`). |
| `path` | `'/'` | `string` | Path prefix where the cookie is accessible. |
| `secrets` | `undefined` | `string \| string[]` | Secret key(s) used for cryptographic signing and key rotation. |
| `sign` | `undefined` | `string[]` | List of cookie names that must be signed. |

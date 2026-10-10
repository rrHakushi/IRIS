# Elysia Validation & TypeBox (`Elysia.t`)

This guide covers runtime validation, data coercion, custom types, Standard Schema support, and type inference using TypeBox in ElysiaJS.

---

## 1. Single Source of Truth

Elysia enforces a single source of truth for:
1. **Runtime Validation** (validating requests and responses)
2. **Data Coercion** (string to numbers/booleans/arrays)
3. **Compile-Time Types** (automatic TypeScript types via static inference)
4. **OpenAPI / Swagger Documentation** (generating API schemas)

Never create duplicate TypeScript interfaces alongside TypeBox schemas. Instead, infer types using `UnwrapSchema` or `typeof Schema.static`.

---

## 2. Validation Targets

Validation schemas are supplied as the second argument of route definitions (before the handler function):

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
    .post(
        '/users/:id',
        {
            params: t.Object({
                id: t.Number() // Automatically coerced from string in params
            }),
            query: t.Object({
                filter: t.Optional(t.String()),
                tags: t.Optional(t.Array(t.String()))
            }),
            headers: t.Object({
                authorization: t.String() // Note: headers are always lower-case
            }),
            body: t.Object({
                name: t.String({ minLength: 2 }),
                email: t.String({ format: 'email' })
            }),
            response: {
                200: t.Object({
                    id: t.Number(),
                    query: t.Any(),
                    body: t.Any()
                }),
                400: t.Object({
                    error: t.String()
                })
            }
        },
        ({ params, query, headers, body }) => {
            return { id: params.id, query, body }
        }
    )
```

### Response Validation Per Status Code

Specify schemas for each HTTP status code. This unlocks end-to-end type safety in Eden Treaty and eliminates untyped responses:

```typescript
response: {
    200: UserDTO,
    400: ErrorDTO,
    401: UnauthorizedDTO
}
```

---

## 3. Elysia-Specific Types (`Elysia.t`)

Elysia extends TypeBox with server-focused data types:

| Type | Syntax | Description |
|---|---|---|
| **Numeric** | `t.Numeric()` | Coerces numeric strings into JavaScript numbers. Useful for query and params. |
| **BooleanString** | `t.BooleanString()` | Coerces `'true'`/`'false'` strings into boolean values. |
| **ObjectString** | `t.ObjectString()` | Parses a JSON-encoded string in query or headers into an object. |
| **UnionEnum** | `t.UnionEnum(['a', 'b', 1])` | Compact enum union supporting strings, numbers, and booleans. |
| **Nullable** | `t.Nullable(t.String())` | Allows value to be `T | null` (not undefined). |
| **MaybeEmpty** | `t.MaybeEmpty(t.String())` | Allows value to be `T | null | undefined`. |
| **File** | `t.File({ format: 'image/*', minSize, maxSize })` | Validates uploaded file MIME type and size (`'10m'`, `'500k'`). |
| **Files** | `t.Files()` | Validates an array of uploaded files. |
| **Cookie** | `t.Cookie({ name: t.String() }, { secrets, secure })` | Validates cookie jar and enables key rotation/signing. |
| **Form** | `t.Form({ file: t.File() })` | Sugar for `t.Object` for multipart/form-data. |
| **UInt8Array** | `t.UInt8Array()` | Validates binary buffers for raw uploads. |

### Automatic Coercion Rules

- **Number to Numeric**: When `t.Number()` is used directly as a top-level route schema for `params` or `query`, Elysia automatically converts it to `t.Numeric()`. (Nested inside `t.Object()`, always write `t.Number()`).
- **Boolean to BooleanString**: Top-level `t.Boolean()` in `params` or `query` is converted to `t.BooleanString()`.
- **Query Arrays**:
  - `nuqs` comma-delimited: `?tags=dev,ops` -> `['dev', 'ops']`
  - Multi-key HTML format: `?tags=dev&tags=ops` -> `['dev', 'ops']`

---

## 4. File Upload Validation & Security

When using `t.File`, Elysia automatically checks `multipart/form-data` and MIME types:

```typescript
new Elysia()
    .post('/upload', ({ body: { avatar } }) => {
        return avatar.name
    }, {
        body: t.Object({
            avatar: t.File({
                format: 'image/*',
                maxSize: '5m' // 5 MegaBytes
            })
        })
    })
```

### Magic-Number File Type Checking (`fileType`)

Content-Type headers can be spoofed by attackers. When using Standard Schema (like Zod), or validating raw files, use Elysia's `fileType` utility which inspects the file's binary magic number:

```typescript
import { Elysia, fileType } from 'elysia'
import { z } from 'zod'

new Elysia()
    .post('/upload', ({ body }) => body, {
        body: z.object({
            file: z.file().refine((file) => fileType(file, 'image/jpeg'))
        })
    })
```

---

## 5. Inferring TypeScript Types from Models

### Recommended Pattern: Model File (`model.ts`)

```typescript
import { t, type UnwrapSchema } from 'elysia'

export const UserModel = {
    user: t.Object({
        id: t.String(),
        username: t.String(),
        email: t.String({ format: 'email' }),
        role: t.UnionEnum(['admin', 'member', 'guest']),
        createdAt: t.Date()
    }),
    createUserBody: t.Object({
        username: t.String({ minLength: 3, maxLength: 30 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 })
    })
} as const

// Map each schema to its static TypeScript type
export type UserModel = {
    [K in keyof typeof UserModel]: UnwrapSchema<typeof UserModel[K]>
}
```

Now you can import and use `UserModel['user']` or `UserModel['createUserBody']` across services and components with 100% type accuracy.

---

## 6. Reference Models (`.model()`)

Reference models register schemas under a string identifier in Elysia's registry:

```typescript
// auth.model.ts
import { Elysia, t } from 'elysia'

export const authModel = new Elysia({ name: 'Auth.Model' })
    .model({
        'auth.signIn': t.Object({
            username: t.String(),
            password: t.String()
        }),
        'auth.user': t.Object({
            id: t.String(),
            username: t.String()
        })
    })
```

### Referencing in Controller

```typescript
// auth.ts
import { Elysia } from 'elysia'
import { authModel } from './auth.model'

export const auth = new Elysia()
    .use(authModel)
    .post('/sign-in', ({ body }) => {
        return { id: '1', username: body.username }
    }, {
        body: 'auth.signIn',     // Auto-completed model name
        response: 'auth.user'
    })
```

### Benefits of Reference Models
1. **OpenAPI / Swagger Naming**: Schemas appear with clean named models instead of anonymous objects.
2. **Type-Checking Performance**: Elysia caches model types during registration, accelerating TypeScript compile and editor response times.
3. **IDE Autocompletion**: Model names are suggested automatically in route schemas.

---

## 7. Standard Schema Interoperability

Elysia supports any library implementing the **Standard Schema** specification (e.g. Zod, Valibot, ArkType):

```typescript
import { Elysia } from 'elysia'
import { z } from 'zod'

new Elysia()
    .get('/profile/:id', ({ params: { id } }) => id, {
        params: z.object({
            id: z.coerce.number()
        })
    })
```

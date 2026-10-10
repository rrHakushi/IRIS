# Elysia OpenAPI & Documentation Pattern

Elysia provides first-class, automatic OpenAPI (v3) documentation generation via the official `@elysia/openapi` plugin. It powers interactive API explorers (Scalar UI by default) and generates machine-readable OpenAPI specifications (`/openapi/json`).

---

## 1. Installation & Compatibility

> [!IMPORTANT]
> **Elysia 2 Version Alignment**: When using Elysia v2 (`elysia@^2.0.0-beta.x`), install `@elysia/openapi@^2.0.0-beta.x`. Mixing `@elysia/openapi` v1 with Elysia v2 causes runtime incompatibilities (`app.getGlobalRoutes is not a function`).

Install the plugin:

```bash
bun add @elysia/openapi@^2.0.0-beta.4
```

---

## 2. Basic Setup

Register `openapi()` on the root Elysia instance:

```typescript
import { Elysia } from 'elysia'
import { openapi } from '@elysia/openapi'

export const app = new Elysia({ strictPath: true })
    .use(openapi())
    .get('/', 'Hello Elysia')
    .listen(process.env.ELYSIA_PORT || 4000)

export type App = typeof app
```

Once mounted:
- Interactive Scalar UI: `http://localhost:4000/openapi`
- Raw OpenAPI JSON Schema: `http://localhost:4000/openapi/json`

---

## 3. OpenAPI from Types (`fromTypes`)

By default, Elysia inspects runtime TypeBox schemas to build OpenAPI documentation. With `fromTypes()`, Elysia also inspects exported TypeScript types to generate schema definitions for implicit return types and route structures.

```typescript
import { Elysia, t } from 'elysia'
import { openapi, fromTypes } from '@elysia/openapi'

export const app = new Elysia()
    .use(
        openapi({
            references: fromTypes()
        })
    )
    .get('/ping', () => ({ status: 'ok' as const }))
```

### Production Deployment & Declaration Files
In production (or when bundling/compiling with `bun build --compile`), TypeScript source files may not be available at runtime. Pre-generate declaration files (`.d.ts`) during your build pipeline and switch references conditionally:

```typescript
import { Elysia } from 'elysia'
import { openapi, fromTypes } from '@elysia/openapi'

export const app = new Elysia()
    .use(
        openapi({
            references: fromTypes(
                process.env.NODE_ENV === 'production'
                    ? 'dist/index.d.ts'
                    : 'src/index.ts'
            )
        })
    )
```

### Monorepo Path Resolution (`projectRoot`)
In monorepo setups (such as `apps/elysia2/`), resolving relative paths to TypeScript config or project roots can fail. Provide the explicit `projectRoot`:

```typescript
import path from 'node:path'
import { Elysia } from 'elysia'
import { openapi, fromTypes } from '@elysia/openapi'

export const app = new Elysia()
    .use(
        openapi({
            references: fromTypes('src/index.ts', {
                projectRoot: import.meta.dir
            })
        })
    )
```

### Custom `tsconfig.json`
If your project uses a customized tsconfig (e.g. `tsconfig.build.json` or composite project references):

```typescript
openapi({
    references: fromTypes('src/index.ts', {
        tsconfigPath: 'tsconfig.dts.json'
    })
})
```

### Caveat: Explicit Types & `Prettify<T>`
Complex type aliases or external interface definitions may occasionally fail to inline in the generator. Use the `Prettify` utility helper to force TypeScript to expand the type:

```typescript
type Prettify<T> = {
    [K in keyof T]: T[K]
} & {}

interface UserProfile {
    id: string
    displayName: string
}

function getUser(): Prettify<UserProfile> {
    return { id: 'usr_1', displayName: 'Yuuno' }
}
```

---

## 4. Describing Routes (`detail`)

Use the `detail` route hook property to provide OpenAPI metadata. It conforms to OpenAPI V3 `OperationObject` and provides full autocomplete and type-safety:

```typescript
import { Elysia, t } from 'elysia'
import { AuthModel } from './model'
import { Auth } from './service'

export const auth = new Elysia({ prefix: '/auth' })
    .post(
        '/sign-in',
        {
            body: AuthModel.signInBody,
            response: {
                200: AuthModel.signInResponse,
                400: AuthModel.signInInvalid
            },
            detail: {
                summary: 'Sign in user',
                description: 'Authenticates a user via username/password credentials and issues a session cookie.',
                tags: ['Authentication']
            }
        },
        async ({ body, cookie: { session } }) => {
            const result = await Auth.signIn(body)
            session.value = result.token
            return result
        }
    )
```

### Field-Level Documentation
Add `description`, `examples`, or validation constraints directly to TypeBox fields in `model.ts`:

```typescript
export const AuthModel = {
    signInBody: t.Object({
        username: t.String({
            description: 'Registered account handle',
            examples: ['yuuno_iris']
        }),
        password: t.String({
            minLength: 8,
            description: 'Account password (minimum 8 characters)'
        })
    }, {
        description: 'User login credentials payload'
    })
}
```

### Hiding Endpoints from Documentation
To prevent internal, health-check, or admin routes from appearing in the documentation UI:

```typescript
app.get('/health', () => ({ status: 'healthy' }), {
    detail: {
        hide: true
    }
})
```

---

## 5. Tag Organization

Group related endpoints into logical sections in Scalar/Swagger UI:

### 1. Global Tag Descriptions
Define tag names and descriptions centrally in the `openapi()` configuration:

```typescript
app.use(
    openapi({
        documentation: {
            tags: [
                { name: 'Auth', description: 'Authentication and session issuance' },
                { name: 'Users', description: 'User profile and account operations' },
                { name: 'System', description: 'System status and operational endpoints' }
            ]
        }
    })
)
```

### 2. Controller-Level or Instance-Level Tags
Apply tags across an entire controller instance:

```typescript
export const userController = new Elysia({
    prefix: '/users',
    tags: ['Users']
})
    .get('/', () => getUsers())
    .get('/:id', ({ params }) => getUser(params.id))
```

---

## 6. Response Headers (`withHeader`)

To document custom HTTP headers returned by an endpoint in the OpenAPI schema, wrap your response schema with `withHeader`:

```typescript
import { Elysia, t } from 'elysia'
import { openapi, withHeader } from '@elysia/openapi'

export const app = new Elysia()
    .use(openapi())
    .get(
        '/version',
        ({ set }) => {
            set.headers['x-api-version'] = '2.0.0'
            return { version: '2.0.0' }
        },
        {
            response: withHeader(
                t.Object({ version: t.String() }),
                {
                    'x-api-version': t.String({ description: 'Current deployed engine version' })
                }
            )
        }
    )
```

> [!NOTE]
> `withHeader` is a documentation annotation for the OpenAPI specification. It does not set headers automatically at runtime; response headers must be populated via `set.headers`.

---

## 7. Model References (`.model()`)

Define reusable component schemas in the OpenAPI specification via `.model()`:

```typescript
const app = new Elysia()
    .model({
        User: t.Object({
            id: t.String(),
            username: t.String()
        })
    })
    .get('/me', () => ({ id: '1', username: 'yuuno' }), {
        response: {
            200: 'User'
        },
        detail: {
            tags: ['Users']
        }
    })
```

In the generated OpenAPI JSON, this registers a component schema under `#/components/schemas/User`.

---

## 8. Security Schemes (Bearer JWT & OAuth)

Define security components in `documentation.components.securitySchemes` and attach them to controllers or routes:

```typescript
export const app = new Elysia()
    .use(
        openapi({
            documentation: {
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT',
                            description: 'Enter your IRIS access token'
                        }
                    }
                }
            }
        })
    )

// Controller with enforced security in documentation
export const protectedController = new Elysia({
    prefix: '/account',
    detail: {
        tags: ['Account'],
        security: [
            { bearerAuth: [] }
        ]
    }
})
```

---

## 9. Standard Schema Mappers (`mapJsonSchema`)

When using schemas other than TypeBox (e.g. Zod, Valibot, or Effect), configure `mapJsonSchema` so `@elysia/openapi` can convert them to standard JSON Schema:

### Zod (v4 & v3)
```typescript
import openapi from '@elysia/openapi'
import * as z from 'zod'

// Zod 4 (native toJSONSchema)
openapi({
    mapJsonSchema: {
        zod: z.toJSONSchema
    }
})

// Zod 3 (via zod-to-json-schema)
import { zodToJsonSchema } from 'zod-to-json-schema'
openapi({
    mapJsonSchema: {
        zod: zodToJsonSchema
    }
})
```

### Valibot
```typescript
import openapi from '@elysia/openapi'
import { toJsonSchema } from '@valibot/to-json-schema'

openapi({
    mapJsonSchema: {
        valibot: toJsonSchema
    }
})
```

### Effect
```typescript
import openapi from '@elysia/openapi'
import { JSONSchema } from 'effect'

openapi({
    mapJsonSchema: {
        effect: JSONSchema.make
    }
})
```

---

## 10. Customizing Docs Path & Metadata

Change the documentation URL or API info properties:

```typescript
app.use(
    openapi({
        path: '/docs', // Mount Scalar UI at /docs and schema at /docs/json
        documentation: {
            info: {
                title: 'IRIS API Engine',
                version: '2.0.0',
                description: 'High-performance core microservices for IRIS.'
            }
        }
    })
)
```

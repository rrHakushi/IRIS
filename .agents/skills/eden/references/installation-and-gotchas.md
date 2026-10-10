# Eden Treaty: Installation & Common Gotchas

Guide for installing, setting up, and configuring TypeScript for Eden Treaty (`@elysia/eden`) in frontend apps and monorepos.

---

## 1. Installation

Install Eden Treaty in your frontend / client workspace:

```bash
# Using Bun
bun add @elysia/eden
bun add -d elysia

# Using pnpm
pnpm add @elysia/eden
pnpm add -D elysia

# Using npm
npm install @elysia/eden
npm install -D elysia
```

> [!IMPORTANT]
> Eden Treaty requires the `elysia` package as a dev dependency on the client to infer utility types. **The Elysia version on the client MUST match the server's Elysia version.**

---

## 2. Server Type Export

On the Elysia server, export the type of your Elysia application instance using TypeScript's `typeof`:

```typescript
// apps/backend/src/index.ts
import { Elysia, t } from 'elysia'

const app = new Elysia()
    .get('/', () => 'Hi Elysia')
    .get('/id/:id', ({ params: { id } }) => id)
    .post('/mirror', ({ body }) => body, {
        body: t.Object({
            id: t.Number(),
            name: t.String()
        })
    })
    .listen(3000)

// Export type definition for clients
export type App = typeof app
```

---

## 3. Client Consumption

In the client application, import the server type and initialize Eden Treaty:

```typescript
// apps/web/src/lib/elysia.ts
import { treaty } from '@elysia/eden'
import type { App } from '@IRIS/elysia' // Or relative import './server'

export const api = treaty<App>('localhost:3000')

// Usage in client components / services:
const { data: greeting } = await api.get()
const { data: user } = await api.id({ id: 1895 }).get()
const { data: mirrored } = await api.mirror.post({
    id: 1895,
    name: 'Skadi'
})
```

---

## 4. Common Gotchas & Troubleshooting

### 1. TypeScript Strict Mode (`tsconfig.json`)
Eden Treaty relies heavily on conditional types and template literals. Ensure `strict` mode is enabled in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### 2. Mismatched Elysia Versions
If client and server have differing Elysia versions in `node_modules`, type inference can fail or degrade to `any`.

Verify using your package manager's dependency inspection tool:
```bash
# pnpm
pnpm why elysia

# npm
npm why elysia

# bun
bun pm ls elysia
```

Ensure only **one single Elysia major/minor version** exists across the workspace root and all consumer apps.

### 3. Minimum TypeScript Version (>= 5.0)
Elysia and Eden utilize newer TypeScript features such as **Const Generics** and **Template Literal Inference**. The client project must use TypeScript **5.0 or later**:

```json
{
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### 4. Method Chaining is Mandatory on the Server
Elysia accumulates route and state types via method chaining. Breaking the chain breaks Eden's type inference:

```typescript
// ❌ WRONG: Broken method chaining loses type definitions
const app = new Elysia()
app.state('build', 1)
app.get('/', ({ store: { build } }) => build) // Property 'build' does not exist on store

// ✅ CORRECT: Method chaining preserves and folds inferred types
const app = new Elysia()
    .state('build', 1)
    .get('/', ({ store: { build } }) => build)
    .listen(3000)

export type App = typeof app
```

### 5. Bun-Specific Type Definitions
If your server handlers return Bun primitives (e.g. `Bun.file(...)`), install Bun types in the client project to resolve return types:

```bash
bun add -d @types/bun
# or
pnpm add -D @types/bun
```

### 6. Monorepo Path Aliases & Namespaces
In monorepos, if the frontend imports `type App` from a backend that uses internal path aliases (e.g., `@/controllers`), the frontend TypeScript compiler must also be able to resolve those paths, or types will collapse to `any`.

#### Recommended Solution: Namespaced Path Aliases
Define namespaces in the root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@backend/*": ["./apps/backend/src/*"],
      "@frontend/*": ["./apps/frontend/src/*"]
    }
  }
}
```

This prevents alias collisions and allows the frontend to cleanly resolve backend controller types without ambiguity.

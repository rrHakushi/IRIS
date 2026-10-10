# Eden Treaty: Tree-Like Syntax & Dynamic Paths

Eden Treaty translates your Elysia route definitions into an intuitive, tree-like JavaScript proxy structure with end-to-end type safety.

---

## 1. Tree-Like Syntax (Filesystem Analogy)

In REST APIs, URLs represent resource paths separated by `/` slashes:
- `/documents/elysia`
- `/documents/kalpas`
- `/api/v1/auth/sign-in`

In JavaScript, nested object access is expressed via dot notation (`.`). Eden Treaty maps each segment of your API path to nested object properties on the treaty client.

| API Path | Treaty Property |
| :--- | :--- |
| `/` | `api` (invoke methods directly on client) |
| `/hi` | `api.hi` |
| `/users` | `api.users` |
| `/deep/nested/path` | `api.deep.nested.path` |

---

## 2. HTTP Method Invocations

Attach the lowercase HTTP verb function to the final path segment:

```typescript
import { treaty } from '@elysia/eden'
import type { App } from './server'

const api = treaty<App>('localhost:3000')

// GET /
const res1 = await api.get()

// GET /hi
const res2 = await api.hi.get()

// POST /users
const res3 = await api.users.post({ name: 'Elysia' })

// PUT /settings/profile
const res4 = await api.settings.profile.put({ theme: 'dark' })

// DELETE /session
const res5 = await api.session.delete()

// PATCH /item
const res6 = await api.item.patch({ count: 5 })
```

---

## 3. Dynamic Path Parameters

Dynamic route parameters (like `:id` or `:name`) cannot be represented by property names alone because parameter values vary at runtime.

Eden Treaty provides a **parameterized function call** to pass path parameters clearly and type-safely.

### Single Parameter
```typescript
// Server: app.get('/item/:name', ({ params: { name } }) => ...)

// Client:
const { data } = await api.item({ name: 'Skadi' }).get()
```

### Multiple Dynamic Segments & Nested Paths
```typescript
// Server: app.get('/org/:orgId/repo/:repoId/commits', ...)

// Client:
const { data } = await api
    .org({ orgId: 'elysiajs' })
    .repo({ repoId: 'eden' })
    .commits
    .get()
```

### Path Parameter Mapping Table

| Elysia Route Definition | Eden Treaty Client Call |
| :--- | :--- |
| `app.get('/item', ...)` | `api.item.get()` |
| `app.get('/item/:name', ...)` | `api.item({ name: 'Skadi' }).get()` |
| `app.get('/item/:name/details', ...)` | `api.item({ name: 'Skadi' }).details.get()` |
| `app.put('/users/:id/role', ...)` | `api.users({ id: 1895 }).role.put({ role: 'admin' })` |
| `app.delete('/posts/:postId/comments/:commentId', ...)` | `api.posts({ postId: '1' }).comments({ commentId: '99' }).delete()` |

---

## 4. Wildcards & Catch-All Routes

For wildcard paths (e.g., `/files/*`):

```typescript
// Server:
const app = new Elysia()
    .get('/files/*', ({ params }) => params['*'])

// Client:
const { data } = await api.files({ '*': 'documents/report.pdf' }).get()
```

---

## 5. IDE Autocompletion & Type Inference

Because Eden Treaty operates on TypeScript type representations:
1. Typing `api.` triggers autocomplete showing all root routes and methods.
2. Typing `api.users({` prompts you for the exact dynamic parameters defined in the route pattern.
3. Typos in path segments or parameter keys produce compile-time TypeScript errors before you even run your code.

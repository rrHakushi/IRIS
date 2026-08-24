# SDK Generation (`@nestia/sdk`)

`@nestia/sdk` reads the controllers and emits a typed fetch SDK, a `swagger.json`, and an E2E test scaffold — all from one config file.

## The config file

Place `nestia.config.ts` at the project root, next to `tsconfig.json`. Bootstrap an empty one with `npx nestia init`.

```ts
import { INestiaConfig } from "@nestia/sdk";
import { NestFactory } from "@nestjs/core";
// import { FastifyAdapter } from "@nestjs/platform-fastify";

import { AppModule } from "./src/AppModule";

const NESTIA_CONFIG: INestiaConfig = {
  input: async () => {
    const app = await NestFactory.create(AppModule);
    // const app = await NestFactory.create(AppModule, new FastifyAdapter());
    // app.setGlobalPrefix("api");
    // app.enableVersioning({ type: VersioningType.URI, prefix: "v" });
    return app;
  },
  output: "src/api",
  swagger: {
    output: "packages/api/swagger.json",
    openapi: "3.1",
    servers: [{ url: "http://localhost:3000" }],
    info: { title: "My API", version: "1.0.0" },
  },
  distribute: "packages/api",
  simulate: true,
  e2e: "test/features/api",
  // propagate: true,
  // clone: true,
  // primitive: true,
  // assert: false,
  // json: false,
};
export default NESTIA_CONFIG;
```

## Every config field

### `input` (required)

Tells `@nestia/sdk` where the controllers live. Three forms:

- **Function returning an `INestApplication`** (most reliable — what the wizard scaffolds):
  ```ts
  input: async () => NestFactory.create(AppModule)
  ```
  This guarantees the same module graph the runtime uses, including any `setGlobalPrefix` / versioning. If the app uses Fastify, pass the `FastifyAdapter` here too — it changes route registration in subtle ways.

- **Glob pattern(s) by path** (faster, no boot):
  ```ts
  input: ["src/**/*.controller.ts"]
  ```

- **Include + exclude object**:
  ```ts
  input: {
    include: ["src/**/*.controller.ts"],
    exclude: ["src/**/*.test.ts"],
  }
  ```

The function form is recommended for accuracy. The glob form is faster but skips anything that requires the Nest container to resolve.

### `output` (required for `nestia sdk`)

Directory where the generated SDK is written. Conventional choice: `"src/api"`. Conventional structure:

```
src/api/
├── HttpError.ts
├── IConnection.ts
├── functional/             # one file per controller method
│   └── bbs/
│       └── articles/
│           └── index.ts
├── module.ts               # re-exports everything
└── structures/             # DTO type re-exports
```

### `swagger` (optional)

Configuration block for `npx nestia swagger`. If omitted, swagger generation is disabled.

```ts
swagger: {
  output: "packages/api/swagger.json",
  openapi: "3.1",                                    // or "3.0" or "2.0"
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "http://localhost:3000" }],
  security: {                                        // declare auth schemes
    bearer: { type: "http", scheme: "bearer" },
  },
  tags: [
    { name: "articles", description: "Article CRUD" },
  ],
  decompose: true,                                   // each query DTO field as separate param
  operationId: ({ class: c, function: f }) => `${c}_${f}`,
}
```

`output` can be a directory (file becomes `swagger.json`) or a full path.

`openapi: "3.1"` is the default and the source of truth. Setting `"3.0"` or `"2.0"` runs `OpenApi.downgrade` to produce a backwards-compatible doc — useful when the consumer (Swagger UI / Postman / older codegens) can't handle 3.1.

### `distribute` (optional)

Where to scaffold a publishable npm package containing the SDK. Conventional value: `"packages/api"`. After `npx nestia sdk`, that directory has its own `package.json`, `tsconfig.json`, README, and the generated SDK files — ready for `cd packages/api && npm publish`.

This is how the SDK gets shared with frontend/mobile teams as a versioned dependency.

### `simulate` (optional, default `false`)

If `true`, the generated SDK includes a "mockup simulator" — every function gets a branch that activates when the connection's `simulate: true` is set. The branch validates inputs with `typia.assert<T>()` and returns random valid responses with `typia.random<T>()`.

```ts
const connection: api.IConnection = {
  host: "http://localhost:3000",
  simulate: true,
};
const article = await api.functional.bbs.articles.create(connection, "general", input);
// runs locally, no network call
```

This is the feature to mention whenever the user complains about frontend being blocked on backend implementation.

### `e2e` (optional)

Directory for auto-generated E2E test scaffolds. Running `npx nestia e2e` reads the controllers and writes one test file per route that imports the SDK and calls the endpoint. The user fills in the assertions; nestia handles the boilerplate.

### `propagate` (optional, default `false`)

Changes the SDK's return contract. Without it, an SDK function rejects with `HttpError` on non-2xx. With `propagate: true`, it always resolves to an `IPropagation<StatusMap>`:

```ts
type Output = IPropagation<{
  200: IArticle;
  400: TypeGuardError.IProps;
  404: INotFound;
}>;

const out = await api.functional.articles.update(connection, id, input);
if (out.success) {
  const article: IArticle = out.data;        // narrowed to 200 branch
} else if (out.status === 400) {
  const err: TypeGuardError.IProps = out.data;
} else if (out.status === 404) {
  const err: INotFound = out.data;
} else {
  const result: unknown = out.data;          // out-of-band status
}
```

The status codes in the type come from the route's `@TypedException` decorators plus the success response. This is how to get an exhaustive, type-checked error-handling pattern without try/catch.

### `clone` (optional, default `false`)

If `true`, every DTO type the controllers reference is copied into `<output>/structures/` as a standalone interface. The SDK then references the cloned versions instead of the originals.

The motivation: ORM-coupled DTOs. If a controller returns a `User` from Prisma directly (no separate DTO), publishing the SDK would force consumers to install Prisma. `clone: true` strips Prisma-specific types and replaces them with plain TypeScript shapes, so the SDK has no ORM dependency.

Symptom that means "you should have set `clone: true`": SDK consumers complaining about transitive `@prisma/client` or `typeorm` installs.

### `primitive` (optional, default `true`)

Wraps every DTO returned by the SDK in `Primitive<T>`. `Primitive<T>` strips methods (`Date` → `string`, `class.toJSON()` → its return type), reflecting what actually arrives over the wire.

Leave at default unless the DTOs are already JSON-shaped and the wrapping is annoying.

### `assert` (optional, default `false`)

If `true`, every SDK call wraps its arguments in `typia.assert<T>()` before sending. Catches runtime type errors at the client. Slows compilation slightly. Worth it when SDK consumers aren't using strict TypeScript and the extra safety pays off.

### `json` (optional, default `false`)

If `true`, the SDK uses `typia.assertStringify<T>()` to serialize request bodies — ~10x faster than `JSON.stringify` and validates as it serializes. Slows compilation slightly. Useful when SDK calls are on a hot path.

## CLI commands

```bash
npx nestia sdk           # regenerate SDK to <output>
npx nestia swagger       # regenerate <swagger.output>
npx nestia e2e           # regenerate <e2e>
npx nestia all           # all of the above
```

Custom config or tsconfig path:

```bash
npx nestia sdk --config nestia2.config.ts --project tsconfig2.json
```

Wire these into `package.json` so they run on every commit / CI:

```jsonc
{
  "scripts": {
    "build": "tsc",
    "sdk": "nestia sdk",
    "swagger": "nestia swagger",
    "e2e": "nestia e2e",
    "prebuild": "npm run sdk && npm run swagger"
  }
}
```

## Distribution to frontend teams

With `distribute` set, the workflow is:

```bash
npx nestia sdk            # populates packages/api/
cd packages/api
npm version patch         # or minor/major
npm publish
```

The generated `packages/api/package.json` already has the correct `name`, `main`, `types`, `peerDependencies` (typia), and an empty `dependencies` (because the SDK uses only `fetch`). Customize `name`, `description`, and `repository` once at scaffold time; subsequent `npx nestia sdk` runs preserve those edits.

For a private monorepo, skip the publish — pnpm/yarn workspace links pick up the package automatically.

## PNPM monorepo specifics

If the project is a pnpm workspace, the typical layout is:

```
my-monorepo/
├── pnpm-workspace.yaml
├── packages/
│   ├── api/                # generated SDK package
│   │   └── package.json    # auto-generated; name = "@my/api"
│   └── server/             # NestJS server
│       ├── nestia.config.ts
│       ├── package.json
│       └── src/
└── apps/
    ├── web/                # imports "@my/api"
    └── mobile/             # imports "@my/api"
```

In `packages/server/nestia.config.ts`, set `distribute: "../api"`. After `npx nestia sdk`, the `packages/api/` workspace has the freshly generated SDK and is consumable by `web` / `mobile` via the workspace link.

When publishing as a real npm package from a pnpm workspace, `pnpm publish --filter @my/api` is the right command. Don't run `npm publish` inside `packages/api` directly — pnpm's `node_modules` layout will confuse it.

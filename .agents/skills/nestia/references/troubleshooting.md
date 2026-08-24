# Troubleshooting

When nestia "doesn't work", it almost always silently no-ops rather than failing loudly. The decorators still type-check, the project still compiles — but the runtime validators are absent, the SDK is empty, or swagger has missing routes. This file is the diagnosis tree for the common failure modes.

## Diagnosis flow

Start by asking the user three things:

1. What's the exact symptom? ("Validation isn't running", "SDK is empty", "Swagger missing routes", "Build fails", "JSDoc descriptions vanished".)
2. Which compiler is being used? Show me `nest-cli.json` and the `build` script in `package.json`.
3. Was `npm run prepare` (or `pnpm run prepare` / `yarn run prepare`) actually run? If yes, what did it print?

The answer to #2 alone resolves a lot of cases. The answer to #3 resolves most of the rest.

## Symptom: "Validation isn't running" / "@TypedBody accepts garbage"

A `@TypedBody()` parameter is happily letting through requests that should fail validation. Or `@TypedRoute.Get()` returns the controller's value without serializing/validating it.

This means the typia + `@nestia/core` transform did not actually run during compilation. Check, in order:

### 1. Wrong compiler

If `nest-cli.json` has `"builder": "swc"` or `"builder": "esbuild"`, switch back to default `tsc`. Same for `package.json` `build` scripts that call `swc` or `tsc-esbuild` directly. Nestia requires the standard Microsoft `tsc` because it needs type information at compile time; SWC, esbuild, and Babel all strip types.

```jsonc
// nest-cli.json — correct
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

No `compilerOptions.builder`. Default builder uses `tsc`.

### 2. `prepare` script wasn't run

```bash
npm run prepare
```

This runs `ts-patch install && typia patch`. Without it, `tsc` ignores the `plugins` array in `tsconfig.json`. The script should already be in `package.json`:

```jsonc
"scripts": { "prepare": "ts-patch install && typia patch" }
```

If `prepare` isn't there, the wizard didn't finish — re-run `npx nestia setup`.

After running `prepare`, recompile and retest.

### 3. `tsconfig.json` plugins are missing

Confirm `tsconfig.json` has at minimum:

```jsonc
"compilerOptions": {
  "strict": true,
  "plugins": [
    { "transform": "typia/lib/transform" },
    {
      "transform": "@nestia/core/lib/transform",
      "validate": "validate",
      "stringify": "assert"
    }
  ]
}
```

If `strict` (or at least `strictNullChecks`) is off, typia's transform produces validators that pass everything because it can't trust the type info. Turn it on.

### 4. Mismatched package versions

`@nestia/core` and `@nestia/sdk` should be on the same major version. Mixed majors (e.g. `@nestia/core@10` with `@nestia/sdk@11`) can produce subtly broken transforms. Check:

```bash
npm ls @nestia/core @nestia/sdk typia nestia
```

If versions disagree, bump them all together:

```bash
npm install @nestia/core@latest @nestia/sdk@latest typia@latest nestia@latest
npm run prepare
```

### 5. Custom transformer running before typia

Other ts-patch plugins ahead of typia in the `plugins` array can mangle the AST in ways that hide the types from typia. Move typia first:

```jsonc
"plugins": [
  { "transform": "typia/lib/transform" },
  { "transform": "@nestia/core/lib/transform", ... },
  // any other custom transforms after these
]
```

## Symptom: "SDK is empty" or "SDK doesn't include my new route"

`npx nestia sdk` runs without errors but the `output` directory has no functions, or a route added to a controller doesn't appear.

### 1. `input` doesn't reach the new controller

If `input` is the function form, the controller has to be registered through the module graph. A controller declared in a file but not imported by any `@Module({ controllers: [...] })` is invisible.

If `input` is a glob pattern, confirm the pattern actually matches:

```bash
node -e "console.log(require('fast-glob').sync(['src/**/*.controller.ts']))"
```

### 2. `output` was deleted but not regenerated

`npx nestia sdk` writes to `output`; it doesn't watch. After deleting the directory, re-run the command. For automation, add it to a `pre*` script or a CI step.

### 3. The transform silently failed at compile time

NX is the prime offender here — see "NX swallows errors" below. Outside NX, run `tsc --noEmit` first; any type errors block the SDK generation in ways the `nestia sdk` command may not surface clearly.

### 4. Controllers use vanilla decorators that nestia can't introspect

A method decorated with a custom `@MyOwnRouteDecorator()` that wraps `@Get` might not be recognized. Use `@TypedRoute.*` (or vanilla `@Get`/`@Post`) directly on the controller method.

## Symptom: "Swagger document is missing routes"

`swagger.json` is generated but a controller's routes don't show up in it.

Same first three checks as the SDK case — the swagger generator uses the same `input` and the same compile pipeline. Plus:

### 1. Route uses a non-standard HTTP method decorator

Swagger generation only follows methods decorated with `@TypedRoute.*` or NestJS's standard `@Get`/`@Post`/etc. Custom shorthand decorators that wrap them won't be found. Replace with the standard decorator.

### 2. Controller is excluded by a filter

Check `nestia.config.ts` for `input.exclude` patterns that might match the controller file unintentionally.

## Symptom: "JSDoc descriptions are missing in swagger" (TypeScript 5.3+)

`@summary`, `@description`, and per-property comments used to show up in `swagger.json` but stopped after a TypeScript upgrade.

This is a known regression: TypeScript 5.3 stopped parsing `JSDocComment` nodes for performance. The fix is `npx typia patch`, which restores parsing. It's already in the `prepare` script for new projects:

```jsonc
"scripts": { "prepare": "ts-patch install && typia patch" }
```

For existing projects upgrading TypeScript, append `&& typia patch` to the `prepare` script and re-run it. The patch is idempotent and is intended as a temporary shim until upstream `ts-patch` adds first-class TypeScript 5.3 support.

## Symptom: "Build fails after npm install on CI"

CI runs `npm ci --omit=dev` or `npm install --production` and fails because `prepare` tries to run `ts-patch install` without the dev dependencies present.

Pass `--ignore-scripts` when installing for a production deploy:

```bash
npm ci --omit=dev --ignore-scripts
# or
npm install --production --ignore-scripts
```

If the user is shipping a single-bundle deploy (webpack-bundled, no `node_modules`), this isn't needed — there's no `prepare` step at the destination at all.

## Symptom: "NX silently produces wrong output"

`nx <package>:build` succeeds but the compiled JavaScript doesn't have the typia validators inlined.

NX swallows ts-patch / nestia transform errors. To see them, run `tsc` directly on the package:

```bash
tsc --project packages/<name>/tsconfig.lib.json --outDir dist/packages/<name>-debug --noEmit
```

Or add a debug task to `project.json`:

```jsonc
"build:validate:nestia": {
  "executor": "nx:run-commands",
  "options": {
    "commands": [
      "tsc --project packages/<name>/tsconfig.lib.json --outDir dist/packages/<name>-debug"
    ]
  }
}
```

The most common NX-specific cause: `tsconfig.lib.json` doesn't carry the `plugins` array. NX uses per-package tsconfigs, and the plugins must be repeated in each one (or extended from a shared base). See `references/setup.md` "NX monorepo".

NX's per-plugin `transformers` field is **not** compatible with nestia. NX expects a `before` hook; nestia uses `ts-patch` instead. Don't try to wire nestia through NX's transformer slot.

## Symptom: "Webpack build fails / runtime crashes after webpack"

### `nest build --webpack` was used

Don't. `@nestjs/cli`'s webpack flow is incompatible with nestia's transforms. Use `npx webpack` directly with a config that uses `ts-loader`. See `references/setup.md` "Webpack — with node_modules".

### `prepare` runs in production install

Webpack output directory is deployed and starts with a fresh `npm install`, which runs `prepare`, which fails because dev deps are gone. Use `--ignore-scripts` or skip the install entirely (single-bundle path).

### `class-validator` / `class-transformer` ignored at runtime

The `IgnorePlugin` config in the single-bundle webpack template intentionally ignores these because nestia replaces them. If the project still uses them anywhere (e.g. inherited code), remove that piece of the IgnorePlugin filter — or, better, finish the migration to typia-backed validation.

## Symptom: "Type 'X' is not assignable to typia.tags.X<...>"

Confusing typia tag errors when a type is intersected with `tags.Format<"uuid">` etc.

Usually one of:

- The base type is wrong: `tags.Format` only applies to `string`. `tags.Type<"uint32">` only applies to `number`. `tags.MinItems` only applies to arrays.
- Two contradictory tags on the same type: `string & tags.MinLength<10> & tags.MaxLength<3>` is a logic error typia rejects.
- Imported `tags` from the wrong place: `import { tags } from "typia"`, not from `@nestia/core` or anywhere else.

## Symptom: "Cannot find module '@nestia/core/lib/transform'"

`tsc` can't resolve the transform plugin path. Two causes:

- `@nestia/core` isn't actually installed (or installed in a workspace the current `tsconfig.json` doesn't see). Re-run `npm install`.
- pnpm strict resolution: pnpm hoists nothing by default, so the transform may not be resolvable from where `tsc` is looking. Add a `.npmrc` with `node-linker=hoisted` (last resort) or migrate the project to `pnpm`'s recommended layout where every package declares its dependencies explicitly.

## Symptom: "WebSocket route never accepts connections"

Built a `@WebSocketRoute()` controller, but `ws://localhost:3000/...` connections hang or are rejected.

The bootstrap is missing `WebSocketAdaptor.upgrade(app)`:

```ts
import { WebSocketAdaptor } from "@nestia/core";

const app = await NestFactory.create(AppModule);
await WebSocketAdaptor.upgrade(app); // <-- required
await app.listen(3001);
```

Without that call, the HTTP server never accepts WebSocket upgrade requests. This is the #1 mistake when first using `@WebSocketRoute`.

## Symptom: "Agentica calls fail with 'function not found'"

The agent decides to call a function that doesn't exist on the controller. Two common causes:

- The swagger document is stale. Regenerate with `npx nestia swagger` and reload it in the agent.
- An HTTP controller was registered with a `connection.host` that doesn't match the deployment. The agent calls the function name, but `@agentica/core` builds the URL from `connection.host + operation.path` — if the path prefix is wrong, the call 404s and the model retries with a different name.

## Symptom: "Generated SDK has weird `Primitive<T>` wrappers everywhere"

The SDK's input and output types are `Primitive<IBbsArticle>` instead of `IBbsArticle`. This is intentional — `Primitive<T>` reflects what actually traverses JSON (no methods, `Date` becomes `string`, etc.). If the wrapping is more annoying than helpful (e.g. all DTOs are already plain interfaces), turn it off:

```ts
const NESTIA_CONFIG: INestiaConfig = {
  // ...
  primitive: false,
};
```

## Symptom: "Mockup simulator returns the same random data every time"

`typia.random<T>()` is deterministic per process by default. For varied data on each call, the simulator path uses a different seed each invocation — but the user may be observing a cached response from a service worker or a memoized hook upstream. Confirm by adding a temporary `console.log` inside an SDK call: if the log fires once and stops, the cache is upstream of the SDK, not in nestia.

## When to give up and ask Anthropic, the maintainer, or the community

If, after the above, the symptom doesn't match anything: the project's specific compiler-plugin combination may be hitting an edge case. The author is responsive on:

- GitHub issues: https://github.com/samchon/nestia/issues
- Discord: https://discord.gg/E94XhzrUCZ
- The nestia "Gurubase" doc chatbot: https://gurubase.io/g/nestia (often answers setup questions in seconds)

Before opening an issue, get a minimal reproduction: `npx nestia start tmp-repro`, add the smallest controller that reproduces the bug, and link it.

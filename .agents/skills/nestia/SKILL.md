---
name: nestia
description: Build, configure, and ship NestJS backends with Nestia — covering @nestia/core super-fast typed decorators (TypedRoute/TypedBody/TypedQuery/TypedParam/TypedHeaders/TypedFormData/TypedException/WebSocketRoute), @nestia/sdk for type-safe SDK and Swagger generation, the mockup simulator, automatic E2E test generation, and the Agentica/@agentica AI chatbot integration. Use this skill whenever the user mentions nestia, @nestia/core, @nestia/sdk, typia (in a NestJS context), Agentica, agentic LLM function calling from a NestJS server, swapping out class-validator/class-transformer for typia-powered validation, generating a typed fetch SDK from controllers ("like tRPC for NestJS"), building swagger.json from TypeScript types instead of @ApiProperty decorators, fixing ts-patch / typia patch / "transform plugin not found" / NX nestia transform / webpack bundling errors, or whenever they describe symptoms that match (e.g. "my SDK isn't regenerating", "Swagger is missing my routes", "validation is too slow", "I want a mockup backend for the frontend"). Also trigger on phrases like "convert NestJS controllers to LLM function calling", "generate AI chatbot from swagger", or "type-safe NestJS client SDK".
---

# Nestia

Nestia is a set of helper libraries for [NestJS](https://docs.nestjs.com) that replaces class-validator / class-transformer / @nestjs/swagger / manual SDK writing with one mechanism: pure TypeScript types compiled into runtime code by `typia`. The end result is faster validation, an auto-generated typed fetch SDK, an auto-generated `swagger.json`, an auto-generated E2E test suite, and a one-command path to an LLM-powered AI chatbot via `@agentica`.

This skill covers what each package does, how to set it up correctly (the setup is the part most projects get wrong), the decorator API, the `nestia.config.ts` schema, and how to debug the common failure modes.

## When this skill applies

Trigger on any of these and consult the relevant reference file:

| Situation | Read first |
|---|---|
| Brand new project, "set up nestia" | `references/setup.md` |
| Existing NestJS project, adding nestia | `references/setup.md` |
| Writing or porting controllers | `references/core-decorators.md` |
| Generating client SDK / swagger.json | `references/sdk-generation.md` |
| Building AI chatbot from server | `references/agentic-ai.md` |
| E2E test generation | `references/e2e-testing.md` |
| Build is broken / SDK isn't regenerating / NX or webpack issue | `references/troubleshooting.md` |

The reference files are loaded only as needed — don't read them all upfront.

## The package map

Nestia is several npm packages working together. Knowing which one does what prevents installing the wrong thing.

- **`@nestia/core`** — runtime decorators that replace `@Body`/`@Query`/`@Param`/etc. with versions backed by typia. This is the package responsible for the 20,000x validation speedup and JSON serialization. Installed as a regular `dependency`.
- **`@nestia/sdk`** — the build-time toolchain that reads your controllers and emits the SDK, `swagger.json`, and E2E test scaffolding. Installed as `devDependency`.
- **`@nestia/e2e`** — runtime helpers used by the generated E2E tests (`TestValidator`, `ArrayUtil`, etc.). Installed as a regular `dependency`.
- **`nestia`** — the CLI (`npx nestia setup`, `npx nestia sdk`, `npx nestia swagger`, `npx nestia e2e`, `npx nestia start`, `npx nestia template`). Installed as `devDependency`.
- **`typia`** — the underlying transformer. Nestia is built on top of it; you'll see its `tags.Format<"uuid">`, `tags.MinLength`, etc. in DTO types. Installed as a regular `dependency`.
- **`@agentica/core`** + **`@agentica/rpc`** + **`@samchon/openapi`** + **`tgrid`** — separate ecosystem (was once `@nestia/agent`, now its own family) for turning a Swagger document into an LLM-callable agent. Installed only when building an AI chatbot.

Latest stable versions as of April 2026: `@nestia/core` and `@nestia/sdk` at 11.x, `nestia` CLI at 10.x. Always verify with `npm view <pkg> version` if the user is hitting a strange error — sometimes the fix is just bumping all four nestia packages together.

## The single most important setup detail

**Nestia only works with the standard Microsoft TypeScript compiler.** Not SWC, not esbuild, not Babel. These compilers strip type information, and `@nestia/core` needs that type information at compile time to generate validators and serializers. If a user's `nest-cli.json` has `"builder": "swc"` or their bundler is esbuild, they will get bizarre runtime errors (validators that pass everything, empty SDK output, missing routes in swagger). The fix is to switch back to `tsc`.

The pipeline that has to be set up is:

1. `tsconfig.json` declares the `plugins` (typia + `@nestia/core` + optionally `@nestia/sdk`).
2. `package.json` has `"prepare": "ts-patch install && typia patch"`.
3. `npm run prepare` is run once (and re-runs on `npm install`) so `ts-patch` rewires `tsc` to honor those plugins.
4. From then on, `tsc` (and only `tsc`) compiles the project with full nestia magic.

If any link in that chain breaks, nestia silently no-ops. `references/setup.md` walks through this end-to-end including `npx nestia setup` (the recommended path) and the manual setup.

## Core decorator API at a glance

Imports come from `@nestia/core`. These are drop-in replacements for the equivalent NestJS decorators, but with type-driven validation and serialization compiled in.

- **`@TypedRoute.Get/Post/Put/Patch/Delete/Head`** — like `@Get` etc., but the response body is type-checked and JSON-serialized via `typia.assertStringify` (~200x faster than `JSON.stringify` + `class-transformer`).
- **`@TypedBody()`** — request body. Validates the parsed JSON against the parameter's TypeScript type. ~20,000x faster than `class-validator` and supports unions, recursion, template literal types, and typia tags.
- **`@TypedParam("name")`** — single path parameter, type-coerced and validated.
- **`@TypedQuery()`** — query string, parsed and validated against a DTO interface.
- **`@TypedFormData.Body()`** — `multipart/form-data` body (file uploads + fields).
- **`@TypedHeaders()`** — request headers as a typed object.
- **`@TypedException<T>(status)`** — declares a possible error response type for a route. Picked up by both the swagger generator and the `propagate` mode of the SDK.
- **`@WebSocketRoute()`** + **`@WebSocketRoute.Acceptor()`** etc. — type-safe WebSocket RPC, replacing `@WebSocketGateway`. Integrates with the SDK so clients can call WebSocket endpoints just like HTTP ones.

Full signatures, examples, and gotchas live in `references/core-decorators.md`.

## DTOs are pure TypeScript

A nestia DTO is a plain `interface` (or `type`). No decorators, no class. Constraints are expressed as intersection types using `typia` tags:

```ts
import { tags } from "typia";

export interface IBbsArticle {
  id: string & tags.Format<"uuid">;
  title: string & tags.MinLength<3> & tags.MaxLength<50>;
  body: string;
  thumbnail: (string & tags.Format<"uri">) | null;
  created_at: string & tags.Format<"date-time">;
}
export namespace IBbsArticle {
  export interface ICreate {
    title: string & tags.MinLength<3> & tags.MaxLength<50>;
    body: string;
    thumbnail: (string & tags.Format<"uri">) | null;
  }
}
```

Because there are no decorators, the same interface works as request body type, response type, swagger schema source, and SDK type — all without duplication. JSDoc comments on the interface members become Swagger field descriptions; this is the documentation strategy nestia recommends instead of `@ApiProperty`. Note: with TypeScript ≥ 5.3 you also need `npx typia patch` (idempotent) for JSDoc-derived features to work, until upstream `ts-patch` catches up.

## SDK & swagger generation in one config

A single `nestia.config.ts` at the project root drives everything that `npx nestia sdk`, `npx nestia swagger`, and `npx nestia e2e` produce. Minimal shape:

```ts
import { INestiaConfig } from "@nestia/sdk";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/AppModule";

const NESTIA_CONFIG: INestiaConfig = {
  input: async () => NestFactory.create(AppModule),
  output: "src/api",                      // SDK destination
  swagger: {
    output: "packages/api/swagger.json",  // Swagger destination
    openapi: "3.1",
    servers: [{ url: "http://localhost:3000" }],
  },
  distribute: "packages/api",             // optional npm-publishable SDK package
  simulate: true,                         // bake a mockup simulator into the SDK
  // propagate: true,                     // return IPropagation<T> instead of throwing
  // clone: true,                         // copy DTO types into the SDK (decouples ORM)
  // primitive: true,                     // wrap DTO types in Primitive<T> (default true)
  // assert: false,                       // typia.assert SDK arguments at runtime
  // json: false,                         // typia.assertStringify response bodies
};
export default NESTIA_CONFIG;
```

The full `INestiaConfig` schema, the meaning of every flag, and how `clone` / `propagate` / `simulate` change generated output are in `references/sdk-generation.md`.

After configuring, the loop is just:

```bash
npx nestia sdk      # regenerate the SDK
npx nestia swagger  # regenerate swagger.json
npx nestia e2e      # regenerate the e2e test scaffolds
```

Add these to `package.json` scripts (`"sdk": "nestia sdk"`, etc.) and to a CI step so the SDK never drifts from the controllers.

## Mockup simulator (frontend-first development)

If `simulate: true` is set in `nestia.config.ts`, the generated SDK ships with an embedded fake backend. Frontend developers flip one flag on the connection object and the SDK starts validating their inputs with `typia.assert<T>()` and returning random-but-type-correct responses from `typia.random<T>()` — no real server needed.

```ts
const connection: api.IConnection = {
  host: "http://localhost:3000",
  simulate: true, // <- mockup mode
};
const article = await api.functional.bbs.articles.create(connection, "general", input);
```

When the real backend is ready, drop the `simulate: true` and the same call hits the live server. This is the closest thing nestia has to a "killer feature" for full-stack teams; mention it whenever the user complains about frontend being blocked on backend.

## AI chatbot — the @agentica path

Nestia's chatbot story is now a separate package family called `@agentica`. The pipeline is: write controllers normally → `npx nestia swagger` → feed `swagger.json` into `@agentica/core` → it converts every operation into an LLM function-calling schema, picks which one to call from the user's message (selector → caller → describer agents), and uses `typia.validate` to feed validation errors back to the model on bad calls. With `gpt-4o-mini`, validation feedback typically takes function-call success rate from ~50% on the first try to 99% on the second. Details, the WebSocket controller pattern, and the validation-feedback loop are in `references/agentic-ai.md`.

## How to actually help a nestia user

1. **Ask which package and version they're on** before guessing. `@nestia/core` 11.x and 10.x have the same surface but different transform internals; mismatched `@nestia/core` and `@nestia/sdk` versions are a common source of "it just stopped working".
2. **Verify the compiler** when anything weird is happening — ask to see `nest-cli.json`, `tsconfig.json`, and confirm `npm run prepare` was run after install. Most "nestia doesn't work" issues are really "the transform plugins aren't actually loaded".
3. **Read the right reference** — don't try to remember every flag. The reference files exist precisely so the model can answer specific questions accurately. Open them when the question demands depth.
4. **Prefer `npx nestia setup` over manual setup** when bootstrapping. It edits `tsconfig.json` and `package.json` correctly, including the `prepare` script. Manual setup is for people who already know the failure modes.
5. **Don't reach for `class-validator` / `@ApiProperty` / `class-transformer`** in nestia code — they coexist with nestia but defeat its purpose. If the user's project has them, they're the legacy path being replaced.

## Reference files

- `references/setup.md` — wizard, manual, NX, webpack, and "single-JS-file" bundling setups, plus the standard-TypeScript-compiler-only constraint.
- `references/core-decorators.md` — every `@Typed*` decorator with signatures, examples, and edge cases.
- `references/sdk-generation.md` — full `INestiaConfig` schema, clone mode, propagation mode, distribution, monorepo setup, CLI flags.
- `references/swagger-generation.md` — runtime vs build-time swagger, JSDoc-driven docs, security schemes, decompose, operation IDs.
- `references/e2e-testing.md` — auto-generated e2e tests with `@nestia/e2e`'s TestValidator, dynamic test loaders, `@nestia/benchmark`.
- `references/agentic-ai.md` — `@agentica/core`, `@agentica/rpc`, validation feedback, WebSocket chatbot controller pattern.
- `references/troubleshooting.md` — the failure modes (transform not applied, NX swallowing errors, SWC/esbuild incompatibility, JSDoc lost on TS 5.3+, SDK out of sync, etc.).

## Templates

- `assets/nestia.config.template.ts` — a fully-commented `nestia.config.ts` ready to drop in.
- `assets/tsconfig.template.json` — a tsconfig wired with the typia + `@nestia/core` + `@nestia/sdk` transforms.
- `assets/package.scripts.json` — the script entries (`prepare`, `build`, `sdk`, `swagger`, `e2e`, `test`) that a nestia project should have.

## Examples

- `examples/bbs-controller/` — a tiny but realistic controller + DTO + service trio showing every common decorator in context.

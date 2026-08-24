# Swagger Generation

`@nestia/sdk` produces an OpenAPI document straight from the TypeScript types and JSDoc — no `@ApiProperty`, `@ApiResponse`, `@ApiTags` decorators needed. This file covers both the offline (`npx nestia swagger`) and runtime composition flows, plus the documentation strategy nestia recommends.

## The two ways to build swagger

### Offline — `npx nestia swagger`

Runs as part of the build. Reads `nestia.config.ts`, parses controllers, writes `swagger.json` to `swagger.output`.

```ts
// nestia.config.ts
swagger: {
  output: "packages/api/swagger.json",
  openapi: "3.1",
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "http://localhost:3000" }],
}
```

```bash
npx nestia swagger
```

This is the right choice if:
- Swagger is consumed by codegens, CI checks, or external docs.
- The OpenAPI doc should be committed to git (recommended — diffs reveal API drift).
- The doc is shipped as part of the SDK's distribute package.

### Runtime — register the `@nestia/sdk` transform plugin

If `@nestia/sdk/lib/transform` is in the `tsconfig.json` `plugins` array (the wizard prompt "Transform Runtime Swagger" does this for you when answered `true`), the swagger document can be composed at server startup:

```ts
import { NestiaSwaggerComposer } from "@nestia/sdk";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./AppModule";

const app = await NestFactory.create(AppModule);
const document = await NestiaSwaggerComposer.document(app, {
  openapi: "3.1",
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "http://localhost:3000" }],
});
// serve `document` at /api-docs via swagger-ui-express, or do whatever else with it
```

This is the right choice if:
- The doc must be served live by the server (e.g. on `/api-docs`).
- The doc varies per environment (different `servers` URLs in dev vs prod).
- A standalone build step is not wanted.

The two paths produce equivalent output. Most projects use the offline path; pick runtime only when there's a concrete reason.

## What populates the document

### Routes

Every controller method decorated with `@TypedRoute.*` (or any vanilla NestJS `@Get`/`@Post`/etc.) becomes an OpenAPI operation. The HTTP method, path, request body schema (from `@TypedBody` parameter type), query schema (from `@TypedQuery`), path params (from `@TypedParam`), headers (from `@TypedHeaders`), response schema (from the function's return type), and error schemas (from `@TypedException`) are all derived automatically.

### Schemas

DTO types referenced anywhere in a controller are emitted as `components.schemas` entries. Recursive types and union types are preserved exactly. typia tags map to OpenAPI keywords:

| typia tag | OpenAPI keyword |
|---|---|
| `tags.Format<"uuid">` | `format: uuid` |
| `tags.Format<"date-time">` | `format: date-time` |
| `tags.Format<"email">` | `format: email` |
| `tags.MinLength<N>` | `minLength: N` |
| `tags.MaxLength<N>` | `maxLength: N` |
| `tags.Pattern<"...">` | `pattern: ...` |
| `tags.Type<"uint32">` | `type: integer, format: int32, minimum: 0` |
| `tags.Minimum<N>` | `minimum: N` |
| `tags.Maximum<N>` | `maximum: N` |
| `tags.MinItems<N>` | `minItems: N` |
| `tags.MaxItems<N>` | `maxItems: N` |
| `tags.UniqueItems<true>` | `uniqueItems: true` |

### Descriptions — JSDoc, not decorators

This is the documentation strategy nestia recommends and where most NestJS users have to unlearn `@ApiProperty`. Use JSDoc on the type and field; nestia harvests it.

```ts
/**
 * A bulletin board article.
 *
 * Articles are the primary unit of content. Sections group related articles
 * and are referenced by `IArticle.section`.
 *
 * @author Mohamed
 */
export interface IArticle {
  /** Server-generated UUIDv4. Do not set on `ICreate`. */
  id: string & tags.Format<"uuid">;

  /**
   * Headline of the article.
   *
   * Must be between 3 and 50 characters. Trailing whitespace is trimmed.
   */
  title: string & tags.MinLength<3> & tags.MaxLength<50>;

  /** Markdown body. May contain image references. */
  body: string;

  /**
   * Optional thumbnail URL.
   *
   * Set to `null` to clear an existing thumbnail.
   */
  thumbnail: (string & tags.Format<"uri">) | null;
}
```

The leading paragraph becomes the schema description. Per-property comments become field descriptions. JSDoc tags like `@example`, `@deprecated`, `@title`, `@summary` are recognized.

For routes, the same pattern works on the controller method:

```ts
/**
 * Create a new article.
 *
 * Validates the body, persists it, and returns the created article with its
 * server-generated `id` and `created_at`. Fails with 400 if validation fails.
 *
 * @param section Section the article belongs to.
 * @param input Article fields to create.
 * @returns The created article, including server-generated fields.
 *
 * @tag articles
 * @security bearer
 */
@TypedException<TypeGuardError.IProps>(400)
@TypedRoute.Post()
async create(
  @TypedParam("section") section: string,
  @TypedBody() input: IArticle.ICreate,
): Promise<IArticle> { ... }
```

Recognized JSDoc tags in route comments include `@tag`, `@security`, `@deprecated`, `@summary`, `@operationId`. The leading paragraph becomes the operation summary; subsequent paragraphs become the description.

> Important — TypeScript 5.3+ caveat: `tsc` no longer parses JSDoc by default. Run `npx typia patch` (or have it in `prepare`) to re-enable it. Without that step, the schema descriptions and tag attachments will silently disappear.

## Security schemes

Declare them in `swagger.security`:

```ts
swagger: {
  security: {
    bearer: { type: "http", scheme: "bearer" },
    apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
    oauth2: {
      type: "oauth2",
      flows: {
        authorizationCode: {
          authorizationUrl: "https://auth.example.com/oauth/authorize",
          tokenUrl: "https://auth.example.com/oauth/token",
          scopes: { "read:articles": "Read articles", "write:articles": "Write articles" },
        },
      },
    },
  },
}
```

Reference them on routes via `@security` JSDoc tags:

```ts
/**
 * @security bearer
 * @security oauth2 read:articles write:articles
 */
@TypedRoute.Post()
async create(...) { ... }
```

If a `@security` tag references a scheme not declared in `nestia.config.ts`, generation fails with a clear error — that's the intended behavior.

## Tags

Two ways:

```ts
// nestia.config.ts
swagger: {
  tags: [
    { name: "articles", description: "Article CRUD operations." },
    { name: "auth", description: "Authentication and authorization." },
  ],
}
```

Or per-route via `@tag` JSDoc. If both are used and the names match, the description from `nestia.config.ts` wins.

## Operation IDs

By default, operation IDs are `<class>_<method>` (e.g. `BbsArticlesController_create`). Override globally:

```ts
swagger: {
  operationId: ({ class: c, function: f, method, path }) => `${c}.${f}`,
  // or strip the controller suffix:
  // operationId: ({ class: c, function: f }) => `${c.replace(/Controller$/, '')}_${f}`,
}
```

Or per-route via `@operationId` JSDoc.

## Decompose query

`swagger.decompose: true` (default `false`) splits a `@TypedQuery() query: IRequest` into one OpenAPI parameter per property. Most clients prefer this — it's how Swagger UI's "Try it out" form is built and how curl examples are usable. With `decompose: false`, the query DTO becomes a single `application/json`-style parameter, which most consumers handle poorly.

## OpenAPI version downgrade

`openapi: "3.1"` is the default and the cleanest output. Downgrade only when the consumer can't handle it:

| Setting | When to use |
|---|---|
| `"3.1"` | Default. Modern Swagger UI, Stoplight, Redocly, Postman recent versions. |
| `"3.0"` | Older codegens, OpenAPI Generator if the user is targeting an older client. |
| `"2.0"` | Legacy tools only. Loses union types and many typia tag mappings. Avoid if possible. |

The downgrade goes through `OpenApi.downgrade` from `@samchon/openapi`. It's lossy; some 3.1 features have no 3.0 equivalent and are dropped silently.

## Cloud Swagger Editor

`https://nestia.io/editor` is a hosted TypeScript IDE + Swagger UI. Paste a `swagger.json` URL or upload one, and it offers a writable editor with live request execution and SDK simulation. Useful for ad-hoc API exploration; mention it whenever the user asks "is there a way to play with my API in the browser?".

The editor URL pattern:

```
https://nestia.io/editor/?url=<encoded-url-to-swagger.json>&simulate=true&e2e=true
```

`simulate=true` activates the mockup simulator client-side (no server required). `e2e=true` enables a "generate test" button per operation.

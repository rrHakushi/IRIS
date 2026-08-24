# Core decorators (`@nestia/core`)

All decorators import from `@nestia/core`. They are drop-in replacements for the equivalent NestJS decorators, with type-driven validation and serialization compiled in by typia.

## TypedRoute — type-safe response

`@TypedRoute.Get / .Post / .Put / .Patch / .Delete / .Head` replace `@Get / @Post / ...`. The difference is the response: nestia compiles the function's return type into a `typia.assertStringify<T>()` call. That gives:

- ~200x faster JSON serialization vs `JSON.stringify` + `class-transformer`.
- Compile-time guarantee that the controller actually returns the declared type.
- Runtime validation that catches drift between the type and the real return value (configurable via the `stringify` option in the tsconfig plugin — `assert` throws, `validate.log` logs without throwing).

```ts
import { TypedRoute } from "@nestia/core";
import { Controller } from "@nestjs/common";

@Controller("articles")
export class ArticlesController {
  @TypedRoute.Get(":id")
  async at(id: string): Promise<IArticle> {
    return this.service.findOne(id);
  }
}
```

Path arguments still use `@Param`/`@TypedParam` — `TypedRoute` is purely about the response.

## TypedBody — type-safe request body

`@TypedBody()` replaces `@Body()`. The parameter's TypeScript type is compiled into a `typia.validate<T>` (or `assert<T>`, etc.) call that runs on the parsed JSON before the controller method body executes.

```ts
import { TypedBody, TypedRoute } from "@nestia/core";

@TypedRoute.Post()
async create(@TypedBody() input: IArticle.ICreate): Promise<IArticle> {
  return this.service.create(input);
}
```

Capabilities (anything typia supports):

- Recursive types.
- Discriminated and undiscriminated unions.
- Template literal types (`` `${string}@${string}` ``).
- Dynamic property keys (e.g. `Record<string, T>`).
- Tuple rest types.
- typia tags (`tags.Format<"uuid">`, `tags.MinLength<3>`, `tags.MaxLength<50>`, `tags.Pattern<"...">`, `tags.Type<"uint32">`, `tags.Minimum<0>`, `tags.Maximum<100>`, `tags.MultipleOf<5>`, `tags.ExclusiveMinimum<0>`, `tags.ExclusiveMaximum<100>`, `tags.MinItems<1>`, `tags.MaxItems<10>`, `tags.UniqueItems<true>`, `tags.MinLength<3>`, `tags.MaxLength<50>`, custom `tags.TagBase`).

Choosing the validator (set in `tsconfig.json` `plugins[].validate`):

- `validate` — collects every error with paths. Best for client-facing APIs that need helpful 4xx responses.
- `assert` — throws on the first error. Smaller code, faster, less detailed.
- `is` — boolean only.
- `validateEquals` / `assertEquals` — reject extra/unknown properties (strict shape).
- `validatePrune` / `assertPrune` — silently strip unknown properties.

Switching between them is a one-line change in `tsconfig.json`; no code changes required.

## TypedParam — typed path parameter

`@TypedParam("name")` replaces `@Param("name")`. It both coerces (e.g. `string` → `number`) and validates against the parameter's TypeScript type, including typia tags.

```ts
@TypedRoute.Get(":section/:id")
async at(
  @TypedParam("section") section: string,
  @TypedParam("id") id: string & tags.Format<"uuid">,
): Promise<IArticle> { ... }
```

Path parameters are inherently strings on the wire. Nestia coerces to `number`, `boolean`, or `bigint` when the type calls for it; for anything more structured, use `@TypedQuery` or `@TypedBody` instead.

## TypedQuery — typed query string

`@TypedQuery()` replaces `@Query()`. The parameter is a single DTO interface; the query string is parsed and validated against it.

```ts
interface IArticleQuery {
  page?: number & tags.Type<"uint32">;
  limit?: number & tags.Type<"uint32"> & tags.Maximum<100>;
  search?: string;
  status?: "draft" | "published" | "archived";
}

@TypedRoute.Get()
async index(@TypedQuery() query: IArticleQuery): Promise<IArticle[]> { ... }
```

For Swagger output: by default each property of the query DTO becomes a separate query parameter in the OpenAPI document. Set `swagger.decompose: false` in `nestia.config.ts` if a single object-typed query parameter is preferred.

For typed individual query parameters (one decorator per field), use `@TypedQuery.Get` / `@TypedQuery.Body` variants for finer control — see the typia docs for the rare cases this matters.

## TypedFormData — multipart form bodies

`@TypedFormData.Body()` handles `multipart/form-data` for file uploads with typed fields.

```ts
import { TypedFormData, TypedRoute } from "@nestia/core";

interface IArticleUpload {
  title: string;
  body: string;
  thumbnail: File;        // single file
  attachments: File[];    // multiple files
}

@TypedRoute.Post("upload")
async upload(@TypedFormData.Body() input: IArticleUpload): Promise<IArticle> {
  // input.thumbnail is a File, input.attachments is File[]
}
```

`File` here is the standard Web `File` interface (Node 20+). For older runtimes, use `Blob` or the older `Multer.File` type; typia handles both.

## TypedHeaders — typed request headers

`@TypedHeaders()` parses the request headers into a typed object. Useful for required custom headers or auth tokens with structure.

```ts
interface IAuthHeaders {
  "x-tenant-id": string & tags.Format<"uuid">;
  "x-request-id"?: string;
  authorization: `Bearer ${string}`;
}

@TypedRoute.Get()
async list(@TypedHeaders() headers: IAuthHeaders): Promise<IArticle[]> { ... }
```

Header names are lower-cased per HTTP semantics. typia tags work here too.

## TypedException — declared error responses

`@TypedException<T>(status, description?)` declares a possible error response from a route. It does not change runtime behavior on its own — it influences what nestia generates:

- The Swagger document gets a typed `responses` entry for that status.
- The SDK's `propagate` mode includes that status as a discriminated branch.

```ts
import { TypedException, TypedRoute } from "@nestia/core";
import { TypeGuardError } from "typia";

@TypedException<TypeGuardError.IProps>(400, "Validation failure")
@TypedException<IUnauthorized>(401, "Missing or invalid token")
@TypedException<IForbidden>(403)
@TypedRoute.Post()
async create(@TypedBody() input: IArticle.ICreate): Promise<IArticle> { ... }
```

Stack multiple `@TypedException` decorators on a route to declare every error shape it can produce. Combined with `propagate: true` in `nestia.config.ts`, the SDK callers get a discriminated `IPropagation` return type with all possible status codes baked in.

## SwaggerExample — request/response examples

`@SwaggerExample()` attaches example payloads to a route, picked up by the Swagger generator.

```ts
import { SwaggerExample, TypedBody, TypedRoute } from "@nestia/core";

@SwaggerExample("request", "default", {
  title: "Hello",
  body: "World",
})
@SwaggerExample("response", "created", {
  id: "5d4e5f6a-...",
  title: "Hello",
  body: "World",
  created_at: "2026-04-25T00:00:00Z",
})
@TypedRoute.Post()
async create(@TypedBody() input: IArticle.ICreate): Promise<IArticle> { ... }
```

## WebSocketRoute — typed WebSocket RPC

`@WebSocketRoute()` plus `@WebSocketRoute.Acceptor()` and friends replace NestJS's `@WebSocketGateway`. The big win is integration with the SDK: WebSocket endpoints become callable from the generated client just like HTTP ones, with full type safety on both directions.

The pattern uses `tgrid` under the hood:

```ts
import { WebSocketRoute } from "@nestia/core";
import { Controller } from "@nestjs/common";
import { WebSocketAcceptor } from "tgrid";

interface IClientListener {
  notify(message: string): void;
}

class ChatService {
  constructor(private acceptor: WebSocketAcceptor<null, ChatService, IClientListener>) {}

  async send(message: string): Promise<void> {
    const driver = this.acceptor.getDriver(); // typed handle to the client
    await driver.notify(`Echo: ${message}`);
  }
}

@Controller("chat")
export class ChatController {
  @WebSocketRoute()
  async open(
    @WebSocketRoute.Acceptor()
    acceptor: WebSocketAcceptor<null, ChatService, IClientListener>,
    @WebSocketRoute.Param("room") room: string,
  ): Promise<void> {
    await acceptor.accept(new ChatService(acceptor));
  }
}
```

For the WebSocket support to be active, call `WebSocketAdaptor.upgrade(app)` after `NestFactory.create(...)` in the bootstrap file. See `references/agentic-ai.md` for the full chatbot pattern that builds on this.

## Mixing nestia decorators with vanilla NestJS decorators

`@TypedRoute.*` decorators stack with `@UseGuards`, `@UseInterceptors`, `@UseFilters`, `@UsePipes`, and `@SetMetadata` exactly like `@Get`/`@Post`. There's no conflict; nestia's transform only rewrites the validation/serialization portion.

Don't combine `@TypedBody()` and `@Body()` on the same parameter, and don't use `class-validator` decorators on a DTO that nestia is also validating — at best they duplicate work, at worst they disagree.

## DTO patterns

DTOs are plain interfaces or types. Convention from the `@samchon/backend` template:

- One file per top-level entity: `IArticle.ts`, `IUser.ts`, etc.
- Subtypes go in a same-named namespace: `IArticle.ICreate`, `IArticle.IUpdate`, `IArticle.ISummary`.
- JSDoc on every property — these become the Swagger field descriptions and are also visible to LLMs in the agentic AI flow.

```ts
import { tags } from "typia";

/** A bulletin board article. */
export interface IArticle {
  /** Server-generated identifier. */
  id: string & tags.Format<"uuid">;
  /** Title shown in lists and the article header. */
  title: string & tags.MinLength<3> & tags.MaxLength<50>;
  /** Body text in markdown. */
  body: string;
  /** ISO-8601 creation timestamp, set by the server. */
  created_at: string & tags.Format<"date-time">;
}
export namespace IArticle {
  /** Payload accepted by `POST /articles`. */
  export interface ICreate {
    title: string & tags.MinLength<3> & tags.MaxLength<50>;
    body: string;
  }
  /** Payload accepted by `PUT /articles/:id`. */
  export interface IUpdate extends Partial<ICreate> {}
  /** Compact form returned in list endpoints. */
  export interface ISummary {
    id: string & tags.Format<"uuid">;
    title: string;
    created_at: string & tags.Format<"date-time">;
  }
}
```

This pattern keeps the wire schema, the Swagger description, and the generated SDK type in lockstep, with no duplication anywhere.

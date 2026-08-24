# Example — BBS Articles Controller

A small, complete example showing every common `@nestia/core` decorator in a single CRUD controller. Drop these three files into a NestJS project that's already had `npx nestia setup` run on it and they'll work end-to-end.

## Files

- **`IBbsArticle.ts`** — DTOs as pure TypeScript interfaces with typia tags. No `class-validator` decorators, no `@ApiProperty` — JSDoc carries the documentation, typia tags carry the validation rules, and a single `IBbsArticle` namespace holds the related types (`ICreate`, `IUpdate`, `ISummary`, `IRequest`).
- **`BbsArticlesController.ts`** — five routes (list, read, create, update, delete) using `@TypedRoute.*`, `@TypedParam`, `@TypedQuery`, `@TypedBody`, and `@TypedException`. JSDoc on each route becomes the OpenAPI summary/description. The `@security bearer` JSDoc tag references a security scheme declared in `nestia.config.ts`.
- **`BbsArticlesService.ts`** — an in-memory implementation so the controller is runnable without a database. Replace with a real repository in production.

## Wiring it into a project

1. Copy the three files into `src/bbs-articles/` (or wherever the project's feature modules live).
2. Register the service and controller in a feature module:

```ts
import { Module } from "@nestjs/common";
import { BbsArticlesController } from "./BbsArticlesController";
import { BbsArticlesService } from "./BbsArticlesService";

@Module({
  controllers: [BbsArticlesController],
  providers: [BbsArticlesService],
})
export class BbsArticlesModule {}
```

3. Import that module from `AppModule`.
4. Generate the SDK and swagger:

```bash
npx nestia sdk
npx nestia swagger
```

5. The frontend can now call:

```ts
import api from "@my/api";
const article = await api.functional.bbs.articles.create(
  connection,
  "general",
  { writer: "Mohamed", title: "Hello", body: "World", thumbnail: null },
);
```

## What this example deliberately demonstrates

- **`@TypedException` stacking** — multiple error types per route (`400` validation + `404` not-found on the update route).
- **typia tags as path-parameter constraints** — `id: string & tags.Format<"uuid">` means the route 404-rejects non-UUID IDs before the handler runs.
- **JSDoc as the documentation source** — no `@ApiProperty` anywhere, but the generated `swagger.json` still has full descriptions for every field and route.
- **Namespaced DTO subtypes** — `IBbsArticle.ICreate` for the POST body, `IBbsArticle.IUpdate` for the PUT body, `IBbsArticle.ISummary` for the list response. One source file, zero duplication.
- **A `Partial<ICreate>` update DTO** — common pattern for PATCH-like semantics on a PUT route.
- **A typed query DTO with optional fields and bounds** — `IBbsArticle.IRequest` with `tags.Maximum<100>` on the limit parameter.

The pattern in this example scales — every entity in a real project follows the same `I<Entity>.ts` + `<Entity>Controller.ts` + `<Entity>Service.ts` structure.

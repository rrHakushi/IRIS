# E2E Testing

`@nestia/sdk` can generate one E2E test per route automatically, and `@nestia/e2e` provides the runtime helpers (`TestValidator`, `ArrayUtil`, `RandomGenerator`, `GaffComparator`) to write assertions in a readable way.

## Why a generated E2E suite

The argument from the nestia docs: unit tests check small pieces; E2E tests prove the system works end-to-end across the network. With a typed SDK already in hand, an E2E test is just a typed function call plus assertions. nestia generates the function-call boilerplate and the file structure; the developer writes the assertions.

The result is that adding a new route is "write the controller, run `npx nestia e2e`, fill in the assertions" — no test setup, no manual `supertest` boilerplate, no DTO duplication.

## Configuring generation

In `nestia.config.ts`:

```ts
const NESTIA_CONFIG: INestiaConfig = {
  input: async () => NestFactory.create(AppModule),
  output: "src/api",
  e2e: "test/features/api",
};
```

Run:

```bash
npx nestia e2e
```

Output structure mirrors the `functional/` tree of the SDK:

```
test/features/api/
└── bbs/
    └── articles/
        ├── test_api_bbs_articles_create.ts
        ├── test_api_bbs_articles_index.ts
        ├── test_api_bbs_articles_at.ts
        └── test_api_bbs_articles_update.ts
```

Each file exports a single `test_api_*` function that takes a `connection: api.IConnection` and exercises the corresponding endpoint:

```ts
// test/features/api/bbs/articles/test_api_bbs_articles_create.ts
import api from "@my/api";
import typia from "typia";
import { TestValidator } from "@nestia/e2e";

export const test_api_bbs_articles_create = async (
  connection: api.IConnection,
): Promise<void> => {
  const article = await api.functional.bbs.articles.create(
    connection,
    "general",
    typia.random<api.functional.bbs.articles.create.Input>(),
  );
  typia.assert(article);
  // TODO: add domain assertions
};
```

`typia.random<T>()` produces a valid random instance of any type. `typia.assert(value)` round-trips the result through the type to make sure the server returned what its types claim. Add domain assertions on top of that — equality checks, "the created article appears in subsequent list calls", etc.

## TestValidator — readable assertions

`@nestia/e2e` ships `TestValidator` for the cases plain `assert` makes ugly:

```ts
import { TestValidator } from "@nestia/e2e";

// equality of values, with a label that surfaces in failure output
TestValidator.equals("article ID matches")(created.id)(fetched.id);

// expecting an error of a specific kind
await TestValidator.httpError("missing title rejected")(400)(() =>
  api.functional.bbs.articles.create(connection, "general", {
    ...input,
    title: "", // invalid
  }),
);

// predicate
TestValidator.predicate("created_at is recent")(
  () => Date.now() - new Date(created.created_at).getTime() < 5_000,
);

// search/index logic
TestValidator.search("by title")
  (input => api.functional.bbs.articles.index(connection, "general", { search: input }))
  (sample, 4); // 4 random samples
```

Reading order — `TestValidator.method("label")(actual)(expected)` — feels odd at first but produces failure messages that read like English: "article ID matches: expected ..., got ...".

## Driving tests at runtime

Tests are plain async functions; they don't need a runner. The convention from `@samchon/backend` is a tiny test driver in `test/index.ts`:

```ts
import { DynamicExecutor } from "@nestia/e2e";
import api from "@my/api";

import { MyBackend } from "../src/MyBackend";

const main = async (): Promise<void> => {
  const backend = new MyBackend();
  await backend.open();

  const connection: api.IConnection = { host: "http://127.0.0.1:3000" };
  const report = await DynamicExecutor.validate({
    prefix: "test_",
    parameters: () => [{ ...connection }],
  })("test/features");

  await backend.close();

  if (report.executions.some(e => e.error !== null)) process.exit(-1);
};
main().catch((exp) => {
  console.error(exp);
  process.exit(-1);
});
```

`DynamicExecutor.validate` finds every `export const test_*` function under the given directory, runs it, and produces a `report` with timing per test plus errors. No Jest/Mocha needed — this is intentional, because a typed SDK call doesn't need the ceremony.

To use Jest instead, just call each `test_api_*` function from a `test()` block. Both styles work.

## Benchmark — `@nestia/benchmark`

Once an E2E suite exists, `@nestia/benchmark` reuses it to measure throughput:

```ts
import { DynamicBenchmarker } from "@nestia/benchmark";
import api from "@my/api";

await DynamicBenchmarker.master({
  servant: `${__dirname}/servant.js`,
  count: 4,                                // worker processes
  threads: 16,                             // concurrent calls per worker
  simultaneous: 32,                        // concurrent requests in flight
  filter: name => name.includes("create") || name.includes("index"),
  stdio: "inherit",
});
```

Output is per-route latency percentiles plus throughput. Useful for proving the typia-vs-class-validator speedup claim on a realistic workload.

## What to write tests for first

When migrating to nestia, prioritize:

1. **Happy paths for every CRUD route** — these are pure boilerplate, generated for free.
2. **Validation 400s** — confirm `@TypedBody` rejects what it should. `TestValidator.httpError(400)(...)` is one line.
3. **Auth 401/403s** — confirm guards still fire after the migration.
4. **Cross-route invariants** — "create + immediately index returns the new record". These can't be auto-generated and are usually where real bugs hide.

The generated test files are stubs; the developer is expected to flesh them out. Re-running `npx nestia e2e` does **not** overwrite existing tests by default — only missing ones are added, so customizations are preserved across regenerations.

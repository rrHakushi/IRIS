# Setup

Nestia's setup is the part most projects get wrong. This file walks through every supported path. Pick the one that matches the project, then verify the four pipeline links described in `SKILL.md` are intact.

## Decision tree

- **Empty directory, want a starter project**: `npx nestia start <dir>` (minimal) or `npx nestia template <dir>` (Prisma + PostgreSQL + FP/TDD example, based on `@samchon/backend`).
- **Existing NestJS project, want nestia added**: `npx nestia setup` (the wizard).
- **NX monorepo**: `npx nestia setup`, then patch each package's `tsconfig.lib.json` manually (see "NX" section).
- **Need to bundle to a single JS file (serverless)**: `npx nestia setup` + custom webpack config (see "Webpack — single JS file" section).
- **Want full control, no wizard**: "Manual setup" section.

## Boilerplate (new project)

```bash
npx nestia start <directory>
```

Produces a minimal SDK-generation-focused project. No database. Good for trying nestia out.

```bash
npx nestia template <directory>
```

Produces a more realistic boilerplate (Prisma + PostgreSQL + functional / TDD example) — equivalent to `@samchon/backend`.

## Setup wizard (existing project)

```bash
# npm
npx nestia setup

# pnpm
npx nestia setup --manager pnpm

# yarn (classic; berry is NOT supported)
npx nestia setup --manager yarn
```

The wizard will:

1. Install `@nestia/core`, `@nestia/sdk`, `@nestia/e2e`, `typia`, `nestia` (as appropriate).
2. Patch `tsconfig.json` to register the `typia/lib/transform`, `@nestia/core/lib/transform`, and (if "Transform Runtime Swagger" is yes) `@nestia/sdk/lib/transform` plugins.
3. Add `"prepare": "ts-patch install && typia patch"` to `package.json`.
4. Run `prepare` once.

The "Transform Runtime Swagger" prompt: choose **true** if planning to build the swagger document at runtime via `SwaggerModule` style integration. Choose **false** if only the offline `npx nestia swagger` flow is needed (this is the more common answer).

## Manual setup

Use only when the wizard's edits aren't acceptable for some reason — the wizard does this same thing, correctly, every time.

Install the compiler chain and the four nestia packages:

```bash
# npm
npm install --save-dev typescript ts-node ts-patch
npm install --save-dev nestia @nestia/sdk
npm install --save @nestia/core @nestia/e2e typia
```

Patch `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "plugins": [
      { "transform": "typia/lib/transform" },
      {
        "transform": "@nestia/core/lib/transform",
        "validate": "validate",
        "stringify": "assert"
      },
      { "transform": "@nestia/sdk/lib/transform" } // only if building runtime swagger
    ]
  }
}
```

`strict` (or at minimum `strictNullChecks`) is mandatory. typia's transformer needs full type information to generate validators; loose mode produces silently-wrong code.

The `validate` and `stringify` keys on the `@nestia/core` plugin pick which typia function backs `@TypedBody`/`@TypedRoute`:

| Key | Allowed values | Effect |
|---|---|---|
| `validate` | `is`, `assert`, `validate`, `equals`, `assertEquals`, `validateEquals`, `assertPrune`, `validatePrune`, `assertClone`, `validateClone` | What `@TypedBody` runs on the incoming request body. `assert` (default-ish) gives a single first-error message; `validate` gives every error; the `Equals` variants reject extra properties; the `Prune` variants strip them. |
| `stringify` | `is`, `assert`, `validate`, `validate.log` | What `@TypedRoute` runs on the response. `assert` validates and serializes (recommended); `validate.log` validates without throwing — useful in production to catch bad responses without breaking the API. |

Add the `prepare` script:

```jsonc
{
  "scripts": {
    "prepare": "ts-patch install && typia patch"
  }
}
```

Run it once after install:

```bash
npm run prepare
```

`ts-patch` rewires `node_modules/typescript` so `tsc` honors the `plugins` declared in `tsconfig.json`. `typia patch` is a temporary shim (TS 5.3+) that re-enables `JSDocComment` parsing — needed if using typia "comment tags" or schema-from-comment features. Both are idempotent. The `prepare` script makes sure they run on every fresh `npm install`.

## NX monorepo

NX takes some extra care because each package has its own `tsconfig.lib.json`.

1. Run `npx nestia setup` at the workspace root as usual.
2. In every package that needs nestia decorators, edit `tsconfig.lib.json`:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true,
    "types": [],
    "plugins": [
      { "transform": "typia/lib/transform" },
      {
        "transform": "@nestia/core/lib/transform",
        "validate": "validate",
        "stringify": "assert"
      },
      { "transform": "@nestia/sdk/lib/transform" }
    ]
  },
  "include": ["**/*.ts"],
  "exclude": ["jest.config.ts", "**/*.spec.ts", "**/*.test.ts"]
}
```

3. NX silently swallows transform errors on `nx <pkg>:build`. To surface them, add a debug task that runs `tsc` directly:

```jsonc
{
  "targets": {
    "build:validate:nestia": {
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "tsc --project packages/<package-name>/tsconfig.lib.json --outDir dist/packages/nestiaTest"
        ]
      }
    }
  }
}
```

Run that task whenever an `nx build` looks suspicious (correct compile, but nestia decorators aren't actually doing anything). It will print the typia / nestia errors NX hides.

NX's per-plugin `transformers` field does **not** work with nestia. NX expects a `before` hook; nestia uses `ts-patch` instead, which is a different mechanism. Don't try to wire nestia through NX's built-in transformer slot — keep it in `tsconfig.lib.json` plugins and let `ts-patch` handle it.

## Webpack — with `node_modules`

For typical bundling (ship a `dist/server.js` plus a pruned `node_modules`):

```bash
npx nestia setup
npm install --save-dev ts-loader webpack webpack-cli webpack-node-externals
```

`webpack.config.js`:

```js
const path = require("path");
const nodeExternals = require("webpack-node-externals");

module.exports = {
  entry: { server: "./src/executable/server.ts" },
  output: { path: path.join(__dirname, "dist"), filename: "[name].js" },
  optimization: { minimize: false },
  externals: [nodeExternals()],
  mode: "development",
  target: "node",
  module: {
    rules: [
      { test: /\.ts$/, exclude: /node_modules/, loader: "ts-loader" },
    ],
  },
  resolve: { extensions: [".tsx", ".ts", ".js"] },
};
```

**Do not** run `nest build --webpack`. The `@nestjs/cli` webpack flow is incompatible with nestia. Use `npx webpack` directly.

To prepare for production deploy:

```bash
npx webpack
npm ci --omit=dev --ignore-scripts
```

`--ignore-scripts` is essential — without it, `npm` will try to re-run `prepare` (`ts-patch install && typia patch`), which fails in production where the dev dependencies are gone.

## Webpack — single JS file (serverless)

For Lambda / Cloud Run / Cloud Functions where one file is wanted with no `node_modules`:

```bash
npx nestia setup
npm install --save-dev ts-loader webpack webpack-cli copy-webpack-plugin write-file-webpack-plugin
```

```js
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const WriteFilePlugin = require("write-file-webpack-plugin");
const { IgnorePlugin } = require("webpack");

const lazyImports = [
  "@fastify/static",
  "@fastify/view",
  "@nestjs/microservices",
  "@nestjs/websockets",
  "class-transformer",
  "class-validator",
];

module.exports = {
  entry: { server: "./src/executable/server.ts" },
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js",
    chunkFormat: false,
  },
  optimization: { minimize: true },
  mode: "production",
  target: "node",
  module: {
    rules: [{ test: /\.ts$/, exclude: /node_modules/, loader: "ts-loader" }],
  },
  resolve: { extensions: [".tsx", ".ts", ".js"] },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: ".env", to: "[name][ext]" },
        { from: "package.json", to: "[name][ext]" },
        // Uncomment if using Prisma:
        // {
        //   from: "node_modules/**/.prisma/client/*.node",
        //   to: () => Promise.resolve("[path][name][ext]"),
        //   globOptions: { dot: true },
        // },
      ],
    }),
    new WriteFilePlugin(),
    new IgnorePlugin({
      checkResource: (resource) => {
        if (lazyImports.some((m) => resource.startsWith(m))) {
          try {
            require.resolve(resource);
          } catch {
            return true;
          }
        }
        return false;
      },
    }),
  ],
};
```

Then just `npx webpack` and deploy `dist/`. No `node_modules` needed at the destination, no pruning step.

## The standard-TypeScript-compiler-only rule

`@nestia/core` performs AOT compilation of decorators through the standard TypeScript compiler API. Compilers that strip type information cannot be used:

- ✅ Microsoft's `tsc` (`typescript` npm package) — required.
- ❌ SWC (`@swc/core`) — strips types.
- ❌ esbuild — strips types.
- ❌ Babel (`@babel/preset-typescript`) — strips types.

If a user has `nest-cli.json` with `"builder": "swc"` or `"builder": "esbuild"`, switch back to default (`tsc`). Symptoms of a non-standard compiler being used: validators don't actually validate, response serialization is missing, generated swagger has no routes, generated SDK is empty.

This applies to **compilation**, not runtime. The compiled JavaScript runs on plain Node.js with no runtime requirements beyond what NestJS already needs.

## Verification checklist

After any setup path, confirm:

1. `tsconfig.json` has the `plugins` array with at least typia and `@nestia/core`.
2. `package.json` has `"prepare": "ts-patch install && typia patch"`.
3. `npm run prepare` has been run (re-run after `npm install` if anything seems off).
4. `nest-cli.json` does **not** set `"builder"` to `swc` or `esbuild`.
5. A trivial `@TypedBody()` parameter rejects a malformed request with a typia error message — if it accepts garbage, the transform isn't actually running.

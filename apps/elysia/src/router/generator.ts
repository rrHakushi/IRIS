import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { c } from "../utils/colors"
import { findRouteFiles } from "./helpers/scanner"
import { parseRoutePath, HTTP_METHODS, type HttpMethod } from "./helpers/path"
import { renderTypeMap, extractTypeSignatures } from "./helpers/types-renderer"

/**
 * Configuration options for the Elysia route manifest generator.
 */
export interface GeneratorOptions {
  /** Directory containing file-based routes (defaults to `src/modules`). */
  modulesDir?: string
  /** Output file destination for the generated Elysia app manifest. */
  outputFile?: string
  /** Output file destination for the generated cache key types. */
  cacheKeysOutputFile?: string
  /** Suppress console output when files are generated. */
  silent?: boolean
}

/**
 * Generates statically typed Elysia route and cache key manifests from all `route.ts` files.
 *
 * This function:
 * 1. Scans `src/modules/` recursively for all route handler files.
 * 2. Statically imports each route module into `src/router/generated/routes.generated.ts`.
 * 3. Chained `.get()`, `.post()`, etc. calls with their associated validation schemas, rate limiters,
 *    and authorization guards (`requireAuth`, `requirePermissions`).
 * 4. Extracts all declared `cacheKeys` into `src/router/generated/cache-keys.generated.ts` for global type safety.
 * 5. Uses idempotent file writes to prevent infinite reload loops during `bun --watch`.
 *
 * @param options - Generator configuration options
 *
 * @example
 * ```typescript
 * await generateRoutes({ silent: true })
 * ```
 */
export async function generateRoutes(
  options: GeneratorOptions = {}
): Promise<void> {
  const routerDir = import.meta.dirname
  const modulesDir = options.modulesDir || path.resolve(routerDir, "../modules")
  const generatedDir = path.resolve(routerDir, "generated")
  const outputFile =
    options.outputFile || path.resolve(generatedDir, "routes.generated.ts")
  const cacheKeysOutputFile =
    options.cacheKeysOutputFile ||
    path.resolve(generatedDir, "cache-keys.generated.ts")

  // Ensure generated output directory exists
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true })
  }

  const routeFiles = findRouteFiles(modulesDir)

  // Sort files for deterministic code generation
  routeFiles.sort()

  const imports: string[] = []
  const routeChains: string[] = []
  const globalTypeSignatures: Record<string, any> = {}
  const routesWithCacheKeys: Array<{ importName: string }> = []
  let routeIndex = 0

  for (const filePath of routeFiles) {
    const relativePath = path.relative(modulesDir, filePath)
    const routePath = parseRoutePath(relativePath)
    const importName = `Route_${routeIndex}`
    const relativeImport = path
      .relative(generatedDir, filePath)
      .replace(/\\/g, "/")
      .replace(/\.(ts|js)$/, "")

    try {
      const fileUrl = pathToFileURL(filePath).href
      const importedModule = await import(fileUrl)
      const RouteExport = importedModule.default

      if (!RouteExport) continue

      let instance: Record<string, any> = {}
      if (typeof RouteExport === "function") {
        try {
          instance = new RouteExport()
        } catch {
          instance = RouteExport
        }
      } else if (typeof RouteExport === "object" && RouteExport !== null) {
        instance = RouteExport
      }

      const exportObj = RouteExport as Record<string, unknown> | undefined

      // Collect cache key type signatures
      const routeCacheKeys =
        instance.cacheKeys ||
        exportObj?.cacheKeys ||
        importedModule.cacheKeys ||
        {}

      if (
        routeCacheKeys &&
        typeof routeCacheKeys === "object" &&
        Object.keys(routeCacheKeys).length > 0
      ) {
        extractTypeSignatures(globalTypeSignatures, routeCacheKeys)
        routesWithCacheKeys.push({ importName })
      }

      // Check which HTTP methods are implemented
      const implementedMethods: HttpMethod[] = []
      for (const method of HTTP_METHODS) {
        const hasMethod =
          typeof instance[method] === "function" ||
          (typeof instance[method] === "object" &&
            instance[method] !== null &&
            "handler" in instance[method]) ||
          typeof exportObj?.[method] === "function" ||
          (typeof exportObj?.[method] === "object" &&
            exportObj?.[method] !== null &&
            "handler" in (exportObj?.[method] as object))

        if (hasMethod) {
          implementedMethods.push(method)
        }
      }

      if (implementedMethods.length === 0) continue

      imports.push(`import ${importName} from "${relativeImport}";`)

      for (const method of implementedMethods) {
        const elysiaMethod = method === "ALL" ? "all" : method.toLowerCase()

        // Check if schema is defined on route or method
        let schemaExpr = ""
        if ((instance.schemas as Record<string, unknown>)?.[method]) {
          schemaExpr = `${importName}.schemas!.${method}`
        } else if (
          typeof instance[method] === "object" &&
          instance[method] !== null &&
          "schema" in (instance[method] as object)
        ) {
          schemaExpr = `${importName}.${method}!.schema`
        } else if (instance.schema) {
          schemaExpr = `${importName}.schema`
        }

        const handlerCall = `async (ctx: unknown) => {
      const route = ${importName} as Record<string, unknown>;
      const methodItem = route.${method} as Record<string, unknown> | ((...args: unknown[]) => unknown) | undefined;
      const handler = typeof methodItem === "function" ? methodItem : (methodItem?.handler as ((...args: unknown[]) => unknown) | undefined);
      const methodObj = typeof methodItem === "object" && methodItem !== null ? methodItem : null;
      const rateLimitConfig = (methodObj?.rateLimit ?? (route.rateLimits as Record<string, unknown> | undefined)?.${method} ?? route.rateLimit) as RateLimitConfig | undefined;
      const limiter = rateLimitConfig ? getRouteLimiter("${importName}_${method}", rateLimitConfig) : null;
      const authConfig = {
        requireAuth: (methodObj?.requireAuth ?? route.requireAuth) as boolean | { message?: string } | undefined,
        requirePermissions: (methodObj?.requirePermissions ?? route.requirePermissions) as IRISBitFieldResolvable[] | undefined,
      };
      const authGuard = (authConfig.requireAuth !== undefined || authConfig.requirePermissions !== undefined)
        ? (c: Context) => assertRouteAuthorization(c, authConfig)
        : null;
      (ctx as Context).cacheKeys = globalCacheKeyStorage as unknown as Context["cacheKeys"];
      return executeWithRequestLogs(ctx as Context, handler, limiter, authGuard);
    }`

        if (schemaExpr) {
          routeChains.push(`  .${elysiaMethod}(
    "${routePath}",
    ${schemaExpr},
    ${handlerCall}
  )`)
        } else {
          routeChains.push(`  .${elysiaMethod}(
    "${routePath}",
    ${handlerCall}
  )`)
        }
      }

      routeIndex++
    } catch (err) {
      console.warn(`[Eden Generator] Could not inspect ${filePath}:`, err)
    }
  }

  // 1. Generate cache-keys.generated.ts
  const cacheKeysContent = `/* eslint-disable */
// Automatically generated by the IRIS file router for cache key type safety.
// Do not edit manually.

export interface GlobalCacheKeys {
${renderTypeMap(globalTypeSignatures, 1)}}

export type GlobalCacheKeyStorage = GlobalCacheKeys;
`

  writeIfChanged(cacheKeysOutputFile, cacheKeysContent)

  // 2. Generate routes.generated.ts
  const globalKeysInit =
    routesWithCacheKeys.length > 0
      ? `function deepMergeCacheKeys(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const [key, val] of Object.entries(source)) {
    if (typeof val === "function") {
      target[key] = val;
    } else if (val && typeof val === "object") {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }
      deepMergeCacheKeys(target[key] as Record<string, unknown>, val as Record<string, unknown>);
    }
  }
}
` +
        routesWithCacheKeys
          .map(
            (
              r
            ) => `const ${r.importName}_keys = (${r.importName} as Record<string, unknown>)?.cacheKeys;
if (${r.importName}_keys && typeof ${r.importName}_keys === "object") {
  deepMergeCacheKeys(globalCacheKeyStorage, ${r.importName}_keys as Record<string, unknown>);
}`
          )
          .join("\n")
      : ""

  const routesContent = `/* eslint-disable */
// Automatically generated by the IRIS file router for Eden Treaty.
// Do not edit manually.
import { Elysia } from "elysia";
import type { Context, RateLimitConfig } from "../types";
import type { IRISBitFieldResolvable } from "@IRIS/permissions";
import { executeWithRequestLogs } from "../../utils/request-logger";
import { createRateLimiter } from "../../plugins/rate-limiter";
import { assertRouteAuthorization } from "../helpers/auth-guard";
${imports.join("\n")}

const routeLimiters = new Map<string, ReturnType<typeof createRateLimiter>>();
function getRouteLimiter(key: string, config: RateLimitConfig) {
  let l = routeLimiters.get(key);
  if (!l) {
    l = createRateLimiter(config);
    routeLimiters.set(key, l);
  }
  return l;
}

export const globalCacheKeyStorage: Record<string, Record<string, unknown>> = {};
${globalKeysInit}

export const routes = new Elysia({ name: "iris-routes" })
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }))
${routeChains.join("\n")};

export type App = typeof routes;
`

  writeIfChanged(outputFile, routesContent)

  if (!options.silent) {
    console.log(
      `${c.cyan("[Eden Generator]")} Generated manifests for ${c.bold(routeIndex)} route files in ${c.underline(path.relative(process.cwd(), generatedDir))}`
    )
  }
}

/**
 * Idempotently writes content to a file, skipping if the content is identical
 * to prevent unnecessary watcher trigger cascades.
 */
function writeIfChanged(filePath: string, newContent: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8")
    if (existing === newContent) {
      return
    }
  }
  fs.writeFileSync(filePath, newContent, "utf-8")
}

export { findRouteFiles } from "./helpers/scanner"
export { parseRoutePath } from "./helpers/path"

import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { c } from "../utils/colors"

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
  "ALL",
] as const

type HttpMethod = (typeof HTTP_METHODS)[number]

/**
 * Converts a relative module file path into an Elysia URL route.
 *
 * Rules:
 * - Omits the root module directory
 * - Strips route groupings wrapped in parentheses: `(group)/user` -> `/user`
 * - Transforms dynamic parameters: `[id]` -> `:id`
 * - Transforms wildcard catch-all segments: `[...slug]` -> `*`
 *
 * @param relativeFilePath - File path relative to the modules root directory
 * @returns Formatted URL route path string starting with a leading slash
 *
 * @example
 * ```typescript
 * parseRoutePath("IRIS-account/user/[id]/list/route.ts") // returns "/user/:id/list"
 * ```
 */
export function parseRoutePath(relativeFilePath: string): string {
  const normalized = relativeFilePath.replace(/\\/g, "/").replace(/^\/+/, "")
  const parts = normalized.split("/")

  if (parts.length < 2) return "/"

  const segments = parts.slice(1, -1)
  const routeSegments = segments.filter((seg) => !/^\(.*\)$/.test(seg))

  if (routeSegments.length === 0) {
    return "/"
  }

  const mapped = routeSegments.map((seg) => {
    if (seg.startsWith("[...") && seg.endsWith("]")) {
      return "*"
    }
    if (seg.startsWith("[") && seg.endsWith("]")) {
      return `:${seg.slice(1, -1)}`
    }
    return seg
  })

  return "/" + mapped.join("/")
}

/**
 * Recursively scans a filesystem directory for all `route.ts` or `route.js` files.
 *
 * @param dir - Starting directory path to traverse
 * @param baseDir - Base reference directory
 * @returns Array of absolute file paths matching route files
 */
export function findRouteFiles(dir: string, baseDir: string = dir): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath, baseDir))
    } else if (
      entry.isFile() &&
      (entry.name === "route.ts" || entry.name === "route.js")
    ) {
      results.push(fullPath)
    }
  }

  return results
}

/**
 * Options configuring the Elysia route manifest generator.
 */
export interface GeneratorOptions {
  /** Directory containing file-based routes (defaults to src/modules). */
  modulesDir?: string
  /** Output file destination for the generated Elysia app manifest. */
  outputFile?: string
  /** Suppress console output when files are generated. */
  silent?: boolean
}

/**
 * Generates a statically typed Elysia route manifest (routes.generated.ts)
 * from all route.ts files in src/modules.
 *
 * Inspects default route exports, preserves TypeBox response schemas without casting to any,
 * wraps request handlers in logging and rate limiting contexts, and outputs an Elysia router.
 *
 * @param options - Generator configuration options
 */
export async function generateRoutes(options: GeneratorOptions = {}) {
  const rootDir = path.resolve(import.meta.dirname, "..")
  const modulesDir = options.modulesDir || path.resolve(rootDir, "modules")
  const outputFile =
    options.outputFile ||
    path.resolve(import.meta.dirname, "routes.generated.ts")

  const routeFiles = findRouteFiles(modulesDir)
  routeFiles.sort()

  const imports: string[] = []
  const routeChains: string[] = []

  let routeIndex = 0

  for (const filePath of routeFiles) {
    const relativeModulePath = path.relative(modulesDir, filePath)
    const routePath = parseRoutePath(relativeModulePath)

    // Compute relative import path from outputFile directory to the route file (without .ts extension)
    let relativeImport = path
      .relative(path.dirname(outputFile), filePath)
      .replace(/\\/g, "/")
    if (!relativeImport.startsWith(".")) {
      relativeImport = "./" + relativeImport
    }
    relativeImport = relativeImport.replace(/\.(ts|js)$/, "")

    try {
      const fileUrl = pathToFileURL(filePath).href
      const mod = await import(fileUrl)
      const routeExport = mod.default

      if (!routeExport) continue

      const importName = `route_${routeIndex}`
      imports.push(`import ${importName} from "${relativeImport}";`)

      let instance: Record<string, unknown>
      if (typeof routeExport === "function") {
        try {
          instance = new (routeExport as any)()
        } catch {
          instance = routeExport as any
        }
      } else {
        instance = routeExport as any
      }

      for (const method of HTTP_METHODS) {
        const hasMethod =
          typeof instance[method] === "function" ||
          (typeof instance[method] === "object" &&
            instance[method] !== null &&
            "handler" in (instance[method] as object))

        if (!hasMethod) continue

        const elysiaMethod = method === "ALL" ? "all" : method.toLowerCase()

        // Check if schema is defined on route or method
        let schemaExpr = ""
        if (instance.schema) {
          schemaExpr = `${importName}.schema`
        } else if ((instance.schemas as Record<string, unknown>)?.[method]) {
          schemaExpr = `${importName}.schemas.${method}`
        } else if (
          typeof instance[method] === "object" &&
          instance[method] !== null &&
          "schema" in (instance[method] as object)
        ) {
          schemaExpr = `(${importName} as any).${method}.schema`
        }

        if (schemaExpr) {
          routeChains.push(`  .${elysiaMethod}(
    "${routePath}",
    ${schemaExpr},
    async (ctx: any) => {
      const methodItem = (${importName} as any).${method};
      const handler = typeof methodItem === "function" ? methodItem : methodItem?.handler;
      const rateLimitConfig = methodItem?.rateLimit ?? (${importName} as any).rateLimits?.${method} ?? (${importName} as any).rateLimit;
      const limiter = rateLimitConfig ? getRouteLimiter("${importName}_${method}", rateLimitConfig) : null;
      return executeWithRequestLogs(ctx, handler, limiter) as any;
    }
  )`)
        } else {
          routeChains.push(`  .${elysiaMethod}(
    "${routePath}",
    async (ctx: any) => {
      const methodItem = (${importName} as any).${method};
      const handler = typeof methodItem === "function" ? methodItem : methodItem?.handler;
      const rateLimitConfig = methodItem?.rateLimit ?? (${importName} as any).rateLimits?.${method} ?? (${importName} as any).rateLimit;
      const limiter = rateLimitConfig ? getRouteLimiter("${importName}_${method}", rateLimitConfig) : null;
      return executeWithRequestLogs(ctx, handler, limiter) as any;
    }
  )`)
        }
      }

      routeIndex++
    } catch (err) {
      console.warn(`[Eden Generator] Could not inspect ${filePath}:`, err)
    }
  }

  const fileContent = `/* eslint-disable */
// Automatically generated by the IRIS file router for Eden Treaty.
// Do not edit manually.
import { Elysia } from "elysia";
import { executeWithRequestLogs } from "../utils/request-logger";
import { createRateLimiter } from "../plugins/rate-limiter";
${imports.join("\n")}

const routeLimiters = new Map<string, ReturnType<typeof createRateLimiter>>();
function getRouteLimiter(key: string, config: unknown) {
  let l = routeLimiters.get(key);
  if (!l) {
    l = createRateLimiter(config as any);
    routeLimiters.set(key, l);
  }
  return l;
}

export const routes = new Elysia({ name: "iris-routes" })
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }))
${routeChains.join("\n")};

export type App = typeof routes;
`

  if (fs.existsSync(outputFile)) {
    const current = fs.readFileSync(outputFile, "utf-8")
    if (current === fileContent) {
      // Content has not changed: avoid touching file to prevent bun --watch restart loop
      return
    }
  }

  fs.writeFileSync(outputFile, fileContent, "utf-8")

  if (!options.silent) {
    console.log(
      `${c.cyan(c.bold("[Eden Generator]"))} ${c.green("Generated")} ${c.bold(routeIndex)} ${c.green("routes in:")} ${c.dim(outputFile)}`
    )
  }
}

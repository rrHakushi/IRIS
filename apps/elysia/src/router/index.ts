import fs from "node:fs"
import path from "node:path"
import util from "node:util"
import { pathToFileURL } from "node:url"
import { Elysia } from "elysia"
import { createRateLimiter } from "../plugins/rate-limiter"
import { c, colorMethod } from "../utils/colors"
import {
  requestLogStorage,
  type RequestLogStore,
  type RequestLogItem,
} from "../utils/request-logger"
import {
  Route,
  type RouteClass,
  type Context,
  type RouteInstance,
  type RouteDefinition,
  type MethodConfig,
  type HttpMethodKey,
} from "./types"

const HTTP_METHODS: readonly HttpMethodKey[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
  "ALL",
] as const

/**
 * Converts a relative module file path into an Elysia URL route.
 *
 * Rules:
 * - Module directory (first segment) is ignored: `IRIS-account/auth/login/route.ts` -> `/auth/login`
 * - Route groups in parentheses are ignored: `IRIS-account/(public)/auth/login/route.ts` -> `/auth/login`
 * - Dynamic parameters `[id]` -> `:id`
 * - Catch-all parameters `[...slug]` -> `*`
 * - Module root `IRIS-account/route.ts` -> `/`
 */
export function parseRoutePath(relativeFilePath: string): string {
  const normalized = relativeFilePath.replace(/\\/g, "/").replace(/^\/+/, "")
  const parts = normalized.split("/")

  // Need at least module_folder/route.ts
  if (parts.length < 2) return "/"

  // First segment is module name (ignored), last segment is file name (ignored)
  const segments = parts.slice(1, -1)

  // Filter out route groups in parentheses like (auth), (admin)
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
 * Recursively scans a directory for route.ts or route.js files.
 */
function findRouteFiles(dir: string, baseDir: string = dir): string[] {
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

import { prisma } from "@IRIS/database"
import { generateRoutes } from "./generator"
import { generateInsomniumConfig } from "./insomnium"
import { ensureDevAccount } from "../utils/dev-account"

/**
 * Configuration options for the file-based route loader.
 */
export interface RouterOptions {
  /** Directory containing file-based routes (defaults to src/modules). */
  modulesDir?: string
  /** Suppress console output when loading routes. */
  silent?: boolean
}

/**
 * Creates an Elysia plugin that loads all module routes using file-based routing.
 *
 * Capabilities:
 * - Scans `src/modules` recursively for all `route.ts` and `route.js` files
 * - Parses URL paths supporting route groups `(group)`, params `[id]`, and wildcards `[...slug]`
 * - Preserves TypeBox request and response schemas for OpenAPI validation
 * - Mounts route-level or method-level Token Bucket rate limiters
 * - Integrates request-scoped console grouping (`ctx.log`) via AsyncLocalStorage
 * - Automatically generates `routes.generated.ts` for Eden Treaty client type safety
 * - Generates and synchronizes `insomnium.json` for API testing in development mode
 * - Watches filesystem for route additions/removals with debounced auto-regeneration
 *
 * @param options - Router loader options
 * @returns Configured Elysia router instance with all dynamic routes mounted
 */
export async function createRouterModule(options: RouterOptions = {}) {
  const modulesDir =
    options.modulesDir || path.resolve(import.meta.dirname, "../modules")
  const router = new Elysia({ name: "iris-file-router" })

  const isDev = process.env.NODE_ENV === "development"

  // When in development mode, ensure dev account and API key exist
  let devApiKey: string | undefined
  if (isDev) {
    try {
      const devAccount = await ensureDevAccount(prisma)
      if (devAccount) {
        devApiKey = devAccount.apiKey
      }
    } catch (err) {
      if (!options.silent) {
        console.warn("[Dev Account] Warning:", err)
      }
    }
  }

  // Automatically generate Eden-compatible typed routes manifest
  try {
    await generateRoutes({ modulesDir, silent: options.silent })
  } catch (err) {
    if (!options.silent) {
      console.warn("[Router] Route auto-generation warning:", err)
    }
  }

  // When in development mode, generate Insomnium config
  if (isDev) {
    try {
      await generateInsomniumConfig({
        modulesDir,
        devApiKey,
        silent: options.silent,
      })
    } catch (err) {
      if (!options.silent) {
        console.warn("[Insomnium] Auto-generation warning:", err)
      }
    }
  }

  // In development, watch for file changes to automatically regenerate Eden routes and Insomnium config
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NODE_ENV !== "test"
  ) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    try {
      const watcher = fs.watch(
        modulesDir,
        { recursive: true },
        (event, filename) => {
          if (
            filename &&
            (filename.endsWith(".ts") || filename.endsWith(".js"))
          ) {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(async () => {
              try {
                await generateRoutes({ modulesDir, silent: true })
                if (isDev) {
                  await generateInsomniumConfig({
                    modulesDir,
                    devApiKey,
                    silent: true,
                  })
                }
              } catch (err) {
                console.error("[Router] Auto-generation failed on change:", err)
              }
            }, 100)
          }
        }
      )
      if (
        typeof watcher === "object" &&
        watcher !== null &&
        "unref" in watcher
      ) {
        ;(watcher as { unref: () => void }).unref()
      }
    } catch {
      // Ignored if recursive fs.watch is not supported
    }
  }

  if (!fs.existsSync(modulesDir)) {
    if (!options.silent) {
      console.log(`[Router] Modules directory not found: ${modulesDir}`)
    }
    return router
  }

  const routeFiles = findRouteFiles(modulesDir)
  let loadedCount = 0
  const routesByModule = new Map<
    string,
    Array<{ method: string; path: string }>
  >()

  for (const filePath of routeFiles) {
    const relativePath = path.relative(modulesDir, filePath)
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
    const moduleName = normalized.split("/")[0] || "core"
    const routePath = parseRoutePath(relativePath)

    try {
      const fileUrl = pathToFileURL(filePath).href
      const importedModule = await import(fileUrl)
      const RouteExport = importedModule.default

      if (!RouteExport) {
        console.warn(
          `[Router] Skipping ${relativePath}: No default export found.`
        )
        continue
      }

      let instance: RouteInstance
      let staticClass: RouteClass | null = null

      if (typeof RouteExport === "function") {
        try {
          instance = new (RouteExport as RouteClass)()
          staticClass = RouteExport as RouteClass
        } catch {
          instance = RouteExport as unknown as RouteInstance
        }
      } else if (typeof RouteExport === "object" && RouteExport !== null) {
        instance = RouteExport as RouteInstance
      } else {
        console.warn(
          `[Router] Skipping ${relativePath}: Default export is not a class or object.`
        )
        continue
      }

      const globalRateLimit =
        staticClass?.rateLimit ||
        instance.rateLimit ||
        (RouteExport as RouteDefinition)?.rateLimit ||
        importedModule.rateLimit

      const perMethodRateLimits =
        staticClass?.rateLimits ||
        instance.rateLimits ||
        (RouteExport as RouteDefinition)?.rateLimits ||
        importedModule.rateLimits ||
        {}

      const globalSchema =
        staticClass?.schema ||
        instance.schema ||
        (RouteExport as RouteDefinition)?.schema

      const perMethodSchemas =
        staticClass?.schemas ||
        instance.schemas ||
        (RouteExport as RouteDefinition)?.schemas ||
        {}

      for (const method of HTTP_METHODS) {
        const methodItem =
          (staticClass as Record<string, unknown>)?.[method] ??
          (instance[method] !==
          (Route.prototype as Record<string, unknown>)[method]
            ? instance[method]
            : undefined)

        let handler: ((ctx: Context) => unknown) | null = null
        let methodSchema: Record<string, unknown> = {
          ...(globalSchema || {}),
          ...(perMethodSchemas[method as keyof typeof perMethodSchemas] || {}),
        }
        let customMethodRateLimit =
          perMethodRateLimits[method as keyof typeof perMethodRateLimits]

        if (typeof methodItem === "function") {
          handler = methodItem as (ctx: Context) => unknown
        } else if (
          typeof methodItem === "object" &&
          methodItem !== null &&
          "handler" in methodItem
        ) {
          handler = (methodItem as MethodConfig).handler
          if ((methodItem as MethodConfig).schema) {
            methodSchema = {
              ...methodSchema,
              ...(methodItem as MethodConfig).schema,
            }
          }
          if ((methodItem as MethodConfig).rateLimit) {
            customMethodRateLimit = (methodItem as MethodConfig).rateLimit
          }
        }

        if (handler) {
          const elysiaMethod = (
            method === "ALL" ? "all" : method.toLowerCase()
          ) as keyof Elysia

          const methodRateLimit =
            customMethodRateLimit ||
            (staticClass as Record<string, unknown>)?.[`${method}_rateLimit`] ||
            (staticClass as Record<string, unknown>)?.[
              `${method.toLowerCase()}RateLimit`
            ] ||
            (staticClass as Record<string, unknown>)?.[`${method}RateLimit`] ||
            globalRateLimit

          const rateLimiter = methodRateLimit
            ? createRateLimiter(methodRateLimit)
            : null

          const boundHandler = async (ctx: Context) => {
            const store: RequestLogStore = { logs: [] }
            ;(
              ctx.request as unknown as { _requestLogs?: RequestLogItem[] }
            )._requestLogs = store.logs

            ctx.log = Object.assign(
              (...args: unknown[]) => {
                store.logs.push({ type: "log", message: util.format(...args) })
              },
              {
                info: (...args: unknown[]) => {
                  store.logs.push({
                    type: "info",
                    message: util.format(...args),
                  })
                },
                warn: (...args: unknown[]) => {
                  store.logs.push({
                    type: "warn",
                    message: util.format(...args),
                  })
                },
                error: (...args: unknown[]) => {
                  store.logs.push({
                    type: "error",
                    message: util.format(...args),
                  })
                },
              }
            )

            return await requestLogStorage.run(store, async () => {
              if (rateLimiter) {
                const rateLimitError = rateLimiter(ctx)
                if (rateLimitError) {
                  return rateLimitError
                }
              }
              return await handler.call(instance, ctx)
            })
          }

          const routeTarget = (router as unknown as Record<string, Function>)[
            elysiaMethod
          ]

          if (typeof routeTarget === "function") {
            const hasSchema = Object.keys(methodSchema).length > 0
            if (hasSchema) {
              routeTarget.call(router, routePath, methodSchema, boundHandler)
            } else {
              routeTarget.call(router, routePath, boundHandler)
            }
          }

          loadedCount++
          if (!routesByModule.has(moduleName)) {
            routesByModule.set(moduleName, [])
          }
          routesByModule.get(moduleName)!.push({ method, path: routePath })
        }
      }
    } catch (err) {
      console.error(
        `${c.red(c.bold("[Router]"))} Failed to load route ${relativePath}:`,
        err
      )
    }
  }

  if (!options.silent) {
    for (const [modName, moduleRoutes] of routesByModule) {
      console.log(
        `${c.blue(c.bold("[Router]"))} ${c.magenta(c.bold(`[${modName}]`))}`
      )
      for (const route of moduleRoutes) {
        console.log(
          `${c.blue(c.bold("[Router]"))}   ${colorMethod(route.method)} ${c.cyan(route.path)}`
        )
      }
    }

    const moduleCount = routesByModule.size
    const moduleLabel = moduleCount === 1 ? "module" : "modules"
    console.log(
      `${c.blue(c.bold("[Router]"))} ${c.green("Total routes loaded:")} ${c.bold(loadedCount)} ${c.dim(`(${moduleCount} ${moduleLabel})`)}`
    )
  }

  return router
}

export * from "./types"
export * from "./generator"
export * from "./insomnium"
export {
  createRateLimiter,
  rateLimiter,
  getClientIp,
  type ClientRecord,
} from "../plugins/rate-limiter"

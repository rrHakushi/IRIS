import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Elysia } from "elysia"
import { prisma } from "@IRIS/database"
import { createRateLimiter } from "../plugins/rate-limiter"
import { notificationService } from "../plugins/notification"
import { c, colorMethod } from "../utils/colors"
import { ensureDevAccount } from "../utils/dev-account"
import {
  requestLogStorage,
  createRequestLogger,
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
} from "./types"
import { parseRoutePath, HTTP_METHODS } from "./helpers/path"
import { findRouteFiles } from "./helpers/scanner"
import {
  assertRouteAuthorization,
  type AuthGuardConfig,
} from "./helpers/auth-guard"
import { generateRoutes } from "./generator"
import { generateInsomniumConfig } from "./insomnium"

/**
 * Configuration options for the file-based route loader.
 */
export interface RouterModuleOptions {
  /** Directory containing file-based routes (defaults to `src/modules`). */
  modulesDir?: string
  /** Suppress console banner and route mapping output. */
  silent?: boolean
}

/**
 * Discovers, loads, validates, and mounts all file-based routes onto an Elysia router instance.
 *
 * This function:
 * 1. Automatically synchronizes Eden Treaty and Insomnium manifests in development mode.
 * 2. Traverses `src/modules/` recursively for `route.ts` or `route.js` files.
 * 3. Mounts route handlers with validation schemas, rate limiters, and authorization guards (`requireAuth`, `requirePermissions`).
 * 4. Aggregates and validates unique cache key definitions across all routes.
 * 5. Decorates each route execution context with database, cache, session, and `notifications`.
 *
 * @param options - Router module configuration options
 * @returns Configured Elysia router instance with all dynamic routes mounted
 *
 * @example
 * ```typescript
 * const router = await createRouterModule()
 * app.use(router)
 * ```
 */
export async function createRouterModule(
  options: RouterModuleOptions = {}
): Promise<Elysia> {
  const router = new Elysia({ name: "iris-router" })
  const modulesDir =
    options.modulesDir || path.resolve(import.meta.dirname, "../modules")
  const isDev = process.env.NODE_ENV === "development"
  const isWatch =
    process.argv.includes("--watch") || process.env.BUN_ENV === "watch"

  // 1. Ensure dev administrator account and API key exist in development
  let devApiKey: string | undefined
  if (isDev) {
    try {
      const devAccount = await ensureDevAccount(prisma)
      devApiKey = devAccount?.apiKey
    } catch {
      // Ignored if database is not reachable at boot
    }
  }

  // 2. Synchronize route manifests on startup in development
  if (isDev) {
    try {
      await generateRoutes({ modulesDir, silent: true })
      await generateInsomniumConfig({ modulesDir, devApiKey, silent: true })
    } catch (err) {
      console.error("[Router] Initial manifest sync failed:", err)
    }
  }

  // 3. Fallback filesystem watcher inside process if running directly with bun --watch
  if (isDev && isWatch && fs.existsSync(modulesDir)) {
    try {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null
      const watcher = fs.watch(
        modulesDir,
        { recursive: true },
        (_eventType, filename) => {
          if (!filename) return
          const ext = path.extname(filename)
          if (![".ts", ".js"].includes(ext)) return

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
          }, 150)
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
      // Ignored if recursive fs.watch is not supported by environment
    }
  }

  if (!fs.existsSync(modulesDir)) {
    if (!options.silent) {
      console.log(`[Router] Modules directory not found: ${modulesDir}`)
    }
    return router
  }

  // 4. Discover and mount all routes
  const routeFiles = findRouteFiles(modulesDir)
  let loadedCount = 0
  const routesByModule = new Map<
    string,
    Array<{ method: string; path: string }>
  >()
  const globalCacheKeyStorage: Record<string, Record<string, any>> = {}
  const cacheKeyRegistry = new Map<string, string>()

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

      // Merge cache keys
      const routeCacheKeys =
        staticClass?.cacheKeys ||
        instance.cacheKeys ||
        (RouteExport as RouteDefinition)?.cacheKeys ||
        importedModule.cacheKeys ||
        {}

      if (
        routeCacheKeys &&
        typeof routeCacheKeys === "object" &&
        Object.keys(routeCacheKeys).length > 0
      ) {
        deepMergeAndValidateCacheKeys(
          globalCacheKeyStorage,
          routeCacheKeys,
          "",
          relativePath,
          cacheKeyRegistry
        )
      }

      // Route-level rate limits and authorization options
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

      const routeAuthConfig: AuthGuardConfig = {
        requireAuth:
          staticClass?.requireAuth ??
          instance.requireAuth ??
          (RouteExport as RouteDefinition)?.requireAuth ??
          importedModule.requireAuth,
        requirePermissions:
          staticClass?.requirePermissions ??
          instance.requirePermissions ??
          (RouteExport as RouteDefinition)?.requirePermissions ??
          importedModule.requirePermissions,
      }

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

        // Bodyless HTTP methods must never have body schema attached
        if (["GET", "HEAD", "OPTIONS"].includes(method) && methodSchema.body) {
          delete methodSchema.body
        }

        let customMethodRateLimit =
          perMethodRateLimits[method as keyof typeof perMethodRateLimits]

        let methodAuthConfig: AuthGuardConfig = {}

        if (typeof methodItem === "function") {
          handler = methodItem as (ctx: Context) => unknown
        } else if (
          typeof methodItem === "object" &&
          methodItem !== null &&
          "handler" in methodItem
        ) {
          handler = (methodItem as MethodConfig).handler as (
            ctx: Context
          ) => unknown

          if ((methodItem as MethodConfig).schema) {
            methodSchema = {
              ...methodSchema,
              ...(methodItem as MethodConfig).schema,
            }
          }
          if ((methodItem as MethodConfig).rateLimit) {
            customMethodRateLimit = (methodItem as MethodConfig).rateLimit
          }

          methodAuthConfig = {
            requireAuth: (methodItem as MethodConfig).requireAuth,
            requirePermissions: (methodItem as MethodConfig).requirePermissions,
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

            const requestLogger = createRequestLogger(store)
            ctx.logger = requestLogger
            ctx.cacheKeys =
              globalCacheKeyStorage as unknown as Context["cacheKeys"]
            ctx.notifications = notificationService

            return await requestLogStorage.run(store, async () => {
              // 1. Enforce route/method authorization guards (method priority over route)
              assertRouteAuthorization(ctx, methodAuthConfig, routeAuthConfig)

              // 2. Enforce rate limiting
              if (rateLimiter) {
                const rateLimitError = rateLimiter(ctx)
                if (rateLimitError) {
                  return rateLimitError
                }
              }

              // 3. Execute route handler
              const res = await handler.call(instance, ctx)
              if (res instanceof Response) {
                ctx.set.status = res.status
              }
              return res
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

/**
 * Deeply merges and validates cache keys across routes, throwing on duplicate collisions.
 */
function deepMergeAndValidateCacheKeys(
  target: Record<string, any>,
  source: Record<string, any>,
  prefix: string,
  relativePath: string,
  cacheKeyRegistry: Map<string, string>
): void {
  for (const [key, val] of Object.entries(source)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (typeof val === "function") {
      const existing = cacheKeyRegistry.get(fullPath)
      if (existing) {
        throw new Error(
          `[Router] Duplicate cache key "${fullPath}" found in "${relativePath}". It was already defined in "${existing}". Cache keys must be unique across all routes.`
        )
      }
      cacheKeyRegistry.set(fullPath, relativePath)
      target[key] = val
    } else if (val && typeof val === "object") {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {}
      }
      deepMergeAndValidateCacheKeys(
        target[key],
        val,
        fullPath,
        relativePath,
        cacheKeyRegistry
      )
    }
  }
}

export * from "./types"
export * from "./generator"
export * from "./insomnium"
export * from "./helpers/path"
export * from "./helpers/scanner"
export * from "./helpers/auth-guard"
export {
  createRateLimiter,
  rateLimiter,
  getClientIp,
  type ClientRecord,
} from "../plugins/rate-limiter"

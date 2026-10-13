import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { c } from "../utils/colors"
import { DEV_ACCOUNT_DEFAULTS } from "../utils/dev-account"
import { parseRoutePath, HTTP_METHODS } from "./helpers/path"
import { findRouteFiles } from "./helpers/scanner"

/**
 * Configuration options for Insomnium workspace collection generation.
 */
export interface InsomniumOptions {
  /** Directory containing file-based routes (defaults to `src/modules`). */
  modulesDir?: string
  /** Output file destination for the Insomnium v4 export JSON. */
  outputFile?: string
  /** Developer API key injected into workspace environment variables. */
  devApiKey?: string
  /** Suppress console output during generation. */
  silent?: boolean
}

/**
 * Generates an Insomnium v4 export JSON configuration from all routes.
 *
 * This function:
 * 1. Scans `src/modules/` recursively using the shared scanner helper.
 * 2. Parses URL parameters and schemas using the shared path helper.
 * 3. Builds a pre-configured Insomnium workspace with base URL and development API keys.
 * 4. Organizes endpoints into folders grouped by domain module.
 * 5. Synthesizes sample request bodies and query parameters matching TypeBox schemas.
 * 6. Idempotently writes to `insomnium.json`.
 *
 * @param options - Insomnium generator options
 *
 * @example
 * ```typescript
 * await generateInsomniumConfig({ silent: true })
 * ```
 */
export async function generateInsomniumConfig(
  options: InsomniumOptions = {}
): Promise<void> {
  const routerDir = import.meta.dirname
  const modulesDir = options.modulesDir || path.resolve(routerDir, "../modules")
  const outputFile =
    options.outputFile || path.resolve(routerDir, "../../insomnium.json")

  const devApiKey = options.devApiKey || DEV_ACCOUNT_DEFAULTS.apiKey

  const workspaceId = "wrk_iris_elysia_api"
  const envId = "env_iris_elysia_local"

  const resources: Array<Record<string, unknown>> = [
    {
      _id: workspaceId,
      parentId: null,
      name: "IRIS Elysia API",
      description:
        "Auto-generated collection for IRIS Elysia file-based routes",
      scope: "collection",
      _type: "workspace",
    },
    {
      _id: envId,
      parentId: workspaceId,
      name: "Local Development",
      data: {
        base_url: "http://localhost:4000",
        api_key: devApiKey,
        token: "",
      },
      dataPropertyOrder: {
        "&": ["base_url", "api_key", "token"],
      },
      color: "#8b5cf6",
      isPrivate: false,
      _type: "environment",
    },
  ]

  const folderIds = new Map<string, string>()
  const routeFiles = findRouteFiles(modulesDir)

  // Sort files for deterministic generation
  routeFiles.sort()

  let requestCount = 0

  for (const filePath of routeFiles) {
    const relativePath = path.relative(modulesDir, filePath)
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
    const moduleName = normalized.split("/")[0] || "core"
    const routePath = parseRoutePath(relativePath)

    // Create module folder (request_group) if not yet created
    let folderId = folderIds.get(moduleName)
    if (!folderId) {
      const sanitizedName = moduleName.replace(/[^a-zA-Z0-9_]/g, "_")
      folderId = `fld_${sanitizedName}`
      folderIds.set(moduleName, folderId)

      resources.push({
        _id: folderId,
        parentId: workspaceId,
        name: moduleName,
        description: `Routes for ${moduleName} module`,
        environment: {},
        environmentPropertyOrder: null,
        _type: "request_group",
      })
    }

    try {
      const fileUrl = pathToFileURL(filePath).href
      const importedModule = await import(fileUrl)
      const RouteExport = importedModule.default

      if (!RouteExport) continue

      let instance: Record<string, unknown>
      if (typeof RouteExport === "function") {
        try {
          instance = new (RouteExport as new () => Record<string, unknown>)()
        } catch {
          instance = RouteExport as Record<string, unknown>
        }
      } else if (typeof RouteExport === "object" && RouteExport !== null) {
        instance = RouteExport as Record<string, unknown>
      } else {
        continue
      }

      const globalSchema = (instance.schema ||
        (RouteExport as Record<string, unknown>)?.schema) as
        Record<string, unknown> | undefined
      const perMethodSchemas = (instance.schemas ||
        (RouteExport as Record<string, unknown>)?.schemas ||
        {}) as Record<string, Record<string, unknown>>

      for (const method of HTTP_METHODS) {
        const methodItem = instance[method]
        if (!methodItem) continue

        let methodSchema: Record<string, unknown> = {
          ...(globalSchema || {}),
          ...(perMethodSchemas[method] || {}),
        }

        if (
          typeof methodItem === "object" &&
          methodItem !== null &&
          "schema" in methodItem
        ) {
          methodSchema = {
            ...methodSchema,
            ...((methodItem as Record<string, unknown>).schema as object),
          }
        }

        // Generate query parameters
        const parameters: Array<{
          name: string
          value: string
          disabled?: boolean
        }> = []
        if (
          methodSchema.query &&
          typeof methodSchema.query === "object" &&
          "properties" in methodSchema.query
        ) {
          const queryProps = (methodSchema.query as Record<string, unknown>)
            .properties
          if (queryProps && typeof queryProps === "object") {
            for (const [paramName, prop] of Object.entries(queryProps)) {
              parameters.push({
                name: paramName,
                value: String(sampleFromSchema(prop) ?? ""),
                disabled: false,
              })
            }
          }
        }

        // Generate headers
        const headers: Array<{
          name: string
          value: string
          disabled?: boolean
        }> = [
          {
            name: "x-api-key",
            value: "{{ _.api_key }}",
            disabled: false,
          },
          {
            name: "Authorization",
            value: "Bearer {{ _.token }}",
            disabled: true,
          },
        ]

        // Generate body
        let body: Record<string, unknown> = {}
        if (method !== "GET" && method !== "HEAD") {
          headers.unshift({
            name: "Content-Type",
            value: "application/json",
            disabled: false,
          })

          if (
            methodSchema.body &&
            typeof methodSchema.body === "object" &&
            "properties" in methodSchema.body
          ) {
            const bodySample = sampleFromSchema(methodSchema.body)
            body = {
              mimeType: "application/json",
              text: JSON.stringify(bodySample, null, 2),
            }
          }
        }

        const safePathId = routePath.replace(/[^a-zA-Z0-9]/g, "_")
        const requestId = `req_${moduleName}_${safePathId}_${method.toLowerCase()}`

        resources.push({
          _id: requestId,
          parentId: folderId,
          url: `{{ _.base_url }}${routePath}`,
          name: `${method} ${routePath}`,
          description: "",
          method,
          body,
          parameters,
          headers,
          authentication: {},
          isPrivate: false,
          settingStoreCookies: true,
          settingSendCookies: true,
          settingDisableRenderRequestBody: false,
          settingEncodeUrl: true,
          settingRebuildPath: true,
          settingFollowRedirects: "global",
          _type: "request",
        })

        requestCount++
      }
    } catch (err) {
      if (!options.silent) {
        console.warn(`[Insomnium] Could not inspect ${filePath}:`, err)
      }
    }
  }

  const exportDocument = {
    _type: "export",
    __export_format: 4,
    __export_source: "insomnium.desktop.app:v0.2.3-a",
    resources,
  }

  const fileContent = JSON.stringify(exportDocument, null, 2) + "\n"

  // Prevent touching the file if unchanged to avoid bun --watch reload loops and preserve disk lifetime
  if (fs.existsSync(outputFile)) {
    const current = fs.readFileSync(outputFile, "utf-8")
    if (current === fileContent) {
      return
    }
  }

  fs.writeFileSync(outputFile, fileContent, "utf-8")

  if (!options.silent) {
    console.log(
      `${c.cyan(c.bold("[Insomnium]"))} ${c.green("Generated")} ${c.bold(requestCount)} ${c.green("endpoints in:")} ${c.dim(outputFile)}`
    )
  }
}

/**
 * Generates sample data from a JSON Schema / TypeBox definition.
 */
function sampleFromSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return ""

  const s = schema as Record<string, unknown>

  if (s.default !== undefined) return s.default
  if (Array.isArray(s.examples) && s.examples.length > 0) return s.examples[0]
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0]

  switch (s.type) {
    case "string":
      if (s.format === "date-time") return new Date().toISOString()
      if (s.format === "email") return "user@example.com"
      if (s.format === "uuid") return "00000000-0000-0000-0000-000000000000"
      return "string"
    case "number":
    case "integer":
      return s.minimum ?? 1
    case "boolean":
      return true
    case "array":
      if (s.items) {
        return [sampleFromSchema(s.items)]
      }
      return []
    case "object":
      if (s.properties && typeof s.properties === "object") {
        const result: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(s.properties)) {
          result[k] = sampleFromSchema(v)
        }
        return result
      }
      return {}
    default:
      return null
  }
}

if (import.meta.main) {
  generateInsomniumConfig()
}

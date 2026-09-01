import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { c } from "../utils/colors"
import { DEV_ACCOUNT_DEFAULTS } from "../utils/dev-account"

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
] as const

type HttpMethod = (typeof HTTP_METHODS)[number]

/**
 * Options configuring Insomnium collection generation.
 */
export interface InsomniumGeneratorOptions {
  /** Directory containing file-based routes (defaults to src/modules). */
  modulesDir?: string
  /** Output file destination for the Insomnium v4 export JSON. */
  outputFile?: string
  /** Developer API key injected into workspace environment variables. */
  devApiKey?: string
  /** Suppress console output during generation. */
  silent?: boolean
}

/**
 * Converts a relative file path to an Elysia route path.
 *
 * @param relativeFilePath - File path relative to modules root
 * @returns Formatted URL route path string
 */
function parseRoutePath(relativeFilePath: string): string {
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
 * Recursively scans directory for route files.
 *
 * @param dir - Directory path to traverse
 * @returns List of absolute route file paths
 */
function findRouteFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []

  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath))
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
 * Derives a sample JSON payload value from a TypeBox JSON schema definition.
 *
 * @param schema - TypeBox schema object
 * @returns Sample object or primitive value
 */
function sampleFromSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return {}
  const s = schema as Record<string, unknown>

  if (s.default !== undefined) return s.default
  if (s.type === "string") return "string"
  if (s.type === "number" || s.type === "integer") return 1
  if (s.type === "boolean") return true
  if (s.type === "array") return []
  if (s.type === "object" && s.properties && typeof s.properties === "object") {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(
      s.properties as Record<string, unknown>
    )) {
      obj[k] = sampleFromSchema(v)
    }
    return obj
  }
  return {}
}

/**
 * Generates an Insomnium / Insomnia v4 compatible collection file from all file-based routes.
 *
 * Automatically inspects query parameters, path segments, and TypeBox body schemas to
 * synthesize pre-filled HTTP requests organized into module folders with development API keys.
 *
 * @param options - Generation options
 */
export async function generateInsomniumConfig(
  options: InsomniumGeneratorOptions = {}
): Promise<void> {
  const modulesDir =
    options.modulesDir || path.resolve(import.meta.dirname, "../modules")
  const outputFile =
    options.outputFile ||
    path.resolve(import.meta.dirname, "../../insomnium.json")

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    `http://localhost:${process.env.ELYSIA_PORT || 4000}`

  const routeFiles = findRouteFiles(modulesDir)

  const workspaceId = "wrk_iris_api"
  const baseEnvId = "env_iris_base"

  const resources: Array<Record<string, unknown>> = [
    {
      _id: workspaceId,
      parentId: null,
      name: "IRIS API",
      description: "Auto-generated Insomnium collection for IRIS Elysia server",
      scope: "collection",
      _type: "workspace",
    },
    {
      _id: baseEnvId,
      parentId: workspaceId,
      name: "Base Environment",
      data: {
        base_url: baseUrl,
        token: "",
        api_key: options.devApiKey || DEV_ACCOUNT_DEFAULTS.apiKey,
      },
      dataPropertyOrder: {
        "&": ["base_url", "token", "api_key"],
      },
      color: "#6b46c1",
      isPrivate: false,
      _type: "environment",
    },
  ]

  // Folder map to track module request groups
  const folderIds = new Map<string, string>()

  // Add Health Check endpoint
  resources.push({
    _id: "req_health_check",
    parentId: workspaceId,
    url: "{{ _.base_url }}/health",
    name: "GET /health",
    description: "Server health and uptime check",
    method: "GET",
    body: {},
    parameters: [],
    headers: [],
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

  let requestCount = 1

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

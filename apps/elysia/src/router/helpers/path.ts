/**
 * Converts a relative module file path into an Elysia URL route path.
 *
 * Rules:
 * - Omits the top-level module directory (e.g. `IRIS-social/...` -> `/...`)
 * - Strips route groupings wrapped in parentheses: `(group)/user` -> `/user`
 * - Transforms dynamic parameters: `[id]` -> `:id`
 * - Transforms wildcard catch-all segments: `[...slug]` -> `*`
 *
 * @param relativeFilePath - File path relative to the `src/modules` directory
 * @returns Formatted URL route path string starting with a leading slash
 *
 * @example
 * ```typescript
 * parseRoutePath("IRIS-account/user/[id]/list/route.ts") // returns "/user/:id/list"
 * parseRoutePath("IRIS-media/(public)/pricing/route.ts") // returns "/pricing"
 * parseRoutePath("IRIS-core/route.ts")                  // returns "/"
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

/** Supported HTTP method verbs recognized by the router */
export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
  "ALL",
] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

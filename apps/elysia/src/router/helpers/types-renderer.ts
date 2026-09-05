/**
 * Recursively formats an in-memory nested type signature map into a TypeScript interface body.
 *
 * @param map - Record containing primitive function signature strings or nested object structures
 * @param depth - Current indentation level (defaults to 1)
 * @returns Formatted TypeScript code string representation of the type map
 *
 * @example
 * ```typescript
 * const rendered = renderTypeMap({ anime: { id: "(id: number) => string" } }, 1)
 * ```
 */
export function renderTypeMap(
  map: Record<string, any>,
  depth: number = 1
): string {
  const indent = "  ".repeat(depth)
  const lines: string[] = []

  for (const [key, val] of Object.entries(map)) {
    if (typeof val === "string") {
      lines.push(`${indent}${key}: ${val};`)
    } else if (val && typeof val === "object") {
      lines.push(`${indent}${key}: {`)
      lines.push(renderTypeMap(val, depth + 1))
      lines.push(`${indent}};`)
    }
  }

  return lines.join("\n")
}

/**
 * Deeply merges and extracts type signatures from route cache key functions.
 *
 * @param target - Target object accumulating type signature strings
 * @param source - Source cache key object containing generator functions
 */
export function extractTypeSignatures(
  target: Record<string, any>,
  source: Record<string, any>
): void {
  for (const [key, val] of Object.entries(source)) {
    if (typeof val === "function") {
      const fnStr = val.toString()
      const argsMatch = fnStr.match(/^(?:async\s*)?(?:function\s*)?\(([^)]*)\)/)
      const arrowMatch = fnStr.match(/^(?:async\s*)?\(([^)]*)\)\s*=>/)
      const singleArgMatch = fnStr.match(/^(?:async\s*)?([a-zA-Z0-9_$]+)\s*=>/)

      let rawArgs = ""
      if (argsMatch?.[1] !== undefined) rawArgs = argsMatch[1]
      else if (arrowMatch?.[1] !== undefined) rawArgs = arrowMatch[1]
      else if (singleArgMatch?.[1] !== undefined) rawArgs = singleArgMatch[1]

      const formattedArgs = rawArgs
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
        .map((a) => {
          const argName = a.split(":")[0]?.trim() || a.trim()
          return `${argName}: any`
        })
        .join(", ")

      target[key] = `(${formattedArgs}) => string`
    } else if (val && typeof val === "object") {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {}
      }
      extractTypeSignatures(target[key], val)
    }
  }
}

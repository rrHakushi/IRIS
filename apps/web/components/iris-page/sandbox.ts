import type { SandboxContext } from "./types"

/**
 * List of dangerous global property names that are strictly blocked
 * to prevent XSS, prototype pollution, and environment inspection.
 */
const BLOCKED_GLOBALS = new Set([
  "window",
  "document",
  "globalThis",
  "global",
  "self",
  "top",
  "parent",
  "frames",
  "eval",
  "Function",
  "AsyncFunction",
  "GeneratorFunction",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "cookieStore",
  "document.cookie",
  "location",
  "navigator",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "Worker",
  "SharedWorker",
  "ServiceWorker",
  "process",
  "importScripts",
  "__proto__",
  "constructor",
  "prototype",
])

/**
 * Safe standard JavaScript built-ins exposed to expressions and scripts.
 */
const SAFE_GLOBALS: Record<string, any> = {
  Math,
  Date,
  Number,
  String,
  Boolean,
  Array,
  Object,
  JSON,
  RegExp,
  isNaN,
  isFinite,
  parseInt,
  parseFloat,
  encodeURIComponent,
  decodeURIComponent,
  console: {
    log: (...args: any[]) => console.log("[IrisPage]", ...args),
    warn: (...args: any[]) => console.warn("[IrisPage]", ...args),
    error: (...args: any[]) => console.error("[IrisPage]", ...args),
  },
}

/**
 * Creates a sandbox Proxy around the context to isolate execution.
 */
function createSandboxProxy(context: SandboxContext): any {
  return new Proxy(context, {
    has: () => true, // Trap all identifier lookups so they never reach the real global scope
    get: (target, prop: string | symbol) => {
      if (typeof prop !== "string") return undefined

      // Explicitly block dangerous globals
      if (BLOCKED_GLOBALS.has(prop)) {
        console.warn(`[IrisPage Sandbox] Blocked illegal access to "${prop}".`)
        return undefined
      }

      // Check context properties
      if (prop in target) {
        return (target as any)[prop]
      }

      // Check allowed safe built-in globals
      if (prop in SAFE_GLOBALS) {
        return SAFE_GLOBALS[prop]
      }

      return undefined
    },
    set: (target, prop: string | symbol, value: any) => {
      if (typeof prop === "string" && !BLOCKED_GLOBALS.has(prop)) {
        (target as any)[prop] = value
        return true
      }
      return false
    },
  })
}

/**
 * Safely resolves a nested dot-notation path on an object.
 */
export function getByPath(obj: any, path: string): any {
  if (obj == null || !path) return undefined
  const parts = path.split(".")
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

/**
 * Immutably updates a nested property at a dot-notation path.
 */
export function setByPath<T extends Record<string, any>>(obj: T, path: string, value: any): T {
  const parts = path.split(".")
  if (parts.length === 0) return obj

  const clone = { ...obj }
  let current: any = clone

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (key === undefined) continue
    if (current[key] == null || typeof current[key] !== "object") {
      current[key] = {}
    } else {
      current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] }
    }
    current = current[key]
  }

  const lastKey = parts[parts.length - 1]
  if (lastKey !== undefined) {
    current[lastKey] = value
  }
  return clone
}

/**
 * Immutably toggles a boolean property at a dot-notation path.
 */
export function toggleByPath<T extends Record<string, any>>(obj: T, path: string): T {
  const current = getByPath(obj, path)
  return setByPath(obj, path, !current)
}

/**
 * Immutably appends an item to an array at a dot-notation path.
 */
export function pushByPath<T extends Record<string, any>>(obj: T, path: string, item: any): T {
  const current = getByPath(obj, path)
  const arr = Array.isArray(current) ? [...current, item] : [item]
  return setByPath(obj, path, arr)
}

/**
 * Immutably removes an item at an index from an array at a dot-notation path.
 */
export function removeByPath<T extends Record<string, any>>(obj: T, path: string, index: number): T {
  const current = getByPath(obj, path)
  if (!Array.isArray(current)) return obj
  const arr = current.filter((_, i) => i !== index)
  return setByPath(obj, path, arr)
}

/**
 * Evaluates an expression inside an isolated sandbox context.
 * Blocks access to window, document, and dangerous globals.
 */
export function evaluateExpression(expr: string, context: SandboxContext): any {
  if (!expr || typeof expr !== "string") return undefined
  const trimmed = expr.trim()
  if (!trimmed) return undefined

  // Fast path for simple property paths (e.g. "state.count", "user.username")
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(trimmed)) {
    return getByPath(context, trimmed)
  }

  // Gracefully handle common ellipsis placeholders without evaluating as JS syntax
  if (/^(\.{2,}|…|-+)$/.test(trimmed)) {
    return undefined
  }

  const sandbox = createSandboxProxy(context)

  try {
    const fn = new Function("sandbox", `with (sandbox) { return (${trimmed}); }`)
    return fn(sandbox)
  } catch {
    return undefined
  }
}

/**
 * Executes a multi-statement script or action inside an isolated sandbox context.
 * Supports async/await so actions can call Elysia or async APIs.
 */
export async function executeScript(script: string, context: SandboxContext): Promise<any> {
  if (!script || typeof script !== "string") return undefined
  const trimmed = script.trim()
  if (!trimmed) return undefined

  const sandbox = createSandboxProxy(context)

  try {
    // Wrap script inside an async IIFE to support await statements
    const fn = new Function("sandbox", `with (sandbox) { return (async () => { ${trimmed} })(); }`)
    return await fn(sandbox)
  } catch (error) {
    console.error(`[IrisPage Sandbox] Script execution error in "${trimmed}":`, error)
    throw error
  }
}

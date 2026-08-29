import util from "node:util"
import { AsyncLocalStorage } from "node:async_hooks"
import { c } from "./colors"

/**
 * Formats a Date into a zero-padded timestamp string `[HH:mm:ss]` with dim gray coloring.
 *
 * @param date - Optional Date object or timestamp (defaults to new Date())
 * @returns Formatted and colorized timestamp string e.g. `[10:36:09]`
 */
export function formatTimestamp(date: Date | string | number = new Date()): string {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n: number) => n.toString().padStart(2, "0")
  const h = pad(d.getHours())
  const m = pad(d.getMinutes())
  const s = pad(d.getSeconds())
  return c.gray(`[${h}:${m}:${s}]`)
}

/**
 * Individual captured log item with severity level and formatted message.
 */
export interface RequestLogItem {
  /** Log severity type. */
  type: "log" | "info" | "warn" | "error"
  /** Formatted log message string. */
  message: string
  /** Timestamp when log was recorded. */
  timestamp?: Date
}

/**
 * AsyncLocalStorage storage container for request-scoped logs.
 */
export interface RequestLogStore {
  /** Array of captured log items accumulated during request execution. */
  logs: RequestLogItem[]
}

/**
 * Scoped request logger interface attached to route context `ctx.log`.
 */
export interface RequestLogger {
  /** Logs standard message. */
  (...args: unknown[]): void
  /** Logs informational message. */
  info(...args: unknown[]): void
  /** Logs warning message with highlighted badge. */
  warn(...args: unknown[]): void
  /** Logs error message with highlighted badge. */
  error(...args: unknown[]): void
}

/**
 * AsyncLocalStorage instance isolating console log items per concurrent request.
 */
export const requestLogStorage = new AsyncLocalStorage<RequestLogStore>()

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

let isInterceptorActive = false

/**
 * Initializes global console interception.
 * When called inside a route execution (with an active AsyncLocalStorage store),
 * console.log/info/warn/error are captured to be grouped under that request's log output.
 * Outside a request, console behaves completely normally.
 */
export function initConsoleInterceptor(): void {
  if (isInterceptorActive) return
  isInterceptorActive = true

  const createIntercept = (type: "log" | "info" | "warn" | "error") => {
    return (...args: unknown[]) => {
      const store = requestLogStorage.getStore()
      if (store) {
        store.logs.push({
          type,
          message: util.format(...args),
          timestamp: new Date(),
        })
      } else {
        originalConsole[type](...args)
      }
    }
  }

  console.log = createIntercept("log")
  console.info = createIntercept("info")
  console.warn = createIntercept("warn")
  console.error = createIntercept("error")
}

/**
 * Formats captured request logs as a tree structure branching from the request header.
 *
 * @param logs - Array of accumulated RequestLogItem records
 */
export function printGroupedRequestLogs(logs: RequestLogItem[]): void {
  if (!logs || logs.length === 0) return

  for (let i = 0; i < logs.length; i++) {
    const isLast = i === logs.length - 1
    const branch = c.gray(isLast ? "  └─ " : "  ├─ ")
    const item = logs[i]
    if (!item) continue

    const time = formatTimestamp(item.timestamp)

    let prefix = ""
    if (item.type === "warn") prefix = c.yellow(c.bold("[WARN] "))
    if (item.type === "error") prefix = c.red(c.bold("[ERROR] "))

    process.stdout.write(`${branch}${time} ${prefix}${item.message}\n`)
  }
}

/**
 * Executes a route handler inside an AsyncLocalStorage context to isolate and group
 * all console statements and `ctx.log` calls under the request's terminal output.
 * Also executes route-level or method-level rate limit checks prior to invoking the handler.
 *
 * @param ctx - Route execution context
 * @param handler - Main route handler function
 * @param rateLimiter - Optional rate limiter middleware function
 * @returns Result of handler execution or 429 response if rate limited
 */
export async function executeWithRequestLogs(
  ctx: unknown,
  handler?: (ctx: unknown) => unknown,
  rateLimiter?: ((ctx: any) => unknown) | null
): Promise<unknown> {
  if (!handler) return undefined

  if (rateLimiter) {
    const errorResponse = rateLimiter(ctx)
    if (errorResponse) {
      return errorResponse
    }
  }

  const req = (ctx as { request?: Request })?.request
  const store: RequestLogStore = { logs: [] }

  if (req) {
    ; (req as unknown as { _requestLogs?: RequestLogItem[] })._requestLogs =
      store.logs
  }

  ; (ctx as { log?: RequestLogger }).log = Object.assign(
    (...args: unknown[]) => {
      store.logs.push({
        type: "log",
        message: util.format(...args),
        timestamp: new Date(),
      })
    },
    {
      info: (...args: unknown[]) => {
        store.logs.push({
          type: "info",
          message: util.format(...args),
          timestamp: new Date(),
        })
      },
      warn: (...args: unknown[]) => {
        store.logs.push({
          type: "warn",
          message: util.format(...args),
          timestamp: new Date(),
        })
      },
      error: (...args: unknown[]) => {
        store.logs.push({
          type: "error",
          message: util.format(...args),
          timestamp: new Date(),
        })
      },
    }
  )

  return await requestLogStorage.run(store, async () => {
    return await handler(ctx)
  })
}


import util from "node:util"
import { c } from "./colors.js"
import { requestLogStorage } from "./request-logger.js"

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent"

export type TagColor =
  | "blue"
  | "yellow"
  | "magenta"
  | "green"
  | "cyan"
  | "red"
  | "white"
  | "gray"

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

const DEFAULT_TAG_COLORS: Record<string, TagColor> = {
  Services: "blue",
  Plugins: "yellow",
  Elysia: "magenta",
  WebSocket: "magenta",
  MediaQueue: "magenta",
  Mailer: "green",
  "Dev Account": "green",
  Cron: "cyan",
  Insomnium: "cyan",
  "Eden Generator": "cyan",
  Cache: "cyan",
  Router: "blue",
  Auth: "blue",
  Database: "blue",
}

function resolveTagColor(tag: string, overrideColor?: TagColor): TagColor {
  if (overrideColor) return overrideColor
  return DEFAULT_TAG_COLORS[tag] || "magenta"
}

function colorizeTag(tag: string, color: TagColor): string {
  const colorFn = (c as Record<string, ((v: unknown) => string) | undefined>)[color]
  const renderedColor = colorFn ? colorFn(c.bold(`[${tag}]`)) : c.bold(`[${tag}]`)
  return renderedColor
}

let currentLogLevel: LogLevel = (() => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel as LogLevel
  }
  return "info"
})()

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLogLevel]
}

function emitLog(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  rawArgs: unknown[] = []
): void {
  if (!shouldLog(level)) return

  const store = requestLogStorage.getStore()
  if (store) {
    const formatted = rawArgs.length > 0 ? util.format(message, ...rawArgs) : message
    store.logs.push({
      type: level === "debug" ? "info" : level,
      message: formatted,
      timestamp: new Date(),
    })
  } else {
    const formatted = rawArgs.length > 0 ? util.format(message, ...rawArgs) : message
    if (level === "error") {
      console.error(formatted)
    } else if (level === "warn") {
      console.warn(formatted)
    } else {
      console.log(formatted)
    }
  }
}

export interface ScopedLoggerOptions {
  color?: TagColor
  parentTag?: string
}

export interface ScopedLogger {
  /** Logs standard informational message prefixed with the scoped tag. */
  (...args: unknown[]): void
  /** Logs standard informational message prefixed with the scoped tag. */
  info(...args: unknown[]): void
  /** Logs warning message prefixed with the scoped tag and warning badge. */
  warn(...args: unknown[]): void
  /** Logs error message prefixed with the scoped tag and error badge. */
  error(...args: unknown[]): void
  /** Logs debug message (hidden unless LOG_LEVEL=debug). */
  debug(...args: unknown[]): void
  /** Logs success message with a green checkmark icon. */
  success(...args: unknown[]): void
  /** Alias for info. */
  log(...args: unknown[]): void
  /** Creates a nested child logger under this tag (e.g. `[MediaQueue][AniList]`). */
  withTag(subtag: string, color?: TagColor): ScopedLogger
}

/**
 * Creates a scoped logger instance with dedicated tag styling and level methods.
 *
 * @param tag - Tag name displayed in brackets e.g. "Services", "MediaQueue"
 * @param options - Optional color or configuration options
 * @returns Strongly-typed callable logger instance
 */
export function createLogger(tag: string, options?: ScopedLoggerOptions): ScopedLogger {
  const color = resolveTagColor(tag, options?.color)
  const fullTag = options?.parentTag ? `${options.parentTag}][${tag}` : tag
  const tagPrefix = colorizeTag(fullTag, color)

  const formatMessage = (args: unknown[]): string => {
    return `${tagPrefix} ${util.format(...args)}`
  }

  const logFn = (...args: unknown[]) => {
    emitLog("info", formatMessage(args))
  }

  const loggerObj: ScopedLogger = Object.assign(logFn, {
    info: (...args: unknown[]) => {
      emitLog("info", formatMessage(args))
    },
    warn: (...args: unknown[]) => {
      emitLog("warn", `${tagPrefix} ${c.yellow(c.bold("[WARN]"))} ${util.format(...args)}`)
    },
    error: (...args: unknown[]) => {
      emitLog("error", `${tagPrefix} ${c.red(c.bold("[ERROR]"))} ${util.format(...args)}`)
    },
    debug: (...args: unknown[]) => {
      emitLog("debug", `${tagPrefix} ${c.gray("[DEBUG]")} ${util.format(...args)}`)
    },
    success: (...args: unknown[]) => {
      emitLog("info", `${tagPrefix} ${c.green("✓")} ${util.format(...args)}`)
    },
    log: (...args: unknown[]) => {
      emitLog("info", formatMessage(args))
    },
    withTag: (subtag: string, subColor?: TagColor): ScopedLogger => {
      return createLogger(subtag, {
        color: subColor || color,
        parentTag: fullTag,
      })
    },
  })

  return loggerObj
}

/**
 * Service-specific specialized logger interface for Elysia service lifecycle.
 */
export interface ServiceLogger extends ScopedLogger {
  /** Logs standard service loaded line: `[Services] Service loaded: <name> (<desc>)` */
  (name: string, description?: string): void
  /** Logs standard service loaded line: `[Services] Service loaded: <name> (<desc>)` */
  loaded(name: string, description?: string): void
  /** Logs total count of registered backend services: `[Services] Total services loaded: <count>` */
  total(count: number): void
  /** Logs missing required environment variable warning: `[Services]   ⚠️ Missing required env: <var> (<reason>)` */
  missingEnv(envVar: string, reason?: string): void
  /** Logs provider-specific missing environment variable warning: `[Services]   ⚠️ [<provider>] Missing required env: <var> (<reason>)` */
  providerMissingEnv(provider: string, envVar: string, reason?: string): void
  /** Logs provider-specific optional environment variable notice: `[Services]   ℹ️ [<provider>] Optional env not set: <var> (<fallback>)` */
  providerOptionalEnv(provider: string, envVar: string, fallback?: string): void
  /** Logs successful service check/verification: `[Services]   ✓ <message>` */
  verified(message: string): void
}

function createServiceLogger(): ServiceLogger {
  const base = createLogger("Services", { color: "blue" })

  const loaded = (name: string, description?: string) => {
    const desc = description ? ` ${c.dim(`(${description})`)}` : ""
    const line = `${c.blue(c.bold("[Services]"))} Service loaded: ${c.green(name.padEnd(18))}${desc}`
    emitLog("info", line)
  }

  const callable = Object.assign(
    (name: string, description?: string) => {
      loaded(name, description)
    },
    base,
    {
      loaded,
      total: (count: number) => {
        emitLog(
          "info",
          `${c.blue(c.bold("[Services]"))} Total services loaded: ${c.green(count)}`
        )
      },
      missingEnv: (envVar: string, reason?: string) => {
        const desc = reason ? ` ${c.dim(`(${reason})`)}` : ""
        emitLog(
          "warn",
          `${c.blue(c.bold("[Services]"))}   ${c.yellow("⚠️ Missing required env:")} ${c.red(envVar)}${desc}`
        )
      },
      providerMissingEnv: (provider: string, envVar: string, reason?: string) => {
        const desc = reason ? ` ${c.dim(`(${reason})`)}` : ""
        emitLog(
          "warn",
          `${c.blue(c.bold("[Services]"))}   ${c.yellow(`⚠️ [${provider}] Missing required env:`)} ${c.red(envVar)}${desc}`
        )
      },
      providerOptionalEnv: (provider: string, envVar: string, fallback?: string) => {
        const desc = fallback ? ` ${c.dim(`(${fallback})`)}` : ""
        emitLog(
          "info",
          `${c.blue(c.bold("[Services]"))}   ${c.dim(`ℹ️ [${provider}] Optional env not set:`)} ${c.dim(envVar)}${desc}`
        )
      },
      verified: (message: string) => {
        emitLog(
          "info",
          `${c.blue(c.bold("[Services]"))}   ${c.green("✓")} ${c.dim(message)}`
        )
      },
    }
  )

  return callable as unknown as ServiceLogger
}

/**
 * Plugin-specific specialized logger interface for Elysia plugin lifecycle.
 */
export interface PluginLogger extends ScopedLogger {
  /** Logs standard plugin loaded line: `[Plugins] Plugin loaded: <name> (<desc>)` */
  (name: string, description?: string): void
  /** Logs standard plugin loaded line: `[Plugins] Plugin loaded: <name> (<desc>)` */
  loaded(name: string, description?: string): void
  /** Logs total count of registered plugins: `[Plugins] Total plugins loaded: <count>` */
  total(count: number): void
}

function createPluginLogger(): PluginLogger {
  const base = createLogger("Plugins", { color: "yellow" })

  const loaded = (name: string, description?: string) => {
    const desc = description ? c.dim(` (${description})`) : ""
    const line = `${c.yellow(c.bold("[Plugins]"))} Plugin loaded: ${c.cyan(name.padEnd(10))}${desc}`
    emitLog("info", line)
  }

  const callable = Object.assign(
    (name: string, description?: string) => {
      loaded(name, description)
    },
    base,
    {
      loaded,
      total: (count: number) => {
        emitLog(
          "info",
          `${c.yellow(c.bold("[Plugins]"))} Total plugins loaded: ${c.green(count)}`
        )
      },
    }
  )

  return callable as unknown as PluginLogger
}

/**
 * WebSocket-specific logger interface with connection lifecycle helpers.
 */
export interface WebSocketLogger extends ScopedLogger {
  connected(userId: string): void
  disconnected(): void
}

function createWebSocketLogger(): WebSocketLogger {
  const base = createLogger("WebSocket", { color: "magenta" })
  return Object.assign(base, {
    connected: (userId: string) => {
      emitLog(
        "info",
        `${c.magenta(c.bold("[WebSocket]"))} ${c.green("Client connected:")} user=${c.cyan(userId)}`
      )
    },
    disconnected: () => {
      emitLog(
        "info",
        `${c.magenta(c.bold("[WebSocket]"))} ${c.yellow("Client disconnected")}`
      )
    },
  })
}

// Pre-configured specialized loggers
const serviceLogger = createServiceLogger()
const pluginLogger = createPluginLogger()
const wsLogger = createWebSocketLogger()
const mediaQueueLogger = createLogger("MediaQueue", { color: "magenta" })
const mailerLogger = createLogger("Mailer", { color: "green" })
const devAccountLogger = createLogger("Dev Account", { color: "green" })
const cronLogger = createLogger("Cron", { color: "cyan" })
const routerLogger = createLogger("Router", { color: "blue" })
const elysiaLogger = createLogger("Elysia", { color: "magenta" })
const cacheLogger = createLogger("Cache", { color: "cyan" })

/**
 * Centralized IRIS Logger namespace and callable root function.
 */
export const logger = Object.assign(
  (...args: unknown[]) => {
    emitLog("info", util.format(...args))
  },
  {
    /** Informational general log. */
    info: (...args: unknown[]) => {
      emitLog("info", util.format(...args))
    },
    /** Warning general log. */
    warn: (...args: unknown[]) => {
      emitLog("warn", `${c.yellow(c.bold("[WARN]"))} ${util.format(...args)}`)
    },
    /** Error general log. */
    error: (...args: unknown[]) => {
      emitLog("error", `${c.red(c.bold("[ERROR]"))} ${util.format(...args)}`)
    },
    /** Debug general log (visible when LOG_LEVEL=debug). */
    debug: (...args: unknown[]) => {
      emitLog("debug", `${c.gray("[DEBUG]")} ${util.format(...args)}`)
    },
    /** Success general log with green checkmark. */
    success: (...args: unknown[]) => {
      emitLog("info", `${c.green("✓")} ${util.format(...args)}`)
    },

    /** Dynamic log level management. */
    setLevel: (level: LogLevel) => {
      currentLogLevel = level
    },
    getLevel: (): LogLevel => {
      return currentLogLevel
    },

    /** Tagged / Scoped logger creation factory. */
    create: createLogger,
    scoped: createLogger,

    /** Domain-specific loggers */
    service: serviceLogger,
    services: serviceLogger,
    plugin: pluginLogger,
    plugins: pluginLogger,
    ws: wsLogger,
    websocket: wsLogger,
    mediaQueue: mediaQueueLogger,
    mailer: mailerLogger,
    devAccount: devAccountLogger,
    cron: cronLogger,
    router: routerLogger,
    elysia: elysiaLogger,
    cache: cacheLogger,
  }
)

export default logger

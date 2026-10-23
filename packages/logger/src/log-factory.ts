import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import util from "node:util"
import {
  c,
  colorizeTag,
  formatJsonString,
  formatTimestamp,
  hashTagColor,
} from "./colors.js"
import type {
  ILogFactory,
  JsonLogFn,
  LogEntry,
  LogFactoryOptions,
  LogLevel,
  LogSink,
  ModuleName,
  TagColor,
} from "./types.js"

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

const BADGE_WIDTH = 9 // "[SUCCESS]".length

function getBadge(
  level: "debug" | "info" | "warn" | "error" | "success"
): string {
  let badgeText = ""
  let coloredBadge = ""

  switch (level) {
    case "info":
      badgeText = "[INFO]"
      coloredBadge = c.blue(c.bold(badgeText))
      break
    case "warn":
      badgeText = "[WARN]"
      coloredBadge = c.yellow(c.bold(badgeText))
      break
    case "error":
      badgeText = "[ERROR]"
      coloredBadge = c.red(c.bold(badgeText))
      break
    case "debug":
      badgeText = "[DEBUG]"
      coloredBadge = c.gray(c.bold(badgeText))
      break
    case "success":
      badgeText = "[SUCCESS]"
      coloredBadge = c.green(c.bold(badgeText))
      break
  }

  const padding = " ".repeat(BADGE_WIDTH - badgeText.length)
  return `${coloredBadge}${padding}`
}

function loadExistingModules(): Set<string> {
  const set = new Set<string>()
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const possiblePaths = [
      path.resolve(currentDir, "modules.generated.ts"),
      path.resolve(currentDir, "../src/modules.generated.ts"),
      path.resolve(currentDir, "modules.generated.d.ts"),
      path.resolve(currentDir, "../dist/modules.generated.d.ts"),
    ]
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const text = fs.readFileSync(p, "utf-8")
        const matches = text.matchAll(/["'](.*?)["']:\s*true/g)
        for (const match of matches) {
          if (match[1]) set.add(match[1])
        }
        if (set.size > 0) break
      }
    }
  } catch {
    // Graceful fallback
  }
  return set
}

const registeredModules = loadExistingModules()

function persistGeneratedModules(): void {
  if (Bun.env.NODE_ENV === "production") return
  try {
    const list = Array.from(registeredModules).sort()
    const content = `// This file is auto-generated at runtime by @Iris/logger. Do not edit manually.\nexport interface KnownModules {\n${list.map((m) => `  ${JSON.stringify(m)}: true`).join("\n")}\n}\n`

    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const targets = [
      path.resolve(currentDir, "modules.generated.ts"),
      path.resolve(currentDir, "../src/modules.generated.ts"),
      path.resolve(currentDir, "modules.generated.d.ts"),
      path.resolve(currentDir, "../dist/modules.generated.d.ts"),
    ]

    for (const target of targets) {
      if (fs.existsSync(path.dirname(target))) {
        fs.writeFileSync(target, content, "utf-8")
      }
    }
  } catch {
    // Graceful fallback for read-only environments
  }
}

function registerRuntimeModule(moduleName: string): void {
  if (!moduleName || registeredModules.has(moduleName)) return
  registeredModules.add(moduleName)
  persistGeneratedModules()
}

let globalLogLevel: LogLevel = (() => {
  const envLevel = Bun.env.LOG_LEVEL?.toLowerCase()
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel as LogLevel
  }
  return "info"
})()

let globalSink: LogSink | null = null

function isDevelopment(): boolean {
  const env = Bun.env.NODE_ENV
  return !env || env === "development"
}

function isJsonMode(instanceJsonOverride?: boolean): boolean {
  if (instanceJsonOverride !== undefined) {
    return instanceJsonOverride
  }
  if (Bun.env.LOG_FORMAT === "json") {
    return true
  }
  return Bun.env.NODE_ENV === "production"
}

/**
 * Primary logger class for the IRIS ecosystem.
 *
 * Instantiated with a module name to provide scoped, colorized, timestamped,
 * padded, and level-filtered logs with runtime-generated module autocomplete.
 */
export class LogFactory implements ILogFactory {
  public readonly module: string
  public readonly fullModulePath: string
  public readonly color: TagColor
  public readonly json: JsonLogFn

  private readonly options: LogFactoryOptions
  private readonly tagPrefix: string

  constructor(module: ModuleName, options: LogFactoryOptions = {}) {
    this.module = module
    this.options = options

    let parentPath: string | undefined
    if (options.parentModule) {
      if (typeof options.parentModule === "string") {
        parentPath = options.parentModule
      } else if (
        typeof options.parentModule === "object" &&
        "fullModulePath" in options.parentModule
      ) {
        parentPath = options.parentModule.fullModulePath
      }
    }

    this.fullModulePath = parentPath ? `${parentPath}][${module}` : module
    this.color = options.color ?? hashTagColor(this.fullModulePath)
    this.tagPrefix = colorizeTag(this.fullModulePath, this.color)

    // Register module names at runtime for automatic TypeScript autocomplete generation
    LogFactory.registerModule(this.module)
    if (parentPath) {
      LogFactory.registerModule(parentPath)
    }

    const jsonHandler = (arg1: unknown, arg2?: unknown) => {
      this.logJson("info", arg1, arg2)
    }

    this.json = Object.assign(jsonHandler, {
      info: (arg1: unknown, arg2?: unknown) => this.logJson("info", arg1, arg2),
      warn: (arg1: unknown, arg2?: unknown) => this.logJson("warn", arg1, arg2),
      error: (arg1: unknown, arg2?: unknown) =>
        this.logJson("error", arg1, arg2),
      debug: (arg1: unknown, arg2?: unknown) =>
        this.logJson("debug", arg1, arg2),
      success: (arg1: unknown, arg2?: unknown) =>
        this.logJson("success", arg1, arg2),
    })
  }

  /**
   * Registers a module name at runtime, persisting it to generated declarations for IDE autocomplete.
   */
  public static registerModule(moduleName: string): void {
    registerRuntimeModule(moduleName)
  }

  /**
   * Retrieves all module names registered at runtime.
   */
  public static getRegisteredModules(): string[] {
    return Array.from(registeredModules)
  }

  /**
   * Static factory method to instantiate a new `LogFactory`.
   */
  public static create(
    module: ModuleName,
    options?: LogFactoryOptions
  ): LogFactory {
    return new LogFactory(module, options)
  }

  /**
   * Sets the global minimum log level threshold.
   */
  public static setLevel(level: LogLevel): void {
    globalLogLevel = level
  }

  /**
   * Retrieves the current global minimum log level.
   */
  public static getLevel(): LogLevel {
    return globalLogLevel
  }

  /**
   * Sets a global log sink callback for capturing log entries.
   */
  public static setSink(sink: LogSink | null): void {
    globalSink = sink
  }

  /**
   * Clears the active global log sink callback.
   */
  public static clearSink(): void {
    globalSink = null
  }

  /**
   * Creates a nested child logger (e.g. `[Module][SubModule]`) inheriting parent configuration.
   */
  public child(
    submodule: ModuleName,
    options?: Omit<LogFactoryOptions, "parentModule">
  ): LogFactory {
    return new LogFactory(submodule, {
      ...this.options,
      ...options,
      parentModule: this.fullModulePath,
    })
  }

  /**
   * Logs an informational message with `[INFO]` badge.
   */
  public info(...args: unknown[]): void {
    this.emit("info", args)
  }

  /**
   * Logs a warning message with `[WARN]` badge.
   */
  public warn(...args: unknown[]): void {
    this.emit("warn", args)
  }

  /**
   * Logs an error message with `[ERROR]` badge.
   */
  public error(...args: unknown[]): void {
    this.emit("error", args)
  }

  /**
   * Logs a debug message with `[DEBUG]` badge.
   * Only logs when `LOG_LEVEL=debug` and `NODE_ENV` is development (or unset).
   */
  public debug(...args: unknown[]): void {
    if (!isDevelopment()) return
    this.emit("debug", args)
  }

  /**
   * Logs a success message with `[SUCCESS]` badge.
   */
  public success(...args: unknown[]): void {
    this.emit("success", args)
  }

  private logJson(
    level: "debug" | "info" | "warn" | "error" | "success",
    arg1: unknown,
    arg2?: unknown
  ): void {
    let title: string | undefined
    let data: unknown

    if (typeof arg1 === "string" && arg2 !== undefined) {
      title = arg1
      data = arg2
    } else if (typeof arg2 === "string") {
      data = arg1
      title = arg2
    } else {
      data = arg1
    }

    const formattedJson = formatJsonString(data)
    const message = title ? `${title}\n${formattedJson}` : formattedJson
    this.emit(level, [message])
  }

  private shouldLog(
    level: "debug" | "info" | "warn" | "error" | "success"
  ): boolean {
    const checkLevel: LogLevel = level === "success" ? "info" : level
    const effectiveLevel = this.options.level ?? globalLogLevel
    return LOG_LEVEL_PRIORITY[checkLevel] >= LOG_LEVEL_PRIORITY[effectiveLevel]
  }

  private formatArgs(args: unknown[]): string {
    if (args.length === 0) return ""
    // Ensure Error instances preserve stack trace if available
    const mapped = args.map((arg) => {
      if (arg instanceof Error && arg.stack) {
        return arg.stack
      }
      return arg
    })
    return util.format(...mapped)
  }

  private emit(
    level: "debug" | "info" | "warn" | "error" | "success",
    args: unknown[]
  ): void {
    if (!this.shouldLog(level)) return

    const now = new Date()
    const formattedMessage = this.formatArgs(args)

    // Notify sinks (per-instance and global)
    const entry: LogEntry = {
      level,
      module: this.fullModulePath,
      message:
        typeof args[0] === "string"
          ? args[0]
          : formattedMessage,
      args,
      formatted: formattedMessage,
      timestamp: now,
    }

    if (this.options.sink) {
      this.options.sink(entry)
    }
    if (globalSink) {
      globalSink(entry)
    }

    // Console output formatting
    if (isJsonMode(this.options.json)) {
      const jsonLine = JSON.stringify({
        timestamp: now.toISOString(),
        level,
        module: this.fullModulePath,
        message: formattedMessage,
      })

      if (level === "error") {
        console.error(jsonLine)
      } else if (level === "warn") {
        console.warn(jsonLine)
      } else {
        console.log(jsonLine)
      }
      return
    }

    const timestamp = formatTimestamp(now)
    const badge = getBadge(level)
    const line = `${timestamp} ${this.tagPrefix} ${badge} ${formattedMessage}`

    if (level === "error") {
      console.error(line)
    } else if (level === "warn") {
      console.warn(line)
    } else {
      console.log(line)
    }
  }
}

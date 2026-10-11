import type { KnownModules as GeneratedModules } from "./modules.generated.js"

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

/**
 * Dynamic registry of module names generated at runtime when LogFactory is initialized.
 * Can also be extended via TypeScript declaration merging:
 *
 * ```ts
 * declare module "@Iris/logger" {
 *   interface KnownModules {
 *     MyModule: true
 *   }
 * }
 * ```
 */
export interface KnownModules extends GeneratedModules {}

export type KnownModuleName = keyof KnownModules
export type ModuleName = [KnownModuleName] extends [never]
  ? string
  : KnownModuleName | (string & {})

export interface ILogFactory {
  readonly module: string
  readonly fullModulePath: string
}

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error" | "success"
  module: string
  message: string
  args: unknown[]
  formatted: string
  timestamp: Date
}

export type LogSink = (entry: LogEntry) => void

export interface LogFactoryOptions {
  /** Optional custom ANSI tag badge color. If omitted, deterministically hashed. */
  color?: TagColor
  /** Optional custom per-instance minimum log level override. */
  level?: LogLevel
  /**
   * Optional parent module path or parent LogFactory instance for hierarchical scoping.
   * Autocompletes known module names generated at runtime, while accepting any string or logger instance.
   */
  parentModule?: ModuleName | ILogFactory
  /** Optional instance-specific sink callback to capture emitted log entries. */
  sink?: LogSink
  /** Optional explicit toggle for structured JSON output. */
  json?: boolean
}

/**
 * Callable method and sub-level namespace for formatted JSON logging.
 */
export interface JsonLogFn {
  (data: unknown, message?: string): void
  (message: string, data: unknown): void
  info(data: unknown, message?: string): void
  info(message: string, data: unknown): void
  warn(data: unknown, message?: string): void
  warn(message: string, data: unknown): void
  error(data: unknown, message?: string): void
  error(message: string, data: unknown): void
  debug(data: unknown, message?: string): void
  debug(message: string, data: unknown): void
  success(data: unknown, message?: string): void
  success(message: string, data: unknown): void
}

import type { TagColor } from "./types.js"

/**
 * Zero-dependency terminal color formatting using ANSI escape codes.
 * Compatible with Node.js, Bun, Linux, macOS, and Windows terminals.
 */
export const isColorSupported =
  !("NO_COLOR" in (Bun.env || {})) &&
  (Bun.env?.TERM !== "dumb" ||
    Boolean(Bun.env?.CI) ||
    Boolean(process.stdout?.isTTY))

const format = (open: number, close: number) => (str: unknown) =>
  isColorSupported ? `\x1b[${open}m${str}\x1b[${close}m` : String(str)

/**
 * ANSI escape code styling helpers for terminal output.
 */
export const c = {
  reset: format(0, 0),
  bold: format(1, 22),
  dim: format(2, 22),
  italic: format(3, 23),
  underline: format(4, 24),

  black: format(30, 39),
  red: format(31, 39),
  green: format(32, 39),
  yellow: format(33, 39),
  blue: format(34, 39),
  magenta: format(35, 39),
  cyan: format(36, 39),
  white: format(37, 39),
  gray: format(90, 39),

  bgRed: format(41, 49),
  bgGreen: format(42, 49),
  bgYellow: format(43, 49),
  bgBlue: format(44, 49),
  bgMagenta: format(45, 49),
  bgCyan: format(46, 49),
}

const PALETTE: TagColor[] = ["cyan", "blue", "magenta", "green", "yellow"]

/**
 * Deterministically maps any module name string to a consistent ANSI tag color.
 */
export function hashTagColor(tag: string): TagColor {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % PALETTE.length
  return PALETTE[index] ?? "cyan"
}

/**
 * Wraps and colors a bracketed module tag badge e.g. `[Auth]`.
 */
export function colorizeTag(tag: string, color: TagColor): string {
  const colorFn = (c as Record<string, ((v: unknown) => string) | undefined>)[
    color
  ]
  return colorFn ? colorFn(c.bold(`[${tag}]`)) : c.bold(`[${tag}]`)
}

/**
 * Formats a Date into a zero-padded timestamp string `[HH:mm:ss]` with dim gray coloring.
 */
export function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  const h = pad(date.getHours())
  const m = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return c.gray(`[${h}:${m}:${s}]`)
}

/**
 * Formats data into a formatted (indented) JSON string with syntax-colored tokens.
 */
export function formatJsonString(data: unknown, indent = 2): string {
  try {
    const raw = typeof data === "string" ? data : JSON.stringify(data, null, indent)
    if (!isColorSupported) return raw

    return raw.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            // Key name (e.g. "msg":)
            return c.cyan(match.slice(0, -1)) + ":"
          }
          // String value (e.g. "Test")
          return c.green(match)
        }
        if (/true|false/.test(match)) {
          return c.yellow(match)
        }
        if (/null/.test(match)) {
          return c.dim(match)
        }
        return c.yellow(match)
      }
    )
  } catch {
    return String(data)
  }
}

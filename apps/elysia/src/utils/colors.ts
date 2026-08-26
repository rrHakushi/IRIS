/**
 * Zero-dependency terminal color formatting using ANSI escape codes.
 * Works across Windows Terminal, PowerShell, Linux, macOS, and CI.
 */
const isColorSupported =
  !("NO_COLOR" in process.env) &&
  (process.platform === "win32" ||
    process.env.TERM !== "dumb" ||
    Boolean(process.env.CI) ||
    Boolean(process.stdout?.isTTY));

const format = (open: number, close: number) => (str: unknown) =>
  isColorSupported ? `\x1b[${open}m${str}\x1b[${close}m` : String(str);

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
};

export function colorMethod(method: string): string {
  const m = method.toUpperCase();
  switch (m) {
    case "GET":
      return c.green(c.bold(m.padEnd(7)));
    case "POST":
      return c.yellow(c.bold(m.padEnd(7)));
    case "PUT":
      return c.blue(c.bold(m.padEnd(7)));
    case "PATCH":
      return c.magenta(c.bold(m.padEnd(7)));
    case "DELETE":
      return c.red(c.bold(m.padEnd(7)));
    default:
      return c.gray(c.bold(m.padEnd(7)));
  }
}

export function colorStatus(status: number | string): string {
  const code = Number(status) || 200;
  if (code >= 500) {
    return c.red(c.bold(code));
  }
  if (code >= 400) {
    return c.yellow(c.bold(code));
  }
  if (code >= 300) {
    return c.cyan(code);
  }
  if (code >= 200) {
    return c.green(c.bold(code));
  }
  return c.gray(code);
}

export function colorDuration(ms: number): string {
  const formatted = ms < 1 ? ms.toFixed(2) : ms.toFixed(1);
  if (ms > 200) {
    return c.red(`(${formatted}ms)`);
  }
  if (ms > 50) {
    return c.yellow(`(${formatted}ms)`);
  }
  return c.dim(`(${formatted}ms)`);
}

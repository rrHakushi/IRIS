export type NumberFormatMode = "cap" | "compact" | "raw";

export interface FormatNumberOptions {
  /**
   * Maximum character length or digit threshold before capping.
   * For "cap" mode, length 2 caps at 99 (resulting in "99+").
   * @default 2
   */
  length?: number;

  /**
   * Formatting mode:
   * - "cap": Replaces numbers larger than 10^length - 1 with "[max]+" (e.g. 150, 2 -> "99+")
   * - "compact": Metric abbreviations (K, M, B, T) (e.g. 1500 -> "1.5K", 2500000 -> "2.5M")
   * - "raw": Standard string representation
   * @default "cap"
   */
  mode?: NumberFormatMode;

  /**
   * Maximum decimal places for compact mode or floating point numbers.
   * @default 1
   */
  decimals?: number;
}

const METRIC_UNITS = [
  { value: 1e12, symbol: "T" },
  { value: 1e9, symbol: "B" },
  { value: 1e6, symbol: "M" },
  { value: 1e3, symbol: "K" },
];

/**
 * Formats a number with length-capping (e.g. 150 -> "99+") or compact metric abbreviation (e.g. 1500 -> "1.5K").
 *
 * @param value - The input integer or floating point number.
 * @param lengthOrOptions - Max digit length (number) or options configuration object.
 * @param mode - Optional format mode ("cap" | "compact" | "raw") when passing positional arguments.
 *
 * @example
 * ```ts
 * formatNumber(150, 2)              // "99+"
 * formatNumber(42, 2)               // "42"
 * formatNumber(1500, 2, "compact")  // "1.5K"
 * formatNumber(2500000, 2, "compact") // "2.5M"
 * formatNumber(1200, 3)             // "999+"
 * ```
 */
export function formatNumber(
  value: number,
  lengthOrOptions: number | FormatNumberOptions = 2,
  mode: NumberFormatMode = "cap"
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "0";
  }

  // Parse arguments
  let targetLength = 2;
  let targetMode = mode;
  let decimals = 1;

  if (typeof lengthOrOptions === "number") {
    targetLength = lengthOrOptions;
    targetMode = mode;
  } else if (typeof lengthOrOptions === "object") {
    targetLength = lengthOrOptions.length ?? 2;
    targetMode = lengthOrOptions.mode ?? "cap";
    decimals = lengthOrOptions.decimals ?? 1;
  }

  // 1. Compact Metric Mode (e.g. 1500 -> 1.5K, 2500000 -> 2.5M)
  if (targetMode === "compact") {
    const isNegative = value < 0;
    const absValue = Math.abs(value);

    for (const unit of METRIC_UNITS) {
      if (absValue >= unit.value) {
        const formatted = (absValue / unit.value).toFixed(decimals);
        // Clean trailing zeros after decimal (e.g. "1.0K" -> "1K", "1.50M" -> "1.5M")
        const clean = formatted.replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1");
        return `${isNegative ? "-" : ""}${clean}${unit.symbol}`;
      }
    }

    // Number is less than 1,000
    return value % 1 === 0 ? value.toString() : value.toFixed(decimals).replace(/\.0+$/, "");
  }

  // 2. Cap / Badge Mode (e.g. length 2: max 99 -> "99+", length 3: max 999 -> "999+")
  if (targetMode === "cap") {
    if (targetLength <= 0) return value.toString();

    const maxCap = Math.pow(10, targetLength) - 1;

    if (value > maxCap) {
      return `${maxCap}+`;
    }

    if (value < -maxCap) {
      return `-${maxCap}+`;
    }

    // Handle integers vs floating point within range
    return value % 1 === 0 ? value.toString() : Number(value.toFixed(decimals)).toString();
  }

  // 3. Raw mode
  return value.toString();
}

/**
 * Shorthand helper for badge capping: returns "99+" when value exceeds length threshold.
 */
export function formatBadgeNumber(value: number, length: number = 2): string {
  return formatNumber(value, length, "cap");
}

/**
 * Shorthand helper for compact metric formatting: returns "1.5K", "2.5M", etc.
 */
export function formatCompactNumber(value: number, decimals: number = 1): string {
  return formatNumber(value, { mode: "compact", decimals });
}

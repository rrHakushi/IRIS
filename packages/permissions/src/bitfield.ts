import { IRISFlags, IRISFlagKey } from "./flags.js";

/**
 * Represents any value or structure that can be resolved into permission bitmask words.
 *
 * Accepts:
 * - A `bigint` bitmask value (e.g. `IRISFlags.ADMINISTRATOR`)
 * - A string key representing a valid flag (e.g. `'ADMINISTRATOR'`)
 * - An existing `IRISBitField` instance
 * - An object containing a `raw` array of 32-bit integer words
 * - A `readonly number[]` of 32-bit integer words
 * - An array of nested `IRISBitFieldResolvable` items
 */
export type IRISBitFieldResolvable =
  | bigint
  | IRISFlagKey
  | IRISBitField
  | { readonly raw: readonly number[] }
  | readonly number[]
  | readonly IRISBitFieldResolvable[];

/**
 * Manages bitwise permission evaluation and integer-array storage for the IRIS ecosystem.
 *
 * Stores permissions as an array of 32-bit integers (`Int[]` in PostgreSQL/Prisma).
 * Supports BigInt operations, Administrator superuser bypass, and polymorphic input resolution.
 */
export class IRISBitField {
  /**
   * Reference to the single unified collection of IRIS permission flags.
   */
  public static readonly Flags = IRISFlags;

  /**
   * Cached word index and mask for the ADMINISTRATOR permission.
   */
  private static _adminWordIndex: number = -1;
  private static _adminMask: number = 0;

  /**
   * Retrieves the 32-bit word index and bitmask for the ADMINISTRATOR flag.
   *
   * @returns Object containing the word index and bitmask.
   */
  private static getAdminInfo(): { readonly wordIndex: number; readonly mask: number } {
    if (IRISBitField._adminWordIndex === -1) {
      const bits = IRISBitField.flagToBits(IRISFlags.ADMINISTRATOR);
      IRISBitField._adminWordIndex = bits.findIndex((w) => w !== 0);
      IRISBitField._adminMask = bits[IRISBitField._adminWordIndex] ?? 0;
    }
    return {
      wordIndex: IRISBitField._adminWordIndex,
      mask: IRISBitField._adminMask,
    };
  }

  /**
   * Internal storage of 32-bit integer words.
   */
  private bits: number[] = [];

  /**
   * Creates a new `IRISBitField` instance.
   *
   * @param resolvable - Initial permission resolvable or null for an empty bitfield.
   */
  constructor(resolvable: IRISBitFieldResolvable | null = null) {
    if (resolvable !== null) {
      this.bits = IRISBitField.resolve(resolvable);
    }
  }

  /**
   * Returns the underlying raw array of 32-bit integer words suitable for database storage.
   */
  public get raw(): readonly number[] {
    return this.bits;
  }

  /**
   * Converts a single 64-bit/BigInt flag into an array of 32-bit integer bitfield words.
   *
   * @param flag - The positive BigInt flag value.
   * @returns An array of 32-bit signed integer words.
   * @throws {Error} If the provided flag is not a positive bigint.
   */
  private static flagToBits(flag: bigint): number[] {
    if (typeof flag !== "bigint" || flag <= 0n) {
      throw new Error(`Invalid flag: must be a positive bigint, received ${String(flag)}`);
    }

    const result: number[] = [];
    let temp = flag;
    let bitIndex = 0;
    while (temp > 0n) {
      if ((temp & 1n) === 1n) {
        const wordIndex = Math.floor(bitIndex / 32);
        const bitMask = 1 << (bitIndex % 32);
        result[wordIndex] = (result[wordIndex] ?? 0) | bitMask;
      }
      temp >>= 1n;
      bitIndex++;
    }

    for (let i = 0; i < result.length; i++) {
      if (result[i] === null || result[i] === undefined) {
        result[i] = 0;
      }
    }
    return result;
  }

  /**
   * Resolves a polymorphic permission resolvable into an array of 32-bit integer words.
   *
   * @param resolvable - Permission resolvable or null.
   * @returns An array of 32-bit integer words.
   * @throws {Error} If the resolvable is an invalid type or unknown permission string.
   */
  public static resolve(resolvable: IRISBitFieldResolvable | null): number[] {
    if (resolvable === null) {
      return [];
    }

    if (resolvable instanceof IRISBitField) {
      return [...resolvable.raw];
    }

    if (typeof resolvable === "object") {
      if ("raw" in resolvable && Array.isArray(resolvable.raw)) {
        return [...resolvable.raw];
      }
      if (Array.isArray(resolvable)) {
        if (resolvable.length > 0 && typeof resolvable[0] === "number") {
          return [...(resolvable as readonly number[])];
        }
        const result: number[] = [];
        for (const item of resolvable) {
          const resolved = IRISBitField.resolve(item as IRISBitFieldResolvable);
          const maxLength = Math.max(result.length, resolved.length);
          for (let i = 0; i < maxLength; i++) {
            result[i] = (result[i] ?? 0) | (resolved[i] ?? 0);
          }
        }
        return result;
      }
    }

    if (typeof resolvable === "string") {
      const flagValue = IRISFlags[resolvable as IRISFlagKey];
      if (flagValue === undefined || flagValue === null) {
        throw new Error(`Invalid permission flag key: "${resolvable}"`);
      }
      return IRISBitField.flagToBits(flagValue);
    }

    if (typeof resolvable === "bigint") {
      return IRISBitField.flagToBits(resolvable);
    }

    throw new Error("Invalid IRISBitFieldResolvable type");
  }

  /**
   * Creates a new `IRISBitField` from a raw array of 32-bit integers.
   *
   * @param raw - Array of 32-bit integer words from the database or null.
   * @returns A new `IRISBitField` instance.
   */
  public static fromRaw(raw: readonly number[] | null): IRISBitField {
    return new IRISBitField(raw);
  }

  /**
   * Creates a new `IRISBitField` from a BigInt value.
   *
   * @param value - BigInt bitmask or null.
   * @returns A new `IRISBitField` instance.
   */
  public static fromBigInt(value: bigint | null): IRISBitField {
    return new IRISBitField(value);
  }

  /**
   * Determines whether the given resolvable is specifically a check for the ADMINISTRATOR permission.
   *
   * @param resolvable - Permission resolvable to evaluate.
   * @returns `true` if the resolvable only represents ADMINISTRATOR.
   */
  private isAdministratorCheck(resolvable: IRISBitFieldResolvable): boolean {
    try {
      const { wordIndex, mask } = IRISBitField.getAdminInfo();
      const otherBits = IRISBitField.resolve(resolvable);
      if (otherBits.length !== wordIndex + 1) {
        return false;
      }
      for (let i = 0; i < wordIndex; i++) {
        if ((otherBits[i] ?? 0) !== 0) {
          return false;
        }
      }
      return (otherBits[wordIndex] ?? 0) === mask;
    } catch {
      return false;
    }
  }

  /**
   * Checks whether this bitfield contains ALL of the bits specified in the given resolvable.
   *
   * If this bitfield holds the `ADMINISTRATOR` permission, this method returns `true` automatically
   * for all checks (unless specifically checking for the presence of the `ADMINISTRATOR` flag itself).
   *
   * @param resolvable - The permission or permissions to verify.
   * @returns `true` if all specified permissions are satisfied, `false` otherwise.
   */
  public has(resolvable: IRISBitFieldResolvable): boolean {
    const { wordIndex, mask } = IRISBitField.getAdminInfo();
    const adminWord = this.bits[wordIndex] ?? 0;
    const hasAdmin = (adminWord & mask) !== 0;

    if (hasAdmin && !this.isAdministratorCheck(resolvable)) {
      return true;
    }

    const otherBits = IRISBitField.resolve(resolvable);
    for (let i = 0; i < otherBits.length; i++) {
      const otherWord = otherBits[i] ?? 0;
      const thisWord = this.bits[i] ?? 0;
      if ((thisWord & otherWord) !== otherWord) {
        return false;
      }
    }
    return true;
  }

  /**
   * Checks whether this bitfield contains ANY of the bits specified in the given resolvable.
   *
   * If this bitfield holds the `ADMINISTRATOR` permission, this method returns `true` automatically.
   *
   * @param resolvable - The permission or permissions to verify.
   * @returns `true` if at least one permission is satisfied, `false` otherwise.
   */
  public any(resolvable: IRISBitFieldResolvable): boolean {
    const { wordIndex, mask } = IRISBitField.getAdminInfo();
    const adminWord = this.bits[wordIndex] ?? 0;
    const hasAdmin = (adminWord & mask) !== 0;

    if (hasAdmin) {
      return true;
    }

    const otherBits = IRISBitField.resolve(resolvable);
    for (let i = 0; i < otherBits.length; i++) {
      const otherWord = otherBits[i] ?? 0;
      const thisWord = this.bits[i] ?? 0;
      if ((thisWord & otherWord) !== 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Adds one or more permissions to this bitfield.
   *
   * @param resolvables - Permissions to add.
   * @returns This bitfield instance for method chaining.
   */
  public add(...resolvables: readonly IRISBitFieldResolvable[]): this {
    for (const resolvable of resolvables) {
      const otherBits = IRISBitField.resolve(resolvable);
      const maxLength = Math.max(this.bits.length, otherBits.length);
      for (let i = 0; i < maxLength; i++) {
        this.bits[i] = (this.bits[i] ?? 0) | (otherBits[i] ?? 0);
      }
    }
    return this;
  }

  /**
   * Removes one or more permissions from this bitfield.
   *
   * @param resolvables - Permissions to remove.
   * @returns This bitfield instance for method chaining.
   */
  public remove(...resolvables: readonly IRISBitFieldResolvable[]): this {
    for (const resolvable of resolvables) {
      const otherBits = IRISBitField.resolve(resolvable);
      for (let i = 0; i < this.bits.length; i++) {
        const otherWord = otherBits[i] ?? 0;
        this.bits[i] = (this.bits[i] ?? 0) & ~otherWord;
      }
    }
    while (this.bits.length > 0 && this.bits[this.bits.length - 1] === 0) {
      this.bits.pop();
    }
    return this;
  }

  /**
   * Returns an array of permission flag key names currently granted in this bitfield.
   *
   * @returns Array of matching `IRISFlagKey` strings.
   */
  public toArray(): IRISFlagKey[] {
    const result: IRISFlagKey[] = [];
    const keys = Object.keys(IRISFlags) as IRISFlagKey[];
    for (const key of keys) {
      const flagValue = IRISFlags[key];
      const flagBits = IRISBitField.flagToBits(flagValue);
      let matches = true;
      for (let i = 0; i < flagBits.length; i++) {
        const flagWord = flagBits[i] ?? 0;
        const thisWord = this.bits[i] ?? 0;
        if ((thisWord & flagWord) !== flagWord) {
          matches = false;
          break;
        }
      }
      if (matches) {
        result.push(key);
      }
    }
    return result;
  }

  /**
   * Converts the internal 32-bit integer words into a single BigInt value.
   *
   * @returns A BigInt representing the full permission bitmask.
   */
  public toBigInt(): bigint {
    let result = 0n;
    for (let i = 0; i < this.bits.length; i++) {
      const bitWord = this.bits[i] ?? 0;
      const word = BigInt(bitWord >>> 0);
      result |= word << BigInt(i * 32);
    }
    return result;
  }

  /**
   * Checks whether this bitfield represents the exact same bit configuration as another resolvable.
   *
   * @param other - The resolvable to compare against.
   * @returns `true` if both bitfields have identical bit patterns, `false` otherwise.
   */
  public equals(other: IRISBitFieldResolvable): boolean {
    const otherBits = IRISBitField.resolve(other);
    const maxLen = Math.max(this.bits.length, otherBits.length);
    for (let i = 0; i < maxLen; i++) {
      const thisWord = this.bits[i] ?? 0;
      const otherWord = otherBits[i] ?? 0;
      if (thisWord !== otherWord) {
        return false;
      }
    }
    return true;
  }

  /**
   * Creates an exact clone of this `IRISBitField` instance.
   *
   * @returns A new independent `IRISBitField` instance with copied bits.
   */
  public clone(): IRISBitField {
    return new IRISBitField(this.bits);
  }
}

/**
 * Alias for `IRISBitField`.
 */
export const BitField = IRISBitField;

/**
 * Type alias for `BitField`.
 */
export type BitField = IRISBitField;

/**
 * Default permission set for standard users (empty bitfield `[]`).
 */
export const DEFAULT_PERMISSIONS: readonly number[] = Object.freeze([]);

/**
 * Evaluates whether a user's permissions array satisfies the specified permission check.
 *
 * Designed for Next.js Server Components, API route handlers, NestJS guards, and frontend panels.
 *
 * @param permissions - The raw array of 32-bit integers from the database, or null if unauthenticated.
 * @param permission - The permission flag, key name, or array of permissions to evaluate.
 * @param checkType - Evaluation mode: `'all'` (default) requires every permission, `'any'` requires at least one.
 * @returns `true` if the permission check is satisfied, `false` otherwise.
 *
 * @example
 * ```typescript
 * import { hasPermission, IRISFlags } from '@IRIS/permissions';
 *
 * const isAuthorized = hasPermission(user.permissions, IRISFlags.ADMINISTRATOR);
 * ```
 */
export function hasPermission(
  permissions: readonly number[] | number[] | null,
  permission: IRISBitFieldResolvable,
  checkType: "all" | "any" = "all",
): boolean {
  if (permissions === null || permissions.length === 0) {
    return false;
  }
  const bitfield = new IRISBitField(permissions);
  return checkType === "any" ? bitfield.any(permission) : bitfield.has(permission);
}

/**
 * Single, unified collection of IRIS permission bit flags.
 *
 * Each permission flag is represented as a unique 64-bit `bigint` bitmask.
 */
export const IRISFlags = {
  /**
   * Administrator superuser permission.
   * Grants unrestricted administrative access across all IRIS systems, routes, and services.
   * Only increment the number on the right (e.g. 0n, 1n, 2n...)
   */
  ADMINISTRATOR: 1n << 0n,
} as const;

/**
 * String literal union of all valid permission flag keys.
 */
export type IRISFlagKey = keyof typeof IRISFlags;

/**
 * BigInt union of all valid permission flag numeric values.
 */
export type IRISFlagValue = (typeof IRISFlags)[IRISFlagKey];

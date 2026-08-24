import { CustomDecorator, SetMetadata } from "@nestjs/common";
import { IRISBitFieldResolvable } from "@IRIS/permissions";

/**
 * Metadata key used to store permission requirements on route handlers and controllers.
 */
export const PERMISSIONS_KEY = "IRIS_PERMISSIONS_KEY";

/**
 * Logical evaluation operator for multiple permission requirements.
 * - `'all'`: User must possess every specified permission.
 * - `'any'`: User must possess at least one specified permission.
 */
export type PermissionOperator = "any" | "all";

/**
 * Metadata structure stored for route permission verification.
 */
export interface PermissionsMetadata {
  /**
   * The list of permissions required to access the route.
   */
  readonly flags: readonly IRISBitFieldResolvable[];

  /**
   * The logical operator applied when evaluating multiple permissions.
   */
  readonly operator: PermissionOperator;
}

/**
 * Decorator that attaches required permission flags and evaluation strategy to a route handler or controller.
 *
 * @param flags - One or more permission flags, BigInts, flag key names, or arrays of resolvables.
 * @param operator - Logical operator: `'all'` (default) requires all flags, `'any'` requires at least one flag.
 * @returns A NestJS custom route/class decorator.
 *
 * @example
 * ```typescript
 * // Require ADMINISTRATOR permission
 * @RequirePermissions(IRISFlags.ADMINISTRATOR)
 * @Get('admin/dashboard')
 * getAdminDashboard() {
 *   return this.adminService.getStats();
 * }
 * ```
 */
export const RequirePermissions = (
  flags: readonly IRISBitFieldResolvable[] | IRISBitFieldResolvable,
  operator: PermissionOperator = "all",
): CustomDecorator<string> => {
  const normalizedFlags: readonly IRISBitFieldResolvable[] = Array.isArray(flags)
    ? flags
    : [flags];

  const metadata: PermissionsMetadata = {
    flags: normalizedFlags,
    operator,
  };

  return SetMetadata(PERMISSIONS_KEY, metadata);
};

/**
 * Alias for `RequirePermissions`.
 */
export const Permissions = RequirePermissions;

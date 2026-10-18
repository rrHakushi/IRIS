import type { IRISBitFieldResolvable } from "@IRIS/permissions"
import { Unauthorized, Forbidden } from "../../utils/errors"
import type { Session } from "../../plugins/session"

/**
 * Configuration options for route-level or method-level authorization.
 */
export interface AuthGuardConfig {
  /**
   * Whether an authenticated user session is required.
   * Can be a boolean or an object with a custom error message.
   * Method-level configuration takes strict priority over route-level.
   *
   * @default false
   */
  requireAuth?: boolean | { message?: string }

  /**
   * Array of permissions required to execute this route.
   * Automatically enforces `requireAuth: true`.
   * Method-level configuration takes strict priority over route-level.
   */
  requirePermissions?: IRISBitFieldResolvable[]

  /**
   * Array of OAuth scopes required to execute this route when accessed via OAuth token.
   * Automatically enforces `requireAuth: true`.
   * Method-level configuration takes strict priority over route-level.
   */
  requireScopes?: string[]
}

/**
 * Asserts that the incoming request meets the route or method authorization requirements.
 *
 * Rules:
 * - Method-level options take priority over route-level options.
 *   E.g., if a route specifies `requireAuth: true`, but a specific `GET` method specifies
 *   `requireAuth: false`, the `GET` method is publicly accessible.
 * - Specifying `requirePermissions` automatically enforces authentication.
 * - Fails fast by throwing standard RFC 9457 `Unauthorized` (401) or `Forbidden` (403) errors.
 *
 * @param ctx - Route execution context containing the active session
 * @param methodConfig - Method-level authorization configuration
 * @param routeConfig - Route-level authorization configuration
 * @throws {Unauthorized} If authentication is required but user is unauthenticated
 * @throws {Forbidden} If specific permissions are required but missing on user
 *
 * @example
 * ```typescript
 * assertRouteAuthorization(ctx, { requireAuth: true })
 * assertRouteAuthorization(ctx, { requirePermissions: [IRISFlags.ADMINISTRATOR] })
 * ```
 */
export function assertRouteAuthorization(
  ctx: { session?: Session },
  methodConfig?: AuthGuardConfig | null,
  routeConfig?: AuthGuardConfig | null
): void {
  // Method-level takes strict priority over route-level
  const authOption =
    methodConfig?.requireAuth !== undefined
      ? methodConfig.requireAuth
      : (routeConfig?.requireAuth ?? false)

  const permissionsOption =
    methodConfig?.requirePermissions !== undefined
      ? methodConfig.requirePermissions
      : routeConfig?.requirePermissions

  const scopesOption =
    methodConfig?.requireScopes !== undefined
      ? methodConfig.requireScopes
      : routeConfig?.requireScopes

  const hasPermissionsRequirement =
    Array.isArray(permissionsOption) && permissionsOption.length > 0
  const hasScopesRequirement =
    Array.isArray(scopesOption) && scopesOption.length > 0

  // Having permissions or scopes requirement automatically implies requireAuth
  const isAuthRequired =
    Boolean(authOption) || hasPermissionsRequirement || hasScopesRequirement

  if (!isAuthRequired) {
    return
  }

  const session = ctx.session
  if (!session || !session.isAuthenticated || !session.user) {
    const message =
      typeof authOption === "object" && authOption.message
        ? authOption.message
        : "Authentication required"
    throw new Unauthorized(message)
  }

  if (hasPermissionsRequirement) {
    for (const permission of permissionsOption) {
      if (!session.hasPermission(permission)) {
        throw new Forbidden("Insufficient permissions to perform this action")
      }
    }
  }

  if (hasScopesRequirement && session.method === "oauth") {
    for (const scope of scopesOption) {
      if (!session.hasScope(scope)) {
        throw new Forbidden(`Insufficient OAuth scope: requires '${scope}'`)
      }
    }
  }
}

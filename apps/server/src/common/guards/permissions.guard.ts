import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IRISBitField, IRISBitFieldResolvable } from "@IRIS/permissions";
import {
  PERMISSIONS_KEY,
  PermissionsMetadata,
} from "../decorators/permissions.decorator";
import { RequestWithAuth } from "../types/auth.types";

/**
 * NestJS authorization guard that validates user permissions against metadata defined via `@RequirePermissions()`.
 *
 * Checks whether the authenticated user attached to the HTTP request satisfies the required permission bitfields.
 * If the user holds `IRISFlags.ADMINISTRATOR`, permission checks automatically evaluate to `true`.
 *
 * @example
 * ```typescript
 * @UseGuards(PermissionsGuard)
 * @Controller('settings')
 * export class SettingsController {}
 * ```
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  /**
   * Creates an instance of `PermissionsGuard`.
   *
   * @param reflector - NestJS reflector for reading route and controller metadata.
   */
  public constructor(private readonly reflector: Reflector) {}

  /**
   * Evaluates if the current request satisfies the required route permissions.
   *
   * @param context - Execution context of the current route handler.
   * @returns `true` if authorized or if no permission metadata is set, `false` otherwise.
   */
  public canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<PermissionsMetadata | null>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (metadata === null || metadata === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user ?? null;
    const userPermissions = user?.permissions ?? null;

    if (userPermissions === null || userPermissions.length === 0) {
      return false;
    }

    const bitfield = new IRISBitField(userPermissions);

    if (metadata.operator === "any") {
      return metadata.flags.some((flag: IRISBitFieldResolvable) => bitfield.any(flag));
    }

    return metadata.flags.every((flag: IRISBitFieldResolvable) => bitfield.has(flag));
  }
}

import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CacheModule } from "@IRIS/cache";
import { PrismaService } from "./providers/prisma.service";
import {
  AuthMiddleware,
  AuthResolverService,
  AuthGuard,
  PermissionsGuard,
} from "./common";
import { IrisAccountModule } from "./modules/IRIS-account/iris-account.module";

/**
 * Root application module for the IRIS backend server.
 *
 * Configures:
 * - Distributed and in-memory cache provider via `@IRIS/cache`
 * - Global `AuthMiddleware` for session cookie, bearer token, and API key authentication
 * - Global `AuthGuard` protecting all endpoints by default while respecting `@Public()` annotations
 * - Global `PermissionsGuard` enforcing bitfield RBAC based on `@RequirePermissions()`
 * - Feature modules (`IrisAccountModule`, etc.)
 */
@Module({
  imports: [
    CacheModule.forRoot({
      isGlobal: true,
      defaultTtlSeconds: 300,
    }),
    IrisAccountModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    AuthResolverService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configures global middleware for all incoming HTTP requests.
   *
   * @param consumer - NestJS middleware consumer.
   */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthMiddleware).forRoutes("*");
  }
}

import { t, type Context as ElysiaContext } from "elysia";
import type { prisma as PrismaInstance } from "@IRIS/database";

export interface RateLimitConfig {
  duration?: number;
  max?: number;
  [key: string]: unknown;
}

export type RouteSchema = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
  headers?: unknown;
  response?: unknown;
  detail?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * Strongly-typed Elysia route context including Prisma client, Session, User, and Bearer token.
 */
export type Context<
  TParams extends Record<string, string | undefined> = Record<string, string | undefined>,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>,
  TBody = unknown,
> = ElysiaContext & {
  /**
   * Database client connected via @IRIS/database
   */
  prisma: typeof PrismaInstance;
  /**
   * Bearer token extracted from the Authorization header (if present)
   */
  bearer?: string;
  /**
   * Dynamic path parameters (e.g. /user/:id -> params.id)
   */
  params: TParams;
  /**
   * URL query parameters (e.g. ?search=foo -> query.search)
   */
  query: TQuery;
  /**
   * Parsed request body payload
   */
  body: TBody;
};

export type RouteContext<
  TParams extends Record<string, string | undefined> = Record<string, string | undefined>,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>,
  TBody = unknown,
> = Context<TParams, TQuery, TBody>;

export type RouteHandler<
  TParams extends Record<string, string | undefined> = Record<string, string | undefined>,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>,
  TBody = unknown,
> = (ctx: Context<TParams, TQuery, TBody>) => unknown | Promise<unknown>;

export type HttpMethodKey =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS"
  | "HEAD"
  | "ALL";

export interface MethodConfig<
  TParams extends Record<string, string | undefined> = Record<string, string | undefined>,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>,
  TBody = unknown,
> {
  schema?: RouteSchema;
  rateLimit?: RateLimitConfig;
  handler: RouteHandler<TParams, TQuery, TBody>;
}

export interface RouteDefinition {
  rateLimit?: RateLimitConfig;
  rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>;
  schema?: RouteSchema;
  schemas?: Partial<Record<HttpMethodKey, RouteSchema>>;

  GET?: RouteHandler | MethodConfig;
  POST?: RouteHandler | MethodConfig;
  PUT?: RouteHandler | MethodConfig;
  DELETE?: RouteHandler | MethodConfig;
  PATCH?: RouteHandler | MethodConfig;
  OPTIONS?: RouteHandler | MethodConfig;
  HEAD?: RouteHandler | MethodConfig;
  ALL?: RouteHandler | MethodConfig;
  [key: string]: unknown;
}

/**
 * Defines a type-safe file-based route with instant parameter IntelliSense.
 * 
 * @example
 * ```typescript
 * import { defineRoute } from "@/router";
 * 
 * export default defineRoute({
 *   POST({ body, prisma, session }) {
 *     return { ok: true };
 *   },
 * });
 * ```
 */
export function defineRoute(definition: RouteDefinition): RouteDefinition {
  return definition;
}

/**
 * Base class for class-based route definitions.
 */
export abstract class Route {
  static rateLimit?: RateLimitConfig;
  static rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>;
  static schema?: RouteSchema;
  static schemas?: Partial<Record<HttpMethodKey, RouteSchema>>;

  rateLimit?: RateLimitConfig;
  rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>;
  schema?: RouteSchema;
  schemas?: Partial<Record<HttpMethodKey, RouteSchema>>;

  GET?(ctx: Context): unknown;
  POST?(ctx: Context): unknown;
  PUT?(ctx: Context): unknown;
  DELETE?(ctx: Context): unknown;
  PATCH?(ctx: Context): unknown;
  OPTIONS?(ctx: Context): unknown;
  HEAD?(ctx: Context): unknown;
  ALL?(ctx: Context): unknown;
  [key: string]: unknown;
}

export interface RouteClass {
  new(): RouteInstance;
  rateLimit?: RateLimitConfig;
  rateLimits?: Partial<Record<string, RateLimitConfig>>;
  schema?: RouteSchema;
  schemas?: Partial<Record<string, RouteSchema>>;
  [key: string]: unknown;
}

export interface RouteInstance {
  rateLimit?: RateLimitConfig;
  rateLimits?: Partial<Record<string, RateLimitConfig>>;
  schema?: RouteSchema;
  schemas?: Partial<Record<string, RouteSchema>>;
  GET?: RouteHandler | MethodConfig;
  POST?: RouteHandler | MethodConfig;
  PUT?: RouteHandler | MethodConfig;
  DELETE?: RouteHandler | MethodConfig;
  PATCH?: RouteHandler | MethodConfig;
  OPTIONS?: RouteHandler | MethodConfig;
  HEAD?: RouteHandler | MethodConfig;
  ALL?: RouteHandler | MethodConfig;
  [key: string]: unknown;
}

export { t };


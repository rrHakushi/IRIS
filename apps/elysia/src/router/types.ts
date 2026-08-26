import {
  t,
  type Context as ElysiaContext,
  type UnwrapRoute,
  type AnySchema,
} from "elysia";
import type { prisma as PrismaInstance } from "@IRIS/database";
import type { Session, SessionUser } from "../plugins/session";
import type { RequestLogger } from "../utils/request-logger";

/**
 * Rate limiting configuration applied to a route or HTTP method.
 */
export interface RateLimitConfig {
  /** Time window in milliseconds to refill tokens. */
  duration?: number;
  /** Maximum token burst allowance. */
  max?: number;
  /** Maximum burst capacity (alias for max). */
  capacity?: number;
  /** Tokens consumed per invocation. */
  cost?: number;
  [key: string]: unknown;
}

/**
 * Explicit schema definition for route input validation and OpenAPI metadata.
 * Providing this interface enables instant IDE autocompletion for params, query, body, etc.
 */
export interface RouteSchema {
  /**
   * Path parameters validation schema (e.g. /user/:id)
   */
  params?: AnySchema;

  /**
   * Query string parameters validation schema (e.g. ?page=1&limit=20)
   */
  query?: AnySchema;

  /**
   * Request body payload validation schema
   */
  body?: AnySchema;

  /**
   * Request headers validation schema
   */
  headers?: AnySchema;

  /**
   * Cookies validation schema
   */
  cookie?: AnySchema;

  /**
   * Response validation schema (single schema or HTTP status map)
   */
  response?: AnySchema | Record<number | string, AnySchema>;

  /**
   * OpenAPI documentation metadata
   */
  detail?: Record<string, unknown>;
}

/**
 * Resolves static path parameter types from a RouteSchema.
 */
export type SchemaParams<S> = S extends { params: infer P }
  ? P extends AnySchema
    ? UnwrapRoute<{ params: P }>["params"]
    : Record<string, string | undefined>
  : Record<string, string | undefined>;

/**
 * Resolves static query parameter types from a RouteSchema.
 */
export type SchemaQuery<S> = S extends { query: infer Q }
  ? Q extends AnySchema
    ? UnwrapRoute<{ query: Q }>["query"]
    : Record<string, unknown>
  : Record<string, unknown>;

/**
 * Resolves static body payload types from a RouteSchema.
 */
export type SchemaBody<S> = S extends { body: infer B }
  ? B extends AnySchema
    ? UnwrapRoute<{ body: B }>["body"]
    : unknown
  : unknown;

/**
 * Strongly-typed Elysia route context including Prisma client and Bearer token.
 */
export type Context<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
> = ElysiaContext & {
  /**
   * Database client connected via @IRIS/database
   */
  prisma: typeof PrismaInstance;
  /**
   * Extracted session context (NextAuth cookie -> Bearer token -> API key)
   * Provides helper methods: .getUser(), .status, .hasPermission(), .requireUser()
   */
  session: Session;
  /**
   * Request-scoped logger that groups output under the current request
   */
  log: RequestLogger;
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

/**
 * Alias for Route context.
 */
export type RouteContext<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
> = Context<TParams, TQuery, TBody>;

/**
 * General route handler callback.
 */
export type RouteHandler<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
> = (ctx: Context<TParams, TQuery, TBody>) => unknown | Promise<unknown>;

/**
 * Route handler for HTTP methods that do not support a request body (GET, HEAD, OPTIONS).
 * The `body` parameter is omitted from the context.
 */
export type NoBodyRouteHandler<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
> = (ctx: Omit<Context<TParams, TQuery, never>, "body">) => unknown | Promise<unknown>;

/**
 * Route schema for HTTP methods that do not accept a request body.
 */
export type NoBodyRouteSchema = Omit<RouteSchema, "body">;

/** Supported HTTP method verbs. */
export type HttpMethodKey =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS"
  | "HEAD"
  | "ALL";

/**
 * Configuration object for a specific HTTP method with local schema and rate limit.
 */
export interface MethodConfig<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
  S extends RouteSchema = RouteSchema,
> {
  schema?: S;
  rateLimit?: RateLimitConfig;
  handler: RouteHandler<TParams, TQuery, TBody>;
}

/**
 * Configuration object for HTTP methods without a body (GET, HEAD, OPTIONS).
 */
export interface NoBodyMethodConfig<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  S extends NoBodyRouteSchema = NoBodyRouteSchema,
> {
  schema?: S;
  rateLimit?: RateLimitConfig;
  handler: NoBodyRouteHandler<TParams, TQuery>;
}

/**
 * Accepts either a bare handler function or an object specifying local schema, rateLimit, and handler.
 */
export type MethodField<
  GlobalSchema extends RouteSchema = RouteSchema,
  LocalMethodSchema extends RouteSchema = GlobalSchema,
> =
  | RouteHandler<
      SchemaParams<LocalMethodSchema>,
      SchemaQuery<LocalMethodSchema>,
      SchemaBody<LocalMethodSchema>
    >
  | {
      schema?: LocalMethodSchema;
      rateLimit?: RateLimitConfig;
      handler: RouteHandler<
        SchemaParams<LocalMethodSchema>,
        SchemaQuery<LocalMethodSchema>,
        SchemaBody<LocalMethodSchema>
      >;
    };

/**
 * MethodField specialization for bodyless methods (GET, HEAD, OPTIONS).
 */
export type NoBodyMethodField<
  GlobalSchema extends RouteSchema = RouteSchema,
  LocalMethodSchema extends NoBodyRouteSchema = GlobalSchema,
> =
  | NoBodyRouteHandler<
      SchemaParams<LocalMethodSchema>,
      SchemaQuery<LocalMethodSchema>
    >
  | {
      schema?: LocalMethodSchema;
      rateLimit?: RateLimitConfig;
      handler: NoBodyRouteHandler<
        SchemaParams<LocalMethodSchema>,
        SchemaQuery<LocalMethodSchema>
      >;
    };

/**
 * Full file-based route definition accepted by `defineRoute()`.
 */
export interface RouteDefinition<
  S extends RouteSchema = RouteSchema,
  GetS extends NoBodyRouteSchema = S,
  PostS extends RouteSchema = S,
  PutS extends RouteSchema = S,
  DeleteS extends RouteSchema = S,
  PatchS extends RouteSchema = S,
  OptionsS extends NoBodyRouteSchema = S,
  HeadS extends NoBodyRouteSchema = S,
  AllS extends RouteSchema = S,
> {
  rateLimit?: RateLimitConfig;
  rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>;
  schema?: S;
  schemas?: Partial<Record<HttpMethodKey, RouteSchema>>;

  GET?: NoBodyMethodField<S, GetS>;
  HEAD?: NoBodyMethodField<S, HeadS>;
  OPTIONS?: NoBodyMethodField<S, OptionsS>;

  POST?: MethodField<S, PostS>;
  PUT?: MethodField<S, PutS>;
  DELETE?: MethodField<S, DeleteS>;
  PATCH?: MethodField<S, PatchS>;
  ALL?: MethodField<S, AllS>;
}

/**
 * Defines a type-safe file-based route with instant parameter IntelliSense.
 * Automatically infers params, query, and body types from TypeBox schemas.
 * Methods that do not support a request body (GET, HEAD, OPTIONS) do not expose `body`.
 * 
 * @example
 * ```typescript
 * import { defineRoute, t } from "@/router";
 * 
 * export default defineRoute({
 *   schema: {
 *     params: t.Object({ id: t.Number() }),
 *     query: t.Object({ page: t.Optional(t.Number()) }),
 *   },
 *   GET({ params, query }) {
 *     params.id // typed as number!
 *     query.page // typed as number | undefined!
 *     // body is not accessible on GET!
 *   },
 * });
 * ```
 */
export function defineRoute<
  S extends RouteSchema = RouteSchema,
  GetS extends NoBodyRouteSchema = S,
  PostS extends RouteSchema = S,
  PutS extends RouteSchema = S,
  DeleteS extends RouteSchema = S,
  PatchS extends RouteSchema = S,
  OptionsS extends NoBodyRouteSchema = S,
  HeadS extends NoBodyRouteSchema = S,
  AllS extends RouteSchema = S,
>(
  definition: RouteDefinition<S, GetS, PostS, PutS, DeleteS, PatchS, OptionsS, HeadS, AllS>
): RouteDefinition<S, GetS, PostS, PutS, DeleteS, PatchS, OptionsS, HeadS, AllS> {
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

  GET?(ctx: Omit<Context, "body">): unknown;
  HEAD?(ctx: Omit<Context, "body">): unknown;
  OPTIONS?(ctx: Omit<Context, "body">): unknown;

  POST?(ctx: Context): unknown;
  PUT?(ctx: Context): unknown;
  DELETE?(ctx: Context): unknown;
  PATCH?(ctx: Context): unknown;
  ALL?(ctx: Context): unknown;
  [key: string]: unknown;
}

/**
 * Constructor interface for class-based routes.
 */
export interface RouteClass {
  new(): RouteInstance;
  rateLimit?: RateLimitConfig;
  rateLimits?: Partial<Record<string, RateLimitConfig>>;
  schema?: RouteSchema;
  schemas?: Partial<Record<string, RouteSchema>>;
  [key: string]: unknown;
}

/**
 * Instantiated class route with HTTP method handlers.
 */
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


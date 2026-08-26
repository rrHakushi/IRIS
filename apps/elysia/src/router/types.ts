import { t, type Context as ElysiaContext, type UnwrapRoute, type InputSchema } from "elysia";
import type { prisma as PrismaInstance } from "@IRIS/database";
import type { Session, SessionUser } from "../plugins/session";
import type { RequestLogger } from "../utils/request-logger";

export interface RateLimitConfig {
  duration?: number;
  max?: number;
  [key: string]: unknown;
}

export type RouteSchema = InputSchema<any>;

/**
 * Resolves static types from an Elysia/TypeBox schema.
 */
export type SchemaParams<S> = S extends InputSchema<any>
  ? undefined extends S["params"]
    ? Record<string, string | undefined>
    : UnwrapRoute<S>["params"]
  : Record<string, string | undefined>;

export type SchemaQuery<S> = S extends InputSchema<any>
  ? undefined extends S["query"]
    ? Record<string, unknown>
    : UnwrapRoute<S>["query"]
  : Record<string, unknown>;

export type SchemaBody<S> = S extends InputSchema<any>
  ? undefined extends S["body"]
    ? unknown
    : UnwrapRoute<S>["body"]
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

export type RouteContext<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
> = Context<TParams, TQuery, TBody>;

export type RouteHandler<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
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
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
  S extends InputSchema<any> = InputSchema<any>,
> {
  schema?: S;
  rateLimit?: RateLimitConfig;
  handler: RouteHandler<TParams, TQuery, TBody>;
}

export type MethodField<
  GlobalSchema extends InputSchema<any>,
  LocalMethodSchema extends InputSchema<any> = GlobalSchema,
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

export interface RouteDefinition<
  S extends InputSchema<any> = InputSchema<any>,
  GetS extends InputSchema<any> = S,
  PostS extends InputSchema<any> = S,
  PutS extends InputSchema<any> = S,
  DeleteS extends InputSchema<any> = S,
  PatchS extends InputSchema<any> = S,
  OptionsS extends InputSchema<any> = S,
  HeadS extends InputSchema<any> = S,
  AllS extends InputSchema<any> = S,
> {
  rateLimit?: RateLimitConfig;
  rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>;
  schema?: S;
  schemas?: Partial<Record<HttpMethodKey, InputSchema<any>>>;

  GET?: MethodField<S, GetS>;
  POST?: MethodField<S, PostS>;
  PUT?: MethodField<S, PutS>;
  DELETE?: MethodField<S, DeleteS>;
  PATCH?: MethodField<S, PatchS>;
  OPTIONS?: MethodField<S, OptionsS>;
  HEAD?: MethodField<S, HeadS>;
  ALL?: MethodField<S, AllS>;
  [key: string]: unknown;
}

/**
 * Defines a type-safe file-based route with instant parameter IntelliSense.
 * Automatically infers params, query, and body types from TypeBox schemas.
 * 
 * @example
 * ```typescript
 * import { defineRoute, t } from "@/router";
 * 
 * export default defineRoute({
 *   schema: {
 *     params: t.Object({ id: t.Number() }),
 *   },
 *   GET({ params }) {
 *     params.id // typed as number!
 *   },
 * });
 * ```
 */
export function defineRoute<
  S extends InputSchema<any> = {},
  GetS extends InputSchema<any> = S,
  PostS extends InputSchema<any> = S,
  PutS extends InputSchema<any> = S,
  DeleteS extends InputSchema<any> = S,
  PatchS extends InputSchema<any> = S,
  OptionsS extends InputSchema<any> = S,
  HeadS extends InputSchema<any> = S,
  AllS extends InputSchema<any> = S,
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


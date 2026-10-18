import {
  t,
  type Context as ElysiaContext,
  type UnwrapRoute,
  type AnySchema,
} from "elysia"
import type { prisma as PrismaInstance } from "@IRIS/database"
import type { CacheInstance } from "../utils/cache"
import type { IRISBitFieldResolvable } from "@IRIS/permissions"
import type { Session, SessionUser } from "../plugins/session"
import type { RequestLogger } from "../utils/request-logger"
import type { NotificationService } from "../plugins/notification"
import type { GlobalCacheKeyStorage } from "./generated/cache-keys.generated"

export type { GlobalCacheKeyStorage }

/**
 * Rate limiting configuration applied to a route or HTTP method.
 */
export interface RateLimitConfig {
  /** Time window in milliseconds to refill tokens. */
  duration?: number
  /** Maximum token burst allowance. */
  max?: number
  /** Maximum burst capacity (alias for max). */
  capacity?: number
  /** Tokens consumed per invocation. */
  cost?: number
  [key: string]: unknown
}

/**
 * Explicit schema definition for route input validation and OpenAPI metadata.
 * Providing this interface enables instant IDE autocompletion for params, query, body, etc.
 */
export interface RouteSchema {
  /**
   * Path parameters validation schema (e.g. /user/:id)
   */
  params?: AnySchema

  /**
   * Query string parameters validation schema (e.g. ?page=1&limit=20)
   */
  query?: AnySchema

  /**
   * Request body payload validation schema
   */
  body?: AnySchema

  /**
   * Request headers validation schema
   */
  headers?: AnySchema

  /**
   * Cookies validation schema
   */
  cookie?: AnySchema

  /**
   * Response validation schema (single schema or HTTP status map)
   */
  response?: AnySchema | Record<number | string, AnySchema>

  /**
   * OpenAPI documentation metadata
   */
  detail?: Record<string, unknown>
}

/**
 * Resolves static path parameter types from a RouteSchema.
 */
export type SchemaParams<S> = S extends { params: infer P }
  ? P extends AnySchema
    ? UnwrapRoute<{ params: P }>["params"]
    : Record<string, string | undefined>
  : Record<string, string | undefined>

/**
 * Resolves static query parameter types from a RouteSchema.
 */
export type SchemaQuery<S> = S extends { query: infer Q }
  ? Q extends AnySchema
    ? UnwrapRoute<{ query: Q }>["query"]
    : Record<string, unknown>
  : Record<string, unknown>

/**
 * Resolves static body payload types from a RouteSchema.
 */
export type SchemaBody<S> = S extends { body: infer B }
  ? B extends AnySchema
    ? UnwrapRoute<{ body: B }>["body"]
    : unknown
  : unknown

/**
 * A cache key generator function.
 */
export type RouteCacheKeyGenerator = (...args: any[]) => string

/**
 * Nested map of cache key generator functions organized by namespace.
 * Supports arbitrary levels of nesting.
 * E.g. { anime: { id: (id: number) => `anime:${id}` }, manga: { recents: { id: (id: number) => `manga:recents:${id}` } } }
 */
export type RouteCacheKeyStorage = Record<string, any>

/**
 * Session interface for routes guaranteed to have an authenticated user.
 */
export interface AuthenticatedSession extends Omit<Session, "user"> {
  user: SessionUser
}

/**
 * Strongly-typed Elysia route context including Prisma client, cache, session, cacheKeys, and logger.
 */
export type Context<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
  TCacheKeys extends RouteCacheKeyStorage = {},
  TSession extends Session = Session,
> = {
  /**
   * Database client connected via @IRIS/database
   */
  prisma: typeof PrismaInstance
  /**
   * Cache manager instance connected via @IRIS/cache
   */
  cache: CacheInstance
  /**
   * Injected cache key generator functions defined across all route definitions.
   */
  cacheKeys: TCacheKeys & GlobalCacheKeyStorage
  /**
   * Extracted session context (NextAuth cookie -> Bearer token -> API key)
   * Provides helper methods: .getUser(), .status, .hasPermission(), .requireUser()
   */
  session: TSession
  /**
   * Request-scoped logger that groups output under the current request
   */
  logger: RequestLogger
  /**
   * Post-quantum encrypted notification dispatcher service
   */
  notifications: NotificationService
  /**
   * Dynamic path parameters (e.g. /user/:id -> params.id)
   */
  params: TParams
  /**
   * URL query parameters (e.g. ?search=foo -> query.search)
   */
  query: TQuery
  /**
   * Parsed request body payload
   */
  body: TBody
  /**
   * HTTP response mutator
   */
  set: ElysiaContext["set"]
  /**
   * Web standard Request object
   */
  request: ElysiaContext["request"]
  /**
   * Global state store
   */
  store: ElysiaContext["store"]
  /**
   * Request headers map
   */
  headers: Record<string, string | undefined>
  /**
   * Request cookies
   */
  cookie: ElysiaContext["cookie"]
  /**
   * HTTP redirect helper
   */
  redirect: ElysiaContext["redirect"]
  /**
   * Elysia error helper
   */
  error: (code: number | string, response?: unknown) => unknown
  /**
   * Current request path
   */
  path: string
}

/**
 * Alias for Route context.
 */
export type RouteContext<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
  TCacheKeys extends RouteCacheKeyStorage = {},
> = Context<TParams, TQuery, TBody, TCacheKeys>

/**
 * General route handler callback.
 */
export type RouteHandler<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
  TCacheKeys extends RouteCacheKeyStorage = {},
  TSession extends Session = Session,
> = (
  ctx: Context<TParams, TQuery, TBody, TCacheKeys, TSession>
) => unknown | Promise<unknown>

/**
 * Route handler for HTTP methods that do not support a request body (GET, HEAD, OPTIONS).
 * The `body` parameter is omitted from the context.
 */
export type NoBodyRouteHandler<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TCacheKeys extends RouteCacheKeyStorage = {},
  TSession extends Session = Session,
> = (
  ctx: Omit<Context<TParams, TQuery, never, TCacheKeys, TSession>, "body">
) => unknown | Promise<unknown>

/**
 * Infers the session type based on requireAuth and requirePermissions flags.
 */
export type InferSession<TAuth, TPerms> = TAuth extends
  true | { message?: string }
  ? AuthenticatedSession
  : TPerms extends readonly [any, ...any[]] | any[]
    ? AuthenticatedSession
    : Session

/**
 * Route schema for HTTP methods that do not accept a request body.
 */
export type NoBodyRouteSchema = Omit<RouteSchema, "body">

/** Supported HTTP method verbs. */
export type HttpMethodKey =
  "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD" | "ALL"

/**
 * Configuration object for a specific HTTP method with local schema and rate limit.
 */
export interface MethodConfig<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  TBody = unknown,
  S extends RouteSchema = RouteSchema,
  TCacheKeys extends RouteCacheKeyStorage = {},
  TAuth extends boolean | { message?: string } | undefined =
    boolean | { message?: string } | undefined,
  TPerms extends IRISBitFieldResolvable[] | undefined =
    IRISBitFieldResolvable[] | undefined,
> {
  schema?: S
  rateLimit?: RateLimitConfig
  /**
   * Whether authentication is required to access this method.
   * Can be a boolean or an object specifying a custom error message.
   * Method-level configuration has priority over route-level.
   *
   * @default false
   */
  requireAuth?: TAuth
  /**
   * Array of permissions required to invoke this method.
   * Automatically enforces authentication.
   * Method-level configuration has priority over route-level.
   */
  requirePermissions?: TPerms
  /**
   * Array of OAuth scopes required to invoke this method via OAuth bearer token.
   * Automatically enforces authentication.
   * Method-level configuration has priority over route-level.
   */
  requireScopes?: string[]
  handler: RouteHandler<
    TParams,
    TQuery,
    TBody,
    TCacheKeys,
    InferSession<TAuth, TPerms>
  >
}

/**
 * Configuration object for HTTP methods without a body (GET, HEAD, OPTIONS).
 */
export interface NoBodyMethodConfig<
  TParams extends Record<string, unknown> = Record<string, string | undefined>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
  S extends NoBodyRouteSchema = NoBodyRouteSchema,
  TCacheKeys extends RouteCacheKeyStorage = {},
  TAuth extends boolean | { message?: string } | undefined =
    boolean | { message?: string } | undefined,
  TPerms extends IRISBitFieldResolvable[] | undefined =
    IRISBitFieldResolvable[] | undefined,
> {
  schema?: S
  rateLimit?: RateLimitConfig
  /**
   * Whether authentication is required to access this method.
   * Can be a boolean or an object specifying a custom error message.
   * Method-level configuration has priority over route-level.
   *
   * @default false
   */
  requireAuth?: TAuth
  /**
   * Array of permissions required to invoke this method.
   * Automatically enforces authentication.
   * Method-level configuration has priority over route-level.
   */
  requirePermissions?: TPerms
  /**
   * Array of OAuth scopes required to invoke this method via OAuth bearer token.
   * Automatically enforces authentication.
   * Method-level configuration has priority over route-level.
   */
  requireScopes?: string[]
  handler: NoBodyRouteHandler<
    TParams,
    TQuery,
    TCacheKeys,
    InferSession<TAuth, TPerms>
  >
}

/**
 * Accepts either a bare handler function or an object specifying local schema, rateLimit, and handler.
 */
export type MethodField<
  GlobalSchema extends RouteSchema = RouteSchema,
  TCacheKeys extends RouteCacheKeyStorage = {},
> =
  | RouteHandler<
      SchemaParams<GlobalSchema>,
      SchemaQuery<GlobalSchema>,
      SchemaBody<GlobalSchema>,
      TCacheKeys
    >
  | {
      schema?: RouteSchema
      rateLimit?: RateLimitConfig
      requireAuth: true | { message?: string }
      requirePermissions?: IRISBitFieldResolvable[]
      handler: RouteHandler<
        SchemaParams<GlobalSchema>,
        SchemaQuery<GlobalSchema>,
        any,
        TCacheKeys,
        AuthenticatedSession
      >
    }
  | {
      schema?: RouteSchema
      rateLimit?: RateLimitConfig
      requireAuth?: boolean | { message?: string }
      requirePermissions: [IRISBitFieldResolvable, ...IRISBitFieldResolvable[]]
      handler: RouteHandler<
        SchemaParams<GlobalSchema>,
        SchemaQuery<GlobalSchema>,
        any,
        TCacheKeys,
        AuthenticatedSession
      >
    }
  | {
      schema?: RouteSchema
      rateLimit?: RateLimitConfig
      requireAuth?: boolean | { message?: string }
      requirePermissions?: IRISBitFieldResolvable[]
      handler: RouteHandler<
        SchemaParams<GlobalSchema>,
        SchemaQuery<GlobalSchema>,
        any,
        TCacheKeys,
        Session
      >
    }

/**
 * MethodField specialization for bodyless methods (GET, HEAD, OPTIONS).
 */
export type NoBodyMethodField<
  GlobalSchema extends RouteSchema = RouteSchema,
  TCacheKeys extends RouteCacheKeyStorage = {},
> =
  | NoBodyRouteHandler<
      SchemaParams<GlobalSchema>,
      SchemaQuery<GlobalSchema>,
      TCacheKeys
    >
  | {
      schema?: NoBodyRouteSchema
      rateLimit?: RateLimitConfig
      requireAuth: true | { message?: string }
      requirePermissions?: IRISBitFieldResolvable[]
      handler: NoBodyRouteHandler<
        SchemaParams<GlobalSchema>,
        SchemaQuery<GlobalSchema>,
        TCacheKeys,
        AuthenticatedSession
      >
    }
  | {
      schema?: NoBodyRouteSchema
      rateLimit?: RateLimitConfig
      requireAuth?: boolean | { message?: string }
      requirePermissions: [IRISBitFieldResolvable, ...IRISBitFieldResolvable[]]
      handler: NoBodyRouteHandler<
        SchemaParams<GlobalSchema>,
        SchemaQuery<GlobalSchema>,
        TCacheKeys,
        AuthenticatedSession
      >
    }
  | {
      schema?: NoBodyRouteSchema
      rateLimit?: RateLimitConfig
      requireAuth?: boolean | { message?: string }
      requirePermissions?: IRISBitFieldResolvable[]
      handler: NoBodyRouteHandler<
        SchemaParams<GlobalSchema>,
        SchemaQuery<GlobalSchema>,
        TCacheKeys,
        Session
      >
    }

/**
 * Full file-based route definition accepted by `defineRoute()`.
 */
export interface RouteDefinition<
  S extends RouteSchema = RouteSchema,
  K extends RouteCacheKeyStorage = {},
> {
  cacheKeys?: K
  rateLimit?: RateLimitConfig
  rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>
  requireAuth?: boolean | { message?: string }
  requirePermissions?: IRISBitFieldResolvable[]
  requireScopes?: string[]
  schema?: S
  schemas?: Partial<Record<HttpMethodKey, RouteSchema>>

  GET?: NoBodyMethodField<S, K>
  HEAD?: NoBodyMethodField<S, K>
  OPTIONS?: NoBodyMethodField<S, K>

  POST?: MethodField<S, K>
  PUT?: MethodField<S, K>
  DELETE?: MethodField<S, K>
  PATCH?: MethodField<S, K>
  ALL?: MethodField<S, K>
}

/**
 * Defined route object returned by `defineRoute()`.
 * Carries extracted cache keys and schemas while decoupling internal Context types
 * to ensure zero circular type dependencies across modules.
 */
export interface DefinedRoute<
  S extends RouteSchema = RouteSchema,
  K extends RouteCacheKeyStorage = RouteCacheKeyStorage,
  M = unknown,
> {
  cacheKeys?: K
  schema: M extends { schema: infer Sc } ? Sc : S
  schemas?: M extends { schemas: infer Scs }
    ? Scs
    : Partial<Record<HttpMethodKey, RouteSchema>>
  rateLimit?: RateLimitConfig
  rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>
  GET?: M extends { GET: infer G } ? G : unknown
  HEAD?: M extends { HEAD: infer H } ? H : unknown
  OPTIONS?: M extends { OPTIONS: infer O } ? O : unknown
  POST?: M extends { POST: infer P } ? P : unknown
  PUT?: M extends { PUT: infer U } ? U : unknown
  DELETE?: M extends { DELETE: infer D } ? D : unknown
  PATCH?: M extends { PATCH: infer PA } ? PA : unknown
  ALL?: M extends { ALL: infer A } ? A : unknown
  [key: string]: unknown
}

/**
 * Defines a type-safe file-based route with instant parameter IntelliSense.
 * Automatically infers params, query, and body types from TypeBox schemas.
 * Methods that do not support a request body (GET, HEAD, OPTIONS) do not expose `body`.
 * Injects `cacheKeys` and `logger` into the handler context matching `cacheKeys`.
 *
 * @example
 * ```typescript
 * import { defineRoute, t } from "@/router";
 *
 * export default defineRoute({
 *   cacheKeys: {
 *     anime: {
 *       id: (id: number) => `anime:${id}`,
 *     },
 *   },
 *   schema: {
 *     params: t.Object({ id: t.Number() }),
 *     query: t.Object({ page: t.Optional(t.Number()) }),
 *   },
 *   GET({ params, query, cacheKeys, logger }) {
 *     const key = cacheKeys.anime.id(params.id)
 *     params.id // typed as number!
 *     query.page // typed as number | undefined!
 *   },
 * });
 * ```
 */
export function defineRoute<
  S extends RouteSchema = RouteSchema,
  K extends RouteCacheKeyStorage = {},
  D extends RouteDefinition<S, K> = RouteDefinition<S, K>,
>(definition: D): DefinedRoute<S, K, D> {
  return definition as unknown as DefinedRoute<S, K, D>
}

/**
 * Base class for class-based route definitions.
 */
export abstract class Route {
  static rateLimit?: RateLimitConfig
  static rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>
  static requireAuth?: boolean | { message?: string }
  static requirePermissions?: IRISBitFieldResolvable[]
  static schema?: RouteSchema
  static schemas?: Partial<Record<HttpMethodKey, RouteSchema>>

  rateLimit?: RateLimitConfig
  rateLimits?: Partial<Record<HttpMethodKey, RateLimitConfig>>
  requireAuth?: boolean | { message?: string }
  requirePermissions?: IRISBitFieldResolvable[]
  schema?: RouteSchema
  schemas?: Partial<Record<HttpMethodKey, RouteSchema>>

  GET?(ctx: Omit<Context, "body">): unknown
  HEAD?(ctx: Omit<Context, "body">): unknown
  OPTIONS?(ctx: Omit<Context, "body">): unknown

  POST?(ctx: Context): unknown
  PUT?(ctx: Context): unknown
  DELETE?(ctx: Context): unknown
  PATCH?(ctx: Context): unknown
  ALL?(ctx: Context): unknown
  [key: string]: unknown
}

/**
 * Constructor interface for class-based routes.
 */
export interface RouteClass {
  new (): RouteInstance
  rateLimit?: RateLimitConfig
  rateLimits?: Partial<Record<string, RateLimitConfig>>
  requireAuth?: boolean | { message?: string }
  requirePermissions?: IRISBitFieldResolvable[]
  requireScopes?: string[]
  schema?: RouteSchema
  schemas?: Partial<Record<string, RouteSchema>>
  [key: string]: unknown
}

/**
 * Instantiated class route with HTTP method handlers.
 */
export interface RouteInstance {
  rateLimit?: RateLimitConfig
  rateLimits?: Partial<Record<string, RateLimitConfig>>
  requireAuth?: boolean | { message?: string }
  requirePermissions?: IRISBitFieldResolvable[]
  requireScopes?: string[]
  schema?: RouteSchema
  schemas?: Partial<Record<string, RouteSchema>>
  GET?: RouteHandler | MethodConfig
  POST?: RouteHandler | MethodConfig
  PUT?: RouteHandler | MethodConfig
  DELETE?: RouteHandler | MethodConfig
  PATCH?: RouteHandler | MethodConfig
  OPTIONS?: RouteHandler | MethodConfig
  HEAD?: RouteHandler | MethodConfig
  ALL?: RouteHandler | MethodConfig
  [key: string]: unknown
}

export { t }

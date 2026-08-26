import { Elysia } from "elysia";

export type CorsOriginMatcher =
  | string
  | RegExp
  | boolean
  | Array<string | RegExp>
  | ((origin: string, request: Request) => boolean | string);

export interface CorsOptions {
  /**
   * Allowed origin(s).
   * - `true` (default): mirrors incoming request `Origin` header (or '*' if not present).
   * - `false`: disables CORS origin header.
   * - `string`: specific origin or `'*'`.
   * - `Array<string | RegExp>`: list of allowed origins or patterns.
   * - `(origin, request) => boolean | string`: custom resolver function.
   *
   * @default true
   */
  origin?: CorsOriginMatcher;

  /**
   * Allowed HTTP methods.
   * @default ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"]
   */
  methods?: string | string[];

  /**
   * Allowed HTTP headers in requests.
   * @default ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
   */
  allowedHeaders?: string | string[];

  /**
   * Headers exposed to the client in response.
   */
  exposedHeaders?: string | string[];

  /**
   * Whether credentials (cookies, authorization headers) are supported.
   * @default true
   */
  credentials?: boolean;

  /**
   * Access-Control-Max-Age header in seconds.
   * @default 86400 (24 hours)
   */
  maxAge?: number;
}

const DEFAULT_METHODS = [
  "GET",
  "HEAD",
  "PUT",
  "POST",
  "DELETE",
  "PATCH",
  "OPTIONS",
];

const DEFAULT_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  "Accept",
  "Origin",
];

/**
 * Resolves the Access-Control-Allow-Origin value based on config and request.
 */
function resolveAllowedOrigin(
  matcher: CorsOriginMatcher | undefined,
  requestOrigin: string | null,
  request: Request,
  credentials: boolean
): string | null {
  // Default to true (mirror origin)
  const rule = matcher ?? true;

  if (rule === false) {
    return null;
  }

  if (rule === true) {
    if (requestOrigin) {
      return requestOrigin;
    }
    return credentials ? null : "*";
  }

  if (typeof rule === "string") {
    if (rule === "*" && credentials && requestOrigin) {
      // Spec requires explicit origin when credentials are true
      return requestOrigin;
    }
    return rule;
  }

  if (typeof rule === "function") {
    const result = rule(requestOrigin || "", request);
    if (typeof result === "string") return result;
    if (result && requestOrigin) return requestOrigin;
    return null;
  }

  if (rule instanceof RegExp) {
    if (requestOrigin && rule.test(requestOrigin)) {
      return requestOrigin;
    }
    return null;
  }

  if (Array.isArray(rule)) {
    if (!requestOrigin) return null;
    for (const item of rule) {
      if (typeof item === "string" && item === requestOrigin) {
        return requestOrigin;
      }
      if (item instanceof RegExp && item.test(requestOrigin)) {
        return requestOrigin;
      }
    }
    return null;
  }

  return null;
}

/**
 * Elysia CORS plugin supporting credentialed origins, preflight caching, and configurable headers.
 *
 * @example
 * ```typescript
 * import { Elysia } from "elysia";
 * import { cors } from "./plugins";
 *
 * const app = new Elysia()
 *   .use(cors())
 *   .get("/health", () => ({ status: "ok" }));
 * ```
 */
export function cors(options: CorsOptions = {}) {
  const credentials = options.credentials ?? true;
  const methods = Array.isArray(options.methods)
    ? options.methods.join(", ")
    : options.methods || DEFAULT_METHODS.join(", ");

  const defaultAllowedHeaders = Array.isArray(options.allowedHeaders)
    ? options.allowedHeaders.join(", ")
    : options.allowedHeaders || DEFAULT_ALLOWED_HEADERS.join(", ");

  const exposedHeaders = Array.isArray(options.exposedHeaders)
    ? options.exposedHeaders.join(", ")
    : options.exposedHeaders;

  const maxAge = options.maxAge ?? 86400;

  return new Elysia({ name: "iris-cors" })
    .request(({ request, set }) => {
      const requestOrigin = request.headers.get("origin");
      const allowedOrigin = resolveAllowedOrigin(
        options.origin,
        requestOrigin,
        request,
        credentials
      );

      // Handle preflight OPTIONS request
      if (request.method === "OPTIONS") {
        const responseHeaders: Record<string, string> = {
          "access-control-allow-methods": methods,
          "access-control-max-age": String(maxAge),
        };

        if (allowedOrigin) {
          responseHeaders["access-control-allow-origin"] = allowedOrigin;
        }

        if (credentials) {
          responseHeaders["access-control-allow-credentials"] = "true";
        }

        // Mirror requested headers if not explicitly specified
        const reqHeaders = request.headers.get(
          "access-control-request-headers"
        );
        responseHeaders["access-control-allow-headers"] =
          reqHeaders || defaultAllowedHeaders;

        if (exposedHeaders) {
          responseHeaders["access-control-expose-headers"] = exposedHeaders;
        }

        responseHeaders["vary"] = "Origin";

        return new Response(null, {
          status: 204,
          headers: responseHeaders,
        });
      }

      // Populate response headers for standard HTTP requests
      if (allowedOrigin) {
        set.headers["access-control-allow-origin"] = allowedOrigin;
      }

      if (credentials) {
        set.headers["access-control-allow-credentials"] = "true";
      }

      if (exposedHeaders) {
        set.headers["access-control-expose-headers"] = exposedHeaders;
      }

      set.headers["vary"] = "Origin";
    });
}

import { Elysia } from "elysia";
import type { Context } from "../router/types";

export interface RateLimitConfig {
  /**
   * Time window in milliseconds for tracking requests.
   * @default 60_000 (1 minute)
   */
  duration?: number;

  /**
   * Maximum allowed requests within the time window.
   * @default 100
   */
  max?: number;

  /**
   * Custom message returned when rate limit is exceeded.
   */
  errorMessage?: string;

  /**
   * Optional custom function to derive the rate limit key from a request.
   */
  keyGenerator?: (request: Request) => string;

  /**
   * Optional function to skip rate limiting for specific requests.
   */
  skip?: (request: Request) => boolean;

  [key: string]: unknown;
}

export interface ClientRecord {
  count: number;
  resetAt: number;
}

/**
 * Extracts client IP from standard proxy and CDN headers.
 */
export function getClientIp(request?: Request): string {
  if (!request?.headers?.get) return "127.0.0.1";

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * Creates an in-memory rate limiter function for an Elysia route or method.
 * Accurately extracts client IP and sets standard HTTP rate limit headers.
 */
export function createRateLimiter(config: RateLimitConfig = {}) {
  const duration = config.duration ?? 60_000;
  const max = config.max ?? 100;
  const store = new Map<string, ClientRecord>();

  // Periodically clean up stale client entries
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000);

  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }

  return (ctx: Context): { error: string; message: string; status: number } | null => {
    const request = ctx?.request;
    const set = ctx?.set;

    if (config.skip && request && config.skip(request)) {
      return null;
    }

    const key = config.keyGenerator && request
      ? config.keyGenerator(request)
      : getClientIp(request);

    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + duration };
      store.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    if (set?.headers) {
      set.headers["ratelimit-limit"] = String(max);
      set.headers["ratelimit-remaining"] = String(remaining);
      set.headers["ratelimit-reset"] = String(resetSeconds);
    }

    if (record.count > max) {
      if (set) {
        set.status = 429;
        if (set.headers) {
          set.headers["retry-after"] = String(resetSeconds);
        }
      }
      return {
        error: "Too Many Requests",
        message:
          config.errorMessage ??
          `Rate limit of ${max} requests per ${Math.round(duration / 1000)}s exceeded. Try again in ${resetSeconds}s.`,
        status: 429,
      };
    }

    return null;
  };
}

/**
 * Elysia rate-limiter plugin for global or scoped rate limiting.
 *
 * @example
 * ```typescript
 * import { Elysia } from "elysia";
 * import { rateLimiter } from "./plugins";
 *
 * const app = new Elysia()
 *   .use(rateLimiter({ max: 100, duration: 60_000 }))
 *   .get("/", () => "Hello World");
 * ```
 */
export function rateLimiter(options: RateLimitConfig = {}) {
  const limiter = createRateLimiter(options);

  return new Elysia({ name: "iris-rate-limiter" })
    .beforeHandle("global", (ctx) => {
      const errorResponse = limiter(ctx as unknown as Context);
      if (errorResponse) {
        return errorResponse;
      }
    });
}

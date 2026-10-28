import { createHash } from "node:crypto"
import { Elysia, type Context } from "elysia"
import type { Session } from "./session"

const DEFAULT_CAPACITY = 100
const DEFAULT_DURATION = 60_000
const DEFAULT_COST = 1
const DEFAULT_IP = "127.0.0.1"
const CLEANUP_INTERVAL_MS = 60_000

export interface RateLimitContext {
  request?: Request
  session?: Session | { getUser?: () => { id: string } | null; user?: { id: string } | null; apiKeyId?: string | null }
  set?: {
    status?: number | string
    headers?: Record<string, string>
  }
  [key: string]: unknown
}

/**
 * Extracts the real client IP address from incoming request headers,
 * inspecting Cloudflare, X-Forwarded-For, and X-Real-IP reverse proxy headers.
 *
 * @param request - Optional Request instance
 * @returns Client IP address string (defaults to '127.0.0.1' if absent)
 */
export function getClientIp(request?: Request): string {
  if (!request?.headers?.get) return DEFAULT_IP

  const cfIp = request.headers.get("cf-connecting-ip")
  if (cfIp) return cfIp.trim()

  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim()
    if (firstIp) return firstIp
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()

  return DEFAULT_IP
}

/**
 * Resolves a rate-limit key in strict multi-tier hierarchy:
 * 1. Authenticated User ID (`usr:<userId>`)
 * 2. API Key ID or SHA-256 hash (`key:<hash>`)
 * 3. Client IP + Device ID (`dev:<ip>:<deviceId>`)
 * 4. Anonymous IP + User-Agent fingerprint (`ip:<ip>:<uaHash>`)
 *
 * @param ctx - Request route execution context
 * @returns Unique string identifying the client quota bucket
 */
export function resolveRateLimitKey(ctx?: RateLimitContext): string {
  const request = ctx?.request
  const session = ctx?.session as any

  // Priority 1: Authenticated User ID
  const userId = session?.getUser?.()?.id ?? session?.user?.id
  if (userId) {
    return `usr:${userId}`
  }

  // Priority 2: API Key (from session or headers)
  if (session?.apiKeyId) {
    return `key:${session.apiKeyId}`
  }

  if (request?.headers) {
    const rawApiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("apikey") ||
      (request.headers.get("authorization")?.startsWith("ApiKey ")
        ? request.headers.get("authorization")?.slice(7).trim()
        : null)

    if (rawApiKey) {
      const hash = createHash("sha256")
        .update(rawApiKey.trim())
        .digest("hex")
        .slice(0, 16)
      return `key:${hash}`
    }

    // Authenticated Bearer Token bucket
    const authHeader = request.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim()
      const tokenHash = createHash("sha256").update(token).digest("hex").slice(0, 16)
      return `tok:${tokenHash}`
    }

    // Authenticated Session Cookie bucket
    const cookieHeader = request.headers.get("cookie")
    if (cookieHeader && cookieHeader.includes("session=")) {
      const sessionMatch = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/)
      if (sessionMatch && sessionMatch[1]) {
        const cookieHash = createHash("sha256").update(sessionMatch[1]).digest("hex").slice(0, 16)
        return `ses:${cookieHash}`
      }
    }
  }

  // Priority 3: IP + Device ID or User-Agent fingerprint
  const ip = getClientIp(request)
  const deviceId =
    request?.headers?.get("x-device-id") ||
    request?.headers?.get("device-id") ||
    request?.headers?.get("x-client-id")

  if (deviceId) {
    return `dev:${ip}:${deviceId.trim()}`
  }

  const userAgent = request?.headers?.get("user-agent")
  if (userAgent) {
    const uaHash = createHash("md5").update(userAgent).digest("hex").slice(0, 8)
    return `ip:${ip}:${uaHash}`
  }

  return `ip:${ip}`
}

/**
 * Creates an in-memory Token Bucket rate limiter function.
 *
 * Implements smooth token replenishment over time at a constant rate while
 * allowing bursts up to the bucket's maximum capacity.
 *
 * @param config - Rate limiter configuration options (capacity, duration, cost, refillRate)
 * @returns A limiter middleware function accepting request Context and returning a 429 error payload or null
 *
 * @example
 * ```typescript
 * const limiter = createRateLimiter({ capacity: 10, duration: 60000 });
 * const err = limiter(ctx);
 * if (err) return err;
 * ```
 */
export function createRateLimiter(config: RateLimitConfig = {}) {
  const capacity = config.capacity ?? config.max ?? DEFAULT_CAPACITY
  const duration = config.duration ?? DEFAULT_DURATION
  const refillRate = config.refillRate ?? capacity / (duration / 1000)
  const cost = config.cost ?? DEFAULT_COST

  const store = new Map<string, TokenBucketRecord>()

  // Periodically clean up stale entries (idle for longer than full duration window)
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of store.entries()) {
      if (now - record.lastRefill > duration && record.tokens >= capacity) {
        store.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS)

  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    ;(timer as { unref: () => void }).unref()
  }

  return (
    ctx: RateLimitContext | Context
  ): RateLimitErrorResponse | null => {
    const set = ctx?.set

    if (config.skip && config.skip(ctx as any)) {
      return null
    }

    const key = config.keyGenerator
      ? config.keyGenerator(ctx as any)
      : resolveRateLimitKey(ctx as any)

    const now = Date.now()
    let record = store.get(key)

    if (!record) {
      record = { tokens: capacity, lastRefill: now }
      store.set(key, record)
    } else {
      // Smooth token replenishment
      const elapsedSeconds = (now - record.lastRefill) / 1000
      record.tokens = Math.min(
        capacity,
        record.tokens + elapsedSeconds * refillRate
      )
      record.lastRefill = now
    }

    // Check if sufficient tokens are available
    if (record.tokens >= cost) {
      record.tokens -= cost
      const remaining = Math.floor(record.tokens)
      const resetSeconds = Math.ceil((capacity - record.tokens) / refillRate)

      if (set) {
        if (!set.headers) set.headers = {}
        set.headers["ratelimit-limit"] = String(capacity)
        set.headers["ratelimit-remaining"] = String(remaining)
        set.headers["ratelimit-reset"] = String(resetSeconds)
      }

      return null
    }

    // Tokens exhausted -> 429 Too Many Requests
    const deficit = cost - record.tokens
    const retryAfter = Math.max(1, Math.ceil(deficit / refillRate))
    const resetSeconds = Math.ceil((capacity - record.tokens) / refillRate)

    if (set) {
      set.status = 429
      if (!set.headers) set.headers = {}
      set.headers["ratelimit-limit"] = String(capacity)
      set.headers["ratelimit-remaining"] = "0"
      set.headers["ratelimit-reset"] = String(resetSeconds)
      set.headers["retry-after"] = String(retryAfter)
    }

    return {
      error: "Too Many Requests",
      message:
        config.errorMessage ??
        `Rate limit exceeded. Try again in ${retryAfter}s.`,
      status: 429,
    }
  }
}

/**
 * Elysia rate-limiter plugin for global or scoped rate limiting.
 *
 * Uses the Token Bucket algorithm and automatically resolves client identity keys via:
 * 1. User ID (if authenticated)
 * 2. API Key (if provided)
 * 3. IP + Device ID / User-Agent (if anonymous)
 *
 * @param options - Rate limiting configuration options
 * @returns Elysia plugin instance attaching a beforeHandle hook to enforce rate limits
 *
 * @example
 * ```typescript
 * import { Elysia } from "elysia";
 * import { rateLimiter } from "./plugins";
 *
 * const app = new Elysia()
 *   .use(rateLimiter({ capacity: 50, duration: 60000 }));
 * ```
 */
export function rateLimiter(options: RateLimitConfig = {}) {
  const limiter = createRateLimiter(options)

  return new Elysia({ name: "iris-rate-limiter" }).onBeforeHandle(
    "global",
    (ctx) => {
      const errorResponse = limiter(ctx as unknown as RateLimitContext)
      if (errorResponse) {
        return errorResponse
      }
    }
  )
}

export interface RateLimitErrorResponse {
  error: string
  message: string
  status: number
}

export interface RateLimitConfig {
  /**
   * Maximum capacity of the token bucket (maximum burst allowance).
   * @default 100
   */
  capacity?: number

  /**
   * Alias for `capacity` for backwards-compatibility.
   * @default 100
   */
  max?: number

  /**
   * Time window in milliseconds to completely refill the bucket.
   * The refill rate defaults to `capacity / (duration / 1000)` tokens per second.
   * @default 60_000 (1 minute)
   */
  duration?: number

  /**
   * Direct refill rate in tokens per second.
   * If specified, overrides the `capacity / (duration / 1000)` calculation.
   */
  refillRate?: number

  /**
   * Number of tokens consumed per request.
   * @default 1
   */
  cost?: number

  /**
   * Custom error message returned when tokens are exhausted.
   */
  errorMessage?: string

  /**
   * Optional custom key generator to derive a unique rate-limit key.
   */
  keyGenerator?: (ctx: RateLimitContext) => string

  /**
   * Optional predicate function to skip rate limiting for specific requests.
   */
  skip?: (ctx: RateLimitContext) => boolean

  [key: string]: unknown
}

/**
 * Internal state record for a single token bucket in memory.
 */
export interface TokenBucketRecord {
  /**
   * Current number of tokens available in the bucket (can be fractional).
   */
  tokens: number

  /**
   * Epoch millisecond timestamp when the bucket was last refilled.
   */
  lastRefill: number
}

/**
 * Backward-compatible alias for TokenBucketRecord.
 */
export type ClientRecord = TokenBucketRecord

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

/**
 * Standard supported OAuth 2.0 and OIDC scopes in the IRIS ecosystem.
 */
export const SUPPORTED_SCOPES = [
  "identify",
  "profile",
  "email",
  "lists:read",
  "lists:write",
  "activity:read",
  "activity:write",
  "offline_access",
] as const

export type IrisScope = (typeof SUPPORTED_SCOPES)[number]

export interface ScopeMetadata {
  scope: string
  name: string
  description: string
  isDangerous?: boolean
}

export const SCOPE_DEFINITIONS: Record<string, ScopeMetadata> = {
  identify: {
    scope: "identify",
    name: "Identify User",
    description: "Access your username, user ID, and avatar.",
  },
  profile: {
    scope: "profile",
    name: "User Profile",
    description: "View your full profile information, bio, and customizations.",
  },
  email: {
    scope: "email",
    name: "Email Address",
    description: "Access your verified primary email address.",
  },
  "lists:read": {
    scope: "lists:read",
    name: "Read Media Lists",
    description: "Read your anime, manga, movie, TV, game, book, and music lists.",
  },
  "lists:write": {
    scope: "lists:write",
    name: "Manage Media Lists",
    description: "Add, update, or delete entries in your media lists.",
    isDangerous: true,
  },
  "activity:read": {
    scope: "activity:read",
    name: "Read Activity",
    description: "View your activity logs, reviews, and social interactions.",
  },
  "activity:write": {
    scope: "activity:write",
    name: "Manage Activity",
    description: "Post reviews, comments, and recommendations on your behalf.",
    isDangerous: true,
  },
  offline_access: {
    scope: "offline_access",
    name: "Offline Access",
    description: "Stay connected even when you are not actively using the application.",
  },
}

/**
 * Normalizes a scope string (space or comma separated) into a unique string array.
 */
export function parseScopes(scopeString?: string | null): string[] {
  if (!scopeString) return ["identify", "profile"]
  return Array.from(
    new Set(
      scopeString
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    )
  )
}

/**
 * Validates requested scopes against allowed client scopes.
 */
export function validateScopes(
  requestedScopes: string[],
  allowedScopes: string[] = [...SUPPORTED_SCOPES]
): { valid: boolean; invalidScopes: string[] } {
  const invalid = requestedScopes.filter((s) => !allowedScopes.includes(s))
  return {
    valid: invalid.length === 0,
    invalidScopes: invalid,
  }
}

/**
 * Generates a high-entropy random token with optional prefix.
 */
export function generateSecureToken(prefix = "", bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`
}

/**
 * Generates a public Client ID for an OAuth application.
 */
export function generateClientId(): string {
  return `iris_app_${randomBytes(16).toString("hex")}`
}

/**
 * Generates a raw Client Secret.
 */
export function generateClientSecret(): string {
  return `iris_sec_${randomBytes(32).toString("base64url")}`
}

/**
 * Hashes a client secret using SHA-256 for secure database storage.
 */
export function hashClientSecret(secret: string): string {
  return createHash("sha256").update(secret.trim()).digest("hex")
}

/**
 * Constant-time comparison to verify a submitted client secret against the stored hash.
 */
export function verifyClientSecret(
  submittedSecret: string,
  storedHash: string
): boolean {
  const submittedHash = hashClientSecret(submittedSecret)
  const a = Buffer.from(submittedHash, "hex")
  const b = Buffer.from(storedHash, "hex")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Verifies RFC 7636 PKCE code verifier against code challenge.
 */
export function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: "S256" | "plain" = "S256"
): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge
  }
  const hashed = createHash("sha256").update(codeVerifier.trim()).digest("base64url")
  return hashed === codeChallenge.trim()
}

/**
 * Resolves the server base URL for discovery metadata and issuer identification.
 */
export function getIssuerUrl(): string {
  const url =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_URL ||
    `http://localhost:${process.env.ELYSIA_PORT || 4000}`
  return url.replace(/\/+$/, "")
}

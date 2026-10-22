import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Standard advertised OAuth 2.0 and OpenID Connect (OIDC) scopes.
 * Note: Under the "allow everything" policy, all scopes are permitted without restriction.
 */
export const SUPPORTED_SCOPES = [
  'identify',
  'profile',
  'email',
  'lists:read',
  'lists:write',
  'activity:read',
  'activity:write',
  'offline_access',
] as const

export type IrisScope = (typeof SUPPORTED_SCOPES)[number]

/**
 * Parses a space or comma separated scope string into an array of scopes.
 * If empty or undefined, defaults to all supported scopes.
 */
export function parseScopes(scopeString?: string | null): string[] {
  if (!scopeString || !scopeString.trim()) {
    return [...SUPPORTED_SCOPES]
  }

  const list = scopeString
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return list.length > 0 ? Array.from(new Set(list)) : [...SUPPORTED_SCOPES]
}

/**
 * Generates a public Client ID for registered OAuth applications.
 */
export function generateClientId(): string {
  return `iris_app_${randomBytes(16).toString('hex')}`
}

/**
 * Generates a secure random Client Secret.
 */
export function generateClientSecret(): string {
  return `iris_sec_${randomBytes(32).toString('base64url')}`
}

/**
 * Computes a SHA-256 digest of the client secret for database storage.
 */
export function hashClientSecret(secret: string): string {
  return createHash('sha256').update(secret.trim()).digest('hex')
}

/**
 * Constant-time comparison to verify a submitted client secret against the stored hash.
 */
export function verifyClientSecret(
  submittedSecret: string,
  storedHash: string
): boolean {
  try {
    const submittedHash = hashClientSecret(submittedSecret)
    const a = Buffer.from(submittedHash, 'hex')
    const b = Buffer.from(storedHash, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Verifies RFC 7636 PKCE code verifier against code challenge.
 */
export function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: 'S256' | 'plain' = 'S256'
): boolean {
  if (!codeVerifier || !codeChallenge) return false

  if (method === 'plain') {
    return codeVerifier.trim() === codeChallenge.trim()
  }

  const hashed = createHash('sha256')
    .update(codeVerifier.trim())
    .digest('base64url')

  return hashed === codeChallenge.trim()
}

/**
 * Generates an opaque, cryptographically secure bearer token or code with a custom prefix.
 */
export function generateSecureToken(prefix = '', bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`
}

/**
 * Resolves the server base URL for discovery metadata and issuer identification.
 */
export function getIssuerUrl(): string {
  const url = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_API_URL!
  return url.replace(/\/+$/, '')
}

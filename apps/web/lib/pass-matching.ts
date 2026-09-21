import type { BitwardenUriMatch } from "./pass-types"

/**
 * Extracts base domain (eTLD+1 heuristic) from a hostname.
 * e.g. "auth.github.com" -> "github.com", "sub.domain.co.uk" -> "domain.co.uk"
 */
function getBaseDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split(".").filter(Boolean)
  if (parts.length <= 2) return parts.join(".")

  // Common second-level domains
  const slds = ["co", "com", "org", "net", "edu", "gov", "ac"]
  const tld = parts[parts.length - 1]
  const second = parts[parts.length - 2]

  if (slds.includes(second!) && parts.length >= 3) {
    return parts.slice(-3).join(".")
  }

  return parts.slice(-2).join(".")
}

/**
 * Normalizes a URL string by ensuring a scheme is present for parsing.
 */
function parseUrlSafe(urlString: string): URL | null {
  if (!urlString || typeof urlString !== "string") return null
  const trimmed = urlString.trim()
  if (!trimmed) return null

  try {
    if (!trimmed.includes("://")) {
      return new URL(`https://${trimmed}`)
    }
    return new URL(trimmed)
  } catch {
    return null
  }
}

/**
 * Evaluates whether an item's URI matches a target URL
 * following Bitwarden's multi match detection specification:
 * - BaseDomain (Default): Matches domain and any subdomains
 * - Host: Matches exact host (subdomain + domain + optional port)
 * - StartsWith: Matches if target URL begins with the stored URI
 * - Exact: Exact complete string match
 * - RegularExpression: Evaluates URI as a JS RegExp against target URL
 * - Never: Never matches
 */
export function matchUri(
  itemUri: string,
  targetUrl: string,
  matchType: BitwardenUriMatch = "BASE_DOMAIN"
): boolean {
  if (!itemUri || !targetUrl) return false
  if (matchType === "NEVER") return false

  const cleanItem = itemUri.trim()
  const cleanTarget = targetUrl.trim()

  if (matchType === "EXACT") {
    const stripSlash = (s: string) => s.replace(/\/+$/, "")
    return stripSlash(cleanItem) === stripSlash(cleanTarget)
  }

  if (matchType === "STARTS_WITH") {
    return cleanTarget.startsWith(cleanItem)
  }

  if (matchType === "REGULAR_EXPRESSION") {
    try {
      const re = new RegExp(cleanItem, "i")
      return re.test(cleanTarget)
    } catch {
      return false
    }
  }

  const itemParsed = parseUrlSafe(cleanItem)
  const targetParsed = parseUrlSafe(cleanTarget)

  if (!itemParsed || !targetParsed) {
    // Fallback to substring match if unparseable
    return cleanTarget.includes(cleanItem)
  }

  if (matchType === "HOST") {
    return itemParsed.host.toLowerCase() === targetParsed.host.toLowerCase()
  }

  // Default: BASE_DOMAIN
  const itemBase = getBaseDomain(itemParsed.hostname)
  const targetBase = getBaseDomain(targetParsed.hostname)

  return Boolean(itemBase && targetBase && itemBase === targetBase)
}

export const BITWARDEN_MATCH_LABELS: Record<BitwardenUriMatch, string> = {
  BASE_DOMAIN: "Base domain",
  HOST: "Host",
  STARTS_WITH: "Starts with",
  EXACT: "Exact",
  REGULAR_EXPRESSION: "Regular expression",
  NEVER: "Never",
}

/**
 * Extracts a clean domain/hostname from a URI string or domain-like title.
 */
export function extractDomain(uriOrTitle?: string | null): string | null {
  if (!uriOrTitle || typeof uriOrTitle !== "string") return null
  const clean = uriOrTitle.trim()
  if (!clean) return null

  const parsed = parseUrlSafe(clean)
  if (parsed?.hostname) return parsed.hostname

  if (clean.includes(".") && !clean.includes(" ") && !clean.includes("/")) {
    return clean.toLowerCase()
  }
  return null
}

/**
 * Returns a high-res Google favicon service URL for a given domain/hostname.
 */
export function getFaviconUrl(domain?: string | null): string | null {
  if (!domain) return null
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
}

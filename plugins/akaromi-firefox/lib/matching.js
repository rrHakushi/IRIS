/**
 * IRIS Pass — Bitwarden-Compatible URI Matching Engine
 */
;(function (root) {
  const IrisMatching = {}

  const BitwardenUriMatch = {
    BASE_DOMAIN: 0,
    HOST: 1,
    STARTS_WITH: 2,
    EXACT: 3,
    REGULAR_EXPRESSION: 4,
    NEVER: 5,
  }
  IrisMatching.BitwardenUriMatch = BitwardenUriMatch

  const BITWARDEN_MATCH_LABELS = {
    BASE_DOMAIN: "Base domain",
    HOST: "Host",
    STARTS_WITH: "Starts with",
    EXACT: "Exact",
    REGULAR_EXPRESSION: "Regular expression",
    NEVER: "Never",
  }
  IrisMatching.BITWARDEN_MATCH_LABELS = BITWARDEN_MATCH_LABELS

  function normalizeMatchStrategy(strategy) {
    if (typeof strategy === "number") return strategy
    if (typeof strategy === "string") {
      const upper = strategy.toUpperCase()
      if (upper === "BASE_DOMAIN" || upper === "0") return BitwardenUriMatch.BASE_DOMAIN
      if (upper === "HOST" || upper === "1") return BitwardenUriMatch.HOST
      if (upper === "STARTS_WITH" || upper === "STARTSWITH" || upper === "2") return BitwardenUriMatch.STARTS_WITH
      if (upper === "EXACT" || upper === "3") return BitwardenUriMatch.EXACT
      if (upper === "REGULAR_EXPRESSION" || upper === "REGEX" || upper === "4") return BitwardenUriMatch.REGULAR_EXPRESSION
      if (upper === "NEVER" || upper === "5") return BitwardenUriMatch.NEVER
    }
    return BitwardenUriMatch.BASE_DOMAIN
  }
  IrisMatching.normalizeMatchStrategy = normalizeMatchStrategy

  /**
   * Extracts hostname from a URL string safely
   */
  IrisMatching.extractHost = function (urlString) {
    if (!urlString) return ""
    try {
      const url = new URL(
        urlString.includes("://") ? urlString : `https://${urlString}`
      )
      return url.hostname.toLowerCase()
    } catch {
      return urlString.toLowerCase().split("/")[0] || ""
    }
  }

  // Multi-tenant and compound public suffixes
  const PUBLIC_SUFFIXES = [
    "co.uk", "org.uk", "me.uk", "gov.uk", "ac.uk",
    "co.jp", "ne.jp", "ac.jp", "go.jp",
    "com.au", "net.au", "org.au", "edu.au", "gov.au",
    "co.nz", "net.nz", "org.nz", "govt.nz",
    "com.br", "net.br", "org.br",
    "co.in", "net.in", "org.in", "gov.in",
    "com.mx", "org.mx", "gob.mx",
    "com.sg", "net.sg", "org.sg", "gov.sg",
    "co.za", "org.za", "gov.za",
    "com.tr", "org.tr", "edu.tr", "gov.tr",
    "co.kr", "ne.kr", "or.kr", "go.kr",
    "com.tw", "org.tw", "gov.tw",
    "github.io", "gitlab.io", "pages.dev", "vercel.app",
    "netlify.app", "azurewebsites.net", "herokuapp.com",
    "cloudfront.net", "s3.amazonaws.com"
  ]

  /**
   * Extracts base domain (eTLD+1 approximation)
   */
  IrisMatching.extractBaseDomain = function (urlString) {
    const host = IrisMatching.extractHost(urlString)
    if (!host) return ""

    // IP address check
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) {
      return host
    }

    const parts = host.split(".")
    if (parts.length <= 2) return host

    const lastTwo = parts.slice(-2).join(".")
    if (PUBLIC_SUFFIXES.includes(lastTwo) && parts.length >= 3) {
      return parts.slice(-3).join(".")
    }

    // Common standard SLD checks (e.g. .co.xx, .com.xx, .gov.xx)
    const secondToLast = parts[parts.length - 2]
    if (["co", "com", "org", "net", "edu", "gov", "ac", "ne", "or"].includes(secondToLast) && parts.length >= 3) {
      return parts.slice(-3).join(".")
    }

    return parts.slice(-2).join(".")
  }

  /**
   * Tests whether targetUrl matches vaultUri according to Bitwarden match strategy
   */
  IrisMatching.isUriMatch = function (
    targetUrl,
    vaultUri,
    matchStrategy = BitwardenUriMatch.BASE_DOMAIN
  ) {
    if (!targetUrl || !vaultUri) return false
    const strategy = normalizeMatchStrategy(matchStrategy)
    if (strategy === BitwardenUriMatch.NEVER) return false

    const cleanTarget = targetUrl.trim()
    const cleanVault = vaultUri.trim()

    switch (strategy) {
      case BitwardenUriMatch.EXACT: {
        const normTarget = cleanTarget.replace(/\/+$/, "").toLowerCase()
        const normVault = cleanVault.replace(/\/+$/, "").toLowerCase()
        return normTarget === normVault
      }

      case BitwardenUriMatch.STARTS_WITH: {
        const lowerTarget = cleanTarget.toLowerCase()
        const lowerVault = cleanVault.toLowerCase()
        if (!lowerTarget.startsWith(lowerVault)) return false
        // Boundary check: if match is exact or followed by boundary character (/ ? # : or end)
        if (lowerTarget.length === lowerVault.length) return true
        const nextChar = lowerTarget[lowerVault.length]
        if (lowerVault.endsWith("/") || ["/", "?", "#", ":"].includes(nextChar)) {
          return true
        }
        // If cleanVault didn't specify scheme, test hostname boundary
        try {
          const vHost = IrisMatching.extractHost(cleanVault)
          const tHost = IrisMatching.extractHost(cleanTarget)
          return tHost === vHost || tHost.endsWith("." + vHost)
        } catch {
          return false
        }
      }

      case BitwardenUriMatch.HOST: {
        const targetHost = IrisMatching.extractHost(cleanTarget)
        const vaultHost = IrisMatching.extractHost(cleanVault)
        return Boolean(targetHost && vaultHost && targetHost === vaultHost)
      }

      case BitwardenUriMatch.REGULAR_EXPRESSION: {
        try {
          const regex = new RegExp(cleanVault, "i")
          return regex.test(cleanTarget)
        } catch {
          return false
        }
      }

      case BitwardenUriMatch.BASE_DOMAIN:
      default: {
        const targetBase = IrisMatching.extractBaseDomain(cleanTarget)
        const vaultBase = IrisMatching.extractBaseDomain(cleanVault)
        return Boolean(targetBase && vaultBase && targetBase === vaultBase)
      }
    }
  }

  root.IrisMatching = IrisMatching
})(typeof self !== "undefined" ? self : this)

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

    // Common 2-letter ccTLDs compound extensions
    const compoundTlds = [
      "co.uk",
      "org.uk",
      "me.uk",
      "co.jp",
      "ne.jp",
      "ac.jp",
      "com.au",
      "net.au",
      "org.au",
      "co.nz",
      "com.br",
      "co.in",
      "com.mx",
      "com.sg",
      "co.za",
      "com.tr",
      "co.kr",
      "com.tw",
    ]

    const lastTwo = parts.slice(-2).join(".")
    if (compoundTlds.includes(lastTwo) && parts.length >= 3) {
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
    if (matchStrategy === BitwardenUriMatch.NEVER) return false

    const cleanTarget = targetUrl.trim()
    const cleanVault = vaultUri.trim()

    switch (matchStrategy) {
      case BitwardenUriMatch.EXACT: {
        const normTarget = cleanTarget.replace(/\/+$/, "").toLowerCase()
        const normVault = cleanVault.replace(/\/+$/, "").toLowerCase()
        return normTarget === normVault
      }

      case BitwardenUriMatch.STARTS_WITH: {
        return cleanTarget.toLowerCase().startsWith(cleanVault.toLowerCase())
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

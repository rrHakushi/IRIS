/**
 * Akaromi for Firefox — Background Autofill & Matching Engine
 */

/**
 * Filter decrypted ciphers matching a specific URL using Bitwarden match algorithm.
 * Strictly enforces detection method (e.g. HOST matches only exact host).
 * Returns ranked matches: exact domain matches first, followed by base domain matches.
 */
// Step 1: Active Tab Candidate Collection & Heuristics
// Step 1.1: Target Host & Base Domain Resolution
function getMatchingLogins(targetUrl) {
  if (!inMemoryVaultKey || !inMemoryCiphers || !targetUrl) return []

  const targetHost = IrisMatching.extractHost(targetUrl)
  const targetBase = IrisMatching.extractBaseDomain(targetUrl)

  const exactMatches = []
  const baseMatches = []

  for (const cipher of inMemoryCiphers) {
    if (cipher.deletedAt) continue
    if (cipher.type === "SSH_KEY" || cipher.type === 2) continue

    const candidates = []

    // 1. Array of explicit URIs
    const uris = cipher.data?.uris || cipher.login?.uris || cipher.data?.websites || []
    if (Array.isArray(uris) && uris.length > 0) {
      for (const u of uris) {
        const uriStr = typeof u === "string" ? u : u?.uri
        const matchType = typeof u === "object" && u?.match !== undefined && u?.match !== null ? u.match : 0
        if (uriStr && uriStr.trim()) {
          candidates.push({ uri: uriStr.trim(), matchType })
        }
      }
    }

    // 2. Passkey rpId (host matching)
    if (cipher.data?.passkey?.rpId) {
      candidates.push({ uri: cipher.data.passkey.rpId, matchType: 1 })
    }

    // 3. Fallback candidates ONLY if no explicit URIs or passkey rpId exist
    if (candidates.length === 0) {
      if (cipher.data?.uri) candidates.push({ uri: cipher.data.uri, matchType: 0 })
      if (cipher.data?.url) candidates.push({ uri: cipher.data.url, matchType: 0 })
      if (cipher.data?.website) candidates.push({ uri: cipher.data.website, matchType: 0 })

      if (cipher.title) {
        const cleanTitle = cipher.title.trim()
        if (cleanTitle.includes(".") || cleanTitle.includes("localhost") || cleanTitle.includes(":")) {
          const firstWord = cleanTitle.split(/\s+/)[0]
          if (firstWord.includes(".") || firstWord.includes(":")) {
            candidates.push({ uri: firstWord, matchType: 0 })
          }
        }
      }
    }

    // Evaluate candidates
    let isExactHost = false
    let isBaseMatched = false

    for (const { uri, matchType } of candidates) {
      const normStrategy = IrisMatching.normalizeMatchStrategy(matchType)
      if (normStrategy === IrisMatching.BitwardenUriMatch.NEVER) {
        continue
      }

      if (!IrisMatching.isUriMatch(targetUrl, uri, normStrategy)) {
        continue
      }

      const candHost = IrisMatching.extractHost(uri)
      if (
        (candHost && targetHost && candHost === targetHost) ||
        normStrategy === IrisMatching.BitwardenUriMatch.HOST ||
        normStrategy === IrisMatching.BitwardenUriMatch.EXACT
      ) {
        isExactHost = true
        break
      }

      isBaseMatched = true
    }

    if (isExactHost) {
      exactMatches.push({ ...cipher, _matchTier: "exact" })
    } else if (isBaseMatched) {
      baseMatches.push({ ...cipher, _matchTier: "base" })
    }
  }

  // Exact host matches on top, followed by base domain matches
  return [...exactMatches, ...baseMatches]
}

/**
 * Updates extension action badge based on match count or lock state
 */
// Step 3: Extension Action Toolbar Badging
// Step 3.1: Badge Counter Query & Text Setting
async function updateBadge() {
  try {
    const { authToken, apiKey } = await IrisApi.getToken().catch(() => ({}))
    const isAuthenticated = Boolean(authToken || apiKey)

    if (!isAuthenticated) {
      ext.action.setBadgeText({ text: "" })
      return
    }

    if (!inMemoryVaultKey) {
      ext.action.setBadgeText({ text: "" })
      return
    }

    let tabs = await ext.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => [])
    if (!tabs || tabs.length === 0) {
      tabs = await ext.tabs.query({ active: true, currentWindow: true }).catch(() => [])
    }
    if (!tabs || tabs.length === 0) {
      tabs = await ext.tabs.query({ active: true }).catch(() => [])
    }
    const activeTab = tabs?.find((t) => t.url && !t.url.startsWith("about:") && !t.url.startsWith("moz-extension:")) || tabs?.[0]

    if (!activeTab || !activeTab.url) {
      ext.action.setBadgeText({ text: "" })
      return
    }

    const matches = getMatchingLogins(activeTab.url)
    if (matches.length > 0) {
      ext.action.setBadgeText({ text: String(matches.length) })
      ext.action.setBadgeBackgroundColor({ color: "#18181b" })
    } else {
      ext.action.setBadgeText({ text: "" })
    }
  } catch (err) {
    // Ignore tab errors
  }
}

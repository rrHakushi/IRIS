/**
 * Akaromi for Firefox — Background Autofill & Matching Engine
 */

/**
 * Filter decrypted ciphers matching a specific URL using Bitwarden match algorithm
 */
function getMatchingLogins(targetUrl) {
  if (!inMemoryVaultKey || !inMemoryCiphers || !targetUrl) return []

  return inMemoryCiphers.filter((cipher) => {
    if (cipher.deletedAt) return false
    if (cipher.type && cipher.type !== "LOGIN" && !cipher.data?.uris?.length) return false

    const candidates = []

    // 1. Array of URIs in cipher.data?.uris or cipher.login?.uris
    const uris = cipher.data?.uris || cipher.login?.uris || []
    if (Array.isArray(uris)) {
      for (const u of uris) {
        const uriStr = typeof u === "string" ? u : u?.uri
        const matchType = typeof u === "object" && u?.match !== undefined ? u.match : 0
        if (uriStr) candidates.push({ uri: uriStr, matchType })
      }
    }

    // 2. Singular uri, url, website
    if (cipher.data?.uri) candidates.push({ uri: cipher.data.uri, matchType: 0 })
    if (cipher.data?.url) candidates.push({ uri: cipher.data.url, matchType: 0 })
    if (cipher.data?.website) candidates.push({ uri: cipher.data.website, matchType: 0 })

    // 3. Passkey rpId
    if (cipher.data?.passkey?.rpId) {
      candidates.push({ uri: cipher.data.passkey.rpId, matchType: 1 })
    }

    // 4. Fallback: match by title if it looks like a domain, IP, or hostname
    if (cipher.title) {
      const cleanTitle = cipher.title.trim()
      if (cleanTitle.includes(".") || cleanTitle.includes("localhost") || cleanTitle.includes(":")) {
        const firstWord = cleanTitle.split(/\s+/)[0]
        if (firstWord.includes(".") || firstWord.includes(":")) {
          candidates.push({ uri: firstWord, matchType: 0 })
        }
        candidates.push({ uri: cleanTitle, matchType: 0 })
      }
    }

    return candidates.some(({ uri, matchType }) => {
      return IrisMatching.isUriMatch(targetUrl, uri, matchType)
    })
  })
}

/**
 * Updates extension action badge based on match count or lock state
 */
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

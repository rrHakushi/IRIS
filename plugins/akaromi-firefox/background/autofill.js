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
    if (cipher.type !== "LOGIN" && !cipher.data?.uris?.length) return false

    const uris = cipher.data?.uris || []
    return uris.some((u) => {
      const uriStr = typeof u === "string" ? u : u.uri
      const matchType =
        typeof u === "object" && u.match !== undefined ? u.match : 0
      return IrisMatching.isUriMatch(targetUrl, uriStr, matchType)
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

    let tabs = await ext.tabs.query({ active: true, currentWindow: true }).catch(() => [])
    if (!tabs || tabs.length === 0) {
      tabs = await ext.tabs.query({ active: true }).catch(() => [])
    }
    const activeTab = tabs?.[0]

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

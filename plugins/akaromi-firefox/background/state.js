/**
 * Akaromi for Firefox — Background State & Lifecycle Manager
 */

// Universal browser API shim (Firefox & Chromium compatible)
const ext = typeof browser !== "undefined" ? browser : chrome
const storage = typeof IrisStorage !== "undefined" ? IrisStorage : ext.storage.local

// In-memory vault state (strictly zero-history, wiped on lock or restart)
let inMemoryVaultKey = null
let inMemoryCiphers = []
let inMemoryFolders = []
let autoLockTimer = null
let clipboardClearTimer = null

const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * Helper: ensure vault is active and unlocked
 * Uses cached encrypted ciphers from local storage to avoid redundant network calls!
 */
async function ensureVaultActive() {
  if (inMemoryVaultKey) {
    if (inMemoryCiphers.length === 0) {
      await decryptCachedVault(inMemoryVaultKey)
    }
    // Check if background hourly sync is due
    checkHourlySyncDue()
    return true
  }

  if (ext.storage?.session) {
    try {
      const sessionData = await ext.storage.session.get([
        "vaultKeyHex",
        "lastActive",
      ])
      if (sessionData?.vaultKeyHex) {
        const settings = await storage.get(["autoLockMinutes"])
        const minutes = settings.autoLockMinutes ?? 15

        if (minutes > 0 && sessionData.lastActive) {
          const elapsed = Date.now() - sessionData.lastActive
          if (elapsed > minutes * 60 * 1000) {
            console.log(
              "[Akaromi] Auto-lock expired while background worker was idle"
            )
            lockVault()
            return false
          }
        }

        // Restore vault key from session
        inMemoryVaultKey = IrisCrypto.hexToBytes(sessionData.vaultKeyHex)
        await decryptCachedVault(inMemoryVaultKey)
        await resetAutoLock()
        checkHourlySyncDue()
        return true
      }
    } catch (err) {
      console.warn("[Akaromi] Session restore error:", err)
    }
  }

  return false
}

/**
 * Checks if 1 hour has elapsed since last sync and triggers background sync
 */
async function checkHourlySyncDue() {
  try {
    const sData = await storage.get(["lastSyncTimestamp"])
    const lastSync = sData.lastSyncTimestamp || 0
    if (Date.now() - lastSync >= ONE_HOUR_MS && inMemoryVaultKey) {
      syncVault({ force: true }).catch((err) => {
        console.warn("[Akaromi] Hourly background sync warning:", err)
      })
    }
  } catch {}
}

/**
 * Reset auto-lock timer based on settings
 */
async function resetAutoLock() {
  if (autoLockTimer) clearTimeout(autoLockTimer)

  const settings = await storage.get(["autoLockMinutes"])
  const minutes = settings.autoLockMinutes ?? 15 // 15 min default (0 = Never)

  if (ext.storage?.session && inMemoryVaultKey) {
    ext.storage.session.set({ lastActive: Date.now() }).catch(() => {})
  }

  if (minutes > 0 && inMemoryVaultKey) {
    autoLockTimer = setTimeout(
      () => {
        console.log("[Akaromi] Auto-locking vault due to inactivity")
        lockVault()
      },
      minutes * 60 * 1000
    )
  }
}

/**
 * Locks vault and purges all decrypted data from memory and session storage
 */
function lockVault() {
  inMemoryVaultKey = null
  inMemoryCiphers = []
  inMemoryFolders = []
  if (autoLockTimer) clearTimeout(autoLockTimer)
  if (ext.storage?.session) {
    ext.storage.session.remove(["vaultKeyHex", "lastActive"]).catch(() => {})
  }
  updateBadge()
}

function isPrivilegedSender(sender) {
  // Only internal extension contexts (e.g. popup, options page) - not untrusted webpage content scripts
  return !sender.tab && sender.id === ext.runtime.id
}

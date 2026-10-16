/**
 * Akaromi for Firefox — Background State & Lifecycle Manager
 */

// Universal browser API shim (Firefox & Chromium compatible)
const ext = typeof browser !== "undefined" ? browser : chrome
const storage = typeof IrisStorage !== "undefined" ? IrisStorage : ext.storage.local

// In-memory vault state (strictly zero-history, wiped on lock or restart)
// In-memory vault state (strictly zero-history, wiped on lock or restart)
let inMemoryVaultKey = null
let inMemoryCiphers = []
let autoLockTimer = null
let clipboardClearTimer = null

const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * Saves current in-memory vault key to session storage
 */
async function saveVaultKeyToSession() {
  if (!ext.storage?.session || !inMemoryVaultKey) return
  try {
    const vaultKeyHex = IrisCrypto.bytesToHex(inMemoryVaultKey)
    await ext.storage.session.set({
      vaultKeyHex,
      lastActive: Date.now(),
    })
  } catch (err) {
    console.warn("[Akaromi] Failed to save session vault key:", err)
  }
}

/**
 * Removes session vault key
 */
async function clearVaultKeyFromSession() {
  if (ext.storage?.session) {
    await ext.storage.session.remove(["vaultKeyHex", "encryptedVaultKey", "lastActive"]).catch(() => {})
  }
}

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
          if (elapsed >= minutes * 60 * 1000) {
            console.log(
              "[Akaromi] Auto-lock expired while background worker was idle"
            )
            lockVault()
            return false
          }
        }

        inMemoryVaultKey = IrisCrypto.hexToBytes(sessionData.vaultKeyHex)
        await decryptCachedVault(inMemoryVaultKey)
        await resetAutoLock({ preserveLastActive: true })
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
async function resetAutoLock(options = {}) {
  const { preserveLastActive = false } = options
  if (autoLockTimer) clearTimeout(autoLockTimer)

  const settings = await storage.get(["autoLockMinutes"])
  const minutes = settings.autoLockMinutes ?? 15 // 15 min default (0 = Never)

  let lastActive = Date.now()
  if (preserveLastActive && ext.storage?.session) {
    const s = await ext.storage.session.get(["lastActive"])
    if (s.lastActive) lastActive = s.lastActive
  }

  if (ext.storage?.session && inMemoryVaultKey && !preserveLastActive) {
    ext.storage.session.set({ lastActive }).catch(() => {})
  }

  if (minutes > 0 && inMemoryVaultKey) {
    const elapsed = Date.now() - lastActive
    const remainingMs = Math.max(5000, minutes * 60 * 1000 - elapsed)
    const delayInMinutes = Math.max(0.1, remainingMs / 60000)

    try {
      ext.alarms?.create("autoLock", { delayInMinutes })
    } catch (e) {
      console.warn("[Akaromi] Could not create autoLock alarm:", e)
    }

    autoLockTimer = setTimeout(
      () => {
        console.log("[Akaromi] Auto-locking vault due to inactivity")
        lockVault()
      },
      remainingMs
    )
  } else {
    try {
      ext.alarms?.clear("autoLock")
    } catch {}
  }
}

// Register alarm listener for background auto-lock
if (ext.alarms?.onAlarm) {
  ext.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "autoLock") {
      console.log("[Akaromi] Auto-locking vault due to alarm")
      lockVault()
    }
  })
}

/**
 * Locks vault and purges all decrypted data from memory and session storage
 */
function lockVault() {
  if (inMemoryVaultKey) {
    IrisCrypto.zeroize(inMemoryVaultKey)
    inMemoryVaultKey = null
  }
  inMemoryCiphers = []
  if (autoLockTimer) clearTimeout(autoLockTimer)
  try {
    ext.alarms?.clear("autoLock")
  } catch {}
  clearVaultKeyFromSession()
  updateBadge()
}

function isPrivilegedSender(sender) {
  // Only internal extension contexts (e.g. popup, options page) - not untrusted webpage content scripts
  return !sender.tab && sender.id === ext.runtime.id
}

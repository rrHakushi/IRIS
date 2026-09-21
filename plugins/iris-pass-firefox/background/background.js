/**
 * IRIS Pass — Background Service Worker & Vault Manager
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
              "[IRIS Pass] Auto-lock expired while background worker was idle"
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
      console.warn("[IRIS Pass] Session restore error:", err)
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
        console.warn("[IRIS Pass] Hourly background sync warning:", err)
      })
    }
  } catch { }
}

/**
 * Reset auto-lock timer based on settings
 */
async function resetAutoLock() {
  if (autoLockTimer) clearTimeout(autoLockTimer)

  const settings = await storage.get(["autoLockMinutes"])
  const minutes = settings.autoLockMinutes ?? 15 // 15 min default (0 = Never)

  if (ext.storage?.session && inMemoryVaultKey) {
    ext.storage.session.set({ lastActive: Date.now() }).catch(() => { })
  }

  if (minutes > 0 && inMemoryVaultKey) {
    autoLockTimer = setTimeout(
      () => {
        console.log("[IRIS Pass] Auto-locking vault due to inactivity")
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
    ext.storage.session.remove(["vaultKeyHex", "lastActive"]).catch(() => { })
  }
  updateBadge()
}

/**
 * Updates extension action badge based on match count for active tab
 */
async function updateBadge() {
  try {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]

    if (!activeTab || !activeTab.url || !inMemoryVaultKey) {
      ext.action.setBadgeText({ text: "" })
      return
    }

    const matches = getMatchingLogins(activeTab.url)
    if (matches.length > 0) {
      ext.action.setBadgeText({ text: String(matches.length) })
      ext.action.setBadgeBackgroundColor({ color: "#d800a6" }) // IRIS Pass accent
    } else {
      ext.action.setBadgeText({ text: "" })
    }
  } catch (err) {
    // Ignore tab errors
  }
}

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
 * Decrypts raw encrypted ciphers and folders from local storage cache
 * (Ultra fast, zero API network calls)
 */
async function decryptCachedVault(vaultKey) {
  const sData = await storage.get([
    "cachedEncryptedCiphers",
    "cachedEncryptedFolders",
  ])
  const rawCiphers = sData.cachedEncryptedCiphers || []
  const rawFolders = sData.cachedEncryptedFolders || []

  if (rawCiphers.length === 0 && rawFolders.length === 0) {
    // No local cache yet — perform first-time sync
    await syncVault({ force: true })
    return
  }

  const decryptedList = []
  for (const c of rawCiphers) {
    try {
      const title = await IrisCrypto.decryptVaultData(
        c.encryptedTitle,
        vaultKey
      )
      const data = await IrisCrypto.decryptVaultObject(
        c.encryptedData,
        vaultKey
      )
      decryptedList.push({
        id: c.id,
        type: c.type,
        title,
        favorite: c.favorite,
        folderId: c.folderId,
        reprompt: c.reprompt,
        data,
        deletedAt: c.deletedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })
    } catch (err) {
      console.warn("[IRIS Pass] Skipped un-decryptable cached cipher:", c.id)
    }
  }
  inMemoryCiphers = decryptedList

  const decryptedFolders = []
  for (const f of rawFolders) {
    try {
      const name = await IrisCrypto.decryptVaultData(
        f.encryptedName,
        vaultKey
      )
      decryptedFolders.push({ id: f.id, name })
    } catch {
      decryptedFolders.push({ id: f.id, name: "[Folder]" })
    }
  }
  inMemoryFolders = decryptedFolders

  updateBadge()
}

/**
 * Sync vault data from backend (hourly or on explicit "Sync Now" trigger)
 */
async function syncVault(options = {}) {
  const { force = false } = options
  if (!inMemoryVaultKey) return { success: false, error: "Vault is locked" }

  const sData = await storage.get(["lastSyncTimestamp"])
  const lastSync = sData.lastSyncTimestamp || 0

  if (!force && lastSync && Date.now() - lastSync < ONE_HOUR_MS) {
    // Fresh enough — just ensure memory is decrypted
    if (inMemoryCiphers.length === 0) {
      await decryptCachedVault(inMemoryVaultKey)
    }
    return {
      success: true,
      fromCache: true,
      lastSyncTimestamp: lastSync,
      cipherCount: inMemoryCiphers.length,
      folderCount: inMemoryFolders.length,
    }
  }

  try {
    const ciphersRes = await IrisApi.fetchCiphers()
    const rawCiphers = ciphersRes?.ciphers || ciphersRes?.data?.ciphers || []

    let rawFolders = []
    try {
      const foldersRes = await IrisApi.fetchFolders()
      rawFolders = foldersRes?.folders || foldersRes?.data?.folders || []
    } catch (e) {
      console.warn("[IRIS Pass] Failed to fetch folders:", e)
    }

    const now = Date.now()
    await storage.set({
      cachedEncryptedCiphers: rawCiphers,
      cachedEncryptedFolders: rawFolders,
      lastSyncTimestamp: now,
    })

    // Decrypt into memory
    const decryptedList = []
    for (const c of rawCiphers) {
      try {
        const title = await IrisCrypto.decryptVaultData(
          c.encryptedTitle,
          inMemoryVaultKey
        )
        const data = await IrisCrypto.decryptVaultObject(
          c.encryptedData,
          inMemoryVaultKey
        )
        decryptedList.push({
          id: c.id,
          type: c.type,
          title,
          favorite: c.favorite,
          folderId: c.folderId,
          reprompt: c.reprompt,
          data,
          deletedAt: c.deletedAt,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })
      } catch (err) {
        console.warn("[IRIS Pass] Skipped un-decryptable cipher:", c.id)
      }
    }
    inMemoryCiphers = decryptedList

    const decryptedFolders = []
    for (const f of rawFolders) {
      try {
        const name = await IrisCrypto.decryptVaultData(
          f.encryptedName,
          inMemoryVaultKey
        )
        decryptedFolders.push({ id: f.id, name })
      } catch {
        decryptedFolders.push({ id: f.id, name: "[Folder]" })
      }
    }
    inMemoryFolders = decryptedFolders

    updateBadge()

    return {
      success: true,
      fromCache: false,
      lastSyncTimestamp: now,
      cipherCount: inMemoryCiphers.length,
      folderCount: inMemoryFolders.length,
    }
  } catch (err) {
    console.error("[IRIS Pass] Sync error:", err)
    // Fallback to local cache if network fails
    if (inMemoryCiphers.length === 0) {
      await decryptCachedVault(inMemoryVaultKey)
    }
    throw err
  }
}

/**
 * Helper: decrypt master secret key using password, then derive vault key and decrypt ciphers
 */
async function unlockWithPassword(password) {
  const encData = await IrisApi.fetchEncryptionKeys()
  if (!encData?.publicKey || !encData?.encryptedPrivateKey) {
    throw new Error(
      "No encryption keys configured on this account yet. Please unlock or set up your vault on the web first."
    )
  }

  // 1. Decrypt post-quantum master private key using password (scrypt + AES-256-GCM)
  let secretKeyBytes
  try {
    secretKeyBytes = IrisCrypto.decryptPrivateKey(
      encData.encryptedPrivateKey,
      password
    )
  } catch (err) {
    console.error("[IRIS Pass] Master key decryption failed:", err)
    throw new Error("Incorrect account or encryption password")
  }

  // 2. Derive vault key from master secret key (HKDF-SHA256)
  inMemoryVaultKey = IrisCrypto.deriveVaultKey(secretKeyBytes)

  if (ext.storage?.session) {
    await ext.storage.session.set({
      vaultKeyHex: IrisCrypto.bytesToHex(inMemoryVaultKey),
      lastActive: Date.now(),
    })
  }

  // 3. Sync or decrypt vault items
  await syncVault({ force: false })
  await resetAutoLock()
}

function isPrivilegedSender(sender) {
  // Only internal extension contexts (e.g. popup, options page) - not untrusted webpage content scripts
  return !sender.tab && sender.id === ext.runtime.id
}

/**
 * Message Handler
 */
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, payload } = message

  // 1. Vault & Auth Status
  if (action === "GET_STATUS") {
    ; (async () => {
      await ensureVaultActive()
      const { authToken, apiKey } = await IrisApi.getToken()
      const serverUrl = await IrisApi.getServerUrl()
      const sData = await storage.get([
        "user",
        "pinUnlockEnabled",
        "biometricUnlockEnabled",
        "lastSyncTimestamp",
        "clipboardClearSeconds",
        "isDefaultPasswordManager",
      ])
      let user = sData.user || null

      if (!authToken && !apiKey) {
        sendResponse({
          isAuthenticated: false,
          isUnlocked: false,
          serverUrl,
          user: null,
          cipherCount: 0,
          pinUnlockEnabled: Boolean(sData.pinUnlockEnabled),
          biometricUnlockEnabled: Boolean(sData.biometricUnlockEnabled),
          lastSyncTimestamp: sData.lastSyncTimestamp || 0,
        })
        return
      }

      // If token exists, verify with server if user not cached or missing customization
      if (!user || !user.customization) {
        try {
          const auth = await IrisApi.checkAuth()
          if (auth.authenticated && auth.user) {
            user = auth.user
            await storage.set({ user })
          } else if (!user) {
            // Token is invalid/expired
            await storage.clear()
            if (ext.storage?.local) {
              await ext.storage.local.clear().catch(() => {})
            }
            sendResponse({
              isAuthenticated: false,
              isUnlocked: false,
              serverUrl,
              user: null,
              cipherCount: 0,
              pinUnlockEnabled: false,
              biometricUnlockEnabled: false,
              lastSyncTimestamp: 0,
            })
            return
          }
        } catch (e) {
          // Offline or network error: preserve existing state
        }
      }

      sendResponse({
        isAuthenticated: true,
        isUnlocked: Boolean(inMemoryVaultKey),
        user,
        serverUrl,
        cipherCount: inMemoryCiphers.length,
        pinUnlockEnabled: Boolean(sData.pinUnlockEnabled),
        biometricUnlockEnabled: Boolean(sData.biometricUnlockEnabled),
        lastSyncTimestamp: sData.lastSyncTimestamp || 0,
        clipboardClearSeconds: sData.clipboardClearSeconds ?? 30,
        isDefaultPasswordManager: Boolean(sData.isDefaultPasswordManager),
      })
    })()
    return true
  }

  // 2. Log in with Username/Email & Password
  if (action === "LOGIN") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { identifier, password, serverUrl } = payload
        if (!identifier || !password)
          throw new Error("Username/email and password required")

        if (serverUrl) {
          await IrisApi.setServerUrl(serverUrl)
        }

        // 1. Authenticate with IRIS backend
        const loginData = await IrisApi.login(identifier, password)
        if (!loginData?.success) {
          throw new Error("Invalid username or password")
        }

        // 1b. Check if Two-Factor Authentication is required
        if (loginData.mfaRequired) {
          sendResponse({
            success: true,
            mfaRequired: true,
            mfaTicket: loginData.mfaTicket,
            allowedMfaTypes: loginData.allowedMfaTypes || ["totp"],
          })
          return
        }

        if (!loginData?.token) {
          throw new Error("Invalid username or password")
        }

        // 2. Automatically attempt vault key decryption with the same password
        try {
          await unlockWithPassword(password)
        } catch (vaultErr) {
          console.warn(
            "[IRIS Pass] Account logged in, but vault requires separate password or setup:",
            vaultErr
          )
        }

        sendResponse({
          success: true,
          user: loginData.user,
          isUnlocked: Boolean(inMemoryVaultKey),
        })
      } catch (err) {
        console.error("[IRIS Pass] Login error:", err)
        sendResponse({
          success: false,
          error: err.message || "Failed to log in",
        })
      }
    })()
    return true
  }

  // 2b. Verify Two-Factor Authentication (TOTP or Backup Code)
  if (action === "VERIFY_MFA") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { mfaTicket, code, mfaType = "totp", password } = payload
        if (!mfaTicket || !code)
          throw new Error("Verification code is required")

        // 1. Verify MFA code with IRIS backend
        const mfaData = await IrisApi.verifyMfa(mfaTicket, code, mfaType)
        if (!mfaData?.success || !mfaData?.token) {
          throw new Error("Invalid verification code")
        }

        // 2. Automatically attempt vault key decryption with preserved password
        if (password) {
          try {
            await unlockWithPassword(password)
          } catch (vaultErr) {
            console.warn(
              "[IRIS Pass] MFA verified, but vault requires separate password:",
              vaultErr
            )
          }
        }

        sendResponse({
          success: true,
          user: mfaData.user,
          isUnlocked: Boolean(inMemoryVaultKey),
        })
      } catch (err) {
        console.error("[IRIS Pass] MFA verification error:", err)
        sendResponse({
          success: false,
          error: err.message || "Failed to verify 2FA code",
        })
      }
    })()
    return true
  }

  // 2c. Log in via API Key & Master Password
  if (action === "LOGIN_API_KEY") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { apiKey, masterPassword, serverUrl } = payload
        if (!apiKey) throw new Error("API Key is required")
        if (!masterPassword)
          throw new Error("Master Password is required to unlock your vault")

        if (serverUrl) {
          await IrisApi.setServerUrl(serverUrl)
        }

        // 1. Test & save API key
        const user = await IrisApi.loginWithApiKey(apiKey)

        // 2. Decrypt vault with Master Password
        try {
          await unlockWithPassword(masterPassword)
        } catch (vaultErr) {
          console.warn(
            "[IRIS Pass] API key valid, but vault unlock failed:",
            vaultErr
          )
          throw new Error(
            "API key connected, but Master Password is incorrect for this vault"
          )
        }

        sendResponse({
          success: true,
          user,
          isUnlocked: Boolean(inMemoryVaultKey),
        })
      } catch (err) {
        console.error("[IRIS Pass] API Key login error:", err)
        sendResponse({
          success: false,
          error: err.message || "Failed to connect with API key",
        })
      }
    })()
    return true
  }

  // 3. Unlock Vault with Master Password
  if (action === "UNLOCK_VAULT") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { password } = payload
        if (!password) throw new Error("Password required")

        await unlockWithPassword(password)
        sendResponse({ success: true })
      } catch (err) {
        console.error("[IRIS Pass] Unlock error:", err)
        sendResponse({
          success: false,
          error: err.message || "Incorrect password",
        })
      }
    })()
    return true
  }

  // 3b. Setup PIN Unlock
  if (action === "SETUP_PIN_UNLOCK") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        await ensureVaultActive()
        if (!inMemoryVaultKey) throw new Error("Vault is locked")

        const { pin } = payload || {}
        if (!pin || pin.length < 4) {
          throw new Error("PIN must be at least 4 digits")
        }

        const pinData = IrisCrypto.setupPinUnlock(pin, inMemoryVaultKey)
        await storage.set({
          pinUnlockData: pinData,
          pinUnlockEnabled: true,
        })

        sendResponse({ success: true })
      } catch (err) {
        console.error("[IRIS Pass] Setup PIN error:", err)
        sendResponse({ success: false, error: err.message || "Failed to set up PIN" })
      }
    })()
    return true
  }

  // 3c. Unlock Vault with PIN (Persists across browser restarts)
  if (action === "UNLOCK_WITH_PIN") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { pin } = payload || {}
        if (!pin) throw new Error("PIN is required")

        const sData = await storage.get(["pinUnlockData", "pinUnlockEnabled", "user"])
        if (!sData.pinUnlockEnabled || !sData.pinUnlockData) {
          throw new Error("PIN unlock is not enabled on this device")
        }

        // Decrypt vault key using PIN
        const vaultKey = IrisCrypto.unlockWithPin(pin, sData.pinUnlockData)
        inMemoryVaultKey = vaultKey

        if (ext.storage?.session) {
          await ext.storage.session.set({
            vaultKeyHex: IrisCrypto.bytesToHex(inMemoryVaultKey),
            lastActive: Date.now(),
          })
        }

        // Decrypt cached vault ciphers without hitting network
        await decryptCachedVault(inMemoryVaultKey)
        await resetAutoLock()
        checkHourlySyncDue()

        sendResponse({ success: true, user: sData.user })
      } catch (err) {
        console.error("[IRIS Pass] PIN unlock error:", err)
        sendResponse({ success: false, error: err.message || "Incorrect PIN" })
      }
    })()
    return true
  }

  // 3d. Disable PIN Unlock
  if (action === "DISABLE_PIN_UNLOCK") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        await storage.remove(["pinUnlockData"])
        await storage.set({ pinUnlockEnabled: false })
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3e. Setup Biometric Unlock
  if (action === "SETUP_BIOMETRIC_UNLOCK") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { bioData } = payload || {}
        if (!bioData?.credentialId) {
          throw new Error("Invalid biometric enrollment data")
        }

        await storage.set({
          biometricUnlockData: bioData,
          biometricUnlockEnabled: true,
        })
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3f. Unlock Vault with Biometrics
  if (action === "UNLOCK_WITH_BIOMETRICS") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { vaultKeyHex } = payload || {}
        if (!vaultKeyHex) throw new Error("Vault key required")

        inMemoryVaultKey = IrisCrypto.hexToBytes(vaultKeyHex)

        if (ext.storage?.session) {
          await ext.storage.session.set({
            vaultKeyHex: IrisCrypto.bytesToHex(inMemoryVaultKey),
            lastActive: Date.now(),
          })
        }

        await decryptCachedVault(inMemoryVaultKey)
        await resetAutoLock()
        checkHourlySyncDue()

        const sData = await storage.get(["user"])
        sendResponse({ success: true, user: sData.user })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3g. Disable Biometric Unlock
  if (action === "DISABLE_BIOMETRIC_UNLOCK") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        await storage.remove(["biometricUnlockData"])
        await storage.set({ biometricUnlockEnabled: false })
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3h. Sync Now
  if (action === "SYNC_VAULT") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        await ensureVaultActive()
        if (!inMemoryVaultKey) throw new Error("Vault is locked")

        const result = await syncVault({ force: true })
        sendResponse(result)
      } catch (err) {
        console.error("[IRIS Pass] Manual sync error:", err)
        sendResponse({ success: false, error: err.message || "Failed to sync vault" })
      }
    })()
    return true
  }

  // 3i. Schedule Clipboard Clear
  if (action === "SCHEDULE_CLIPBOARD_CLEAR") {
    ; (async () => {
      try {
        const { text, seconds = 30 } = payload || {}
        if (!seconds || seconds <= 0) {
          sendResponse({ success: true, scheduled: false })
          return
        }

        if (clipboardClearTimer) clearTimeout(clipboardClearTimer)
        clipboardClearTimer = setTimeout(async () => {
          try {
            // Check if active tab or offscreen can clear clipboard
            const tabs = await ext.tabs.query({ active: true, currentWindow: true })
            if (tabs[0]?.id) {
              ext.tabs.sendMessage(tabs[0].id, {
                action: "CLEAR_CLIPBOARD_IF_MATCHES",
                payload: { text },
              }).catch(() => {})
            }
          } catch (e) { }
        }, seconds * 1000)

        sendResponse({ success: true, scheduled: true, seconds })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3j. Default Password Manager Toggle
  if (action === "SET_DEFAULT_PASSWORD_MANAGER") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { isDefault } = payload || {}
        await storage.set({ isDefaultPasswordManager: Boolean(isDefault) })

        // If browser privacy API available, disable native password saving
        if (ext.privacy?.services?.passwordSavingEnabled) {
          try {
            await ext.privacy.services.passwordSavingEnabled.set({
              value: !isDefault,
            })
          } catch (e) {
            console.warn("[IRIS Pass] Could not modify native passwordSavingEnabled:", e)
          }
        }

        sendResponse({ success: true, isDefault: Boolean(isDefault) })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 4. Log Out (Completely wipe EVERYTHING from extension)
  if (action === "LOGOUT") {
    ; (async () => {
      if (!isPrivilegedSender(sender)) {
        sendResponse({ success: false, error: "Unauthorized sender context" })
        return
      }
      lockVault()
      if (clipboardClearTimer) {
        clearTimeout(clipboardClearTimer)
        clipboardClearTimer = null
      }
      try {
        ext.action.setBadgeText({ text: "" })
      } catch (e) {}

      // Wipe ALL local keys: tokens, ciphers, folders, PIN unlock, Biometrics, sync timestamps, etc.
      await storage.clear()
      if (ext.storage?.local) {
        await ext.storage.local.clear().catch(() => {})
      }
      if (ext.storage?.session) {
        await ext.storage.session.clear().catch(() => {})
      }
      sendResponse({ success: true })
    })()
    return true
  }

  // 5. Lock Vault
  if (action === "LOCK_VAULT") {
    if (!isPrivilegedSender(sender)) {
      sendResponse({ success: false, error: "Unauthorized sender context" })
      return true
    }
    lockVault()
    sendResponse({ success: true })
    return true
  }

  // 6. Get Matching Logins for a URL
  if (action === "GET_MATCHING_LOGINS") {
    ; (async () => {
      await ensureVaultActive()
      resetAutoLock()
      // If request comes from a content script in a tab, strictly enforce tab URL to prevent cross-domain spoofing
      const targetUrl = sender.tab?.url || payload?.url
      const matches = getMatchingLogins(targetUrl)
      sendResponse({ matches, isUnlocked: Boolean(inMemoryVaultKey) })
    })()
    return true
  }

  // 7. Get All Ciphers (for popup search only)
  if (action === "GET_ALL_CIPHERS") {
    ; (async () => {
      if (!isPrivilegedSender(sender)) {
        sendResponse({ error: "Access denied", ciphers: [], folders: [], isUnlocked: false })
        return
      }
      await ensureVaultActive()
      resetAutoLock()
      sendResponse({
        ciphers: inMemoryCiphers.filter((c) => !c.deletedAt),
        folders: inMemoryFolders,
        isUnlocked: Boolean(inMemoryVaultKey),
      })
    })()
    return true
  }

  // 8. Perform Autofill on active tab
  if (action === "PERFORM_AUTOFILL") {
    ; (async () => {
      try {
        await ensureVaultActive()
        const { cipherId, tabId } = payload
        const cipher = inMemoryCiphers.find((c) => c.id === cipherId)
        if (!cipher) throw new Error("Cipher not found")

        // Target tab is either explicitly given by popup or the sender's tab
        const targetTabId =
          tabId ||
          sender.tab?.id ||
          (await ext.tabs.query({ active: true, currentWindow: true }))[0]?.id
        if (!targetTabId) throw new Error("Target tab not found")

        // Send fill instruction to content script
        await ext.tabs.sendMessage(targetTabId, {
          action: "FILL_INPUTS",
          payload: {
            username: cipher.data?.username || "",
            password: cipher.data?.password || "",
          },
        })

        // Auto-copy TOTP to clipboard and launch countdown timer if present
        if (cipher.data?.totpSecret) {
          const otp = await IrisTotp.generateTotp(cipher.data.totpSecret)
          if (otp) {
            ext.tabs.sendMessage(targetTabId, {
              action: "SHOW_TOTP_TIMER",
              payload: {
                secret: cipher.data.totpSecret,
                label: cipher.title || cipher.data?.username || "2FA",
                initialCode: otp,
              },
            }).catch(() => {})
          }
        }

        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 8b. Open Unlock Popup / Window
  if (action === "OPEN_UNLOCK_WINDOW") {
    ; (async () => {
      try {
        if (ext.action?.openPopup) {
          try {
            await ext.action.openPopup()
            sendResponse({ success: true })
            return
          } catch (e) {
            // Fallback to window creation
          }
        }
        const popupUrl = ext.runtime.getURL("popup/popup.html")
        await ext.windows.create({
          url: popupUrl,
          type: "popup",
          width: 390,
          height: 560,
          focused: true,
        })
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 8c. Process QR Code Screenshot from Selected Area
  if (action === "PROCESS_QR_SCREENSHOT") {
    ; (async () => {
      try {
        const { bounds, tabId } = payload || {}
        const targetTabId = tabId || sender.tab?.id
        const screenshotUrl = await ext.tabs.captureVisibleTab(null, { format: "png" })
        if (!screenshotUrl) throw new Error("Failed to capture screen")

        // Fetch image as blob
        const res = await fetch(screenshotUrl)
        const blob = await res.blob()

        let bitmap
        const dpr = bounds?.dpr || 1
        const sx = Math.max(0, Math.round((bounds?.x || 0) * dpr))
        const sy = Math.max(0, Math.round((bounds?.y || 0) * dpr))
        const sw = Math.max(10, Math.round((bounds?.width || 100) * dpr))
        const sh = Math.max(10, Math.round((bounds?.height || 100) * dpr))

        if (typeof createImageBitmap !== "undefined") {
          bitmap = await createImageBitmap(blob, sx, sy, sw, sh)
        } else {
          bitmap = await createImageBitmap(blob)
        }

        const decodedText = await IrisQrDecoder.scanImage(bitmap)
        if (!decodedText) {
          throw new Error("No QR code detected in the selected area. Please try selecting closer to the QR code.")
        }

        const parsedOtp = IrisTotp.parseOtpAuthUri(decodedText)
        if (!parsedOtp || !parsedOtp.secret) {
          throw new Error(`Scanned QR code is not a valid 2FA authenticator key: ${decodedText.slice(0, 40)}`)
        }

        // Save in session storage so popup can retrieve it
        if (ext.storage?.session) {
          await ext.storage.session.set({ pendingScannedTotp: parsedOtp })
        }

        // Notify content script of success
        if (targetTabId) {
          ext.tabs.sendMessage(targetTabId, {
            action: "QR_SCAN_SUCCESS",
            payload: parsedOtp,
          }).catch(() => {})
        }

        sendResponse({ success: true, result: parsedOtp })
      } catch (err) {
        console.warn("[IRIS Pass] QR Screen Capture error:", err)
        sendResponse({ success: false, error: err.message || "Failed to decode QR code" })
      }
    })()
    return true
  }

  // 9. Save or Update Credential (Internal popup/settings only)
  if (action === "SAVE_CIPHER") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        await ensureVaultActive()
        if (!inMemoryVaultKey) throw new Error("Vault is locked")

        const { id, type, title, folderId, favorite, data } = payload
        const encryptedTitle = await IrisCrypto.encryptVaultData(
          title,
          inMemoryVaultKey
        )
        const encryptedData = await IrisCrypto.encryptVaultObject(
          data,
          inMemoryVaultKey
        )

        let saved
        if (id) {
          saved = await IrisApi.updateCipher(id, {
            type,
            encryptedTitle,
            encryptedData,
            folderId,
            favorite,
          })
        } else {
          saved = await IrisApi.createCipher({
            type,
            encryptedTitle,
            encryptedData,
            folderId,
            favorite,
          })
        }

        // Force fresh sync on modify
        await syncVault({ force: true })
        sendResponse({ success: true, cipher: saved })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 9b. Delete or Trash Credential
  if (action === "DELETE_CIPHER") {
    ; (async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        await ensureVaultActive()
        if (!inMemoryVaultKey) throw new Error("Vault is locked")
        const { id } = payload
        if (!id) throw new Error("Item ID is required")

        await IrisApi.deleteCipher(id)
        await syncVault({ force: true })
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 9c. Get single cipher by ID
  if (action === "GET_CIPHER_BY_ID") {
    ; (async () => {
      if (!isPrivilegedSender(sender)) {
        sendResponse({ success: false, cipher: null, error: "Access denied" })
        return
      }
      await ensureVaultActive()
      const { id } = payload
      const cipher = inMemoryCiphers.find((c) => c.id === id)
      sendResponse({ success: Boolean(cipher), cipher: cipher || null })
    })()
    return true
  }

  // -----------------------------------------------------------
  // Passkey Cryptography & WebAuthn Helpers (Background Worker)
  // -----------------------------------------------------------
  function bufferToBase64Url(buf) {
    if (!buf) return ""
    let bytes
    if (buf instanceof Uint8Array) {
      bytes = buf
    } else if (ArrayBuffer.isView(buf)) {
      bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    } else if (buf instanceof ArrayBuffer) {
      bytes = new Uint8Array(buf)
    } else if (typeof buf === "string") {
      return buf
    } else {
      try {
        bytes = new Uint8Array(buf)
      } catch {
        return ""
      }
    }
    let binary = ""
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  }

  function base64UrlToBuffer(str) {
    if (!str) return new ArrayBuffer(0)
    const base64 =
      str.replace(/-/g, "+").replace(/_/g, "/") +
      "==".slice(0, (4 - (str.length % 4)) % 4)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  function encodeCborAttestation(authData) {
    const parts = []
    parts.push(0xa3) // map(3)

    // "fmt": "none"
    parts.push(0x63, 0x66, 0x6d, 0x74) // key "fmt"
    parts.push(0x64, 0x6e, 0x6f, 0x6e, 0x65) // val "none"

    // "attStmt": {}
    parts.push(0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74) // key "attStmt"
    parts.push(0xa0) // empty map

    // "authData": bytes
    parts.push(0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61) // key "authData"
    if (authData.length < 256) {
      parts.push(0x58, authData.length)
    } else {
      parts.push(0x59, (authData.length >> 8) & 0xff, authData.length & 0xff)
    }
    for (let i = 0; i < authData.length; i++) {
      parts.push(authData[i])
    }

    return new Uint8Array(parts).buffer
  }

  function rawToDerSignature(rawSig) {
    const r = rawSig.slice(0, 32)
    const s = rawSig.slice(32, 64)

    function trimLeadingZeros(arr) {
      let i = 0
      while (i < arr.length - 1 && arr[i] === 0) i++
      return arr.slice(i)
    }

    let rTrim = trimLeadingZeros(r)
    let sTrim = trimLeadingZeros(s)

    if (rTrim[0] & 0x80) {
      const padded = new Uint8Array(rTrim.length + 1)
      padded.set(rTrim, 1)
      rTrim = padded
    }
    if (sTrim[0] & 0x80) {
      const padded = new Uint8Array(sTrim.length + 1)
      padded.set(sTrim, 1)
      sTrim = padded
    }

    const totalLen = 2 + rTrim.length + 2 + sTrim.length
    const der = new Uint8Array(2 + totalLen)
    let offset = 0

    der[offset++] = 0x30 // SEQUENCE
    der[offset++] = totalLen
    der[offset++] = 0x02 // INTEGER (r)
    der[offset++] = rTrim.length
    der.set(rTrim, offset)
    offset += rTrim.length
    der[offset++] = 0x02 // INTEGER (s)
    der[offset++] = sTrim.length
    der.set(sTrim, offset)

    return der
  }

  // 10. Passkey: Discover matching credentials for relying party
  if (action === "PASSKEY_GET_CREDENTIALS") {
    ; (async () => {
      try {
        await ensureVaultActive()
        if (!inMemoryVaultKey) {
          sendResponse({
            success: false,
            isUnlocked: false,
            credentials: [],
            passkeys: [],
            error: "Vault is locked",
          })
          return
        }

        const callerUrl = sender.tab?.url || sender?.url || payload?.url || ""
        const callerHost = IrisMatching.extractHost(callerUrl)
        if (!callerHost) {
          sendResponse({ success: false, credentials: [], passkeys: [] })
          return
        }

        const allowedIds =
          Array.isArray(payload?.allowCredentials) &&
          payload.allowCredentials.length > 0
            ? payload.allowCredentials.map((c) =>
                typeof c === "string" ? c : c.id
              )
            : null

        let matched = []
        for (const cipher of inMemoryCiphers) {
          if (cipher.deletedAt || cipher.type !== "LOGIN") continue
          const passkey = cipher.data?.passkey
          if (!passkey) continue

          const effectiveRpId = passkey.rpId
          if (
            effectiveRpId &&
            IrisMatching.isUriMatch(callerUrl, effectiveRpId, 0)
          ) {
            if (allowedIds && !allowedIds.includes(passkey.credentialId)) {
              continue
            }
            matched.push({
              id: passkey.credentialId,
              credentialId: passkey.credentialId,
              rawId: passkey.credentialId,
              type: "public-key",
              userName: passkey.userName || cipher.data?.username || "Account",
              userDisplayName:
                passkey.userDisplayName ||
                cipher.title ||
                cipher.data?.username ||
                "Account",
              userHandle: passkey.userHandle || "",
              cipherId: cipher.id,
              cipherTitle: cipher.title || "Passkey",
              title: cipher.title || passkey.userName || "Passkey",
            })
          }
        }

        // If allowCredentials filtering resulted in 0 matches, fallback to all RP matches
        if (matched.length === 0 && allowedIds) {
          for (const cipher of inMemoryCiphers) {
            if (cipher.deletedAt || cipher.type !== "LOGIN") continue
            const passkey = cipher.data?.passkey
            if (!passkey) continue

            const effectiveRpId = passkey.rpId
            if (
              effectiveRpId &&
              IrisMatching.isUriMatch(callerUrl, effectiveRpId, 0)
            ) {
              matched.push({
                id: passkey.credentialId,
                credentialId: passkey.credentialId,
                rawId: passkey.credentialId,
                type: "public-key",
                userName: passkey.userName || cipher.data?.username || "Account",
                userDisplayName:
                  passkey.userDisplayName ||
                  cipher.title ||
                  cipher.data?.username ||
                  "Account",
                userHandle: passkey.userHandle || "",
                cipherId: cipher.id,
                cipherTitle: cipher.title || "Passkey",
                title: cipher.title || passkey.userName || "Passkey",
              })
            }
          }
        }

        sendResponse({
          success: true,
          isUnlocked: true,
          credentials: matched,
          passkeys: matched,
        })
      } catch (err) {
        sendResponse({
          success: false,
          credentials: [],
          passkeys: [],
          error: err.message,
        })
      }
    })()
    return true
  }

  // 11. Passkey: Register new credential for relying party
  if (action === "PASSKEY_CREATE_CREDENTIAL") {
    ; (async () => {
      try {
        await ensureVaultActive()
        if (!inMemoryVaultKey) {
          throw new Error("Vault is locked. Please unlock IRIS Pass first.")
        }

        const callerUrl = sender.tab?.url || sender?.url || payload?.url || ""
        const callerHost = IrisMatching.extractHost(callerUrl)
        if (!callerHost) throw new Error("Untrusted sender context")

        const {
          rpId,
          rpName,
          userId,
          userName,
          userDisplayName,
          challenge,
          pubKeyCredParams,
        } = payload || {}

        const effectiveRpId = rpId || callerHost
        if (!IrisMatching.isUriMatch(callerUrl, effectiveRpId, 0)) {
          throw new Error(
            `Cannot register passkey: Caller domain ${callerHost} is not authorized for RP ID ${effectiveRpId}`
          )
        }

        // 1. Generate P-256 ECDSA key pair
        const keyPair = await crypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["sign", "verify"]
        )

        // Export public key to SPKI buffer and JWKs
        const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey)
        const privJwk = await crypto.subtle.exportKey(
          "jwk",
          keyPair.privateKey
        )
        const pubJwk = await crypto.subtle.exportKey(
          "jwk",
          keyPair.publicKey
        )

        // Extract raw 32-byte X and Y coordinates for COSE_Key
        const xBytes = new Uint8Array(base64UrlToBuffer(pubJwk.x))
        const yBytes = new Uint8Array(base64UrlToBuffer(pubJwk.y))

        // Construct COSE_Key for ES256 (CBOR map with 5 elements)
        // 1 (kty): 2 (EC2)       -> 0x01, 0x02
        // 3 (alg): -7 (ES256)    -> 0x03, 0x26 (-1 - 6 = -7 in CBOR)
        // -1 (crv): 1 (P-256)    -> 0x20, 0x01 (-1 - 0 = -1 in CBOR)
        // -2 (x): 32 bytes       -> 0x21, 0x58, 0x20, ...xBytes
        // -3 (y): 32 bytes       -> 0x22, 0x58, 0x20, ...yBytes
        const coseKey = new Uint8Array([
          0xa5,
          0x01, 0x02,
          0x03, 0x26,
          0x20, 0x01,
          0x21, 0x58, 0x20, ...xBytes,
          0x22, 0x58, 0x20, ...yBytes,
        ])

        // 2. Derive Credential ID (random 32 bytes)
        const credIdBytes = crypto.getRandomValues(new Uint8Array(32))
        const credIdB64 = bufferToBase64Url(credIdBytes)

        // 3. Construct clientDataJSON
        const origin = callerUrl
          ? new URL(callerUrl).origin
          : "https://" + effectiveRpId
        const clientDataObj = {
          type: "webauthn.create",
          challenge: challenge,
          origin: origin,
          crossOrigin: false,
        }
        const clientDataJSON = new TextEncoder().encode(
          JSON.stringify(clientDataObj)
        )

        // 4. Construct AuthenticatorData
        const rpIdHashBuf = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(effectiveRpId)
        )
        const rpIdHash = new Uint8Array(rpIdHashBuf)
        const flags = 0x45 // UP=1, UV=1, AT=1
        const signCount = new Uint8Array([0, 0, 0, 0])
        const aaguid = new Uint8Array(16) // zero AAGUID for software authenticator
        const credIdLen = new Uint8Array([
          (credIdBytes.length >> 8) & 0xff,
          credIdBytes.length & 0xff,
        ])

        const authData = new Uint8Array([
          ...rpIdHash,
          flags,
          ...signCount,
          ...aaguid,
          ...credIdLen,
          ...credIdBytes,
          ...coseKey,
        ])

        // 5. Construct Attestation Object (CBOR)
        const attestationObject = encodeCborAttestation(authData)

        // 6. Save Passkey directly inside IRIS Vault
        const passkeyData = {
          credentialId: credIdB64,
          rpId: effectiveRpId,
          rpName: rpName || effectiveRpId,
          userName: userName || userDisplayName || "User",
          userDisplayName: userDisplayName || userName || "User",
          userHandle: userId || "",
          privateKey: privJwk,
          publicKeySpki: bufferToBase64Url(spki),
          signCount: 0,
          createdAt: new Date().toISOString(),
        }

        // Check if there is an existing cipher for this RP & user
        let targetCipher = inMemoryCiphers.find(
          (c) =>
            !c.deletedAt &&
            c.type === "LOGIN" &&
            c.data?.username === userName &&
            c.data?.uris?.some((u) => {
              const uStr = typeof u === "string" ? u : u.uri
              return IrisMatching.isUriMatch(callerUrl, uStr, 0)
            })
        )

        if (targetCipher) {
          const updatedData = {
            ...targetCipher.data,
            passkey: passkeyData,
          }
          const encTitle = await IrisCrypto.encryptVaultData(
            targetCipher.title,
            inMemoryVaultKey
          )
          const encData = await IrisCrypto.encryptVaultObject(
            updatedData,
            inMemoryVaultKey
          )
          await IrisApi.updateCipher(targetCipher.id, {
            type: targetCipher.type,
            encryptedTitle: encTitle,
            encryptedData: encData,
            folderId: targetCipher.folderId,
            favorite: targetCipher.favorite,
          })
        } else {
          const title = rpName || effectiveRpId
          const data = {
            username: userName || "Account",
            uris: callerUrl ? [{ uri: callerUrl, match: 0 }] : [],
            passkey: passkeyData,
          }
          const encTitle = await IrisCrypto.encryptVaultData(
            title,
            inMemoryVaultKey
          )
          const encData = await IrisCrypto.encryptVaultObject(
            data,
            inMemoryVaultKey
          )
          await IrisApi.createCipher({
            type: "LOGIN",
            encryptedTitle: encTitle,
            encryptedData: encData,
          })
        }

        await syncVault({ force: true })

        sendResponse({
          success: true,
          credential: {
            id: credIdB64,
            rawId: credIdB64,
            clientDataJSON: bufferToBase64Url(clientDataJSON),
            attestationObject: bufferToBase64Url(attestationObject),
            authenticatorData: bufferToBase64Url(authData),
            spki: bufferToBase64Url(spki),
          },
        })
      } catch (err) {
        console.error("[IRIS Pass] Passkey creation error in background:", err)
        sendResponse({
          success: false,
          error: err.message || "Failed to create passkey",
        })
      }
    })()
    return true
  }

  // 12. Passkey: Sign assertion with stored private key
  if (action === "PASSKEY_SIGN_ASSERTION") {
    ; (async () => {
      try {
        await ensureVaultActive()
        if (!inMemoryVaultKey)
          throw new Error("Vault is locked. Please unlock IRIS Pass.")

        const callerUrl = sender.tab?.url || sender?.url || payload?.url || ""
        const callerHost = IrisMatching.extractHost(callerUrl)
        if (!callerHost) throw new Error("Untrusted sender context")

        const { credentialId, challenge } = payload || {}
        if (!credentialId) throw new Error("Missing credential ID")

        // Find passkey in vault
        let matchedPasskey = null
        let matchedCipher = null
        for (const c of inMemoryCiphers) {
          if (c.deletedAt || c.type !== "LOGIN") continue
          if (c.data?.passkey?.credentialId === credentialId) {
            matchedPasskey = c.data.passkey
            matchedCipher = c
            break
          }
        }

        if (!matchedPasskey) {
          throw new Error("Passkey not found in vault")
        }

        // Enforce that caller host matches the passkey's registered RP ID
        const effectiveRpId = matchedPasskey.rpId
        if (!effectiveRpId || !IrisMatching.isUriMatch(callerUrl, effectiveRpId, 0)) {
          throw new Error(`Relying party mismatch: Passkey is registered to ${effectiveRpId}, but assertion was requested by ${callerHost}`)
        }

        const effectiveOrigin = callerUrl ? new URL(callerUrl).origin : ("https://" + effectiveRpId)

        const enc = new TextEncoder()

        // 1. Construct clientDataJSON
        const clientDataObj = {
          type: "webauthn.get",
          challenge: challenge,
          origin: effectiveOrigin,
          crossOrigin: false,
        }
        const clientDataJSON = enc.encode(JSON.stringify(clientDataObj))

        // 2. Hash clientDataJSON
        const clientDataHashBuf = await crypto.subtle.digest(
          "SHA-256",
          clientDataJSON
        )
        const clientDataHash = new Uint8Array(clientDataHashBuf)

        // 3. Construct AuthenticatorData (UP=1, UV=1, BE=1, BS=1 -> flags=0x1d)
        const rpIdHashBuf = await crypto.subtle.digest(
          "SHA-256",
          enc.encode(effectiveRpId)
        )
        const rpIdHash = new Uint8Array(rpIdHashBuf)
        const flags = 0x1d

        // Monotonic sign counter
        matchedPasskey.signCount = (matchedPasskey.signCount || 0) + 1
        const signCount = matchedPasskey.signCount
        const signCountBytes = [
          (signCount >>> 24) & 0xff,
          (signCount >>> 16) & 0xff,
          (signCount >>> 8) & 0xff,
          signCount & 0xff,
        ]
        const authData = new Uint8Array([
          ...rpIdHash,
          flags,
          ...signCountBytes,
        ])

        // 4. Sign authData || clientDataHash with stored private key
        const signData = new Uint8Array([...authData, ...clientDataHash])
        const privKey = await crypto.subtle.importKey(
          "jwk",
          matchedPasskey.privateKey,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"]
        )
        const rawSig = await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          privKey,
          signData
        )
        const derSig = rawToDerSignature(new Uint8Array(rawSig))

        sendResponse({
          success: true,
          credential: {
            id: matchedPasskey.credentialId,
            rawId: matchedPasskey.credentialId,
            clientDataJSON: bufferToBase64Url(clientDataJSON),
            authenticatorData: bufferToBase64Url(authData),
            signature: bufferToBase64Url(derSig),
            userHandle: matchedPasskey.userHandle || "",
          },
          userName: matchedPasskey.userName,
        })
      } catch (err) {
        console.error("[IRIS Pass] Passkey assertion error in background:", err)
        sendResponse({
          success: false,
          error: err.message || "Failed to sign passkey assertion",
        })
      }
    })()
    return true
  }
})

// Listen to tab events to update action badge
ext.tabs.onActivated.addListener(updateBadge)
ext.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    updateBadge()
  }
})

// Auto re-inject content scripts into already-open tabs when the extension is updated or reloaded
ext.runtime.onInstalled?.addListener(async () => {
  try {
    const tabs = await ext.tabs.query({ url: ["http://*/*", "https://*/*"] })
    for (const tab of tabs) {
      if (!tab.id) continue
      try {
        if (ext.scripting?.executeScript) {
          await ext.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ["content/passkey-injected.js"],
            world: "MAIN",
          })
          await ext.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ["content/content.js"],
          })
        }
      } catch {
        // Tab might be restricted (e.g. browser internal or store pages)
      }
    }
  } catch (err) {
    console.warn("[IRIS Pass] Auto re-inject tabs warning:", err)
  }
})

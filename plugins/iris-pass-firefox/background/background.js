/**
 * IRIS Pass — Background Service Worker & Vault Manager
 */

// Universal browser API shim (Firefox & Chromium compatible)
const ext = typeof browser !== "undefined" ? browser : chrome

// In-memory vault state (strictly zero-history, wiped on lock or restart)
let inMemoryVaultKey = null
let inMemoryCiphers = []
let inMemoryFolders = []
let autoLockTimer = null

/**
 * Helper: ensure vault is unlocked or restored from session storage
 */
async function ensureVaultActive() {
  if (inMemoryVaultKey) {
    return true
  }

  if (ext.storage?.session) {
    try {
      const sessionData = await ext.storage.session.get([
        "vaultKeyHex",
        "lastActive",
      ])
      if (sessionData?.vaultKeyHex) {
        const settings = await ext.storage.local.get(["autoLockMinutes"])
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
        await fetchAndDecryptVault(inMemoryVaultKey)
        await resetAutoLock()
        return true
      }
    } catch (err) {
      console.warn("[IRIS Pass] Session restore error:", err)
    }
  }

  return false
}

/**
 * Reset auto-lock timer based on settings
 */
async function resetAutoLock() {
  if (autoLockTimer) clearTimeout(autoLockTimer)

  const settings = await ext.storage.local.get(["autoLockMinutes"])
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

  // 3. Fetch and decrypt vault items
  await fetchAndDecryptVault(inMemoryVaultKey)
  await resetAutoLock()
}

/**
 * Fetch and decrypt vault data from backend
 */
async function fetchAndDecryptVault(vaultKey) {
  const ciphersRes = await IrisApi.fetchCiphers()
  const rawCiphers = ciphersRes?.ciphers || ciphersRes?.data?.ciphers || []

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
      console.warn("[IRIS Pass] Skipped un-decryptable cipher:", c.id)
    }
  }

  inMemoryCiphers = decryptedList

  try {
    const foldersRes = await IrisApi.fetchFolders()
    const rawFolders = foldersRes?.folders || foldersRes?.data?.folders || []
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
  } catch (err) {
    inMemoryFolders = []
  }

  updateBadge()
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
      const storage = await ext.storage.local.get(["user"])
      let user = storage.user || null

      if (!authToken && !apiKey) {
        sendResponse({
          isAuthenticated: false,
          isUnlocked: false,
          serverUrl,
          user: null,
          cipherCount: 0,
        })
        return
      }

      // If token exists, verify with server if user not cached
      if (!user) {
        const auth = await IrisApi.checkAuth()
        if (auth.authenticated) {
          user = auth.user
          await ext.storage.local.set({ user })
        } else {
          // Token is invalid/expired
          await IrisApi.logout()
          sendResponse({
            isAuthenticated: false,
            isUnlocked: false,
            serverUrl,
            user: null,
            cipherCount: 0,
          })
          return
        }
      }

      sendResponse({
        isAuthenticated: true,
        isUnlocked: Boolean(inMemoryVaultKey),
        user,
        serverUrl,
        cipherCount: inMemoryCiphers.length,
      })
    })()
    return true
  }

  // 2. Log in with Username/Email & Password
  if (action === "LOGIN") {
    ; (async () => {
      try {
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

  // 4. Log Out
  if (action === "LOGOUT") {
    ; (async () => {
      lockVault()
      await IrisApi.logout()
      sendResponse({ success: true })
    })()
    return true
  }

  // 5. Lock Vault
  if (action === "LOCK_VAULT") {
    lockVault()
    sendResponse({ success: true })
    return true
  }

  // 6. Get Matching Logins for a URL
  if (action === "GET_MATCHING_LOGINS") {
    ; (async () => {
      await ensureVaultActive()
      resetAutoLock()
      const targetUrl = payload?.url
      const matches = getMatchingLogins(targetUrl)
      sendResponse({ matches, isUnlocked: Boolean(inMemoryVaultKey) })
    })()
    return true
  }

  // 7. Get All Ciphers (for popup search)
  if (action === "GET_ALL_CIPHERS") {
    ; (async () => {
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

        const targetTabId =
          tabId ||
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

        // Auto-copy TOTP to clipboard if present
        if (cipher.data?.totpSecret) {
          const otp = await IrisTotp.generateTotp(cipher.data.totpSecret)
          if (otp) {
            ext.tabs.sendMessage(targetTabId, {
              action: "COPY_TO_CLIPBOARD",
              payload: { text: otp, label: "TOTP 2FA code" },
            })
          }
        }

        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 9. Save or Update Credential
  if (action === "SAVE_CIPHER") {
    ; (async () => {
      try {
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

        await fetchAndDecryptVault(inMemoryVaultKey)
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
        await ensureVaultActive()
        if (!inMemoryVaultKey) throw new Error("Vault is locked")
        const { id } = payload
        if (!id) throw new Error("Item ID is required")

        await IrisApi.deleteCipher(id)
        await fetchAndDecryptVault(inMemoryVaultKey)
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
      await ensureVaultActive()
      const { id } = payload
      const cipher = inMemoryCiphers.find((c) => c.id === id)
      sendResponse({ success: Boolean(cipher), cipher: cipher || null })
    })()
    return true
  }

  // ---------------------------------------------------------------------------
  // Passkey Cryptography & WebAuthn Helpers (Background Worker Realm)
  // ---------------------------------------------------------------------------
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
    // 'fmt': 'none'
    parts.push(0x63, 0x66, 0x6d, 0x74)
    parts.push(0x64, 0x6e, 0x6f, 0x6e, 0x65)
    // 'attStmt': {}
    parts.push(0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74)
    parts.push(0xa0)
    // 'authData': bytes
    parts.push(0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61)
    if (authData.length < 256) {
      parts.push(0x58, authData.length)
    } else {
      parts.push(0x59, (authData.length >> 8) & 0xff, authData.length & 0xff)
    }
    for (let i = 0; i < authData.length; i++) parts.push(authData[i])
    return new Uint8Array(parts)
  }

  function rawToDerSignature(rawSig) {
    const r = rawSig.slice(0, 32)
    const s = rawSig.slice(32, 64)

    function encodeDerInt(bytes) {
      let start = 0
      while (start < bytes.length - 1 && bytes[start] === 0) {
        start++
      }
      const sliced = bytes.slice(start)
      if (sliced[0] & 0x80) {
        const out = new Uint8Array(sliced.length + 3)
        out[0] = 0x02
        out[1] = sliced.length + 1
        out[2] = 0x00
        out.set(sliced, 3)
        return out
      }
      const out = new Uint8Array(sliced.length + 2)
      out[0] = 0x02
      out[1] = sliced.length
      out.set(sliced, 2)
      return out
    }

    const rDer = encodeDerInt(r)
    const sDer = encodeDerInt(s)
    const totalLen = rDer.length + sDer.length
    const res = new Uint8Array(2 + totalLen)
    res[0] = 0x30
    res[1] = totalLen
    res.set(rDer, 2)
    res.set(sDer, 2 + rDer.length)
    return res
  }

  // 10. Passkey: Find passkeys for RP ID & allowed credentials
  if (action === "PASSKEY_GET_CREDENTIALS") {
    ; (async () => {
      await ensureVaultActive()
      const { rpId, url, allowCredentials } = payload || {}
      const matchingPasskeys = []
      const allowedIds = Array.isArray(allowCredentials)
        ? allowCredentials
          .map((c) => (typeof c === "string" ? c : c?.id))
          .filter(Boolean)
        : []

      for (const c of inMemoryCiphers) {
        if (c.deletedAt || c.type !== "LOGIN") continue
        const pk = c.data?.passkey
        if (!pk) continue

        // If website restricted credentials with allowCredentials, only allow matching credential IDs
        if (allowedIds.length > 0) {
          if (!allowedIds.includes(pk.credentialId)) {
            continue
          }
        }

        let isMatch = false
        if (rpId && pk.rpId === rpId) isMatch = true
        if (!isMatch && url) {
          const uris = c.data?.uris || []
          isMatch = uris.some((u) =>
            IrisMatching.isUriMatch(url, typeof u === "string" ? u : u.uri)
          )
        }
        if (!isMatch && !rpId && !url) isMatch = true

        if (isMatch) {
          matchingPasskeys.push({
            cipherId: c.id,
            title: c.title,
            userName: pk.userName || c.data?.username || "Passkey",
            userHandle: pk.userHandle || "",
            credentialId: pk.credentialId,
            rpId: pk.rpId,
          })
        }
      }

      sendResponse({
        passkeys: matchingPasskeys,
        isUnlocked: Boolean(inMemoryVaultKey),
      })
    })()
    return true
  }

  // 11. Passkey: Generate keypair, encode attestation, and save to vault
  if (action === "PASSKEY_CREATE_CREDENTIAL") {
    ; (async () => {
      try {
        await ensureVaultActive()
        if (!inMemoryVaultKey)
          throw new Error("Vault is locked. Please unlock IRIS Pass.")

        const {
          rpId,
          rpName,
          userName,
          userDisplayName,
          userId,
          challenge,
          origin,
          url,
          targetCipherId,
        } = payload || {}

        if (!rpId) throw new Error("Missing relying party identifier (rpId)")

        // 1. Generate native ECDSA P-256 key pair in background worker
        const keyPair = await crypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["sign", "verify"]
        )

        const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey)
        const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey)
        const rawPub = await crypto.subtle.exportKey("raw", keyPair.publicKey)
        const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey)

        const rawPubBytes = new Uint8Array(rawPub)
        const xBytes = rawPubBytes.slice(1, 33)
        const yBytes = rawPubBytes.slice(33, 65)

        // 2. Generate random 32-byte Credential ID
        const credIdBytes = crypto.getRandomValues(new Uint8Array(32))
        const credIdB64 = bufferToBase64Url(credIdBytes)

        // 3. Compute SHA-256 RP ID Hash
        const enc = new TextEncoder()
        const rpIdHashBuf = await crypto.subtle.digest(
          "SHA-256",
          enc.encode(rpId)
        )
        const rpIdHash = new Uint8Array(rpIdHashBuf)

        // 4. Construct COSE Key (77 bytes: ES256 / P-256)
        const cose = [
          0xa5,
          0x01,
          0x02,
          0x03,
          0x26,
          0x20,
          0x01,
          0x21,
          0x58,
          0x20,
          ...xBytes,
          0x22,
          0x58,
          0x20,
          ...yBytes,
        ]

        // 5. Construct Authenticator Data
        const flags = 0x5d // UP (1) + UV (4) + BE (8) + BS (16) + AT (64)
        const aaguid = new Uint8Array(16) // all zeroes
        const authDataParts = [
          ...rpIdHash,
          flags,
          0x00,
          0x00,
          0x00,
          0x00, // Sign count
          ...aaguid,
          0x00,
          0x20, // Credential ID length: 32 bytes
          ...credIdBytes,
          ...cose,
        ]
        const authData = new Uint8Array(authDataParts)

        // 6. Encode CBOR Attestation Object
        const attestationObject = encodeCborAttestation(authData)

        // 7. Construct ClientDataJSON
        const clientDataObj = {
          type: "webauthn.create",
          challenge: challenge,
          origin: origin || (url ? new URL(url).origin : "https://" + rpId),
          crossOrigin: false,
        }
        const clientDataJSON = enc.encode(JSON.stringify(clientDataObj))

        // 8. Save credential zero-knowledge into vault cipher
        const passkeyData = {
          credentialId: credIdB64,
          rpId,
          userName: userName || "Account",
          userHandle: userId || "",
          privateKey: privJwk,
          publicKey: jwk,
          createdAt: new Date().toISOString(),
        }

        let targetCipher = null
        if (targetCipherId && targetCipherId !== "new") {
          targetCipher = inMemoryCiphers.find((c) => c.id === targetCipherId)
        } else if (targetCipherId !== "new" && url) {
          targetCipher = inMemoryCiphers.find((c) => {
            if (c.deletedAt || c.type !== "LOGIN") return false
            return (c.data?.uris || []).some((u) =>
              IrisMatching.isUriMatch(url, typeof u === "string" ? u : u.uri)
            )
          })
        }

        if (targetCipher) {
          targetCipher.data = targetCipher.data || {}
          targetCipher.data.passkey = passkeyData
          if (!targetCipher.data.username && userName) {
            targetCipher.data.username = userName
          }
          const encTitle = await IrisCrypto.encryptVaultData(
            targetCipher.title,
            inMemoryVaultKey
          )
          const encData = await IrisCrypto.encryptVaultObject(
            targetCipher.data,
            inMemoryVaultKey
          )
          await IrisApi.updateCipher(targetCipher.id, {
            encryptedTitle: encTitle,
            encryptedData: encData,
          })
        } else {
          const title =
            rpName || rpId || IrisMatching.extractBaseDomain(url) || "Passkey"
          const data = {
            username: userName || "Account",
            uris: url ? [{ uri: url, match: 0 }] : [],
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

        await fetchAndDecryptVault(inMemoryVaultKey)

        sendResponse({
          success: true,
          credential: {
            id: credIdB64,
            rawId: credIdB64,
            clientDataJSON: bufferToBase64Url(clientDataJSON),
            attestationObject: bufferToBase64Url(attestationObject),
            spki: bufferToBase64Url(spki),
            authDataOffset: 30,
            authDataLength: authData.length,
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

        const { credentialId, rpId, challenge, origin, url } = payload || {}
        if (!credentialId) throw new Error("Missing credential ID")

        // Find passkey in vault
        let matchedPasskey = null
        for (const c of inMemoryCiphers) {
          if (c.deletedAt || c.type !== "LOGIN") continue
          if (c.data?.passkey?.credentialId === credentialId) {
            matchedPasskey = c.data.passkey
            break
          }
        }

        if (!matchedPasskey) {
          throw new Error("Passkey not found in vault")
        }

        const enc = new TextEncoder()

        // 1. Construct clientDataJSON
        const clientDataObj = {
          type: "webauthn.get",
          challenge: challenge,
          origin: origin || (url ? new URL(url).origin : "https://" + rpId),
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
        const effectiveRpId = rpId || matchedPasskey.rpId
        const rpIdHashBuf = await crypto.subtle.digest(
          "SHA-256",
          enc.encode(effectiveRpId)
        )
        const rpIdHash = new Uint8Array(rpIdHashBuf)
        const flags = 0x1d
        const signCount = Math.floor(Date.now() / 1000)
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

// Keyboard shortcuts
ext.commands.onCommand.addListener(async (command) => {
  if (command === "autofill_credential") {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]
    if (!activeTab?.url) return

    const matches = getMatchingLogins(activeTab.url)
    if (matches.length > 0) {
      const bestMatch = matches[0]
      await ext.tabs.sendMessage(activeTab.id, {
        action: "FILL_INPUTS",
        payload: {
          username: bestMatch.data?.username || "",
          password: bestMatch.data?.password || "",
        },
      })

      if (bestMatch.data?.totpSecret) {
        const otp = await IrisTotp.generateTotp(bestMatch.data.totpSecret)
        if (otp) {
          ext.tabs.sendMessage(activeTab.id, {
            action: "COPY_TO_CLIPBOARD",
            payload: { text: otp, label: "TOTP 2FA code" },
          })
        }
      }
    }
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


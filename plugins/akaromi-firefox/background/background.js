/**
 * Akaromi for Firefox — Background Message Dispatcher & Lifecycle Coordinator
 */

// PIN brute-force defense state
let pinFailedAttempts = 0
let pinLockoutUntil = 0

/**
 * Schedules wiping sensitive text from system clipboard after specified seconds
 */
function scheduleClipboardWipe(text, seconds = 30) {
  if (!text || !seconds || seconds <= 0) return
  if (clipboardClearTimer) clearTimeout(clipboardClearTimer)
  clipboardClearTimer = setTimeout(async () => {
    try {
      let cleared = false
      try {
        if (typeof document !== "undefined" && document.createElement) {
          const ta = document.createElement("textarea")
          ta.value = ""
          ta.style.position = "fixed"
          ta.style.opacity = "0"
          document.body.appendChild(ta)
          ta.focus()
          ta.select()
          cleared = document.execCommand("copy")
          ta.remove()
        }
      } catch (e) {}

      if (!cleared && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText("").catch(() => {})
      }

      try {
        const tabs = await ext.tabs.query({ active: true, lastFocusedWindow: true })
        const activeTab = tabs[0] || (await ext.tabs.query({ active: true }))[0]
        if (activeTab?.id) {
          ext.tabs.sendMessage(activeTab.id, {
            action: "CLEAR_CLIPBOARD_IF_MATCHES",
            payload: { text },
          }).catch(() => {})
        }
      } catch (e) {}
    } catch (e) {
      console.warn("[Akaromi] Clipboard clear timer error:", e)
    }
  }, seconds * 1000)
}

/**
 * Message Handler
 */
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, payload } = message

  // 1. Vault & Auth Status
  if (action === "GET_STATUS") {
    ;(async () => {
      await ensureVaultActive()
      const { authToken, apiKey } = await IrisApi.getToken()
      const serverUrl = await IrisApi.getServerUrl()
      const sData = await storage.get([
        "user",
        "pinUnlockEnabled",
        "lastSyncTimestamp",
        "clipboardClearSeconds",
        "isDefaultPasswordManager",
        "autoLockMinutes",
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
          lastSyncTimestamp: sData.lastSyncTimestamp || 0,
          clipboardClearSeconds: sData.clipboardClearSeconds ?? 30,
          isDefaultPasswordManager: Boolean(sData.isDefaultPasswordManager),
          autoLockMinutes: sData.autoLockMinutes !== undefined ? sData.autoLockMinutes : 15,
        })
        return
      }

      // If token exists, verify with server if user not cached or missing customization
      const profile = user?.customization?.profile
      if (!user || !user.customization || !profile || !profile.displayNameStyle) {
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
              lastSyncTimestamp: 0,
              clipboardClearSeconds: 30,
              isDefaultPasswordManager: false,
              autoLockMinutes: 15,
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
        lastSyncTimestamp: sData.lastSyncTimestamp || 0,
        clipboardClearSeconds: sData.clipboardClearSeconds ?? 30,
        isDefaultPasswordManager: Boolean(sData.isDefaultPasswordManager),
        autoLockMinutes: sData.autoLockMinutes !== undefined ? sData.autoLockMinutes : 15,
      })
    })()
    return true
  }

  // 2. Log in with Username/Email & Password
  if (action === "LOGIN") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { identifier, password, serverUrl } = payload
        if (!identifier || !password) throw new Error("Username/email and password required")

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
          pinFailedAttempts = 0
          pinLockoutUntil = 0
        } catch (vaultErr) {
          console.warn("[Akaromi] Account logged in, but vault requires setup or unlock:", vaultErr)
        }

        sendResponse({
          success: true,
          user: loginData.user,
          isUnlocked: Boolean(inMemoryVaultKey),
        })
      } catch (err) {
        console.error("[Akaromi] Login error:", err)
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
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { mfaTicket, code, mfaType = "totp", password } = payload
        if (!mfaTicket || !code) throw new Error("Verification code is required")

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
            console.warn("[Akaromi] MFA verified, but vault requires separate password:", vaultErr)
          }
        }

        sendResponse({
          success: true,
          user: mfaData.user,
          isUnlocked: Boolean(inMemoryVaultKey),
        })
      } catch (err) {
        console.error("[Akaromi] MFA verification error:", err)
        sendResponse({
          success: false,
          error: err.message || "Failed to verify 2FA code",
        })
      }
    })()
    return true
  }

  // 2b-2. Send / resend MFA Email verification code
  if (action === "SEND_MFA_EMAIL") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { mfaTicket } = payload || {}
        if (!mfaTicket) throw new Error("MFA ticket is required")
        const res = await IrisApi.sendMfaEmail(mfaTicket)
        sendResponse({ success: true, ...res })
      } catch (err) {
        console.error("[Akaromi] Send MFA email error:", err)
        sendResponse({ success: false, error: err.message || "Failed to send email OTP" })
      }
    })()
    return true
  }

  // 2c. Log in via API Key & Master Password
  if (action === "LOGIN_API_KEY") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { apiKey, masterPassword, accountPassword, serverUrl } = payload
        const pass = accountPassword || masterPassword
        if (!apiKey) throw new Error("API Key is required")
        if (!pass) throw new Error("Account Password is required to unlock your vault")

        if (serverUrl) {
          await IrisApi.setServerUrl(serverUrl)
        }

        // 1. Test & save API key
        const user = await IrisApi.loginWithApiKey(apiKey)

        // 2. Decrypt vault with Account Password
        try {
          await unlockWithPassword(pass)
        } catch (vaultErr) {
          console.warn("[Akaromi] API key valid, but vault unlock failed:", vaultErr)
          throw new Error("API key connected, but Account Password is incorrect for this vault")
        }

        sendResponse({
          success: true,
          user,
          isUnlocked: Boolean(inMemoryVaultKey),
        })
      } catch (err) {
        console.error("[Akaromi] API Key login error:", err)
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
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { password } = payload
        if (!password) throw new Error("Password required")

        await unlockWithPassword(password)
        pinFailedAttempts = 0
        pinLockoutUntil = 0
        sendResponse({ success: true })
      } catch (err) {
        console.error("[Akaromi] Unlock error:", err)
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
    ;(async () => {
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
        console.error("[Akaromi] Setup PIN error:", err)
        sendResponse({ success: false, error: err.message || "Failed to set up PIN" })
      }
    })()
    return true
  }

  // 3c. Unlock Vault with PIN
  if (action === "UNLOCK_WITH_PIN") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { pin } = payload || {}
        if (!pin) throw new Error("PIN is required")

        if (pinLockoutUntil > Date.now()) {
          const remainingSec = Math.ceil((pinLockoutUntil - Date.now()) / 1000)
          throw new Error(`PIN unlock temporarily locked. Please wait ${remainingSec}s.`)
        }

        const sData = await storage.get(["pinUnlockData", "pinUnlockEnabled", "user"])
        if (!sData.pinUnlockEnabled || !sData.pinUnlockData) {
          throw new Error("PIN unlock is not enabled on this device")
        }

        // Decrypt vault key using PIN with rate-limiting & brute-force lockout
        let vaultKey
        try {
          vaultKey = IrisCrypto.unlockWithPin(pin, sData.pinUnlockData)
        } catch (pinErr) {
          pinFailedAttempts++
          if (pinFailedAttempts >= 5) {
            await storage.set({ pinUnlockEnabled: false })
            await storage.remove(["pinUnlockData"])
            pinFailedAttempts = 0
            pinLockoutUntil = 0
            throw new Error("Too many incorrect attempts (5). PIN unlock disabled for security. Please unlock with your account password.")
          } else if (pinFailedAttempts >= 3) {
            pinLockoutUntil = Date.now() + 5000
            throw new Error(`Incorrect PIN (${pinFailedAttempts}/5 attempts). Please wait 5 seconds.`)
          } else {
            throw new Error(`Incorrect PIN (${pinFailedAttempts}/5 attempts)`)
          }
        }

        // Success: reset attempt counters and save to session
        pinFailedAttempts = 0
        pinLockoutUntil = 0
        inMemoryVaultKey = vaultKey

        await saveVaultKeyToSession()

        // Decrypt cached vault ciphers without hitting network
        await decryptCachedVault(inMemoryVaultKey)
        await resetAutoLock()
        checkHourlySyncDue()
        updateBadge()

        sendResponse({ success: true, user: sData.user })
      } catch (err) {
        console.error("[Akaromi] PIN unlock error:", err)
        sendResponse({ success: false, error: err.message || "Incorrect PIN" })
      }
    })()
    return true
  }

  // 3d. Disable PIN Unlock
  if (action === "DISABLE_PIN_UNLOCK") {
    ;(async () => {
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

  // 3h. Sync Now
  if (action === "SYNC_VAULT") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        await ensureVaultActive()
        if (!inMemoryVaultKey) throw new Error("Vault is locked")

        const result = await syncVault({ force: true })
        sendResponse(result)
      } catch (err) {
        console.error("[Akaromi] Manual sync error:", err)
        sendResponse({ success: false, error: err.message || "Failed to sync vault" })
      }
    })()
    return true
  }

  // 3i. Schedule Clipboard Clear
  if (action === "SCHEDULE_CLIPBOARD_CLEAR") {
    ;(async () => {
      try {
        const { text, seconds } = payload || {}
        let sec = seconds
        if (!sec) {
          const s = await storage.get(["clipboardClearSeconds"])
          sec = s.clipboardClearSeconds !== undefined ? Number(s.clipboardClearSeconds) : 30
        }
        if (sec > 0 && text) {
          scheduleClipboardWipe(text, sec)
        }
        sendResponse({ success: true, scheduled: sec > 0, seconds: sec })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3i2. Set Clipboard Clear Timeout Setting
  if (action === "SET_CLIPBOARD_CLEAR_TIMEOUT") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { seconds } = payload || {}
        const parsed = typeof seconds === "number" ? seconds : parseInt(seconds, 10)
        const sec = isNaN(parsed) ? 30 : parsed
        await storage.set({ clipboardClearSeconds: sec })
        sendResponse({ success: true, clipboardClearSeconds: sec })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3j. Default Password Manager Toggle
  if (action === "SET_DEFAULT_PASSWORD_MANAGER" || action === "SET_DEFAULT_PM") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { isDefault } = payload || {}
        await storage.set({ isDefaultPasswordManager: Boolean(isDefault) })

        if (ext.privacy?.services?.passwordSavingEnabled) {
          try {
            await ext.privacy.services.passwordSavingEnabled.set({
              value: !isDefault,
            })
          } catch (e) {
            console.warn("[Akaromi] Could not modify native passwordSavingEnabled:", e)
          }
        }
        if (ext.privacy?.services?.autofillAddressEnabled) {
          try {
            await ext.privacy.services.autofillAddressEnabled.set({
              value: !isDefault,
            })
          } catch (e) {}
        }

        sendResponse({ success: true, isDefault: Boolean(isDefault) })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3k. Set Auto Lock Minutes
  if (action === "SET_AUTO_LOCK") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        const { minutes } = payload || {}
        const parsed = typeof minutes === "number" ? minutes : parseInt(minutes, 10)
        const mins = isNaN(parsed) ? 15 : parsed
        await storage.set({ autoLockMinutes: mins })
        await resetAutoLock()
        sendResponse({ success: true, autoLockMinutes: mins })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 3l. Reset Auto Lock / Activity Ping
  if (action === "RESET_AUTO_LOCK" || action === "PING_ACTIVITY") {
    resetAutoLock().catch(() => {})
    sendResponse({ success: true })
    return true
  }

  // 4. Log Out
  if (action === "LOGOUT") {
    ;(async () => {
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
    ;(async () => {
      await ensureVaultActive()
      resetAutoLock()
      const isPrivileged = isPrivilegedSender(sender)
      let targetUrl = isPrivileged && payload?.url ? payload.url : (sender.url || sender.tab?.url || "")
      if (!targetUrl || targetUrl.startsWith("moz-extension:")) {
        try {
          let tabs = await ext.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => [])
          if (!tabs || tabs.length === 0) {
            tabs = await ext.tabs.query({ active: true, currentWindow: true }).catch(() => [])
          }
          if (!tabs || tabs.length === 0) {
            tabs = await ext.tabs.query({ active: true }).catch(() => [])
          }
          const tab = tabs?.find((t) => t.url && !t.url.startsWith("about:") && !t.url.startsWith("moz-extension:")) || tabs?.[0]
          if (tab?.url) {
            targetUrl = tab.url
          }
        } catch {}
      }
      const matches = getMatchingLogins(targetUrl)

      // Least-Privilege Sanitization for unprivileged webpage content scripts:
      // Expose only safe UI metadata; keep plaintext passwords and TOTP secrets protected in background memory!
      let responseMatches = matches
      if (!isPrivileged) {
        responseMatches = matches.map((c) => ({
          id: c.id,
          title: c.title,
          data: {
            username: c.login?.username || c.data?.username || c.data?.email || "",
            additionalPasswords: (c.data?.additionalPasswords || []).map((ap, idx) => ({
              id: ap.id || String(idx),
              name: ap.name || ap.title || `Password ${idx + 1}`,
            })),
          },
          hasPassword: Boolean(c.login?.password || c.data?.password),
          hasTotp: Boolean(c.login?.totp || c.data?.totp || c.data?.totpSecret),
          hasPasskey: Boolean(c.data?.passkey || c.passkey),
        }))
      }

      sendResponse({ matches: responseMatches, url: targetUrl, isUnlocked: Boolean(inMemoryVaultKey) })
    })()
    return true
  }

  // 6b. Get Decrypted Credential on-demand for Autofill
  if (action === "GET_CREDENTIAL_FOR_AUTOFILL") {
    ;(async () => {
      try {
        await ensureVaultActive()
        resetAutoLock()
        if (!inMemoryVaultKey) throw new Error("Vault is locked")

        const { cipherId, subPasswordId } = payload || {}
        if (!cipherId) throw new Error("cipherId is required")

        // Security check: Verify sender tab matches the cipher's authorized domain
        const isPrivileged = isPrivilegedSender(sender)
        const targetUrl = isPrivileged && payload?.url ? payload.url : (sender.url || sender.tab?.url || "")
        const matching = getMatchingLogins(targetUrl)
        const cipher = matching.find((c) => c.id === cipherId)
        if (!cipher) {
          throw new Error("Cipher does not match current domain or unauthorized")
        }

        let passwordToFill = cipher.login?.password || cipher.data?.password || ""
        if (subPasswordId !== undefined && subPasswordId !== null) {
          const subList = cipher.data?.additionalPasswords || []
          const found = subList.find((p, idx) => (p.id ? p.id === subPasswordId : String(idx) === String(subPasswordId)))
          if (found?.value || found?.password) {
            passwordToFill = found.value || found.password
          }
        }

        const rawTotp =
          cipher.data?.totpSecret ||
          cipher.data?.totp ||
          cipher.data?.totpUri ||
          cipher.data?.otpauth ||
          cipher.totpSecret ||
          cipher.totp ||
          cipher.login?.totp ||
          ""
        const totpSecret = typeof rawTotp === "string" ? rawTotp.trim() : ""

        let generatedTotpCode = ""
        if (totpSecret && typeof IrisTotp !== "undefined" && typeof IrisTotp.generateTotpSync === "function") {
          generatedTotpCode = IrisTotp.generateTotpSync(totpSecret)
        }

        sendResponse({
          success: true,
          username: cipher.login?.username || cipher.data?.username || cipher.data?.email || "",
          password: passwordToFill,
          totpSecret,
          totpCode: generatedTotpCode,
        })
      } catch (err) {
        console.warn("[Akaromi] Credential autofill retrieval error:", err)
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 7. Get All Ciphers
  if (action === "GET_ALL_CIPHERS") {
    ;(async () => {
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
    ;(async () => {
      try {
        await ensureVaultActive()
        const { cipherId, tabId } = payload
        const cipher = inMemoryCiphers.find((c) => c.id === cipherId)
        if (!cipher) throw new Error("Cipher not found")

        const targetTabId =
          tabId ||
          sender.tab?.id ||
          (await ext.tabs.query({ active: true, currentWindow: true }))[0]?.id
        if (!targetTabId) throw new Error("Target tab not found")

        await ext.tabs.sendMessage(targetTabId, {
          action: "FILL_INPUTS",
          payload: {
            title: cipher.title || cipher.data?.username || "Account",
            username: cipher.data?.username || "",
            password: cipher.data?.password || "",
            totpSecret: cipher.data?.totpSecret || "",
          },
        })

        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 8a1. Copy Text to Clipboard (with clipboardWrite permission)
  if (action === "COPY_TO_CLIPBOARD") {
    ;(async () => {
      try {
        const { text } = payload || {}
        if (text) {
          let written = false
          try {
            if (typeof document !== "undefined" && document.createElement) {
              const ta = document.createElement("textarea")
              ta.value = text
              ta.style.position = "fixed"
              ta.style.opacity = "0"
              ;(document.body || document.documentElement).appendChild(ta)
              ta.focus()
              ta.select()
              written = document.execCommand("copy")
              ta.remove()
            }
          } catch {}

          if (!written && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text).catch(() => {})
          }

          // Automatically schedule clipboard wiping using user's setting (default 30s)
          const s = await storage.get(["clipboardClearSeconds"])
          const sec = s.clipboardClearSeconds !== undefined ? Number(s.clipboardClearSeconds) : 30
          if (sec > 0) {
            scheduleClipboardWipe(text, sec)
          }
        }
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 8a2. Desktop / Browser Notification disabled (in-page corner notifications only)
  if (action === "SHOW_NOTIFICATION") {
    sendResponse({ success: true })
    return true
  }

  // 8a3. Generate TOTP code on demand
  if (action === "GENERATE_TOTP") {
    ;(async () => {
      try {
        const { secret } = payload || {}
        if (!secret) throw new Error("No secret provided")
        const code = await IrisTotp.generateTotp(secret)
        const remaining = IrisTotp.getRemainingSeconds()
        sendResponse({ success: true, code, remaining })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 8b. Open Unlock Popup / Window
  if (action === "OPEN_UNLOCK_WINDOW") {
    ;(async () => {
      try {
        if (ext.action?.openPopup) {
          try {
            await ext.action.openPopup()
            sendResponse({ success: true })
            return
          } catch (e) {}
        }
        const popupUrl = ext.runtime.getURL("popup/popup.html")
        await ext.windows.create({
          url: popupUrl,
          type: "popup",
          width: 650,
          height: 446,
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
    ;(async () => {
      try {
        const { bounds, tabId } = payload || {}
        const targetTabId = tabId || sender.tab?.id
        const targetWindowId = sender.tab?.windowId
        const screenshotUrl = targetWindowId !== undefined && targetWindowId !== null
          ? await ext.tabs.captureVisibleTab(targetWindowId, { format: "png" })
          : await ext.tabs.captureVisibleTab({ format: "png" })
        if (!screenshotUrl) throw new Error("Failed to capture screen")

        const res = await fetch(screenshotUrl)
        const blob = await res.blob()
        const fullBitmap = await createImageBitmap(blob)

        const viewportW = bounds?.innerWidth || (bounds?.x + bounds?.width) || (fullBitmap.width / (bounds?.dpr || 1))
        const viewportH = bounds?.innerHeight || (bounds?.y + bounds?.height) || (fullBitmap.height / (bounds?.dpr || 1))

        const scaleX = fullBitmap.width / viewportW
        const scaleY = fullBitmap.height / viewportH

        // Expand crop area slightly (by 15px CSS) to guarantee quiet zone around QR code
        const paddingX = 15
        const paddingY = 15

        const paddedX = Math.max(0, (bounds?.x || 0) - paddingX)
        const paddedY = Math.max(0, (bounds?.y || 0) - paddingY)
        const paddedW = (bounds?.width || 100) + paddingX * 2
        const paddedH = (bounds?.height || 100) + paddingY * 2

        const sx = Math.max(0, Math.min(fullBitmap.width - 10, Math.round(paddedX * scaleX)))
        const sy = Math.max(0, Math.min(fullBitmap.height - 10, Math.round(paddedY * scaleY)))
        const sw = Math.max(10, Math.min(fullBitmap.width - sx, Math.round(paddedW * scaleX)))
        const sh = Math.max(10, Math.min(fullBitmap.height - sy, Math.round(paddedH * scaleY)))

        const croppedBitmap = await createImageBitmap(fullBitmap, sx, sy, sw, sh)

        let decodedText = await IrisQrDecoder.scanImage(croppedBitmap)
        if (!decodedText) {
          // If padded scan didn't find it, try exact tight crop without padding
          const tightSx = Math.max(0, Math.min(fullBitmap.width - 10, Math.round((bounds?.x || 0) * scaleX)))
          const tightSy = Math.max(0, Math.min(fullBitmap.height - 10, Math.round((bounds?.y || 0) * scaleY)))
          const tightSw = Math.max(10, Math.min(fullBitmap.width - tightSx, Math.round((bounds?.width || 100) * scaleX)))
          const tightSh = Math.max(10, Math.min(fullBitmap.height - tightSy, Math.round((bounds?.height || 100) * scaleY)))
          const tightBitmap = await createImageBitmap(fullBitmap, tightSx, tightSy, tightSw, tightSh)
          decodedText = await IrisQrDecoder.scanImage(tightBitmap)
        }

        if (!decodedText) {
          throw new Error("No QR code detected in the selected area. Please try selecting closer to the QR code.")
        }

        const parsedOtp = IrisTotp.parseOtpAuthUri(decodedText)
        if (!parsedOtp || !parsedOtp.secret) {
          throw new Error(`Scanned QR code is not a valid 2FA authenticator key: ${decodedText.slice(0, 40)}`)
        }

        await storage.set({ pendingScannedTotp: parsedOtp })
        if (ext.storage?.session) {
          await ext.storage.session.set({ pendingScannedTotp: parsedOtp }).catch(() => {})
        }

        if (targetTabId) {
          ext.tabs.sendMessage(targetTabId, {
            action: "QR_SCAN_SUCCESS",
            payload: parsedOtp,
          }).catch(() => {})
        }

        sendResponse({ success: true, result: parsedOtp })
      } catch (err) {
        console.warn("[Akaromi] QR Screen Capture error:", err)
        sendResponse({ success: false, error: err.message || "Failed to decode QR code" })
      }
    })()
    return true
  }

  // 9. Save or Update Credential
  if (action === "SAVE_CIPHER" || action === "CREATE_CIPHER" || action === "UPDATE_CIPHER") {
    ;(async () => {
      try {
        if (!isPrivilegedSender(sender)) {
          throw new Error("Unauthorized sender context")
        }
        await ensureVaultActive()
        if (!inMemoryVaultKey) throw new Error("Vault is locked")

        const { id, type, title, folderId, favorite, data } = payload
        const encryptedTitle = await IrisCrypto.encryptVaultData(title, inMemoryVaultKey)
        const encryptedData = await IrisCrypto.encryptVaultObject(data, inMemoryVaultKey)

        let saved
        if (id) {
          saved = await IrisApi.updateCipher(id, {
            type,
            encryptedTitle,
            encryptedData,
            folderId: folderId || null,
            favorite: Boolean(favorite),
          })
        } else {
          saved = await IrisApi.createCipher({
            type,
            encryptedTitle,
            encryptedData,
            folderId: folderId || null,
            favorite: Boolean(favorite),
          })
        }

        await syncVault({ force: true })
        sendResponse({ success: true, cipher: saved })
      } catch (err) {
        sendResponse({ success: false, error: err.message })
      }
    })()
    return true
  }

  // 9b. Delete Credential
  if (action === "DELETE_CIPHER") {
    ;(async () => {
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
    ;(async () => {
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

  // 10. Passkey: Discover matching credentials
  if (action === "PASSKEY_GET_CREDENTIALS") {
    ;(async () => {
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

        const callerUrl = sender.url || sender.tab?.url || payload?.url || ""
        const callerHost = IrisMatching.extractHost(callerUrl)
        if (!callerHost) {
          sendResponse({ success: false, credentials: [], passkeys: [] })
          return
        }

        function normalizeB64(id) {
          if (!id || typeof id !== "string") return ""
          return id.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
        }

        const requestedRpId = (payload?.rpId || callerHost || "").toLowerCase()
        const rawAllowed =
          Array.isArray(payload?.allowCredentials) && payload.allowCredentials.length > 0
            ? payload.allowCredentials.map((c) => (typeof c === "string" ? c : c.id))
            : null
        const allowedIds = rawAllowed ? rawAllowed.map(normalizeB64) : null

        let matched = []
        for (const cipher of inMemoryCiphers) {
          if (cipher.deletedAt || cipher.type !== "LOGIN") continue
          const passkey = cipher.data?.passkey
          if (!passkey) continue

          const effectiveRpId = (passkey.rpId || "").toLowerCase()
          const hasMatchingUri =
            Array.isArray(cipher.data?.uris) &&
            cipher.data.uris.some((u) => {
              const uStr = typeof u === "string" ? u : u?.uri
              return uStr && IrisMatching.isUriMatch(callerUrl, uStr, u?.match ?? 0)
            })

          const isRpMatch =
            effectiveRpId === requestedRpId ||
            (callerHost && (effectiveRpId === callerHost || callerHost.endsWith("." + effectiveRpId))) ||
            (callerUrl && IrisMatching.isUriMatch(callerUrl, effectiveRpId, 0)) ||
            hasMatchingUri

          if (isRpMatch) {
            const normCredId = normalizeB64(passkey.credentialId)
            if (allowedIds && !allowedIds.includes(normCredId)) {
              continue
            }
            matched.push({
              id: passkey.credentialId,
              credentialId: passkey.credentialId,
              rawId: passkey.credentialId,
              type: "public-key",
              userName: passkey.userName || cipher.data?.username || "Account",
              userDisplayName: passkey.userDisplayName || cipher.title || cipher.data?.username || "Account",
              userHandle: passkey.userHandle || "",
              cipherId: cipher.id,
              cipherTitle: cipher.title || "Passkey",
              title: cipher.title || passkey.userName || "Passkey",
            })
          }
        }

        // If allowCredentials was specified but strict ID match didn't find them, check if any RP passkeys exist
        if (matched.length === 0 && allowedIds) {
          for (const cipher of inMemoryCiphers) {
            if (cipher.deletedAt || cipher.type !== "LOGIN") continue
            const passkey = cipher.data?.passkey
            if (!passkey) continue

            const effectiveRpId = (passkey.rpId || "").toLowerCase()
            const hasMatchingUri =
              Array.isArray(cipher.data?.uris) &&
              cipher.data.uris.some((u) => {
                const uStr = typeof u === "string" ? u : u?.uri
                return uStr && IrisMatching.isUriMatch(callerUrl, uStr, u?.match ?? 0)
              })

            const isRpMatch =
              effectiveRpId === requestedRpId ||
              (callerHost && (effectiveRpId === callerHost || callerHost.endsWith("." + effectiveRpId))) ||
              (callerUrl && IrisMatching.isUriMatch(callerUrl, effectiveRpId, 0)) ||
              hasMatchingUri

            if (isRpMatch) {
              matched.push({
                id: passkey.credentialId,
                credentialId: passkey.credentialId,
                rawId: passkey.credentialId,
                type: "public-key",
                userName: passkey.userName || cipher.data?.username || "Account",
                userDisplayName: passkey.userDisplayName || cipher.title || cipher.data?.username || "Account",
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

  // 11. Passkey: Register new credential
  if (action === "PASSKEY_CREATE_CREDENTIAL") {
    ;(async () => {
      try {
        await ensureVaultActive()
        if (!inMemoryVaultKey) {
          throw new Error("Vault is locked. Please unlock Akaromi first.")
        }

        const callerUrl = sender.url || sender.tab?.url || payload?.url || ""
        const callerHost = IrisMatching.extractHost(callerUrl)
        if (!callerHost) throw new Error("Untrusted sender context")

        const {
          rpId,
          rpName,
          userId,
          userName,
          userDisplayName,
          challenge,
          targetCipherId,
        } = payload || {}

        const effectiveRpId = rpId || callerHost
        const isRpAllowed =
          effectiveRpId.toLowerCase() === callerHost.toLowerCase() ||
          callerHost.toLowerCase().endsWith("." + effectiveRpId.toLowerCase()) ||
          IrisMatching.isUriMatch(callerUrl, effectiveRpId, 0)

        if (!isRpAllowed) {
          throw new Error(
            `Cannot register passkey: Caller domain ${callerHost} is not authorized for RP ID ${effectiveRpId}`
          )
        }

        const keyPair = await crypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["sign", "verify"]
        )

        const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey)
        const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey)
        const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey)

        const xBytes = new Uint8Array(base64UrlToBuffer(pubJwk.x))
        const yBytes = new Uint8Array(base64UrlToBuffer(pubJwk.y))

        const coseKey = new Uint8Array([
          0xa5,
          0x01, 0x02,
          0x03, 0x26,
          0x20, 0x01,
          0x21, 0x58, 0x20, ...xBytes,
          0x22, 0x58, 0x20, ...yBytes,
        ])

        const credIdBytes = crypto.getRandomValues(new Uint8Array(32))
        const credIdB64 = bufferToBase64Url(credIdBytes)

        const origin = callerUrl ? new URL(callerUrl).origin : "https://" + effectiveRpId
        const clientDataObj = {
          type: "webauthn.create",
          challenge: challenge,
          origin: origin,
          crossOrigin: false,
        }
        const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientDataObj))

        const rpIdHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(effectiveRpId))
        const rpIdHash = new Uint8Array(rpIdHashBuf)
        const flags = 0x45 // UP=1, UV=1, AT=1
        const signCount = new Uint8Array([0, 0, 0, 0])
        const aaguid = new Uint8Array(16)
        const credIdLen = new Uint8Array([(credIdBytes.length >> 8) & 0xff, credIdBytes.length & 0xff])

        const authData = new Uint8Array([
          ...rpIdHash,
          flags,
          ...signCount,
          ...aaguid,
          ...credIdLen,
          ...credIdBytes,
          ...coseKey,
        ])

        const attestationObject = encodeCborAttestation(authData)

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

        let targetCipher = null
        if (targetCipherId && targetCipherId !== "new") {
          targetCipher = inMemoryCiphers.find((c) => !c.deletedAt && c.id === targetCipherId)
        } else if (!targetCipherId) {
          targetCipher = inMemoryCiphers.find(
            (c) =>
              !c.deletedAt &&
              c.type === "LOGIN" &&
              c.data?.username === userName &&
              c.data?.uris?.some((u) => {
                const uStr = typeof u === "string" ? u : u.uri
                return IrisMatching.isUriMatch(callerUrl, uStr, 0)
              })
          )
        }

        if (targetCipher) {
          const updatedData = { ...targetCipher.data, passkey: passkeyData }
          const encTitle = await IrisCrypto.encryptVaultData(targetCipher.title, inMemoryVaultKey)
          const encData = await IrisCrypto.encryptVaultObject(updatedData, inMemoryVaultKey)
          await IrisApi.updateCipher(targetCipher.id, {
            type: targetCipher.type,
            encryptedTitle: encTitle,
            encryptedData: encData,
            folderId: targetCipher.folderId || null,
            favorite: Boolean(targetCipher.favorite),
          })
        } else {
          const title = rpName || effectiveRpId
          const data = {
            username: userName || "Account",
            uris: callerUrl ? [{ uri: callerUrl, match: 0 }] : [],
            passkey: passkeyData,
          }
          const encTitle = await IrisCrypto.encryptVaultData(title, inMemoryVaultKey)
          const encData = await IrisCrypto.encryptVaultObject(data, inMemoryVaultKey)
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
        console.error("[Akaromi] Passkey creation error in background:", err)
        sendResponse({
          success: false,
          error: err.message || "Failed to create passkey",
        })
      }
    })()
    return true
  }

  // 12. Passkey: Sign assertion
  if (action === "PASSKEY_SIGN_ASSERTION") {
    ;(async () => {
      try {
        await ensureVaultActive()
        if (!inMemoryVaultKey) throw new Error("Vault is locked. Please unlock Akaromi.")

        const callerUrl = sender.url || sender.tab?.url || payload?.url || ""
        const callerHost = IrisMatching.extractHost(callerUrl)
        if (!callerHost) throw new Error("Untrusted sender context")

        const { credentialId, challenge } = payload || {}
        if (!credentialId) throw new Error("Missing credential ID")

        function normalizeB64(id) {
          if (!id || typeof id !== "string") return ""
          return id.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
        }

        const normTargetCredId = normalizeB64(credentialId)

        let matchedPasskey = null
        let matchedCipher = null
        for (const c of inMemoryCiphers) {
          if (c.deletedAt || c.type !== "LOGIN") continue
          if (normalizeB64(c.data?.passkey?.credentialId) === normTargetCredId) {
            matchedPasskey = c.data.passkey
            matchedCipher = c
            break
          }
        }

        if (!matchedPasskey) throw new Error("Passkey not found in vault")

        const effectiveRpId = (matchedPasskey.rpId || "").toLowerCase()
        const requestedRpId = (payload?.rpId || callerHost || "").toLowerCase()
        const hasMatchingUri =
          Array.isArray(matchedCipher?.data?.uris) &&
          matchedCipher.data.uris.some((u) => {
            const uStr = typeof u === "string" ? u : u?.uri
            return uStr && IrisMatching.isUriMatch(callerUrl, uStr, u?.match ?? 0)
          })

        const isRpMatch =
          effectiveRpId === requestedRpId ||
          (callerHost && (effectiveRpId === callerHost || callerHost.endsWith("." + effectiveRpId))) ||
          (callerUrl && IrisMatching.isUriMatch(callerUrl, effectiveRpId, 0)) ||
          hasMatchingUri

        if (!isRpMatch) {
          throw new Error(`Relying party mismatch: Passkey is registered to ${effectiveRpId}, but assertion was requested by ${callerHost}`)
        }

        const effectiveOrigin = payload?.origin || (callerUrl ? new URL(callerUrl).origin : "https://" + (requestedRpId || effectiveRpId))
        const enc = new TextEncoder()

        const clientDataObj = {
          type: "webauthn.get",
          challenge: challenge,
          origin: effectiveOrigin,
          crossOrigin: false,
        }
        const clientDataJSON = enc.encode(JSON.stringify(clientDataObj))

        const clientDataHashBuf = await crypto.subtle.digest("SHA-256", clientDataJSON)
        const clientDataHash = new Uint8Array(clientDataHashBuf)

        const rpIdToUse = requestedRpId || effectiveRpId || callerHost
        const rpIdHashBuf = await crypto.subtle.digest("SHA-256", enc.encode(rpIdToUse))
        const rpIdHash = new Uint8Array(rpIdHashBuf)
        const flags = 0x1d

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

        const signData = new Uint8Array([...authData, ...clientDataHash])
        const privKey = await crypto.subtle.importKey(
          "jwk",
          matchedPasskey.privateKey,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"]
        )
        const rawSig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, signData)
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
        console.error("[Akaromi] Passkey assertion error in background:", err)
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
updateBadge()

// Browser startup event: ensure active session and badges initialize immediately
ext.runtime.onStartup?.addListener(async () => {
  try {
    await ensureVaultActive()
    updateBadge()
  } catch (err) {
    console.warn("[Akaromi] Startup check warning:", err)
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
            files: [
              "lib/icons.js",
              "content/detection.js",
              "content/badge.js",
              "content/menu.js",
              "content/fill.js",
              "content/content.js",
            ],
          })
        }
      } catch {
        // Tab might be restricted
      }
    }
  } catch (err) {
    console.warn("[Akaromi] Auto re-inject tabs warning:", err)
  }
})

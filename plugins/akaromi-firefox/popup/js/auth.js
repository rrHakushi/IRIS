/**
 * Akaromi for Firefox — Authentication, Unlock & Session Views Module
 */
;(function (global) {
  "use strict"

  const { showToast, ext, storage } = global.AkaromiUtils

  // Views & Headers
  const appHeader = document.getElementById("app-header")
  const viewLogin = document.getElementById("view-login")
  const viewMfa = document.getElementById("view-mfa")
  const viewLocked = document.getElementById("view-locked")
  const viewUnlocked = document.getElementById("view-unlocked")

  // Login View Elements
  const btnLoginTabAccount = document.getElementById("btn-login-tab-account")
  const btnLoginTabApiKey = document.getElementById("btn-login-tab-apikey")
  const loginAccountFields = document.getElementById("login-account-fields")
  const loginApikeyFields = document.getElementById("login-apikey-fields")
  const formLogin = document.getElementById("form-login")
  const loginIdentifier = document.getElementById("login-identifier")
  const loginPassword = document.getElementById("login-password")
  const loginApiKey = document.getElementById("login-api-key")
  const loginApiMasterPass = document.getElementById("login-api-masterpass")
  const loginError = document.getElementById("login-error")
  const btnLoginSubmit = document.getElementById("btn-login-submit")
  const btnToggleLoginEye = document.getElementById("btn-toggle-login-eye")
  const btnToggleApikeyEye = document.getElementById("btn-toggle-apikey-eye")
  const btnToggleMasterpassEye = document.getElementById("btn-toggle-masterpass-eye")

  const toggleServerConfig = document.getElementById("toggle-server-config")
  const serverConfigBody = document.getElementById("server-config-body")
  const loginServerUrl = document.getElementById("login-server-url")
  const loginServerLabel = document.getElementById("login-server-label")
  const btnSaveServerUrl = document.getElementById("btn-save-server-url")

  // MFA View Elements
  const formMfa = document.getElementById("form-mfa")
  const mfaCode = document.getElementById("mfa-code")
  const mfaError = document.getElementById("mfa-error")
  const btnMfaSubmit = document.getElementById("btn-mfa-submit")
  const btnMfaCancel = document.getElementById("btn-mfa-cancel")
  const mfaSubtitle = document.getElementById("mfa-subtitle")
  const otpContainer = document.getElementById("otp-container")
  const otpBoxes = Array.from(document.querySelectorAll(".otp-box"))
  const backupCodeWrap = document.getElementById("backup-code-wrap")
  const mfaBackupCode = document.getElementById("mfa-backup-code")
  const btnToggleMfaType = document.getElementById("btn-toggle-mfa-type")
  const btnResendEmailOtp = document.getElementById("btn-resend-email-otp")

  // Unlock View Elements
  const lockedUserName = document.getElementById("locked-user-name")
  const lockedUserEmail = document.getElementById("locked-user-email")
  const lockedAvatar = document.getElementById("locked-avatar")
  const formUnlockPin = document.getElementById("form-unlock-pin")
  const formUnlockPassword = document.getElementById("form-unlock-password")
  const unlockPin = document.getElementById("unlock-pin")
  const unlockPassword = document.getElementById("unlock-password")
  const unlockError = document.getElementById("unlock-error")
  const btnUnlockPinSubmit = document.getElementById("btn-unlock-pin-submit")
  const btnUnlockSubmit = document.getElementById("btn-unlock-submit")
  const btnForgotPin = document.getElementById("btn-forgot-pin")
  const btnUsePin = document.getElementById("btn-use-pin")
  const btnToggleUnlockPinEye = document.getElementById("btn-toggle-unlock-pin-eye")
  const btnToggleUnlockEye = document.getElementById("btn-toggle-unlock-eye")
  const btnSwitchAccount = document.getElementById("btn-switch-account")

  let activeLoginMethod = "account"
  let pendingMfa = null
  let isBackupModeActive = false
  let emailResendCooldown = 0
  let resendTimer = null

  // ----------------------------------------------------
  // Screen Transition Helpers
  // ----------------------------------------------------
  function showLoginView() {
    if (appHeader) appHeader.style.display = "none"
    if (viewLogin) viewLogin.style.display = "flex"
    if (viewMfa) viewMfa.style.display = "none"
    if (viewLocked) viewLocked.style.display = "none"
    if (viewUnlocked) viewUnlocked.style.display = "none"
    requestAnimationFrame(() => loginIdentifier?.focus({ preventScroll: true }))
  }

  function showMfaView(mfaTicket, allowedMfaTypes) {
    if (appHeader) appHeader.style.display = "none"
    if (viewLogin) viewLogin.style.display = "none"
    if (viewMfa) viewMfa.style.display = "flex"
    if (viewLocked) viewLocked.style.display = "none"
    if (viewUnlocked) viewUnlocked.style.display = "none"

    const types = Array.isArray(allowedMfaTypes) ? allowedMfaTypes : ["totp"]
    const hasEmail = types.includes("email")
    const hasTotp = types.includes("totp")

    if (mfaSubtitle) {
      if (hasTotp) {
        mfaSubtitle.textContent = "Enter the 6-digit verification code from your authenticator app"
      } else if (hasEmail) {
        mfaSubtitle.textContent = "Enter the 6-digit verification code sent to your email"
      } else {
        mfaSubtitle.textContent = "Enter your two-factor verification code"
      }
    }

    if (btnResendEmailOtp) {
      btnResendEmailOtp.style.display = hasEmail ? "inline-flex" : "none"
    }

    // Auto-trigger email OTP dispatch if email is the only available MFA type
    if (hasEmail && !hasTotp && mfaTicket) {
      sendEmailOtpCode(mfaTicket)
    }

    requestAnimationFrame(() => {
      if (isBackupModeActive) {
        mfaBackupCode?.focus({ preventScroll: true })
      } else {
        const firstEmpty = otpBoxes.find((b) => !b.value) || otpBoxes[0]
        firstEmpty?.focus({ preventScroll: true })
      }
    })

    saveAuthDraft()
  }

  function showLockedView(user, status) {
    if (appHeader) appHeader.style.display = "none"
    if (viewLogin) viewLogin.style.display = "none"
    if (viewMfa) viewMfa.style.display = "none"
    if (viewLocked) viewLocked.style.display = "flex"
    if (viewUnlocked) viewUnlocked.style.display = "none"

    if (user) {
      if (lockedUserName) lockedUserName.textContent = user.name || user.username || "Account"
      if (lockedUserEmail) lockedUserEmail.textContent = user.email || ""
      if (lockedAvatar) {
        const initials = (user.name || user.username || "A").slice(0, 1).toUpperCase()
        lockedAvatar.textContent = initials
      }
    }

    const pinEnabled = status?.pinUnlockEnabled ?? true
    if (pinEnabled) {
      if (formUnlockPin) formUnlockPin.style.display = "flex"
      if (formUnlockPassword) formUnlockPassword.style.display = "none"
      if (unlockPin) {
        unlockPin.value = ""
        requestAnimationFrame(() => unlockPin.focus({ preventScroll: true }))
      }
    } else {
      if (formUnlockPin) formUnlockPin.style.display = "none"
      if (formUnlockPassword) formUnlockPassword.style.display = "flex"
      if (btnUsePin) btnUsePin.style.display = "none"
      if (unlockPassword) {
        unlockPassword.value = ""
        requestAnimationFrame(() => unlockPassword.focus({ preventScroll: true }))
      }
    }
  }

  function showUnlockedView(user) {
    clearAuthDraft()
    pendingMfa = null

    if (appHeader) appHeader.style.display = "flex"
    if (viewLogin) viewLogin.style.display = "none"
    if (viewMfa) viewMfa.style.display = "none"
    if (viewLocked) viewLocked.style.display = "none"
    if (viewUnlocked) viewUnlocked.style.display = "block"

    IrisApi.getServerUrl().then((serverUrl) => {
      global.AkaromiSettings?.updateDrawerUserInfo(user, serverUrl)
    })

    global.AkaromiVault?.loadVaultData()
  }

  // ----------------------------------------------------
  // Draft State Preservation (Across Window Open / Close)
  // ----------------------------------------------------
  let draftSaveTimeout = null
  function saveAuthDraft() {
    clearTimeout(draftSaveTimeout)
    draftSaveTimeout = setTimeout(saveAuthDraftImmediate, 80)
  }

  function saveAuthDraftImmediate() {
    try {
      const isMfaVisible = viewMfa && viewMfa.style.display !== "none"
      const otpValues = otpBoxes.map((b) => b.value || "")
      const backupVal = mfaBackupCode?.value || ""

      const draft = {
        method: activeLoginMethod,
        identifier: loginIdentifier?.value || "",
        password: loginPassword?.value || "",
        apiKey: loginApiKey?.value || "",
        accountPassword: loginApiMasterPass?.value || "",
        isMfaActive: isMfaVisible && Boolean(pendingMfa?.mfaTicket),
        pendingMfa: pendingMfa || null,
        otpValues,
        backupCode: backupVal,
        isBackupMode: isBackupModeActive,
      }

      storage.set({ akaromi_auth_draft: draft }).catch(() => {})
    } catch {}
  }

  async function restoreDraftState() {
    try {
      const data = await storage.get(["akaromi_auth_draft"])
      const draft = data?.akaromi_auth_draft
      if (!draft) return false

      // 1. If MFA was pending when closed, reopen MFA view directly
      if (draft.isMfaActive && draft.pendingMfa?.mfaTicket) {
        pendingMfa = draft.pendingMfa
        showMfaView(pendingMfa.mfaTicket, pendingMfa.allowedMfaTypes)

        if (draft.isBackupMode) {
          isBackupModeActive = true
          if (otpContainer) otpContainer.style.display = "none"
          if (backupCodeWrap) backupCodeWrap.style.display = "flex"
          if (btnToggleMfaType) btnToggleMfaType.textContent = "Use 6-digit Authenticator Code"
          if (mfaBackupCode && draft.backupCode) {
            mfaBackupCode.value = draft.backupCode
          }
        } else if (Array.isArray(draft.otpValues)) {
          draft.otpValues.forEach((val, idx) => {
            if (otpBoxes[idx]) {
              otpBoxes[idx].value = val || ""
              if (val) otpBoxes[idx].classList.add("filled")
            }
          })
        }
        syncOtpCode()
        return true
      }

      // 2. Otherwise restore login form fields
      if (draft.method === "apikey") {
        activeLoginMethod = "apikey"
        btnLoginTabApiKey?.classList.add("active")
        btnLoginTabAccount?.classList.remove("active")
        if (loginAccountFields) loginAccountFields.style.display = "none"
        if (loginApikeyFields) loginApikeyFields.style.display = "flex"
      } else {
        activeLoginMethod = "account"
        btnLoginTabAccount?.classList.add("active")
        btnLoginTabApiKey?.classList.remove("active")
        if (loginAccountFields) loginAccountFields.style.display = "flex"
        if (loginApikeyFields) loginApikeyFields.style.display = "none"
      }

      if (loginIdentifier && draft.identifier) loginIdentifier.value = draft.identifier
      if (loginPassword && draft.password) loginPassword.value = draft.password
      if (loginApiKey && draft.apiKey) loginApiKey.value = draft.apiKey
      if (loginApiMasterPass && draft.accountPassword) loginApiMasterPass.value = draft.accountPassword

      return false
    } catch {
      return false
    }
  }

  function clearAuthDraft() {
    storage.remove("akaromi_auth_draft").catch(() => {})
  }

  // ----------------------------------------------------
  // Login Form Interactions
  // ----------------------------------------------------
  btnLoginTabAccount?.addEventListener("click", () => {
    activeLoginMethod = "account"
    btnLoginTabAccount.classList.add("active")
    btnLoginTabApiKey?.classList.remove("active")
    if (loginAccountFields) loginAccountFields.style.display = "flex"
    if (loginApikeyFields) loginApikeyFields.style.display = "none"
    saveAuthDraft()
  })

  btnLoginTabApiKey?.addEventListener("click", () => {
    activeLoginMethod = "apikey"
    btnLoginTabApiKey.classList.add("active")
    btnLoginTabAccount?.classList.remove("active")
    if (loginAccountFields) loginAccountFields.style.display = "none"
    if (loginApikeyFields) loginApikeyFields.style.display = "flex"
    saveAuthDraft()
  })

  loginIdentifier?.addEventListener("input", saveAuthDraft)
  loginPassword?.addEventListener("input", saveAuthDraft)
  loginApiKey?.addEventListener("input", saveAuthDraft)
  loginApiMasterPass?.addEventListener("input", saveAuthDraft)

  window.addEventListener("pagehide", saveAuthDraftImmediate)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveAuthDraftImmediate()
  })

  btnToggleLoginEye?.addEventListener("click", () => {
    if (!loginPassword) return
    if (loginPassword.type === "password") {
      loginPassword.type = "text"
      IrisIcons.swap(btnToggleLoginEye, "eye-off")
    } else {
      loginPassword.type = "password"
      IrisIcons.swap(btnToggleLoginEye, "eye")
    }
  })

  btnToggleApikeyEye?.addEventListener("click", () => {
    if (!loginApiKey) return
    if (loginApiKey.type === "password") {
      loginApiKey.type = "text"
      IrisIcons.swap(btnToggleApikeyEye, "eye-off")
    } else {
      loginApiKey.type = "password"
      IrisIcons.swap(btnToggleApikeyEye, "eye")
    }
  })

  btnToggleMasterpassEye?.addEventListener("click", () => {
    if (!loginApiMasterPass) return
    if (loginApiMasterPass.type === "password") {
      loginApiMasterPass.type = "text"
      IrisIcons.swap(btnToggleMasterpassEye, "eye-off")
    } else {
      loginApiMasterPass.type = "password"
      IrisIcons.swap(btnToggleMasterpassEye, "eye")
    }
  })

  IrisApi.getServerUrl().then((serverUrl) => {
    if (loginServerUrl && serverUrl) loginServerUrl.value = serverUrl
    if (loginServerLabel && serverUrl) loginServerLabel.textContent = serverUrl
  }).catch(() => {})

  toggleServerConfig?.addEventListener("click", () => {
    if (!serverConfigBody) return
    const isVisible = serverConfigBody.style.display === "flex"
    serverConfigBody.style.display = isVisible ? "none" : "flex"
  })

  btnSaveServerUrl?.addEventListener("click", async () => {
    const url = loginServerUrl?.value.trim()
    if (!url) return
    await IrisApi.setServerUrl(url)
    await storage.set({ serverUrl: url })
    if (loginServerLabel) loginServerLabel.textContent = url
    showToast("Server URL updated")
    if (serverConfigBody) serverConfigBody.style.display = "none"
  })

  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault()
    if (loginError) loginError.style.display = "none"

    if (btnLoginSubmit) {
      btnLoginSubmit.disabled = true
      btnLoginSubmit.textContent = "Connecting..."
    }

    try {
      if (activeLoginMethod === "account") {
        const identifier = loginIdentifier?.value.trim()
        const password = loginPassword?.value
        if (!identifier || !password) throw new Error("Identifier and password required")

        const res = await ext.runtime.sendMessage({
          action: "LOGIN",
          payload: { identifier, password },
        })

        if (res?.mfaRequired) {
          pendingMfa = { mfaTicket: res.mfaTicket, password, allowedMfaTypes: res.allowedMfaTypes }
          showMfaView(res.mfaTicket, res.allowedMfaTypes)
          return
        }

        if (res?.success) {
          showUnlockedView(res.user)
          showToast("Signed in successfully")
        } else {
          throw new Error(res?.error || "Login failed")
        }
      } else {
        const apiKey = loginApiKey?.value.trim()
        const accountPassword = loginApiMasterPass?.value
        if (!apiKey || !accountPassword) throw new Error("API key and account password required")

        const res = await ext.runtime.sendMessage({
          action: "LOGIN_API_KEY",
          payload: { apiKey, accountPassword },
        })

        if (res?.success) {
          showUnlockedView(res.user)
          showToast("Connected via API Key")
        } else {
          throw new Error(res?.error || "Connection failed")
        }
      }
    } catch (err) {
      if (loginError) {
        loginError.textContent = err.message || "Failed to log in"
        loginError.style.display = "block"
      }
    } finally {
      if (btnLoginSubmit) {
        btnLoginSubmit.disabled = false
        btnLoginSubmit.textContent = "Sign In"
      }
    }
  })

  // ----------------------------------------------------
  // Proper OTP Input Field Behavior (Separate Digit Boxes)
  // ----------------------------------------------------
  function syncOtpCode() {
    if (isBackupModeActive) {
      if (mfaCode) mfaCode.value = mfaBackupCode?.value.trim() || ""
    } else {
      const code = otpBoxes.map((box) => box.value).join("")
      if (mfaCode) mfaCode.value = code
    }
    saveAuthDraft()
  }

  function clearOtpBoxes() {
    otpBoxes.forEach((box) => {
      box.value = ""
      box.classList.remove("filled")
    })
    if (mfaBackupCode) mfaBackupCode.value = ""
    if (mfaCode) mfaCode.value = ""
  }

  otpBoxes.forEach((box, index) => {
    box.addEventListener("focus", () => {
      box.select()
    })

    box.addEventListener("input", (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, "")
      if (raw.length > 0) {
        box.value = raw[raw.length - 1]
        box.classList.add("filled")
        // Move to next box if available
        if (index < otpBoxes.length - 1) {
          otpBoxes[index + 1].focus()
        }
      } else {
        box.value = ""
        box.classList.remove("filled")
      }
      syncOtpCode()
    })

    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        formMfa?.requestSubmit()
        return
      }
      if (e.key === "Backspace") {
        if (!box.value && index > 0) {
          e.preventDefault()
          otpBoxes[index - 1].value = ""
          otpBoxes[index - 1].classList.remove("filled")
          otpBoxes[index - 1].focus()
          syncOtpCode()
        } else if (box.value) {
          box.value = ""
          box.classList.remove("filled")
          syncOtpCode()
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault()
        otpBoxes[index - 1].focus()
      } else if (e.key === "ArrowRight" && index < otpBoxes.length - 1) {
        e.preventDefault()
        otpBoxes[index + 1].focus()
      }
    })

    box.addEventListener("paste", (e) => {
      e.preventDefault()
      const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || ""
      const digits = pasted.replace(/[^0-9]/g, "").slice(0, 6)
      if (!digits) return

      digits.split("").forEach((char, i) => {
        if (otpBoxes[i]) {
          otpBoxes[i].value = char
          otpBoxes[i].classList.add("filled")
        }
      })
      syncOtpCode()

      const nextFocus = Math.min(digits.length, otpBoxes.length - 1)
      otpBoxes[nextFocus]?.focus()
    })
  })

  mfaBackupCode?.addEventListener("input", () => {
    syncOtpCode()
  })

  // Toggle between 6-digit OTP and recovery backup code
  btnToggleMfaType?.addEventListener("click", () => {
    isBackupModeActive = !isBackupModeActive
    if (isBackupModeActive) {
      if (otpContainer) otpContainer.style.display = "none"
      if (backupCodeWrap) backupCodeWrap.style.display = "flex"
      btnToggleMfaType.textContent = "Use 6-digit Authenticator Code"
      if (mfaSubtitle) mfaSubtitle.textContent = "Enter one of your single-use recovery backup codes"
      requestAnimationFrame(() => mfaBackupCode?.focus({ preventScroll: true }))
    } else {
      if (otpContainer) otpContainer.style.display = "flex"
      if (backupCodeWrap) backupCodeWrap.style.display = "none"
      btnToggleMfaType.textContent = "Use Backup Recovery Code"
      if (mfaSubtitle) mfaSubtitle.textContent = "Enter the 6-digit verification code from your authenticator app"
      requestAnimationFrame(() => {
        const firstEmpty = otpBoxes.find((b) => !b.value) || otpBoxes[0]
        firstEmpty?.focus({ preventScroll: true })
      })
    }
    syncOtpCode()
  })

  // Resend email verification code
  async function sendEmailOtpCode(ticket) {
    if (!ticket || emailResendCooldown > 0) return
    emailResendCooldown = 60
    updateResendButton()

    clearInterval(resendTimer)
    resendTimer = setInterval(() => {
      emailResendCooldown--
      if (emailResendCooldown <= 0) {
        clearInterval(resendTimer)
        if (btnResendEmailOtp) {
          btnResendEmailOtp.disabled = false
          btnResendEmailOtp.textContent = "Resend verification email"
        }
      } else {
        updateResendButton()
      }
    }, 1000)

    try {
      const res = await ext.runtime.sendMessage({
        action: "SEND_MFA_EMAIL",
        payload: { mfaTicket: ticket },
      })
      if (res?.success) {
        showToast("Verification email sent")
      }
    } catch (e) {
      console.warn("[Akaromi] Failed to send MFA email:", e)
    }
  }

  function updateResendButton() {
    if (btnResendEmailOtp) {
      btnResendEmailOtp.disabled = true
      btnResendEmailOtp.textContent = `Resend email code (${emailResendCooldown}s)`
    }
  }

  btnResendEmailOtp?.addEventListener("click", () => {
    if (pendingMfa?.mfaTicket) {
      sendEmailOtpCode(pendingMfa.mfaTicket)
    }
  })

  // ----------------------------------------------------
  // MFA Form Submit
  // ----------------------------------------------------
  formMfa?.addEventListener("submit", async (e) => {
    e.preventDefault()
    if (mfaError) mfaError.style.display = "none"
    const code = mfaCode?.value.trim()
    if (!code) {
      if (mfaError) {
        mfaError.textContent = "Please enter your verification code"
        mfaError.style.display = "block"
      }
      return
    }

    if (btnMfaSubmit) {
      btnMfaSubmit.disabled = true
      btnMfaSubmit.textContent = "Verifying..."
    }

    try {
      const res = await ext.runtime.sendMessage({
        action: "VERIFY_MFA",
        payload: {
          mfaTicket: pendingMfa?.mfaTicket,
          code,
          mfaType: isBackupModeActive ? "backup_code" : "totp",
          password: pendingMfa?.password,
        },
      })

      if (res?.success) {
        clearAuthDraft()
        showUnlockedView(res.user)
        showToast("Authentication verified")
      } else {
        throw new Error(res?.error || "Invalid verification code")
      }
    } catch (err) {
      if (mfaError) {
        mfaError.textContent = err.message || "Verification failed"
        mfaError.style.display = "block"
      }
      // Re-focus first box for convenience
      if (!isBackupModeActive) {
        otpBoxes[0]?.focus()
      }
    } finally {
      if (btnMfaSubmit) {
        btnMfaSubmit.disabled = false
        btnMfaSubmit.textContent = "Verify Code"
      }
    }
  })

  btnMfaCancel?.addEventListener("click", () => {
    pendingMfa = null
    clearOtpBoxes()
    saveAuthDraftImmediate()
    showLoginView()
  })

  // ----------------------------------------------------
  // Unlock Form
  // ----------------------------------------------------
  formUnlockPin?.addEventListener("submit", async (e) => {
    e.preventDefault()
    if (unlockError) unlockError.style.display = "none"
    const pin = unlockPin?.value.trim()
    if (!pin) return

    if (btnUnlockPinSubmit) {
      btnUnlockPinSubmit.disabled = true
      btnUnlockPinSubmit.textContent = "Unlocking..."
    }

    try {
      const res = await ext.runtime.sendMessage({
        action: "UNLOCK_WITH_PIN",
        payload: { pin },
      })
      if (res?.success) {
        showUnlockedView(res.user)
        showToast("Vault unlocked")
      } else {
        throw new Error(res?.error || "Incorrect PIN")
      }
    } catch (err) {
      if (unlockError) {
        unlockError.textContent = err.message || "Incorrect PIN"
        unlockError.style.display = "block"
      }
      if (unlockPin) {
        unlockPin.value = ""
        unlockPin.focus()
      }
    } finally {
      if (btnUnlockPinSubmit) {
        btnUnlockPinSubmit.disabled = false
        btnUnlockPinSubmit.textContent = "Unlock Vault"
      }
    }
  })

  btnForgotPin?.addEventListener("click", () => {
    if (formUnlockPin) formUnlockPin.style.display = "none"
    if (formUnlockPassword) formUnlockPassword.style.display = "flex"
    if (btnUsePin) btnUsePin.style.display = "inline-flex"
    if (unlockPassword) {
      unlockPassword.value = ""
      unlockPassword.focus()
    }
  })

  btnUsePin?.addEventListener("click", () => {
    if (formUnlockPin) formUnlockPin.style.display = "flex"
    if (formUnlockPassword) formUnlockPassword.style.display = "none"
    if (unlockPin) {
      unlockPin.value = ""
      unlockPin.focus()
    }
  })

  btnToggleUnlockPinEye?.addEventListener("click", () => {
    if (!unlockPin) return
    if (unlockPin.type === "password") {
      unlockPin.type = "text"
      IrisIcons.swap(btnToggleUnlockPinEye, "eye-off")
    } else {
      unlockPin.type = "password"
      IrisIcons.swap(btnToggleUnlockPinEye, "eye")
    }
  })

  btnToggleUnlockEye?.addEventListener("click", () => {
    if (!unlockPassword) return
    if (unlockPassword.type === "password") {
      unlockPassword.type = "text"
      IrisIcons.swap(btnToggleUnlockEye, "eye-off")
    } else {
      unlockPassword.type = "password"
      IrisIcons.swap(btnToggleUnlockEye, "eye")
    }
  })

  formUnlockPassword?.addEventListener("submit", async (e) => {
    e.preventDefault()
    if (unlockError) unlockError.style.display = "none"
    const pass = unlockPassword?.value
    if (!pass) return

    if (btnUnlockSubmit) {
      btnUnlockSubmit.disabled = true
      btnUnlockSubmit.textContent = "Unlocking..."
    }

    try {
      const res = await ext.runtime.sendMessage({
        action: "UNLOCK_VAULT",
        payload: { password: pass },
      })
      if (res?.success) {
        showUnlockedView(res.user)
        showToast("Vault unlocked")
      } else {
        throw new Error(res?.error || "Incorrect password")
      }
    } catch (err) {
      if (unlockError) {
        unlockError.textContent = err.message || "Incorrect password"
        unlockError.style.display = "block"
      }
      if (unlockPassword) {
        unlockPassword.value = ""
        unlockPassword.focus()
      }
    } finally {
      if (btnUnlockSubmit) {
        btnUnlockSubmit.disabled = false
        btnUnlockSubmit.textContent = "Unlock Vault"
      }
    }
  })

  btnSwitchAccount?.addEventListener("click", async () => {
    if (confirm("Log out of this account?")) {
      await ext.runtime.sendMessage({ action: "LOGOUT" })
      clearAuthDraft()
      showLoginView()
    }
  })

  global.AkaromiAuth = {
    showLoginView,
    showMfaView,
    showLockedView,
    showUnlockedView,
    restoreDraftState,
    saveAuthDraft: saveAuthDraftImmediate,
  }
})(typeof window !== "undefined" ? window : globalThis)

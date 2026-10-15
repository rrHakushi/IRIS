/**
 * Akaromi for Firefox — Settings, PIN & Drawer Navigation Module
 */
;(function (global) {
  "use strict"

  const { showToast, ext, storage } = global.AkaromiUtils
  const state = global.AkaromiState

  // Settings Modal Elements
  const modalSettings = document.getElementById("modal-settings")
  const btnSettingsClose = document.getElementById("btn-settings-close")
  const btnNavSettings = document.getElementById("btn-nav-settings")

  const selectAutoLock = document.getElementById("select-auto-lock")
  const selectClipboardTimer = document.getElementById("select-clipboard-timer")
  const toggleDefaultPm = document.getElementById("toggle-default-pm")
  const settingServerUrl = document.getElementById("setting-server-url")
  const btnSaveSettingsServer = document.getElementById("btn-save-settings-server")

  // PIN Elements
  const togglePinUnlock = document.getElementById("toggle-pin-unlock")
  const pinActiveActions = document.getElementById("pin-active-actions")
  const btnChangePin = document.getElementById("btn-change-pin")
  const modalPinSetup = document.getElementById("modal-pin-setup")
  const formPinSetup = document.getElementById("form-pin-setup")
  const pinSetupNew = document.getElementById("pin-setup-new")
  const pinSetupConfirm = document.getElementById("pin-setup-confirm")
  const pinSetupError = document.getElementById("pin-setup-error")
  const btnTogglePinSetupEye = document.getElementById("btn-toggle-pin-setup-eye")
  const btnPinSetupCancel = document.getElementById("btn-pin-setup-cancel")

  // Drawer Elements
  const drawerBackdrop = document.getElementById("drawer-backdrop")
  const appDrawer = document.getElementById("app-drawer")
  const btnMenuDrawer = document.getElementById("btn-menu-drawer")
  const drawerUserName = document.getElementById("drawer-user-name")
  const drawerUserServer = document.getElementById("drawer-user-server")
  const drawerAvatar = document.getElementById("drawer-avatar")

  const btnNavLock = document.getElementById("btn-nav-lock")
  const btnNavLogout = document.getElementById("btn-nav-logout")
  const btnNavSync = document.getElementById("btn-nav-sync")

  // ----------------------------------------------------
  // Drawer Interactions
  // ----------------------------------------------------
  async function openDrawer() {
    if (drawerBackdrop) drawerBackdrop.style.display = "block"
    if (appDrawer) appDrawer.style.display = "flex"

    try {
      const sData = await storage.get(["user", "serverUrl"])
      if (sData?.user) {
        updateDrawerUserInfo(sData.user, sData.serverUrl)
      }
    } catch {}
  }

  function closeDrawer() {
    if (drawerBackdrop) drawerBackdrop.style.display = "none"
    if (appDrawer) appDrawer.style.display = "none"
  }

  const headerBrandTitle = document.getElementById("header-brand-title")

  btnMenuDrawer?.addEventListener("click", openDrawer)
  headerBrandTitle?.addEventListener("click", openDrawer)
  drawerBackdrop?.addEventListener("click", closeDrawer)

  // ----------------------------------------------------
  // Settings Modal Interactions & Storage Persistence
  // ----------------------------------------------------
  async function loadSettings() {
    try {
      const data = await storage.get([
        "autoLockMinutes",
        "clipboardClearSeconds",
        "isDefaultPasswordManager",
        "serverUrl",
        "pinUnlockEnabled",
      ])

      if (selectAutoLock) {
        const val = data.autoLockMinutes !== undefined ? String(data.autoLockMinutes) : "15"
        selectAutoLock.value = val
      }

      if (selectClipboardTimer) {
        const val = data.clipboardClearSeconds !== undefined ? String(data.clipboardClearSeconds) : "30"
        selectClipboardTimer.value = val
      }

      if (toggleDefaultPm) {
        toggleDefaultPm.checked = Boolean(data.isDefaultPasswordManager)
      }

      if (settingServerUrl) {
        settingServerUrl.value = data.serverUrl || "http://localhost:4000"
      }

      if (togglePinUnlock) {
        togglePinUnlock.checked = Boolean(data.pinUnlockEnabled)
      }
      if (pinActiveActions) {
        pinActiveActions.style.display = data.pinUnlockEnabled ? "flex" : "none"
      }
    } catch (err) {
      console.warn("[Akaromi] Failed to load settings:", err)
    }
  }

  async function openSettings() {
    closeDrawer()
    await loadSettings()
    if (modalSettings) modalSettings.style.display = "flex"
  }

  function closeSettings() {
    if (modalSettings) modalSettings.style.display = "none"
  }

  btnNavSettings?.addEventListener("click", openSettings)
  btnSettingsClose?.addEventListener("click", closeSettings)

  // Auto-lock option
  selectAutoLock?.addEventListener("change", async (e) => {
    const minutes = parseInt(e.target.value, 10)
    await storage.set({ autoLockMinutes: minutes })
    ext.runtime.sendMessage({ action: "SET_AUTO_LOCK", payload: { minutes } }).catch(() => {})
    showToast("Auto-lock timer updated")
  })

  // Clipboard clear timer option
  selectClipboardTimer?.addEventListener("change", async (e) => {
    const seconds = parseInt(e.target.value, 10)
    await storage.set({ clipboardClearSeconds: seconds })
    showToast("Clipboard timer updated")
  })

  // Default Password Manager Toggle
  toggleDefaultPm?.addEventListener("change", async (e) => {
    const isDefault = e.target.checked
    await storage.set({ isDefaultPasswordManager: isDefault })
    ext.runtime.sendMessage({
      action: "SET_DEFAULT_PM",
      payload: { isDefault },
    }).catch(() => {})
    showToast(isDefault ? "Set as default manager" : "Disabled default manager")
  })

  // Server URL update in settings
  btnSaveSettingsServer?.addEventListener("click", async () => {
    const url = settingServerUrl?.value.trim()
    if (!url) return
    await IrisApi.setServerUrl(url)
    await storage.set({ serverUrl: url })
    if (drawerUserServer) drawerUserServer.textContent = url.replace(/^https?:\/\//, "")
    showToast("Server URL saved")
  })

  // ----------------------------------------------------
  // PIN Unlock Setup
  // ----------------------------------------------------
  togglePinUnlock?.addEventListener("change", (e) => {
    if (e.target.checked) {
      openPinSetupModal()
    } else {
      ext.runtime.sendMessage({ action: "DISABLE_PIN_UNLOCK" }).then(() => {
        if (pinActiveActions) pinActiveActions.style.display = "none"
        showToast("PIN unlock disabled")
      })
    }
  })

  btnChangePin?.addEventListener("click", openPinSetupModal)

  function openPinSetupModal() {
    if (modalPinSetup) modalPinSetup.style.display = "flex"
    if (pinSetupNew) pinSetupNew.value = ""
    if (pinSetupConfirm) pinSetupConfirm.value = ""
    if (pinSetupError) pinSetupError.style.display = "none"
    requestAnimationFrame(() => pinSetupNew?.focus({ preventScroll: true }))
  }

  function closePinSetupModal() {
    if (modalPinSetup) modalPinSetup.style.display = "none"
  }

  btnPinSetupCancel?.addEventListener("click", () => {
    closePinSetupModal()
    // If PIN was not enabled, revert toggle
    ext.runtime.sendMessage({ action: "GET_STATUS" }, (resp) => {
      if (togglePinUnlock) togglePinUnlock.checked = Boolean(resp?.pinUnlockEnabled)
    })
  })

  btnTogglePinSetupEye?.addEventListener("click", () => {
    if (!pinSetupNew || !pinSetupConfirm) return
    if (pinSetupNew.type === "password") {
      pinSetupNew.type = "text"
      pinSetupConfirm.type = "text"
      IrisIcons.swap(btnTogglePinSetupEye, "eye-off")
    } else {
      pinSetupNew.type = "password"
      pinSetupConfirm.type = "password"
      IrisIcons.swap(btnTogglePinSetupEye, "eye")
    }
  })

  formPinSetup?.addEventListener("submit", async (e) => {
    e.preventDefault()
    if (pinSetupError) pinSetupError.style.display = "none"
    const pin = pinSetupNew?.value.trim() || ""
    const confirm = pinSetupConfirm?.value.trim() || ""

    if (pin.length < 4) {
      if (pinSetupError) {
        pinSetupError.textContent = "PIN must be at least 4 digits"
        pinSetupError.style.display = "block"
      }
      return
    }
    if (pin !== confirm) {
      if (pinSetupError) {
        pinSetupError.textContent = "PINs do not match"
        pinSetupError.style.display = "block"
      }
      return
    }

    try {
      const res = await ext.runtime.sendMessage({
        action: "SETUP_PIN_UNLOCK",
        payload: { pin },
      })
      if (res?.success) {
        closePinSetupModal()
        if (togglePinUnlock) togglePinUnlock.checked = true
        if (pinActiveActions) pinActiveActions.style.display = "flex"
        showToast("PIN unlock configured")
      } else {
        if (pinSetupError) {
          pinSetupError.textContent = res?.error || "Failed to set up PIN"
          pinSetupError.style.display = "block"
        }
      }
    } catch (err) {
      if (pinSetupError) {
        pinSetupError.textContent = err.message
        pinSetupError.style.display = "block"
      }
    }
  })

  // ----------------------------------------------------
  // Drawer Session Actions
  // ----------------------------------------------------
  btnNavLock?.addEventListener("click", async () => {
    closeDrawer()
    await ext.runtime.sendMessage({ action: "LOCK_VAULT" })
    global.AkaromiAuth?.showLockedView()
    showToast("Vault locked")
  })

  btnNavLogout?.addEventListener("click", async () => {
    if (confirm("Log out of this account?")) {
      closeDrawer()
      await ext.runtime.sendMessage({ action: "LOGOUT" })
      global.AkaromiAuth?.showLoginView()
      showToast("Logged out")
    }
  })

  btnNavSync?.addEventListener("click", async () => {
    closeDrawer()
    showToast("Syncing vault...")
    try {
      await ext.runtime.sendMessage({ action: "SYNC_VAULT", payload: { force: true } })
      await global.AkaromiVault?.loadVaultData()
      showToast("Vault up to date")
    } catch (err) {
      showToast("Sync error: " + (err.message || "Failed"))
    }
  })

  function updateDrawerUserInfo(user, serverUrl) {
    if (!user) return
    if (state) state.currentUser = user

    const customization = global.AkaromiCustomization
    const profile = customization ? customization.getProfileCustomization(user.customization) : {}

    const nameToShow = profile.displayName || user.displayName || user.name || user.username || "Akaromi User"
    const initials = nameToShow.trim().charAt(0).toUpperCase() || "A"
    const statusText = profile.statusText || user.statusText || ""
    const username = user.username ? `@${user.username}` : (user.email || "")

    const activeNameplate = profile.nameplateUrl || user.sidebarCardBackgroundUrl || user.nameplateUrl
    const avatarUrl = profile.avatarUrl || user.avatarUrl
    const avatarFrame = profile.avatarFrame || user.avatarFrame

    const cleanServer = (serverUrl || "localhost:4000").replace(/^https?:\/\//, "").replace(/\/$/, "")

    // 1. Nameplate Background & Overlay
    const nameplateEl = document.getElementById("user-card-nameplate")
    const overlayEl = document.getElementById("user-card-nameplate-overlay")
    const drawerCard = document.getElementById("drawer-user-card")

    if (activeNameplate && customization) {
      const fullUrl = customization.resolveMediaUrl(activeNameplate, serverUrl)
      if (nameplateEl) {
        nameplateEl.style.backgroundImage = `url("${fullUrl}")`
        nameplateEl.style.display = "block"
      }
      if (overlayEl) overlayEl.style.display = "block"
      if (drawerCard) drawerCard.classList.add("has-nameplate")
    } else {
      if (nameplateEl) nameplateEl.style.display = "none"
      if (overlayEl) overlayEl.style.display = "none"
      if (drawerCard) drawerCard.classList.remove("has-nameplate")
    }

    // 2. Avatar & Avatar Frame
    const avatarFallback = document.getElementById("drawer-avatar-fallback")
    const avatarImg = document.getElementById("drawer-avatar-img")
    const avatarFrameEl = document.getElementById("drawer-avatar-frame")

    if (avatarFallback) avatarFallback.textContent = initials

    if (avatarUrl && customization) {
      const fullAvatar = customization.resolveMediaUrl(avatarUrl, serverUrl)
      if (avatarImg) {
        avatarImg.src = fullAvatar
        avatarImg.style.display = "block"
        if (avatarFallback) avatarFallback.style.display = "none"
        avatarImg.onerror = () => {
          avatarImg.style.display = "none"
          if (avatarFallback) avatarFallback.style.display = "flex"
        }
      }
    } else {
      if (avatarImg) avatarImg.style.display = "none"
      if (avatarFallback) avatarFallback.style.display = "flex"
    }

    if (avatarFrame && customization && customization.isValidImageUrl(avatarFrame)) {
      const fullFrame = customization.resolveMediaUrl(avatarFrame, serverUrl)
      if (avatarFrameEl) {
        avatarFrameEl.src = fullFrame
        avatarFrameEl.style.display = "block"
      }
    } else {
      if (avatarFrameEl) avatarFrameEl.style.display = "none"
    }

    // 3. Display Name & Display Name Style
    const nameEl = document.getElementById("drawer-user-name")
    if (nameEl) {
      nameEl.textContent = nameToShow
      nameEl.title = nameToShow

      // Reset inline styles
      nameEl.removeAttribute("style")

      const styleConfig = profile.displayNameStyle || user.displayNameStyle
      if (styleConfig && customization) {
        const cssStyles = customization.getDisplayNameStyleCss(styleConfig)
        for (const [prop, val] of Object.entries(cssStyles)) {
          nameEl.style[prop] = val
        }
        const effectClass = customization.getDisplayNameEffectClasses(styleConfig.effect)
        nameEl.className = `user-card-name ${activeNameplate ? "has-nameplate" : ""} ${effectClass}`.trim()
      } else {
        nameEl.className = `user-card-name ${activeNameplate ? "has-nameplate" : ""}`.trim()
      }
    }

    // 4. Subtitle (statusText / username / server)
    const statusEl = document.getElementById("drawer-user-status")
    const serverEl = document.getElementById("drawer-user-server")

    if (statusEl) {
      if (statusText) {
        statusEl.textContent = statusText
        statusEl.title = statusText
        statusEl.style.display = "block"
        if (activeNameplate) statusEl.classList.add("has-nameplate")
        else statusEl.classList.remove("has-nameplate")
      } else if (username) {
        statusEl.textContent = username
        statusEl.title = username
        statusEl.style.display = "block"
        if (activeNameplate) statusEl.classList.add("has-nameplate")
        else statusEl.classList.remove("has-nameplate")
      } else {
        statusEl.style.display = "none"
      }
    }

    if (serverEl) {
      serverEl.textContent = cleanServer
      if (activeNameplate) serverEl.classList.add("has-nameplate")
      else serverEl.classList.remove("has-nameplate")
    }

    // 5. Card click action -> User card does not redirect anywhere
    if (drawerCard) {
      drawerCard.onclick = null
      drawerCard.removeAttribute("title")
    }
  }

  global.AkaromiSettings = {
    openDrawer,
    closeDrawer,
    openSettings,
    closeSettings,
    updateDrawerUserInfo,
    loadSettings,
  }
})(typeof window !== "undefined" ? window : globalThis)

/**
 * Akaromi for Firefox — Settings, PIN & Drawer Navigation Module
 */
;(function (global) {
  "use strict"

  const { showToast, ext, storage } = global.AkaromiUtils

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
  const btnDrawerClose = document.getElementById("btn-drawer-close")
  const drawerUserName = document.getElementById("drawer-user-name")
  const drawerUserServer = document.getElementById("drawer-user-server")
  const drawerAvatar = document.getElementById("drawer-avatar")

  const btnNavLock = document.getElementById("btn-nav-lock")
  const btnNavLogout = document.getElementById("btn-nav-logout")
  const btnNavSync = document.getElementById("btn-nav-sync")

  // ----------------------------------------------------
  // Drawer Interactions
  // ----------------------------------------------------
  function openDrawer() {
    if (drawerBackdrop) drawerBackdrop.style.display = "block"
    if (appDrawer) appDrawer.style.display = "flex"
  }

  function closeDrawer() {
    if (drawerBackdrop) drawerBackdrop.style.display = "none"
    if (appDrawer) appDrawer.style.display = "none"
  }

  btnMenuDrawer?.addEventListener("click", openDrawer)
  btnDrawerClose?.addEventListener("click", closeDrawer)
  drawerBackdrop?.addEventListener("click", closeDrawer)

  // ----------------------------------------------------
  // Settings Modal Interactions
  // ----------------------------------------------------
  function openSettings() {
    closeDrawer()
    if (modalSettings) modalSettings.style.display = "flex"
  }

  function closeSettings() {
    if (modalSettings) modalSettings.style.display = "none"
  }

  btnNavSettings?.addEventListener("click", openSettings)
  btnSettingsClose?.addEventListener("click", closeSettings)

  // Auto-lock option
  selectAutoLock?.addEventListener("change", (e) => {
    const minutes = parseInt(e.target.value, 10)
    storage.set({ autoLockMinutes: minutes })
    showToast("Auto-lock timer updated")
  })

  // Clipboard clear timer option
  selectClipboardTimer?.addEventListener("change", (e) => {
    const seconds = parseInt(e.target.value, 10)
    storage.set({ clipboardClearSeconds: seconds })
    showToast("Clipboard timer updated")
  })

  // Default Password Manager Toggle
  toggleDefaultPm?.addEventListener("change", (e) => {
    const isDefault = e.target.checked
    ext.runtime.sendMessage({
      action: "SET_DEFAULT_PM",
      payload: { isDefault },
    })
    showToast(isDefault ? "Set as default manager" : "Disabled default manager")
  })

  // Server URL update in settings
  btnSaveSettingsServer?.addEventListener("click", async () => {
    const url = settingServerUrl?.value.trim()
    if (!url) return
    await IrisApi.setServerUrl(url)
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
    if (drawerUserName) drawerUserName.textContent = user?.name || user?.username || "Akaromi User"
    if (drawerUserServer && serverUrl) {
      drawerUserServer.textContent = serverUrl.replace(/^https?:\/\//, "")
    }
    if (drawerAvatar) {
      const initials = (user?.name || user?.username || "A").slice(0, 1).toUpperCase()
      drawerAvatar.textContent = initials
    }
  }

  global.AkaromiSettings = {
    openDrawer,
    closeDrawer,
    openSettings,
    closeSettings,
    updateDrawerUserInfo,
  }
})(typeof window !== "undefined" ? window : globalThis)

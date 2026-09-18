/**
 * IRIS Pass — Popup Script
 */

const ext = typeof browser !== "undefined" ? browser : chrome
const storage = typeof IrisStorage !== "undefined" ? IrisStorage : ext.storage.local

let currentTab = null
let matchingCiphers = []
let allCiphers = []
let allFolders = []
let generatorMode = "password" // "password" | "passphrase"
let modalGeneratorMode = "password"
let totpInterval = null
let currentUser = null
let currentItemType = "LOGIN" // "LOGIN" | "SSH_KEY"
let currentStatus = null
let clipboardClearSeconds = 30

// Views
const viewLogin = document.getElementById("view-login")
const viewMfa = document.getElementById("view-mfa")
const viewLocked = document.getElementById("view-locked")
const viewUnlocked = document.getElementById("view-unlocked")

// Header Actions
const btnLock = document.getElementById("btn-lock")
const btnSync = document.getElementById("btn-sync")

// Login Screen Elements
const formLogin = document.getElementById("form-login")
const btnLoginTabAccount = document.getElementById("btn-login-tab-account")
const btnLoginTabApiKey = document.getElementById("btn-login-tab-apikey")
const loginAccountFields = document.getElementById("login-account-fields")
const loginApikeyFields = document.getElementById("login-apikey-fields")
const loginIdentifier = document.getElementById("login-identifier")
const loginPassword = document.getElementById("login-password")
const loginApiKey = document.getElementById("login-api-key")
const loginApiMasterPass = document.getElementById("login-api-master-pass")
const loginError = document.getElementById("login-error")
const btnLoginSubmit = document.getElementById("btn-login-submit")
const btnToggleLoginEye = document.getElementById("btn-toggle-login-eye")
const btnToggleApikeyEye = document.getElementById("btn-toggle-apikey-eye")
const btnToggleMasterpassEye = document.getElementById(
  "btn-toggle-masterpass-eye"
)
const toggleServerConfig = document.getElementById("toggle-server-config")
const serverConfigBody = document.getElementById("server-config-body")
const serverConfigSection = toggleServerConfig?.closest(
  ".server-config-section"
)
const loginServerUrl = document.getElementById("login-server-url")
const loginServerLabel = document.getElementById("login-server-label")

// MFA Screen Elements
const formMfa = document.getElementById("form-mfa")
const mfaCode = document.getElementById("mfa-code")
const mfaError = document.getElementById("mfa-error")
const mfaSubtitle = document.getElementById("mfa-subtitle")
const btnMfaSubmit = document.getElementById("btn-mfa-submit")
const btnToggleMfaType = document.getElementById("btn-toggle-mfa-type")
const btnMfaCancel = document.getElementById("btn-mfa-cancel")

// State
let activeLoginMethod = "account" // "account" | "apikey"
let pendingMfa = null // { mfaTicket, allowedMfaTypes, password, mfaType }

// Locked Screen Elements
const unlockError = document.getElementById("unlock-error")
const lockedUserLabel = document.getElementById("locked-user-label")
const lockedAvatarImg = document.getElementById("locked-avatar-img")
const lockedAvatar = document.getElementById("locked-avatar")
const btnSwitchAccount = document.getElementById("btn-switch-account")

// Locked Mode A: PIN
const formUnlockPin = document.getElementById("form-unlock-pin")
const unlockPinInput = document.getElementById("unlock-pin")
const btnUnlockPinSubmit = document.getElementById("btn-unlock-pin-submit")
const btnToggleUnlockPinEye = document.getElementById("btn-toggle-unlock-pin-eye")
const btnForgotPin = document.getElementById("btn-forgot-pin")
const btnUnlockBio = document.getElementById("btn-unlock-bio")

// Locked Mode B: Master Password
const formUnlockPassword = document.getElementById("form-unlock-password")
const unlockPasswordInput = document.getElementById("unlock-password")
const btnUnlockSubmit = document.getElementById("btn-unlock-submit")
const btnToggleUnlockEye = document.getElementById("btn-toggle-unlock-eye")
const btnUsePin = document.getElementById("btn-use-pin")

// Unlocked View Elements
const tabBtns = document.querySelectorAll(".tab-btn")
const tabContents = document.querySelectorAll(".tab-content")
const matchingList = document.getElementById("matching-list")
const matchingBadge = document.getElementById("matching-badge")
const currentDomainLabel = document.getElementById("current-domain-label")
const vaultList = document.getElementById("vault-list")
const vaultSearchInput = document.getElementById("vault-search-input")
const btnQuickAdd = document.getElementById("btn-quick-add")
const btnVaultAdd = document.getElementById("btn-vault-add")

// Edit Cipher Screen Elements
const viewEdit = document.getElementById("view-edit")
const btnEditBack = document.getElementById("btn-edit-back")
const btnEditDelete = document.getElementById("btn-edit-delete")
const editViewTitle = document.getElementById("edit-view-title")
const formEditCipher = document.getElementById("form-edit-cipher")
const editCipherId = document.getElementById("edit-cipher-id")
const editTypeSelectorWrap = document.getElementById("edit-type-selector-wrap")
const btnItemTypeLogin = document.getElementById("btn-item-type-login")
const btnItemTypeSsh = document.getElementById("btn-item-type-ssh")
const editLoginFields = document.getElementById("edit-login-fields")
const editSshFields = document.getElementById("edit-ssh-fields")
const editCipherTitle = document.getElementById("edit-cipher-title")
const editCipherFolder = document.getElementById("edit-cipher-folder")
const editCipherUsername = document.getElementById("edit-cipher-username")
const editCipherPassword = document.getElementById("edit-cipher-password")
const btnToggleEditPassEye = document.getElementById("btn-toggle-edit-pass-eye")
const btnEditGenPass = document.getElementById("btn-edit-gen-pass")
const editUrisList = document.getElementById("edit-uris-list")
const btnAddUri = document.getElementById("btn-add-uri")
const editCipherTotp = document.getElementById("edit-cipher-totp")
const btnToggleEditTotpEye = document.getElementById("btn-toggle-edit-totp-eye")
const btnEditScanQr = document.getElementById("btn-edit-scan-qr")
const btnCopyEditTotp = document.getElementById("btn-copy-edit-totp")
const editCipherNotes = document.getElementById("edit-cipher-notes")
const editError = document.getElementById("edit-error")
const btnEditSave = document.getElementById("btn-edit-save")
const btnEditCancel = document.getElementById("btn-edit-cancel")
const editAdditionalPasswordsList = document.getElementById("edit-additional-passwords-list")
const btnAddAdditionalPass = document.getElementById("btn-add-additional-pass")

// SSH Key Elements
const editSshAlgorithm = document.getElementById("edit-ssh-algorithm")
const btnGenerateSsh = document.getElementById("btn-generate-ssh")
const editSshPublicKey = document.getElementById("edit-ssh-public-key")
const editSshPrivateKey = document.getElementById("edit-ssh-private-key")
const editSshFingerprint = document.getElementById("edit-ssh-fingerprint")
const editSshPassphrase = document.getElementById("edit-ssh-passphrase")

// Edit Passkey Elements
const editPasskeySection = document.getElementById("edit-passkey-section")
const passkeyDomain = document.getElementById("passkey-domain")
const passkeyCreated = document.getElementById("passkey-created")
const btnDeletePasskey = document.getElementById("btn-delete-passkey")
let currentEditingPasskey = null

// Tab Generator Elements
const genOutputText = document.getElementById("gen-output-text")
const btnGenRefresh = document.getElementById("btn-gen-refresh")
const btnGenCopy = document.getElementById("btn-gen-copy")
const btnGenFill = document.getElementById("btn-gen-fill")
const btnTypePassword = document.getElementById("btn-type-password")
const btnTypePassphrase = document.getElementById("btn-type-passphrase")
const genPassControls = document.getElementById("gen-password-controls")
const genPassphraseControls = document.getElementById("gen-passphrase-controls")

const sliderPassLength = document.getElementById("slider-pass-length")
const labelPassLength = document.getElementById("label-pass-length")
const chkUpper = document.getElementById("chk-upper")
const chkLower = document.getElementById("chk-lower")
const chkNums = document.getElementById("chk-nums")
const chkSyms = document.getElementById("chk-syms")
const chkAmbig = document.getElementById("chk-ambig")

const sliderWordsCount = document.getElementById("slider-words-count")
const labelWordsCount = document.getElementById("label-words-count")
const inputSeparator = document.getElementById("input-separator")
const chkCapitalize = document.getElementById("chk-capitalize")
const chkIncludeNum = document.getElementById("chk-include-num")

// Modal Generator Elements
const modalGenerator = document.getElementById("modal-generator")
const btnModalGenClose = document.getElementById("btn-modal-gen-close")
const modalGenOutputText = document.getElementById("modal-gen-output-text")
const btnModalGenRefresh = document.getElementById("btn-modal-gen-refresh")
const btnModalGenCopy = document.getElementById("btn-modal-gen-copy")
const btnModalTypePassword = document.getElementById("btn-modal-type-password")
const btnModalTypePassphrase = document.getElementById("btn-modal-type-passphrase")
const modalGenPassControls = document.getElementById("modal-gen-pass-controls")
const modalGenPhraseControls = document.getElementById("modal-gen-phrase-controls")

const sliderModalPassLength = document.getElementById("slider-modal-pass-length")
const labelModalPassLength = document.getElementById("label-modal-pass-length")
const chkModalUpper = document.getElementById("chk-modal-upper")
const chkModalLower = document.getElementById("chk-modal-lower")
const chkModalNums = document.getElementById("chk-modal-nums")
const chkModalSyms = document.getElementById("chk-modal-syms")
const chkModalAmbig = document.getElementById("chk-modal-ambig")

const sliderModalWordsCount = document.getElementById("slider-modal-words-count")
const labelModalWordsCount = document.getElementById("label-modal-words-count")
const inputModalSeparator = document.getElementById("input-modal-separator")
const chkModalCapitalize = document.getElementById("chk-modal-capitalize")
const chkModalIncludeNum = document.getElementById("chk-modal-include-num")
const btnModalGenApply = document.getElementById("btn-modal-gen-apply")
const btnModalGenCancel = document.getElementById("btn-modal-gen-cancel")

// Categorized Settings Elements
// Account
const accountAvatarWrap = document.querySelector(".account-avatar-wrap")
const accountAvatarImg = document.getElementById("account-avatar-img")
const accountAvatar = document.getElementById("account-avatar")
const accountDisplayName = document.getElementById("account-display-name")
const accountUsername = document.getElementById("account-username")
const accountEmail = document.getElementById("account-email")
const settingAccountServer = document.getElementById("setting-account-server")
const btnSettingsLogout = document.getElementById("btn-settings-logout")

// Security & Unlock
const settingAutoLock = document.getElementById("setting-auto-lock")
const togglePinUnlock = document.getElementById("toggle-pin-unlock")
const pinActiveActions = document.getElementById("pin-active-actions")
const btnChangePin = document.getElementById("btn-change-pin")
const toggleBioUnlock = document.getElementById("toggle-bio-unlock")
const rowBioUnlock = document.getElementById("row-bio-unlock")
const settingClipboardClear = document.getElementById("setting-clipboard-clear")

// Vault & Sync
const labelLastSync = document.getElementById("label-last-sync")
const labelVaultStats = document.getElementById("label-vault-stats")
const btnSettingsSyncNow = document.getElementById("btn-settings-sync-now")

// Autofill & System
const toggleDefaultPm = document.getElementById("toggle-default-pm")
const settingServerUrl = document.getElementById("setting-server-url")
const btnSaveServerUrl = document.getElementById("btn-save-server-url")

// PIN Setup Modal
const modalPinSetup = document.getElementById("modal-pin-setup")
const btnModalPinClose = document.getElementById("btn-modal-pin-close")
const formPinSetup = document.getElementById("form-pin-setup")
const pinSetupNew = document.getElementById("pin-setup-new")
const pinSetupConfirm = document.getElementById("pin-setup-confirm")
const pinSetupError = document.getElementById("pin-setup-error")
const btnTogglePinSetupEye = document.getElementById("btn-toggle-pin-setup-eye")
const btnPinSetupCancel = document.getElementById("btn-pin-setup-cancel")

/**
 * Initialize Popup
 */
async function init() {
  // Load active tab info
  try {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true })
    currentTab = tabs[0]
  } catch (e) { }

  if (currentTab?.url) {
    try {
      const url = new URL(currentTab.url)
      currentDomainLabel.textContent = url.hostname
    } catch {
      currentDomainLabel.textContent = currentTab.url
    }
  } else {
    currentDomainLabel.textContent = "New Tab"
  }

  // Load configured Server URL
  const serverUrl = await IrisApi.getServerUrl()
  loginServerUrl.value = serverUrl
  loginServerLabel.textContent = serverUrl
  settingServerUrl.value = serverUrl
  if (settingAccountServer) settingAccountServer.textContent = serverUrl

  // Check authentication & vault state from background
  ext.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
    currentStatus = response
    currentUser = response?.user || null
    clipboardClearSeconds = response?.clipboardClearSeconds ?? 30

    // Populate settings UI
    populateSettingsUI(response)

    if (!response?.isAuthenticated) {
      showLoginView()
    } else if (!response?.isUnlocked) {
      showLockedView(currentUser, response)
    } else {
      showUnlockedView(currentUser)
    }
  })

  // Initial generator run
  generateCredentials()
}

/**
 * Format Relative Timestamp
 */
function formatRelativeTime(ts) {
  if (!ts || ts === 0) return "Never synced"
  const elapsedSec = Math.floor((Date.now() - ts) / 1000)
  if (elapsedSec < 10) return "Just now"
  if (elapsedSec < 60) return `${elapsedSec}s ago`
  const elapsedMin = Math.floor(elapsedSec / 60)
  if (elapsedMin < 60) return `${elapsedMin}m ago`
  const elapsedHours = Math.floor(elapsedMin / 60)
  if (elapsedHours < 24) return `${elapsedHours}h ago`
  return new Date(ts).toLocaleDateString()
}

/**
 * Resolves user's avatar URL from profile/customization data
 */
function getUserAvatarUrl(user, serverUrl) {
  if (!user) return null
  const avatar =
    user.customization?.profile?.avatarUrl ||
    user.customization?.avatarUrl ||
    user.avatarUrl ||
    user.profile?.avatarUrl ||
    user.picture ||
    user.image ||
    null

  if (!avatar || typeof avatar !== "string") return null
  const trimmed = avatar.trim()
  if (!trimmed) return null

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed
  }

  const base = (serverUrl || "http://localhost:4000").replace(/\/+$/, "")
  return `${base}/${trimmed.replace(/^\/+/, "")}`
}

/**
 * Populate Settings UI from status response
 */
function populateSettingsUI(status) {
  if (!status) return

  // Account
  const user = status.user
  const server = status.serverUrl || "http://localhost:4000"

  if (user) {
    const profileCustom = user.customization?.profile || {}
    const name = profileCustom.displayName || user.displayName || user.username || user.email || "Account"
    const username = user.username ? `@${user.username}` : ""
    const email = user.email || ""
    const initial = (name || "U").charAt(0).toUpperCase()

    if (accountDisplayName) accountDisplayName.textContent = name
    if (accountUsername) accountUsername.textContent = username
    if (accountEmail) accountEmail.textContent = email

    const avatarUrl = getUserAvatarUrl(user, server)
    if (accountAvatarImg && accountAvatar) {
      if (avatarUrl) {
        accountAvatarImg.src = avatarUrl
        accountAvatarImg.style.display = "block"
        accountAvatar.style.display = "none"
        accountAvatarImg.onerror = () => {
          accountAvatarImg.style.display = "none"
          accountAvatar.style.display = "flex"
          accountAvatar.textContent = initial
        }
      } else {
        accountAvatarImg.style.display = "none"
        accountAvatar.style.display = "flex"
        accountAvatar.textContent = initial
      }
    } else if (accountAvatar) {
      accountAvatar.textContent = initial
    }
  }

  if (settingAccountServer) settingAccountServer.textContent = server
  if (settingServerUrl) settingServerUrl.value = server

  // Security
  if (settingAutoLock && status.autoLockMinutes !== undefined) {
    settingAutoLock.value = String(status.autoLockMinutes)
  }

  if (togglePinUnlock) {
    togglePinUnlock.checked = Boolean(status.pinUnlockEnabled)
  }
  if (pinActiveActions) {
    pinActiveActions.style.display = status.pinUnlockEnabled ? "flex" : "none"
  }

  if (toggleBioUnlock) {
    toggleBioUnlock.checked = Boolean(status.biometricUnlockEnabled)
  }

  if (settingClipboardClear && status.clipboardClearSeconds !== undefined) {
    settingClipboardClear.value = String(status.clipboardClearSeconds)
  }

  // Sync
  if (labelLastSync) {
    labelLastSync.textContent = `Last synced: ${formatRelativeTime(status.lastSyncTimestamp)}`
  }
  if (labelVaultStats) {
    labelVaultStats.textContent = `${status.cipherCount || 0} items in local vault`
  }

  // Autofill
  if (toggleDefaultPm) {
    toggleDefaultPm.checked = Boolean(status.isDefaultPasswordManager)
  }

  // Check biometric availability on device
  IrisCrypto.isBiometricsAvailable().then((avail) => {
    if (!avail && rowBioUnlock) {
      rowBioUnlock.style.opacity = "0.5"
      rowBioUnlock.title = "Biometrics not available on this system"
    }
  })
}

/**
 * View Transitions
 */
function showLoginView() {
  viewLogin.style.display = "flex"
  if (viewMfa) viewMfa.style.display = "none"
  if (viewEdit) viewEdit.style.display = "none"
  viewLocked.style.display = "none"
  viewUnlocked.style.display = "none"
  btnLock.style.display = "none"
  btnSync.style.display = "none"
  loginPassword.value = ""
  loginError.style.display = "none"
  pendingMfa = null
  if (totpInterval) clearInterval(totpInterval)
}

function showMfaView(mfaTicket, allowedMfaTypes = ["totp"], password = "") {
  viewLogin.style.display = "none"
  if (viewMfa) viewMfa.style.display = "flex"
  if (viewEdit) viewEdit.style.display = "none"
  viewLocked.style.display = "none"
  viewUnlocked.style.display = "none"
  btnLock.style.display = "none"
  btnSync.style.display = "none"

  pendingMfa = {
    mfaTicket,
    allowedMfaTypes,
    password,
    mfaType: "totp",
  }

  mfaCode.value = ""
  mfaError.style.display = "none"
  mfaCode.placeholder = "000 000"
  mfaCode.maxLength = 10
  mfaSubtitle.textContent = "Enter the 6-digit code from your authenticator app"
  btnToggleMfaType.textContent = "Use backup code instead"
  btnMfaSubmit.disabled = false
  btnMfaSubmit.textContent = "Verify & Unlock"

  setTimeout(() => mfaCode.focus(), 50)
  if (totpInterval) clearInterval(totpInterval)
}

function showLockedView(user, status = currentStatus) {
  viewLogin.style.display = "none"
  if (viewMfa) viewMfa.style.display = "none"
  if (viewEdit) viewEdit.style.display = "none"
  viewLocked.style.display = "flex"
  viewUnlocked.style.display = "none"
  btnLock.style.display = "none"
  btnSync.style.display = "none"

  unlockError.style.display = "none"
  const profileCustom = user?.customization?.profile || {}
  const name = profileCustom.displayName || user?.displayName || user?.username || user?.email || "User"
  const initial = (name || "U").charAt(0).toUpperCase()

  if (user?.username || user?.email) {
    lockedUserLabel.textContent = `Logged in as @${user.username || user.email}`
  } else {
    lockedUserLabel.textContent = "Vault is locked"
  }

  const server = status?.serverUrl || "http://localhost:4000"
  const avatarUrl = getUserAvatarUrl(user, server)

  if (lockedAvatarImg && lockedAvatar) {
    if (avatarUrl) {
      lockedAvatarImg.src = avatarUrl
      lockedAvatarImg.style.display = "block"
      lockedAvatar.style.display = "none"
      lockedAvatarImg.onerror = () => {
        lockedAvatarImg.style.display = "none"
        lockedAvatar.style.display = "flex"
      }
    } else {
      lockedAvatarImg.style.display = "none"
      lockedAvatar.style.display = "flex"
    }
  }

  // Check if PIN unlock is enabled
  const pinEnabled = Boolean(status?.pinUnlockEnabled)
  if (pinEnabled) {
    formUnlockPin.style.display = "flex"
    formUnlockPassword.style.display = "none"
    unlockPinInput.value = ""
    setTimeout(() => unlockPinInput.focus(), 50)

    if (status?.biometricUnlockEnabled) {
      btnUnlockBio.style.display = "flex"
    } else {
      btnUnlockBio.style.display = "none"
    }
  } else {
    formUnlockPin.style.display = "none"
    formUnlockPassword.style.display = "flex"
    btnUsePin.style.display = "none"
    unlockPasswordInput.value = ""
    setTimeout(() => unlockPasswordInput.focus(), 50)
  }

  if (totpInterval) clearInterval(totpInterval)
}

function showUnlockedView(user) {
  viewLogin.style.display = "none"
  if (viewMfa) viewMfa.style.display = "none"
  if (viewEdit) viewEdit.style.display = "none"
  viewLocked.style.display = "none"
  viewUnlocked.style.display = "flex"
  btnLock.style.display = "flex"
  btnSync.style.display = "flex"

  loadMatchingLogins()
  loadAllCiphers()
  startTotpTicker()
}

/**
 * Server Configuration Accordion on Login Screen
 */
if (toggleServerConfig) {
  toggleServerConfig.addEventListener("click", () => {
    const isHidden = serverConfigBody.style.display === "none"
    serverConfigBody.style.display = isHidden ? "flex" : "none"
    serverConfigSection?.classList.toggle("open", isHidden)
  })
}

loginServerUrl?.addEventListener("input", (e) => {
  const url = e.target.value.trim() || "http://localhost:4000"
  loginServerLabel.textContent = url
  settingServerUrl.value = url
})

/**
 * Login Method Tabs (Account vs API Key)
 */
btnLoginTabAccount?.addEventListener("click", () => {
  activeLoginMethod = "account"
  btnLoginTabAccount.classList.add("active")
  btnLoginTabApiKey.classList.remove("active")
  loginAccountFields.style.display = "flex"
  loginApikeyFields.style.display = "none"
  btnLoginSubmit.textContent = "Log In & Unlock"
  loginError.style.display = "none"
  loginIdentifier.focus()
})

btnLoginTabApiKey?.addEventListener("click", () => {
  activeLoginMethod = "apikey"
  btnLoginTabApiKey.classList.add("active")
  btnLoginTabAccount.classList.remove("active")
  loginAccountFields.style.display = "none"
  loginApikeyFields.style.display = "flex"
  btnLoginSubmit.textContent = "Connect & Unlock"
  loginError.style.display = "none"
  loginApiKey.focus()
})

// Toggle password and key visibility
btnToggleLoginEye?.addEventListener("click", () => {
  const isPass = loginPassword.type === "password"
  loginPassword.type = isPass ? "text" : "password"
})

btnToggleApikeyEye?.addEventListener("click", () => {
  const isPass = loginApiKey.type === "password"
  loginApiKey.type = isPass ? "text" : "password"
})

btnToggleMasterpassEye?.addEventListener("click", () => {
  const isPass = loginApiMasterPass.type === "password"
  loginApiMasterPass.type = isPass ? "text" : "password"
})

/**
 * Login Form Submission (Account or API Key)
 */
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault()
  const serverUrl = loginServerUrl.value.trim() || "http://localhost:4000"
  loginError.style.display = "none"

  if (activeLoginMethod === "account") {
    const identifier = loginIdentifier.value.trim()
    const password = loginPassword.value

    if (!identifier || !password) return

    btnLoginSubmit.disabled = true
    btnLoginSubmit.textContent = "Signing In..."

    ext.runtime.sendMessage(
      {
        action: "LOGIN",
        payload: { identifier, password, serverUrl },
      },
      (res) => {
        btnLoginSubmit.disabled = false
        btnLoginSubmit.textContent = "Log In & Unlock"

        if (res?.mfaRequired) {
          showMfaView(res.mfaTicket, res.allowedMfaTypes, password)
          return
        }

        if (res?.success) {
          currentUser = res.user
          if (res.isUnlocked) {
            showUnlockedView(currentUser)
          } else {
            showLockedView(currentUser)
          }
        } else {
          loginError.textContent = res?.error || "Invalid username or password"
          loginError.style.display = "block"
        }
      }
    )
  } else {
    // API Key Login
    const apiKey = loginApiKey.value.trim()
    const masterPassword = loginApiMasterPass.value

    if (!apiKey) {
      loginError.textContent = "Please enter an API Key"
      loginError.style.display = "block"
      return
    }
    if (!masterPassword) {
      loginError.textContent = "Master password required to decrypt your vault"
      loginError.style.display = "block"
      return
    }

    btnLoginSubmit.disabled = true
    btnLoginSubmit.textContent = "Connecting..."

    ext.runtime.sendMessage(
      {
        action: "LOGIN_API_KEY",
        payload: { apiKey, masterPassword, serverUrl },
      },
      (res) => {
        btnLoginSubmit.disabled = false
        btnLoginSubmit.textContent = "Connect & Unlock"

        if (res?.success) {
          currentUser = res.user
          if (res.isUnlocked) {
            showUnlockedView(currentUser)
          } else {
            showLockedView(currentUser)
          }
        } else {
          loginError.textContent =
            res?.error || "Failed to connect with API key"
          loginError.style.display = "block"
        }
      }
    )
  }
})

/**
 * MFA Form Submission
 */
formMfa?.addEventListener("submit", (e) => {
  e.preventDefault()
  if (!pendingMfa) return

  const code = mfaCode.value.trim().replace(/\s+/g, "")
  if (!code) return

  btnMfaSubmit.disabled = true
  btnMfaSubmit.textContent = "Verifying..."
  mfaError.style.display = "none"

  ext.runtime.sendMessage(
    {
      action: "VERIFY_MFA",
      payload: {
        mfaTicket: pendingMfa.mfaTicket,
        code,
        mfaType: pendingMfa.mfaType || "totp",
        password: pendingMfa.password || "",
      },
    },
    (res) => {
      btnMfaSubmit.disabled = false
      btnMfaSubmit.textContent = "Verify & Unlock"

      if (res?.success) {
        pendingMfa = null
        currentUser = res.user
        if (res.isUnlocked) {
          showUnlockedView(currentUser)
        } else {
          showLockedView(currentUser)
        }
      } else {
        mfaError.textContent = res?.error || "Invalid verification code"
        mfaError.style.display = "block"
      }
    }
  )
})

btnToggleMfaType?.addEventListener("click", () => {
  if (!pendingMfa) return
  const isTotp = pendingMfa.mfaType === "totp"
  pendingMfa.mfaType = isTotp ? "backup_code" : "totp"

  if (pendingMfa.mfaType === "backup_code") {
    mfaSubtitle.textContent = "Enter an 8-character backup recovery code"
    mfaCode.placeholder = "XXXXXXXX"
    mfaCode.maxLength = 32
    btnToggleMfaType.textContent = "Use authenticator app code instead"
  } else {
    mfaSubtitle.textContent =
      "Enter the 6-digit code from your authenticator app"
    mfaCode.placeholder = "000 000"
    mfaCode.maxLength = 10
    btnToggleMfaType.textContent = "Use backup code instead"
  }

  mfaCode.value = ""
  mfaError.style.display = "none"
  mfaCode.focus()
})

btnMfaCancel?.addEventListener("click", () => {
  pendingMfa = null
  showLoginView()
})

/**
 * PIN Unlock Form Submission
 */
formUnlockPin?.addEventListener("submit", (e) => {
  e.preventDefault()
  const pin = unlockPinInput.value.trim()
  if (!pin) return

  btnUnlockPinSubmit.disabled = true
  btnUnlockPinSubmit.textContent = "Unlocking..."
  unlockError.style.display = "none"

  ext.runtime.sendMessage(
    {
      action: "UNLOCK_WITH_PIN",
      payload: { pin },
    },
    (res) => {
      btnUnlockPinSubmit.disabled = false
      btnUnlockPinSubmit.textContent = "Unlock with PIN"

      if (res?.success) {
        showUnlockedView(currentUser)
      } else {
        unlockError.textContent = res?.error || "Incorrect PIN"
        unlockError.style.display = "block"
        unlockPinInput.value = ""
        unlockPinInput.focus()
      }
    }
  )
})

// Toggle PIN visibility
btnToggleUnlockPinEye?.addEventListener("click", () => {
  const isPass = unlockPinInput.type === "password"
  unlockPinInput.type = isPass ? "text" : "password"
})

// Forgot PIN? Switch to Master Password
btnForgotPin?.addEventListener("click", () => {
  formUnlockPin.style.display = "none"
  formUnlockPassword.style.display = "flex"
  btnUsePin.style.display = "block"
  unlockError.style.display = "none"
  unlockPasswordInput.value = ""
  unlockPasswordInput.focus()
})

// Switch back to PIN
btnUsePin?.addEventListener("click", () => {
  formUnlockPassword.style.display = "none"
  formUnlockPin.style.display = "flex"
  unlockError.style.display = "none"
  unlockPinInput.value = ""
  unlockPinInput.focus()
})

// Unlock with Biometrics Button
btnUnlockBio?.addEventListener("click", async () => {
  try {
    const sData = await storage.get(["biometricUnlockData"])
    const bioData = sData.biometricUnlockData
    if (!bioData) throw new Error("Biometrics not set up")

    btnUnlockBio.textContent = "Verifying..."
    btnUnlockBio.disabled = true

    const vaultKey = await IrisCrypto.unlockWithBiometrics(bioData)
    const vaultKeyHex = IrisCrypto.bytesToHex(vaultKey)

    ext.runtime.sendMessage(
      {
        action: "UNLOCK_WITH_BIOMETRICS",
        payload: { vaultKeyHex },
      },
      (res) => {
        btnUnlockBio.disabled = false
        btnUnlockBio.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          Unlock with Biometrics
        `
        if (res?.success) {
          showUnlockedView(currentUser)
        } else {
          unlockError.textContent = res?.error || "Biometric unlock failed"
          unlockError.style.display = "block"
        }
      }
    )
  } catch (err) {
    btnUnlockBio.disabled = false
    btnUnlockBio.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
      Unlock with Biometrics
    `
    unlockError.textContent = err.message || "Biometric authentication cancelled"
    unlockError.style.display = "block"
  }
})

/**
 * Master Password Unlock Form Submission
 */
formUnlockPassword.addEventListener("submit", (e) => {
  e.preventDefault()
  const password = unlockPasswordInput.value.trim()
  if (!password) return

  btnUnlockSubmit.disabled = true
  btnUnlockSubmit.textContent = "Decrypting..."
  unlockError.style.display = "none"

  ext.runtime.sendMessage(
    {
      action: "UNLOCK_VAULT",
      payload: { password },
    },
    (res) => {
      btnUnlockSubmit.disabled = false
      btnUnlockSubmit.textContent = "Unlock Vault"

      if (res?.success) {
        showUnlockedView(currentUser)
      } else {
        unlockError.textContent = res?.error || "Incorrect password"
        unlockError.style.display = "block"
      }
    }
  )
})

// Toggle password visibility on Unlock
btnToggleUnlockEye?.addEventListener("click", () => {
  const isPass = unlockPasswordInput.type === "password"
  unlockPasswordInput.type = isPass ? "text" : "password"
})

/**
 * Completely wipe all extension data and logout
 */
async function performFullLogout() {
  currentUser = null
  currentStatus = null
  allCiphers = []
  allFolders = []
  matchingCiphers = []

  // Reset inputs
  if (loginPassword) loginPassword.value = ""
  if (loginIdentifier) loginIdentifier.value = ""
  if (loginApiKey) loginApiKey.value = ""
  if (loginApiMasterPass) loginApiMasterPass.value = ""
  if (unlockPinInput) unlockPinInput.value = ""
  if (unlockPasswordInput) unlockPasswordInput.value = ""
  if (pinSetupNew) pinSetupNew.value = ""
  if (pinSetupConfirm) pinSetupConfirm.value = ""

  // Reset avatars
  if (accountAvatarImg) {
    accountAvatarImg.src = ""
    accountAvatarImg.style.display = "none"
  }
  if (accountAvatar) {
    accountAvatar.textContent = "U"
    accountAvatar.style.display = "flex"
  }
  if (lockedAvatarImg) {
    lockedAvatarImg.src = ""
    lockedAvatarImg.style.display = "none"
  }
  if (lockedAvatar) {
    lockedAvatar.style.display = "flex"
  }

  // Tell background service worker to wipe memory & storages
  try {
    await new Promise((resolve) => {
      ext.runtime.sendMessage({ action: "LOGOUT" }, () => resolve())
    })
  } catch (e) {}

  // Explicit storage clear from popup context as well
  try {
    await storage.clear()
    if (ext.storage?.local) {
      await ext.storage.local.clear().catch(() => {})
    }
    if (ext.storage?.session) {
      await ext.storage.session.clear().catch(() => {})
    }
  } catch (e) {}

  showLoginView()
}

// Switch Account / Log Out from locked screen
btnSwitchAccount?.addEventListener("click", () => {
  performFullLogout()
})

// Log Out from Settings tab
btnSettingsLogout?.addEventListener("click", () => {
  performFullLogout()
})

// Lock Vault Button (Header)
btnLock.addEventListener("click", () => {
  ext.runtime.sendMessage({ action: "LOCK_VAULT" }, () => {
    showLockedView(currentUser)
  })
})

// Sync Vault Button (Header & Settings)
function triggerVaultSync() {
  btnSync.classList.add("spinning")
  if (btnSettingsSyncNow) {
    btnSettingsSyncNow.disabled = true
    btnSettingsSyncNow.textContent = "Syncing..."
  }

  ext.runtime.sendMessage({ action: "SYNC_VAULT" }, (res) => {
    btnSync.classList.remove("spinning")
    if (btnSettingsSyncNow) {
      btnSettingsSyncNow.disabled = false
      btnSettingsSyncNow.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: -1px;">
          <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>
        </svg>
        Sync Now
      `
    }

    if (res?.success) {
      if (labelLastSync) {
        labelLastSync.textContent = `Last synced: ${formatRelativeTime(res.lastSyncTimestamp)}`
      }
      if (labelVaultStats) {
        labelVaultStats.textContent = `${res.cipherCount || 0} items in local vault`
      }
      loadMatchingLogins()
      loadAllCiphers()
    }
  })
}

btnSync.addEventListener("click", triggerVaultSync)
btnSettingsSyncNow?.addEventListener("click", triggerVaultSync)

/**
 * Settings Tab Listeners
 */
// Auto-lock timer
settingAutoLock?.addEventListener("change", async (e) => {
  const minutes = parseInt(e.target.value, 10)
  await storage.set({ autoLockMinutes: minutes })
})

// PIN unlock toggle
togglePinUnlock?.addEventListener("change", async (e) => {
  if (e.target.checked) {
    // Open PIN setup modal
    openPinSetupModal()
  } else {
    // Disable PIN unlock
    ext.runtime.sendMessage({ action: "DISABLE_PIN_UNLOCK" }, (res) => {
      if (res?.success) {
        pinActiveActions.style.display = "none"
      }
    })
  }
})

btnChangePin?.addEventListener("click", () => {
  openPinSetupModal()
})

function openPinSetupModal() {
  modalPinSetup.style.display = "flex"
  pinSetupNew.value = ""
  pinSetupConfirm.value = ""
  pinSetupError.style.display = "none"
  setTimeout(() => pinSetupNew.focus(), 50)
}

function closePinSetupModal() {
  modalPinSetup.style.display = "none"
  // If PIN was not active, reset toggle
  storage.get(["pinUnlockEnabled"]).then((res) => {
    togglePinUnlock.checked = Boolean(res.pinUnlockEnabled)
  })
}

btnModalPinClose?.addEventListener("click", closePinSetupModal)
btnPinSetupCancel?.addEventListener("click", closePinSetupModal)

btnTogglePinSetupEye?.addEventListener("click", () => {
  const isPass = pinSetupNew.type === "password"
  pinSetupNew.type = isPass ? "text" : "password"
  pinSetupConfirm.type = isPass ? "text" : "password"
})

formPinSetup?.addEventListener("submit", (e) => {
  e.preventDefault()
  const pin = pinSetupNew.value.trim()
  const confirm = pinSetupConfirm.value.trim()

  if (pin.length < 4) {
    pinSetupError.textContent = "PIN must be at least 4 digits"
    pinSetupError.style.display = "block"
    return
  }

  if (pin !== confirm) {
    pinSetupError.textContent = "PINs do not match"
    pinSetupError.style.display = "block"
    return
  }

  ext.runtime.sendMessage(
    {
      action: "SETUP_PIN_UNLOCK",
      payload: { pin },
    },
    (res) => {
      if (res?.success) {
        togglePinUnlock.checked = true
        pinActiveActions.style.display = "flex"
        modalPinSetup.style.display = "none"
      } else {
        pinSetupError.textContent = res?.error || "Failed to save PIN"
        pinSetupError.style.display = "block"
      }
    }
  )
})

// Biometric unlock toggle
toggleBioUnlock?.addEventListener("change", async (e) => {
  if (e.target.checked) {
    try {
      // Need vaultKey from session or memory
      const storage = await ext.storage.session?.get(["vaultKeyHex"])
      if (!storage?.vaultKeyHex) {
        toggleBioUnlock.checked = false
        alert("Please unlock your vault first to set up Biometrics")
        return
      }

      const vaultKey = IrisCrypto.hexToBytes(storage.vaultKeyHex)
      const bioData = await IrisCrypto.setupBiometricUnlock(vaultKey, currentUser)

      ext.runtime.sendMessage(
        {
          action: "SETUP_BIOMETRIC_UNLOCK",
          payload: { bioData },
        },
        (res) => {
          if (!res?.success) {
            toggleBioUnlock.checked = false
            alert(res?.error || "Failed to configure biometrics")
          }
        }
      )
    } catch (err) {
      toggleBioUnlock.checked = false
      alert(err.message || "Biometric enrollment was cancelled")
    }
  } else {
    ext.runtime.sendMessage({ action: "DISABLE_BIOMETRIC_UNLOCK" })
  }
})

// Clipboard clear timeout
settingClipboardClear?.addEventListener("change", async (e) => {
  const seconds = parseInt(e.target.value, 10)
  clipboardClearSeconds = seconds
  await storage.set({ clipboardClearSeconds: seconds })
})

// Default password manager toggle
toggleDefaultPm?.addEventListener("change", (e) => {
  const isDefault = e.target.checked
  ext.runtime.sendMessage({
    action: "SET_DEFAULT_PASSWORD_MANAGER",
    payload: { isDefault },
  })
})

// Save Server URL
btnSaveServerUrl?.addEventListener("click", async () => {
  const url = settingServerUrl.value.trim() || "http://localhost:4000"
  await IrisApi.setServerUrl(url)
  if (settingAccountServer) settingAccountServer.textContent = url
  btnSaveServerUrl.textContent = "Saved!"
  setTimeout(() => (btnSaveServerUrl.textContent = "Save"), 1200)
})

/**
 * Load Matching Logins for Current Tab
 */
function loadMatchingLogins() {
  if (!currentTab?.url) {
    renderMatchingList([])
    return
  }

  ext.runtime.sendMessage(
    { action: "GET_MATCHING_LOGINS", payload: { url: currentTab.url } },
    (res) => {
      matchingCiphers = res?.matches || []
      matchingBadge.textContent = String(matchingCiphers.length)
      renderMatchingList(matchingCiphers)
    }
  )
}

/**
 * Helper to get item favicon or fallback
 */
function getCipherFavicon(cipher) {
  if (cipher?.type === "SSH_KEY") return null
  const uris = cipher?.data?.uris || []
  for (const u of uris) {
    const uriStr = typeof u === "string" ? u : u.uri
    if (uriStr) {
      try {
        const parsed = new URL(uriStr.startsWith("http") ? uriStr : `https://${uriStr}`)
        return `https://icons.duckduckgo.com/ip3/${parsed.hostname}.ico`
      } catch (e) {}
    }
  }
  return null
}

/**
 * Render Matching Logins List
 */
function renderMatchingList(ciphers) {
  matchingList.innerHTML = ""

  if (ciphers.length === 0) {
    matchingList.innerHTML = `
      <div style="padding: 24px 12px; text-align: center; color: #a19da8; font-size: 12px;">
        No matching logins found for this domain.
      </div>
    `
    return
  }

  ciphers.forEach((cipher) => {
    const card = document.createElement("div")
    card.className = "cipher-card"
    const isSsh = cipher.type === "SSH_KEY"
    const username = isSsh ? (cipher.data?.keyType || "SSH Key") : (cipher.data?.username || "Login")
    const favicon = getCipherFavicon(cipher)
    const cardTop = document.createElement("div")
    cardTop.className = "cipher-card-top"

    const leftWrap = document.createElement("div")

    const titleDiv = document.createElement("div")
    titleDiv.className = "cipher-title"
    if (favicon) {
      const favImg = document.createElement("img")
      favImg.src = favicon
      favImg.alt = ""
      favImg.className = "cipher-favicon"
      favImg.style.cssText = "width: 16px; height: 16px; margin-right: 6px; vertical-align: middle; border-radius: 3px;"
      favImg.onerror = () => { favImg.style.display = "none" }
      titleDiv.appendChild(favImg)
    }
    const titleText = document.createTextNode(cipher.title || "")
    titleDiv.appendChild(titleText)

    const userDiv = document.createElement("div")
    userDiv.className = "cipher-user"
    userDiv.textContent = username

    leftWrap.appendChild(titleDiv)
    leftWrap.appendChild(userDiv)

    const typeBadge = document.createElement("span")
    typeBadge.className = "badge"
    typeBadge.style.fontSize = "9px"
    typeBadge.textContent = cipher.type || ""

    cardTop.appendChild(leftWrap)
    cardTop.appendChild(typeBadge)

    const actionsDiv = document.createElement("div")
    actionsDiv.className = "cipher-actions"

    if (isSsh) {
      const btnPub = document.createElement("button")
      btnPub.className = "mini-action-btn"
      btnPub.dataset.action = "copy-ssh-pub"
      btnPub.textContent = "Public"

      const btnPriv = document.createElement("button")
      btnPriv.className = "mini-action-btn"
      btnPriv.dataset.action = "copy-ssh-priv"
      btnPriv.textContent = "Private"

      const btnEdit = document.createElement("button")
      btnEdit.className = "mini-action-btn edit-btn"
      btnEdit.dataset.action = "edit"
      btnEdit.textContent = "Edit"

      actionsDiv.appendChild(btnPub)
      actionsDiv.appendChild(btnPriv)
      actionsDiv.appendChild(btnEdit)
    } else {
      const btnUser = document.createElement("button")
      btnUser.className = "mini-action-btn"
      btnUser.dataset.action = "copy-user"
      btnUser.textContent = "User"

      const btnPass = document.createElement("button")
      btnPass.className = "mini-action-btn"
      btnPass.dataset.action = "copy-pass"
      btnPass.textContent = "Pass"

      actionsDiv.appendChild(btnUser)
      actionsDiv.appendChild(btnPass)

      if (cipher.data?.totpSecret) {
        const btnTotp = document.createElement("button")
        btnTotp.className = "mini-action-btn"
        btnTotp.dataset.action = "copy-totp"
        btnTotp.textContent = "TOTP"
        actionsDiv.appendChild(btnTotp)
      }

      const btnEdit = document.createElement("button")
      btnEdit.className = "mini-action-btn edit-btn"
      btnEdit.dataset.action = "edit"
      btnEdit.textContent = "Edit"

      actionsDiv.appendChild(btnEdit)
    }

    card.appendChild(cardTop)
    card.appendChild(actionsDiv)

    // Clicking anywhere on the card performs autofill
    card.style.cursor = "pointer"
    card.addEventListener("click", () => {
      if (isSsh) {
        openEditCipher(cipher)
      } else {
        ext.runtime.sendMessage({
          action: "PERFORM_AUTOFILL",
          payload: { cipherId: cipher.id, tabId: currentTab?.id },
        })
        window.close()
      }
    })

    card
      .querySelector('[data-action="edit"]')
      .addEventListener("click", (e) => {
        e.stopPropagation()
        openEditCipher(cipher)
      })

    if (!isSsh) {
      card
        .querySelector('[data-action="copy-user"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          copySensitiveValue(
            card.querySelector('[data-action="copy-user"]'),
            cipher.data?.username || "",
            "User",
            false
          )
        })

      card
        .querySelector('[data-action="copy-pass"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          copySensitiveValue(
            card.querySelector('[data-action="copy-pass"]'),
            cipher.data?.password || "",
            "Pass",
            true
          )
        })

      card
        .querySelector('[data-action="copy-totp"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          const btnTotp = card.querySelector('[data-action="copy-totp"]')
          if (cipher.data?.totpSecret) {
            copyTotpValueWithCountdown(btnTotp, cipher.data.totpSecret, "TOTP")
          }
        })
    } else {
      card
        .querySelector('[data-action="copy-ssh-pub"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          copySensitiveValue(
            card.querySelector('[data-action="copy-ssh-pub"]'),
            cipher.data?.publicKey || "",
            "Public",
            false
          )
        })

      card
        .querySelector('[data-action="copy-ssh-priv"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          copySensitiveValue(
            card.querySelector('[data-action="copy-ssh-priv"]'),
            cipher.data?.privateKey || "",
            "Private",
            true
          )
        })
    }

    matchingList.appendChild(card)
  })
}

/**
 * Copy value to clipboard with feedback and auto-clear scheduling
 */
function copySensitiveValue(btn, text, label, isSensitive = false) {
  if (!text) return
  navigator.clipboard.writeText(text)
  const original = btn.textContent
  btn.textContent = "Copied!"
  btn.style.color = "#10b981"
  setTimeout(() => {
    btn.textContent = original
    btn.style.color = ""
  }, 1200)

  if (isSensitive && clipboardClearSeconds > 0) {
    ext.runtime.sendMessage({
      action: "SCHEDULE_CLIPBOARD_CLEAR",
      payload: { text, seconds: clipboardClearSeconds },
    })
  }
}

let activeTotpCountdownInterval = null
let activeTotpCountdownBtn = null
let activeTotpOriginalText = null

/**
 * Copy TOTP value to clipboard with live countdown feedback until the code expires
 */
async function copyTotpValueWithCountdown(btn, rawSecret, originalText = "TOTP") {
  if (!rawSecret || typeof IrisTotp === "undefined") return
  try {
    let secret = rawSecret
    let period = 30
    const parsed = IrisTotp.parseOtpAuthUri(rawSecret)
    if (parsed) {
      secret = parsed.secret
      period = parsed.period || 30
    }
    const code = await IrisTotp.generateTotp(secret, period)
    if (!code) return

    await navigator.clipboard.writeText(code)

    if (clipboardClearSeconds > 0) {
      ext.runtime.sendMessage({
        action: "SCHEDULE_CLIPBOARD_CLEAR",
        payload: { text: code, seconds: clipboardClearSeconds },
      })
    }

    // Launch in-page floating countdown widget on active tab as well
    ext.tabs?.query?.({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs?.[0]?.id) {
        ext.tabs.sendMessage(tabs[0].id, {
          action: "SHOW_TOTP_TIMER",
          payload: {
            secret: rawSecret,
            label: "2FA Code",
            initialCode: code,
          },
        }).catch(() => {})
      }
    }).catch(() => {})

    // Clear any previous active button countdown
    if (activeTotpCountdownInterval) {
      clearInterval(activeTotpCountdownInterval)
      activeTotpCountdownInterval = null
      if (activeTotpCountdownBtn && activeTotpOriginalText) {
        activeTotpCountdownBtn.textContent = activeTotpOriginalText
        activeTotpCountdownBtn.style.color = ""
      }
    }

    activeTotpCountdownBtn = btn
    activeTotpOriginalText = originalText

    function updateTicker() {
      const rem = IrisTotp.getRemainingSeconds(period)
      if (rem <= 1 || rem === period) {
        // Expired
        if (activeTotpCountdownInterval) {
          clearInterval(activeTotpCountdownInterval)
          activeTotpCountdownInterval = null
        }
        btn.textContent = originalText
        btn.style.color = ""
        activeTotpCountdownBtn = null
        activeTotpOriginalText = null
      } else {
        btn.textContent = `Copied! (${rem}s)`
        btn.style.color = "#10b981"
      }
    }

    // Initial state: show "Copied! (28s)"
    const rem = IrisTotp.getRemainingSeconds(period)
    btn.textContent = `Copied! (${rem}s)`
    btn.style.color = "#10b981"

    activeTotpCountdownInterval = setInterval(updateTicker, 1000)
  } catch (err) {
    console.error("Failed to generate and copy TOTP:", err)
  }
}

/**
 * Load All Vault Ciphers & Folders
 */
function loadAllCiphers() {
  ext.runtime.sendMessage({ action: "GET_ALL_CIPHERS" }, (res) => {
    allCiphers = res?.ciphers || []
    allFolders = res?.folders || []
    if (labelVaultStats) {
      labelVaultStats.textContent = `${allCiphers.length} items in local vault`
    }
    renderVaultList(allCiphers)
  })
}

/**
 * Render All Vault Ciphers List
 */
function renderVaultList(ciphers) {
  vaultList.innerHTML = ""

  if (ciphers.length === 0) {
    vaultList.innerHTML = `
      <div style="padding: 24px 12px; text-align: center; color: #a19da8; font-size: 12px;">
        Vault is empty.
      </div>
    `
    return
  }

  ciphers.forEach((cipher) => {
    const card = document.createElement("div")
    card.className = "cipher-card"
    const isSsh = cipher.type === "SSH_KEY"
    const username = isSsh ? (cipher.data?.keyType || "SSH Key") : (cipher.data?.username || "Login")
    const favicon = getCipherFavicon(cipher)
    const cardTop = document.createElement("div")
    cardTop.className = "cipher-card-top"

    const leftWrap = document.createElement("div")

    const titleDiv = document.createElement("div")
    titleDiv.className = "cipher-title"
    if (favicon) {
      const favImg = document.createElement("img")
      favImg.src = favicon
      favImg.alt = ""
      favImg.className = "cipher-favicon"
      favImg.style.cssText = "width: 16px; height: 16px; margin-right: 6px; vertical-align: middle; border-radius: 3px;"
      favImg.onerror = () => { favImg.style.display = "none" }
      titleDiv.appendChild(favImg)
    }
    const titleText = document.createTextNode(cipher.title || "")
    titleDiv.appendChild(titleText)

    const userDiv = document.createElement("div")
    userDiv.className = "cipher-user"
    userDiv.textContent = username

    leftWrap.appendChild(titleDiv)
    leftWrap.appendChild(userDiv)

    const typeBadge = document.createElement("span")
    typeBadge.className = "badge"
    typeBadge.style.fontSize = "9px"
    typeBadge.textContent = cipher.type || ""

    cardTop.appendChild(leftWrap)
    cardTop.appendChild(typeBadge)

    const actionsDiv = document.createElement("div")
    actionsDiv.className = "cipher-actions"

    if (isSsh) {
      const btnPub = document.createElement("button")
      btnPub.className = "mini-action-btn"
      btnPub.dataset.action = "copy-ssh-pub"
      btnPub.textContent = "Public"

      const btnPriv = document.createElement("button")
      btnPriv.className = "mini-action-btn"
      btnPriv.dataset.action = "copy-ssh-priv"
      btnPriv.textContent = "Private"

      const btnEdit = document.createElement("button")
      btnEdit.className = "mini-action-btn edit-btn"
      btnEdit.dataset.action = "edit"
      btnEdit.textContent = "Edit"

      actionsDiv.appendChild(btnPub)
      actionsDiv.appendChild(btnPriv)
      actionsDiv.appendChild(btnEdit)
    } else {
      const btnUser = document.createElement("button")
      btnUser.className = "mini-action-btn"
      btnUser.dataset.action = "copy-user"
      btnUser.textContent = "User"

      const btnPass = document.createElement("button")
      btnPass.className = "mini-action-btn"
      btnPass.dataset.action = "copy-pass"
      btnPass.textContent = "Pass"

      actionsDiv.appendChild(btnUser)
      actionsDiv.appendChild(btnPass)

      if (cipher.data?.totpSecret) {
        const btnTotp = document.createElement("button")
        btnTotp.className = "mini-action-btn"
        btnTotp.dataset.action = "copy-totp"
        btnTotp.textContent = "TOTP"
        actionsDiv.appendChild(btnTotp)
      }

      const btnEdit = document.createElement("button")
      btnEdit.className = "mini-action-btn edit-btn"
      btnEdit.dataset.action = "edit"
      btnEdit.textContent = "Edit"

      actionsDiv.appendChild(btnEdit)
    }

    card.appendChild(cardTop)
    card.appendChild(actionsDiv)

    // Clicking anywhere on the card performs autofill (if login) or open edit (if ssh)
    card.style.cursor = "pointer"
    card.addEventListener("click", () => {
      if (isSsh) {
        openEditCipher(cipher)
      } else {
        ext.runtime.sendMessage({
          action: "PERFORM_AUTOFILL",
          payload: { cipherId: cipher.id, tabId: currentTab?.id },
        })
        window.close()
      }
    })

    card
      .querySelector('[data-action="edit"]')
      .addEventListener("click", (e) => {
        e.stopPropagation()
        openEditCipher(cipher)
      })

    if (!isSsh) {
      card
        .querySelector('[data-action="copy-user"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          copySensitiveValue(
            card.querySelector('[data-action="copy-user"]'),
            cipher.data?.username || "",
            "User",
            false
          )
        })

      card
        .querySelector('[data-action="copy-pass"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          copySensitiveValue(
            card.querySelector('[data-action="copy-pass"]'),
            cipher.data?.password || "",
            "Pass",
            true
          )
        })

      card
        .querySelector('[data-action="copy-totp"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          const btnTotp = card.querySelector('[data-action="copy-totp"]')
          if (cipher.data?.totpSecret) {
            copyTotpValueWithCountdown(btnTotp, cipher.data.totpSecret, "TOTP")
          }
        })
    } else {
      card
        .querySelector('[data-action="copy-ssh-pub"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          copySensitiveValue(
            card.querySelector('[data-action="copy-ssh-pub"]'),
            cipher.data?.publicKey || "",
            "Public",
            false
          )
        })

      card
        .querySelector('[data-action="copy-ssh-priv"]')
        ?.addEventListener("click", (e) => {
          e.stopPropagation()
          copySensitiveValue(
            card.querySelector('[data-action="copy-ssh-priv"]'),
            cipher.data?.privateKey || "",
            "Private",
            true
          )
        })
    }

    vaultList.appendChild(card)
  })
}

function escapeHtml(str) {
  if (!str) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Additional Password Row Helper
 */
function createAdditionalPasswordRow(ap = null) {
  const row = document.createElement("div")
  row.className = "additional-pass-row"
  row.dataset.id = ap?.id || `ap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const topWrap = document.createElement("div")
  topWrap.style.cssText = "display: flex; gap: 6px; align-items: center;"

  const nameInput = document.createElement("input")
  nameInput.type = "text"
  nameInput.className = "additional-pass-name"
  nameInput.placeholder = "Name (e.g. PIN, Backup Code)"
  nameInput.value = ap?.name || ""
  nameInput.style.cssText = "flex: 1; font-size: 11px; padding: 6px 8px;"

  const removeBtn = document.createElement("button")
  removeBtn.type = "button"
  removeBtn.className = "icon-btn danger btn-remove-add-pass"
  removeBtn.title = "Remove"
  removeBtn.style.cssText = "width: 28px; height: 28px; flex-shrink: 0;"

  const remSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  remSvg.setAttribute("viewBox", "0 0 24 24")
  remSvg.style.cssText = "width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2;"
  const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line")
  l1.setAttribute("x1", "18")
  l1.setAttribute("y1", "6")
  l1.setAttribute("x2", "6")
  l1.setAttribute("y2", "18")
  const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line")
  l2.setAttribute("x1", "6")
  l2.setAttribute("y1", "6")
  l2.setAttribute("x2", "18")
  l2.setAttribute("y2", "18")
  remSvg.appendChild(l1)
  remSvg.appendChild(l2)
  removeBtn.appendChild(remSvg)

  topWrap.appendChild(nameInput)
  topWrap.appendChild(removeBtn)

  const inputWrap = document.createElement("div")
  inputWrap.className = "input-wrap"
  inputWrap.style.cssText = "margin-top: 2px;"

  const valInput = document.createElement("input")
  valInput.type = "password"
  valInput.className = "additional-pass-value font-mono"
  valInput.placeholder = "Secret or Code"
  valInput.value = ap?.value || ""
  valInput.style.fontSize = "12px"

  const eyeBtn = document.createElement("button")
  eyeBtn.type = "button"
  eyeBtn.className = "eye-btn btn-toggle-add-pass-eye"
  eyeBtn.tabIndex = -1

  const eyeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  eyeSvg.setAttribute("viewBox", "0 0 24 24")
  const eyePath = document.createElementNS("http://www.w3.org/2000/svg", "path")
  eyePath.setAttribute("d", "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z")
  const eyeCirc = document.createElementNS("http://www.w3.org/2000/svg", "circle")
  eyeCirc.setAttribute("cx", "12")
  eyeCirc.setAttribute("cy", "12")
  eyeCirc.setAttribute("r", "3")
  eyeSvg.appendChild(eyePath)
  eyeSvg.appendChild(eyeCirc)
  eyeBtn.appendChild(eyeSvg)

  inputWrap.appendChild(valInput)
  inputWrap.appendChild(eyeBtn)

  row.appendChild(topWrap)
  row.appendChild(inputWrap)

  removeBtn.addEventListener("click", () => {
    row.remove()
  })

  eyeBtn.addEventListener("click", () => {
    const isPass = valInput.type === "password"
    valInput.type = isPass ? "text" : "password"
  })

  return row
}

/**
 * Multi-URL Row Helper
 */
function createUriRow(uriObj = null) {
  const row = document.createElement("div")
  row.className = "uri-row"

  const uriVal = typeof uriObj === "string" ? uriObj : uriObj?.uri || ""
  const matchVal = typeof uriObj === "object" && uriObj?.match !== undefined ? uriObj.match : 0

  const uriInput = document.createElement("input")
  uriInput.type = "text"
  uriInput.className = "uri-input"
  uriInput.placeholder = "https://example.com"
  uriInput.value = uriVal

  const matchSelect = document.createElement("select")
  matchSelect.className = "match-select"

  const matchOptions = [
    { val: "0", label: "Base Domain" },
    { val: "1", label: "Host" },
    { val: "2", label: "Starts With" },
    { val: "3", label: "Exact" },
    { val: "4", label: "Regex" },
    { val: "5", label: "Never" },
  ]

  matchOptions.forEach((opt) => {
    const optEl = document.createElement("option")
    optEl.value = opt.val
    optEl.selected = Number(opt.val) === matchVal
    optEl.textContent = opt.label
    matchSelect.appendChild(optEl)
  })

  const removeBtn = document.createElement("button")
  removeBtn.type = "button"
  removeBtn.className = "icon-btn danger btn-remove-uri"
  removeBtn.title = "Remove URL"

  const remSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  remSvg.setAttribute("viewBox", "0 0 24 24")
  remSvg.style.cssText = "width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2;"
  const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line")
  l1.setAttribute("x1", "18")
  l1.setAttribute("y1", "6")
  l1.setAttribute("x2", "6")
  l1.setAttribute("y2", "18")
  const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line")
  l2.setAttribute("x1", "6")
  l2.setAttribute("y1", "6")
  l2.setAttribute("x2", "18")
  l2.setAttribute("y2", "18")
  remSvg.appendChild(l1)
  remSvg.appendChild(l2)
  removeBtn.appendChild(remSvg)

  row.appendChild(uriInput)
  row.appendChild(matchSelect)
  row.appendChild(removeBtn)

  removeBtn.addEventListener("click", () => {
    row.remove()
  })

  return row
}

btnAddUri?.addEventListener("click", () => {
  editUrisList.appendChild(createUriRow())
})

btnAddAdditionalPass?.addEventListener("click", () => {
  editAdditionalPasswordsList.appendChild(createAdditionalPasswordRow())
})

/**
 * Tab Switching
 */
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabId = btn.getAttribute("data-tab")
    tabBtns.forEach((b) => b.classList.remove("active"))
    tabContents.forEach((c) => c.classList.remove("active"))

    btn.classList.add("active")
    document.getElementById(tabId)?.classList.add("active")
  })
})

/**
 * Vault Search Filter
 */
vaultSearchInput?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim()
  if (!query) {
    renderVaultList(allCiphers)
    return
  }

  const filtered = allCiphers.filter((cipher) => {
    const title = (cipher.title || "").toLowerCase()
    const username = (cipher.data?.username || "").toLowerCase()
    const uris = (cipher.data?.uris || [])
      .map((u) => (typeof u === "string" ? u : u.uri).toLowerCase())
      .join(" ")
    return (
      title.includes(query) ||
      username.includes(query) ||
      uris.includes(query)
    )
  })

  renderVaultList(filtered)
})

/**
 * Open Edit/Create Cipher Screen
 */
btnQuickAdd?.addEventListener("click", () => {
  openCreateCipher(currentTab?.url)
})

btnVaultAdd?.addEventListener("click", () => {
  openCreateCipher(null)
})

function populateFolderOptions(selectedId = "") {
  editCipherFolder.innerHTML = '<option value="">(No Folder)</option>'
  allFolders.forEach((f) => {
    const opt = document.createElement("option")
    opt.value = f.id
    opt.textContent = f.name
    if (f.id === selectedId) opt.selected = true
    editCipherFolder.appendChild(opt)
  })
}

function setItemTypeUI(type) {
  currentItemType = type
  if (type === "SSH_KEY") {
    btnItemTypeSsh.classList.add("active")
    btnItemTypeLogin.classList.remove("active")
    editLoginFields.style.display = "none"
    editSshFields.style.display = "flex"
  } else {
    btnItemTypeLogin.classList.add("active")
    btnItemTypeSsh.classList.remove("active")
    editLoginFields.style.display = "flex"
    editSshFields.style.display = "none"
  }
}

btnItemTypeLogin?.addEventListener("click", () => setItemTypeUI("LOGIN"))
btnItemTypeSsh?.addEventListener("click", () => setItemTypeUI("SSH_KEY"))

btnGenerateSsh?.addEventListener("click", async () => {
  const algo = editSshAlgorithm.value
  btnGenerateSsh.disabled = true
  btnGenerateSsh.textContent = "Generating..."
  try {
    const keypair = await IrisCrypto.generateSshKeypair(algo, "user@iris-pass")
    editSshPublicKey.value = keypair.publicKeyOpenSsh
    editSshPrivateKey.value = keypair.privateKeyPem
    editSshFingerprint.textContent = keypair.fingerprintSha256
  } catch (err) {
    alert("Failed to generate SSH key: " + err.message)
  } finally {
    btnGenerateSsh.disabled = false
    btnGenerateSsh.textContent = "Generate"
  }
})

function openCreateCipher(defaultUrl) {
  viewUnlocked.style.display = "none"
  viewEdit.style.display = "flex"
  btnLock.style.display = "none"
  btnSync.style.display = "none"

  editViewTitle.textContent = "New Item"
  editCipherId.value = ""
  btnEditDelete.style.display = "none"
  editError.style.display = "none"

  editTypeSelectorWrap.style.display = "flex"
  setItemTypeUI("LOGIN")

  editCipherTitle.value = ""
  editCipherUsername.value = ""
  editCipherPassword.value = ""
  editCipherTotp.value = ""
  if (btnCopyEditTotp) btnCopyEditTotp.style.display = "none"
  editCipherNotes.value = ""
  editSshPublicKey.value = ""
  editSshPrivateKey.value = ""
  editSshFingerprint.textContent = ""
  editSshPassphrase.value = ""
  editPasskeySection.style.display = "none"
  currentEditingPasskey = null

  editUrisList.innerHTML = ""
  if (defaultUrl) {
    editUrisList.appendChild(createUriRow({ uri: defaultUrl, match: 0 }))
    try {
      const urlObj = new URL(defaultUrl)
      editCipherTitle.value = urlObj.hostname.replace(/^www\./, "")
    } catch {}
  } else {
    editUrisList.appendChild(createUriRow({ uri: "", match: 0 }))
  }

  editAdditionalPasswordsList.innerHTML = ""
  populateFolderOptions("")
}

function openEditCipher(cipher) {
  viewUnlocked.style.display = "none"
  viewEdit.style.display = "flex"
  btnLock.style.display = "none"
  btnSync.style.display = "none"

  editViewTitle.textContent = "Edit Item"
  editCipherId.value = cipher.id
  btnEditDelete.style.display = "flex"
  editError.style.display = "none"

  editTypeSelectorWrap.style.display = "none"
  setItemTypeUI(cipher.type || "LOGIN")

  editCipherTitle.value = cipher.title || ""
  editCipherUsername.value = cipher.data?.username || ""
  editCipherPassword.value = cipher.data?.password || ""
  editCipherTotp.value = cipher.data?.totpSecret || ""
  if (btnCopyEditTotp) {
    btnCopyEditTotp.style.display = cipher.data?.totpSecret ? "inline-flex" : "none"
  }
  editCipherNotes.value = cipher.data?.notes || ""

  // SSH Key fields
  if (cipher.type === "SSH_KEY") {
    editSshPublicKey.value = cipher.data?.publicKey || ""
    editSshPrivateKey.value = cipher.data?.privateKey || ""
    editSshFingerprint.textContent = cipher.data?.fingerprint || ""
    editSshPassphrase.value = cipher.data?.passphrase || ""
  }

  // Populate URIs
  editUrisList.innerHTML = ""
  const uris = cipher.data?.uris || []
  if (uris.length > 0) {
    uris.forEach((u) => editUrisList.appendChild(createUriRow(u)))
  } else {
    editUrisList.appendChild(createUriRow({ uri: "", match: 0 }))
  }

  // Populate Additional Passwords
  editAdditionalPasswordsList.innerHTML = ""
  const addPasses = cipher.data?.additionalPasswords || []
  addPasses.forEach((ap) => {
    editAdditionalPasswordsList.appendChild(createAdditionalPasswordRow(ap))
  })

  // Passkey Section
  if (cipher.data?.passkey) {
    currentEditingPasskey = cipher.data.passkey
    passkeyDomain.textContent = currentEditingPasskey.rpId || "Unknown"
    passkeyCreated.textContent = currentEditingPasskey.createdAt
      ? new Date(currentEditingPasskey.createdAt).toLocaleDateString()
      : "Stored"
    editPasskeySection.style.display = "block"
  } else {
    currentEditingPasskey = null
    editPasskeySection.style.display = "none"
  }

  populateFolderOptions(cipher.folderId || "")
}

btnDeletePasskey?.addEventListener("click", () => {
  if (confirm("Are you sure you want to remove this passkey?")) {
    currentEditingPasskey = null
    editPasskeySection.style.display = "none"
  }
})

btnEditBack?.addEventListener("click", () => {
  viewEdit.style.display = "none"
  viewUnlocked.style.display = "flex"
  btnLock.style.display = "flex"
  btnSync.style.display = "flex"
})

btnEditCancel?.addEventListener("click", () => {
  btnEditBack.click()
})

btnToggleEditPassEye?.addEventListener("click", () => {
  const isPass = editCipherPassword.type === "password"
  editCipherPassword.type = isPass ? "text" : "password"
})

btnToggleEditTotpEye?.addEventListener("click", () => {
  const isPass = editCipherTotp.type === "password"
  editCipherTotp.type = isPass ? "text" : "password"
})

editCipherTotp?.addEventListener("input", () => {
  if (btnCopyEditTotp) {
    btnCopyEditTotp.style.display = editCipherTotp.value.trim() ? "inline-flex" : "none"
  }
})

btnCopyEditTotp?.addEventListener("click", () => {
  const raw = editCipherTotp.value.trim()
  if (raw) {
    copyTotpValueWithCountdown(btnCopyEditTotp, raw, "Copy TOTP")
  }
})

// Trigger in-page screen QR selection
btnEditScanQr?.addEventListener("click", async () => {
  try {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      ext.tabs.sendMessage(tabs[0].id, { action: "START_QR_CAPTURE" })
      window.close() // Close popup so user can drag crop box on active tab
    }
  } catch (err) {
    alert("Could not activate screen scan on this page: " + err.message)
  }
})

// Check if a scanned QR code was deposited in session storage from a previous crop
ext.storage?.session?.get(["pendingScannedTotp"]).then((data) => {
  if (data?.pendingScannedTotp?.secret) {
    const secret = data.pendingScannedTotp.secret
    if (editCipherTotp) {
      editCipherTotp.value = secret
      editCipherTotp.type = "text"
      if (btnCopyEditTotp) {
        btnCopyEditTotp.style.display = "inline-flex"
      }
    }
    // Clean up
    ext.storage.session.remove(["pendingScannedTotp"])
  }
})

/**
 * Generator Modal inside Edit Mode
 */
btnEditGenPass?.addEventListener("click", () => {
  modalGenerator.style.display = "flex"
  modalGenOutputText.textContent = generateModalPassword()
})

btnModalGenClose?.addEventListener("click", () => {
  modalGenerator.style.display = "none"
})

btnModalGenCancel?.addEventListener("click", () => {
  modalGenerator.style.display = "none"
})

btnModalTypePassword?.addEventListener("click", () => {
  modalGeneratorMode = "password"
  btnModalTypePassword.classList.add("active")
  btnModalTypePassphrase.classList.remove("active")
  modalGenPassControls.style.display = "flex"
  modalGenPhraseControls.style.display = "none"
  modalGenOutputText.textContent = generateModalPassword()
})

btnModalTypePassphrase?.addEventListener("click", () => {
  modalGeneratorMode = "passphrase"
  btnModalTypePassphrase.classList.add("active")
  btnModalTypePassword.classList.remove("active")
  modalGenPassControls.style.display = "none"
  modalGenPhraseControls.style.display = "flex"
  modalGenOutputText.textContent = generateModalPassword()
})

function generateModalPassword() {
  if (modalGeneratorMode === "password") {
    return IrisCrypto.generatePassword({
      length: parseInt(sliderModalPassLength.value, 10),
      uppercase: chkModalUpper.checked,
      lowercase: chkModalLower.checked,
      numbers: chkModalNums.checked,
      symbols: chkModalSyms.checked,
      avoidAmbiguous: chkModalAmbig.checked,
    })
  } else {
    return IrisCrypto.generatePassphrase({
      wordCount: parseInt(sliderModalWordsCount.value, 10),
      separator: inputModalSeparator.value || "-",
      capitalize: chkModalCapitalize.checked,
      includeNumber: chkModalIncludeNum.checked,
    })
  }
}

btnModalGenRefresh?.addEventListener("click", () => {
  modalGenOutputText.textContent = generateModalPassword()
})

btnModalGenCopy?.addEventListener("click", () => {
  copySensitiveValue(btnModalGenCopy, modalGenOutputText.textContent, "Password", true)
})

btnModalGenApply?.addEventListener("click", () => {
  const generated = modalGenOutputText.textContent
  editCipherPassword.value = generated
  editCipherPassword.type = "text"
  modalGenerator.style.display = "none"
})

sliderModalPassLength?.addEventListener("input", (e) => {
  labelModalPassLength.textContent = e.target.value
  modalGenOutputText.textContent = generateModalPassword()
})

sliderModalWordsCount?.addEventListener("input", (e) => {
  labelModalWordsCount.textContent = e.target.value
  modalGenOutputText.textContent = generateModalPassword()
})

;[
  chkModalUpper,
  chkModalLower,
  chkModalNums,
  chkModalSyms,
  chkModalAmbig,
  chkModalCapitalize,
  chkModalIncludeNum,
  inputModalSeparator,
].forEach((el) => {
  el?.addEventListener("input", () => {
    modalGenOutputText.textContent = generateModalPassword()
  })
})

/**
 * Save Credential Form Submission
 */
formEditCipher?.addEventListener("submit", (e) => {
  e.preventDefault()

  const id = editCipherId.value || null
  const title = editCipherTitle.value.trim()
  const folderId = editCipherFolder.value || null
  const notes = editCipherNotes.value.trim()

  if (!title) {
    editError.textContent = "Item Title is required"
    editError.style.display = "block"
    return
  }

  let cipherType = currentItemType
  let cipherData = {}

  if (cipherType === "LOGIN") {
    const username = editCipherUsername.value.trim()
    const password = editCipherPassword.value
    const totpSecret = editCipherTotp.value.trim()

    // Collect URIs
    const uris = []
    const uriRows = editUrisList.querySelectorAll(".uri-row")
    uriRows.forEach((row) => {
      const u = row.querySelector(".uri-input")?.value?.trim()
      const m = parseInt(row.querySelector(".match-select")?.value || "0", 10)
      if (u) uris.push({ uri: u, match: m })
    })

    // Collect Additional Passwords
    const additionalPasswords = []
    const addRows = editAdditionalPasswordsList.querySelectorAll(".additional-pass-row")
    addRows.forEach((row) => {
      const name = row.querySelector(".additional-pass-name")?.value?.trim() || "Password"
      const val = row.querySelector(".additional-pass-value")?.value || ""
      if (val) {
        additionalPasswords.push({
          id: row.dataset.id || `ap_${Date.now()}`,
          name,
          value: val,
        })
      }
    })

    cipherData = {
      username,
      password,
      uris,
      additionalPasswords,
      totpSecret: totpSecret || undefined,
      notes: notes || undefined,
      passkey: currentEditingPasskey || undefined,
    }
  } else {
    // SSH_KEY
    const publicKey = editSshPublicKey.value.trim()
    const privateKey = editSshPrivateKey.value.trim()
    const fingerprint = editSshFingerprint.textContent.trim()
    const passphrase = editSshPassphrase.value

    cipherData = {
      publicKey,
      privateKey,
      fingerprint: fingerprint || undefined,
      passphrase: passphrase || undefined,
      keyType: editSshAlgorithm.value,
      notes: notes || undefined,
    }
  }

  btnEditSave.disabled = true
  btnEditSave.textContent = "Saving..."
  editError.style.display = "none"

  ext.runtime.sendMessage(
    {
      action: "SAVE_CIPHER",
      payload: {
        id,
        type: cipherType,
        title,
        folderId,
        favorite: false,
        data: cipherData,
      },
    },
    (res) => {
      btnEditSave.disabled = false
      btnEditSave.textContent = "Save to Vault"

      if (res?.success) {
        btnEditBack.click()
        loadMatchingLogins()
        loadAllCiphers()
      } else {
        editError.textContent = res?.error || "Failed to save item"
        editError.style.display = "block"
      }
    }
  )
})

/**
 * Delete Credential
 */
btnEditDelete?.addEventListener("click", () => {
  const id = editCipherId.value
  if (!id) return

  if (confirm("Are you sure you want to delete this credential?")) {
    btnEditDelete.disabled = true
    ext.runtime.sendMessage(
      {
        action: "DELETE_CIPHER",
        payload: { id },
      },
      (res) => {
        btnEditDelete.disabled = false
        if (res?.success) {
          btnEditBack.click()
          loadMatchingLogins()
          loadAllCiphers()
        } else {
          editError.textContent = res?.error || "Failed to delete item"
          editError.style.display = "block"
        }
      }
    )
  }
})

/**
 * Tab Generator Logic
 */
btnTypePassword?.addEventListener("click", () => {
  generatorMode = "password"
  btnTypePassword.classList.add("active")
  btnTypePassphrase.classList.remove("active")
  genPassControls.style.display = "flex"
  genPassphraseControls.style.display = "none"
  generateCredentials()
})

btnTypePassphrase?.addEventListener("click", () => {
  generatorMode = "passphrase"
  btnTypePassphrase.classList.add("active")
  btnTypePassword.classList.remove("active")
  genPassControls.style.display = "none"
  genPassphraseControls.style.display = "flex"
  generateCredentials()
})

sliderPassLength?.addEventListener("input", (e) => {
  labelPassLength.textContent = e.target.value
  generateCredentials()
})

sliderWordsCount?.addEventListener("input", (e) => {
  labelWordsCount.textContent = e.target.value
  generateCredentials()
})

;[
  chkUpper,
  chkLower,
  chkNums,
  chkSyms,
  chkAmbig,
  chkCapitalize,
  chkIncludeNum,
  inputSeparator,
].forEach((el) => {
  el?.addEventListener("input", generateCredentials)
})

btnGenRefresh?.addEventListener("click", generateCredentials)

btnGenCopy?.addEventListener("click", () => {
  copySensitiveValue(btnGenCopy, genOutputText.textContent, "Password", true)
})

btnGenFill?.addEventListener("click", async () => {
  const password = genOutputText.textContent
  if (!password) return

  const tabs = await ext.tabs.query({ active: true, currentWindow: true })
  if (tabs[0]?.id) {
    ext.tabs.sendMessage(tabs[0].id, {
      action: "FILL_INPUTS",
      payload: { password },
    })
    window.close()
  }
})

function generateCredentials() {
  if (generatorMode === "password") {
    const pass = IrisCrypto.generatePassword({
      length: parseInt(sliderPassLength.value, 10),
      uppercase: chkUpper.checked,
      lowercase: chkLower.checked,
      numbers: chkNums.checked,
      symbols: chkSyms.checked,
      avoidAmbiguous: chkAmbig.checked,
    })
    genOutputText.textContent = pass
  } else {
    const phrase = IrisCrypto.generatePassphrase({
      wordCount: parseInt(sliderWordsCount.value, 10),
      separator: inputSeparator.value || "-",
      capitalize: chkCapitalize.checked,
      includeNumber: chkIncludeNum.checked,
    })
    genOutputText.textContent = phrase
  }
}

/**
 * Live TOTP Ticker
 */
function startTotpTicker() {
  if (totpInterval) clearInterval(totpInterval)
  totpInterval = setInterval(() => {
    // Keep TOTP fresh
  }, 1000)
}

// Start Popup
init()

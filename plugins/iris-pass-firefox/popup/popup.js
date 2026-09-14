/**
 * IRIS Pass — Popup Script
 */

const ext = typeof browser !== "undefined" ? browser : chrome

let currentTab = null
let matchingCiphers = []
let allCiphers = []
let generatorMode = "password" // "password" | "passphrase"
let totpInterval = null
let currentUser = null

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
const formUnlock = document.getElementById("form-unlock")
const unlockPasswordInput = document.getElementById("unlock-password")
const unlockError = document.getElementById("unlock-error")
const btnUnlockSubmit = document.getElementById("btn-unlock-submit")
const btnToggleUnlockEye = document.getElementById("btn-toggle-unlock-eye")
const lockedUserLabel = document.getElementById("locked-user-label")
const btnSwitchAccount = document.getElementById("btn-switch-account")

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
const editCipherTitle = document.getElementById("edit-cipher-title")
const editCipherUsername = document.getElementById("edit-cipher-username")
const editCipherPassword = document.getElementById("edit-cipher-password")
const btnToggleEditPassEye = document.getElementById("btn-toggle-edit-pass-eye")
const btnEditGenPass = document.getElementById("btn-edit-gen-pass")
const editCipherUri = document.getElementById("edit-cipher-uri")
const editCipherTotp = document.getElementById("edit-cipher-totp")
const editCipherNotes = document.getElementById("edit-cipher-notes")
const editError = document.getElementById("edit-error")
const btnEditSave = document.getElementById("btn-edit-save")
const btnEditCancel = document.getElementById("btn-edit-cancel")

// Generator Elements
const genOutputText = document.getElementById("gen-output-text")
const genEntropyLabel = document.getElementById("gen-entropy-label")
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

// Settings Elements
const settingServerUrl = document.getElementById("setting-server-url")
const settingAutoLock = document.getElementById("setting-auto-lock")
const btnSaveSettings = document.getElementById("btn-save-settings")
const btnSettingsLogout = document.getElementById("btn-settings-logout")

/**
 * Initialize Popup
 */
async function init() {
  // Load active tab info
  try {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true })
    currentTab = tabs[0]
  } catch (e) {}

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

  // Load configured Server URL (default http://localhost:4000)
  const serverUrl = await IrisApi.getServerUrl()
  loginServerUrl.value = serverUrl
  loginServerLabel.textContent = serverUrl
  settingServerUrl.value = serverUrl

  // Load auto-lock setting
  const storage = await ext.storage.local.get(["autoLockMinutes"])
  if (storage.autoLockMinutes !== undefined) {
    settingAutoLock.value = String(storage.autoLockMinutes)
  }

  // Check authentication & vault state from background
  ext.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
    if (!response?.isAuthenticated) {
      showLoginView()
    } else if (!response?.isUnlocked) {
      currentUser = response.user
      showLockedView(currentUser)
    } else {
      currentUser = response.user
      showUnlockedView(currentUser)
    }
  })

  // Initial generator run
  generateCredentials()
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

function showLockedView(user) {
  viewLogin.style.display = "none"
  if (viewMfa) viewMfa.style.display = "none"
  if (viewEdit) viewEdit.style.display = "none"
  viewLocked.style.display = "flex"
  viewUnlocked.style.display = "none"
  btnLock.style.display = "none"
  btnSync.style.display = "none"
  unlockPasswordInput.value = ""
  unlockError.style.display = "none"
  if (user?.username || user?.email) {
    lockedUserLabel.textContent = `Logged in as @${user.username || user.email}`
  } else {
    lockedUserLabel.textContent = "Enter your account password"
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
 * Unlock Form Submission (when already authenticated)
 */
formUnlock.addEventListener("submit", (e) => {
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

// Switch Account / Log Out from locked screen
btnSwitchAccount?.addEventListener("click", () => {
  ext.runtime.sendMessage({ action: "LOGOUT" }, () => {
    showLoginView()
  })
})

// Log Out from Settings tab
btnSettingsLogout?.addEventListener("click", () => {
  ext.runtime.sendMessage({ action: "LOGOUT" }, () => {
    showLoginView()
  })
})

// Lock Vault Button (Header)
btnLock.addEventListener("click", () => {
  ext.runtime.sendMessage({ action: "LOCK_VAULT" }, () => {
    showLockedView(currentUser)
  })
})

// Sync Vault Button (Header)
btnSync.addEventListener("click", () => {
  btnSync.classList.add("spinning")
  loadMatchingLogins()
  loadAllCiphers()
  setTimeout(() => btnSync.classList.remove("spinning"), 600)
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
    {
      action: "GET_MATCHING_LOGINS",
      payload: { url: currentTab.url },
    },
    (res) => {
      matchingCiphers = res?.matches || []
      matchingBadge.textContent = String(matchingCiphers.length)
      renderMatchingList(matchingCiphers)
    }
  )
}

/**
 * Render Matching Logins List
 */
function renderMatchingList(ciphers) {
  matchingList.innerHTML = ""

  if (ciphers.length === 0) {
    matchingList.innerHTML = `
      <div style="padding: 24px 12px; text-align: center; color: #a19da8; font-size: 12px;">
        No matching logins found for this site.
      </div>
    `
    return
  }

  ciphers.forEach((cipher) => {
    const card = document.createElement("div")
    card.className = "cipher-card"

    const username = cipher.data?.username || "No username"
    const hasPassword = Boolean(cipher.data?.password)
    const hasTotp = Boolean(cipher.data?.totpSecret)
    const hasPasskey = Boolean(cipher.data?.passkey)

    card.innerHTML = `
      <div class="cipher-card-top">
        <div>
          <div class="cipher-title">${cipher.title}</div>
          <div class="cipher-user">${username}</div>
        </div>
        ${hasPasskey ? '<span class="badge" style="font-size: 9px;">Passkey</span>' : ""}
      </div>

      <div class="cipher-actions">
        <button class="mini-action-btn fill-btn" data-action="fill">Fill</button>
        <button class="mini-action-btn" data-action="copy-user">User</button>
        ${hasPassword ? '<button class="mini-action-btn" data-action="copy-pass">Pass</button>' : ""}
        ${hasTotp ? '<button class="mini-action-btn" data-action="copy-totp">TOTP (<span class="totp-ticker">30</span>s)</button>' : ""}
        <button class="mini-action-btn edit-btn" data-action="edit">Edit</button>
      </div>
    `

    card.querySelector(".cipher-card-top").style.cursor = "pointer"
    card
      .querySelector(".cipher-card-top")
      .addEventListener("click", () => openEditCipher(cipher))

    card
      .querySelector('[data-action="edit"]')
      .addEventListener("click", (e) => {
        e.stopPropagation()
        openEditCipher(cipher)
      })

    card.querySelector('[data-action="fill"]').addEventListener("click", () => {
      ext.runtime.sendMessage({
        action: "PERFORM_AUTOFILL",
        payload: { cipherId: cipher.id, tabId: currentTab?.id },
      })
      window.close()
    })

    card
      .querySelector('[data-action="copy-user"]')
      .addEventListener("click", () => {
        navigator.clipboard.writeText(cipher.data?.username || "")
        showCopiedFeedback(
          card.querySelector('[data-action="copy-user"]'),
          "User"
        )
      })

    if (hasPassword) {
      card
        .querySelector('[data-action="copy-pass"]')
        .addEventListener("click", () => {
          navigator.clipboard.writeText(cipher.data?.password || "")
          showCopiedFeedback(
            card.querySelector('[data-action="copy-pass"]'),
            "Pass"
          )
        })
    }

    if (hasTotp) {
      card
        .querySelector('[data-action="copy-totp"]')
        .addEventListener("click", async () => {
          const code = await IrisTotp.generateTotp(cipher.data?.totpSecret)
          if (code) {
            navigator.clipboard.writeText(code)
            showCopiedFeedback(
              card.querySelector('[data-action="copy-totp"]'),
              "Copied!"
            )
          }
        })
    }

    matchingList.appendChild(card)
  })
}

function showCopiedFeedback(btn, text) {
  const original = btn.textContent
  btn.textContent = "Copied!"
  btn.style.color = "#10b981"
  setTimeout(() => {
    btn.textContent = original
    btn.style.color = ""
  }, 1200)
}

/**
 * Load All Vault Ciphers
 */
function loadAllCiphers() {
  ext.runtime.sendMessage({ action: "GET_ALL_CIPHERS" }, (res) => {
    allCiphers = res?.ciphers || []
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
    const username = cipher.data?.username || cipher.type
    card.innerHTML = `
      <div class="cipher-card-top">
        <div>
          <div class="cipher-title">${cipher.title}</div>
          <div class="cipher-user">${username}</div>
        </div>
        <span class="badge" style="font-size: 9px;">${cipher.type}</span>
      </div>
      <div class="cipher-actions">
        <button class="mini-action-btn fill-btn" data-action="fill">Fill</button>
        <button class="mini-action-btn" data-action="copy-user">User</button>
        <button class="mini-action-btn" data-action="copy-pass">Pass</button>
        <button class="mini-action-btn edit-btn" data-action="edit">Edit</button>
      </div>
    `

    card.querySelector(".cipher-card-top").style.cursor = "pointer"
    card
      .querySelector(".cipher-card-top")
      .addEventListener("click", () => openEditCipher(cipher))

    card
      .querySelector('[data-action="edit"]')
      .addEventListener("click", (e) => {
        e.stopPropagation()
        openEditCipher(cipher)
      })

    card.querySelector('[data-action="fill"]').addEventListener("click", () => {
      ext.runtime.sendMessage({
        action: "PERFORM_AUTOFILL",
        payload: { cipherId: cipher.id, tabId: currentTab?.id },
      })
      window.close()
    })

    card
      .querySelector('[data-action="copy-user"]')
      .addEventListener("click", () => {
        navigator.clipboard.writeText(cipher.data?.username || "")
        showCopiedFeedback(
          card.querySelector('[data-action="copy-user"]'),
          "User"
        )
      })

    card
      .querySelector('[data-action="copy-pass"]')
      .addEventListener("click", () => {
        navigator.clipboard.writeText(cipher.data?.password || "")
        showCopiedFeedback(
          card.querySelector('[data-action="copy-pass"]'),
          "Pass"
        )
      })

    vaultList.appendChild(card)
  })
}

/**
 * Open Cipher Edit/Create Form
 */
function openEditCipher(cipher = null) {
  viewUnlocked.style.display = "none"
  viewEdit.style.display = "flex"
  btnLock.style.display = "none"
  btnSync.style.display = "none"
  editError.style.display = "none"

  if (cipher) {
    editViewTitle.textContent = "Edit Item"
    btnEditDelete.style.display = "flex"
    editCipherId.value = cipher.id
    editCipherTitle.value = cipher.title || ""
    editCipherUsername.value = cipher.data?.username || ""
    editCipherPassword.value = cipher.data?.password || ""
    const uris = cipher.data?.uris || []
    editCipherUri.value = uris
      .map((u) => (typeof u === "string" ? u : u.uri))
      .join(", ")
    editCipherTotp.value = cipher.data?.totpSecret || ""
    editCipherNotes.value = cipher.data?.notes || ""
  } else {
    editViewTitle.textContent = "New Item"
    btnEditDelete.style.display = "none"
    editCipherId.value = ""
    let defaultTitle = ""
    let defaultUri = ""
    if (currentTab?.url && !currentTab.url.startsWith("about:")) {
      defaultUri = currentTab.url
      try {
        defaultTitle = new URL(currentTab.url).hostname.replace(/^www\./, "")
      } catch {}
    }
    editCipherTitle.value = defaultTitle
    editCipherUsername.value = ""
    editCipherPassword.value = ""
    editCipherUri.value = defaultUri
    editCipherTotp.value = ""
    editCipherNotes.value = ""
  }

  setTimeout(() => editCipherTitle.focus(), 50)
}

function closeEditCipher() {
  viewEdit.style.display = "none"
  viewUnlocked.style.display = "flex"
  btnLock.style.display = "flex"
  btnSync.style.display = "flex"
  loadMatchingLogins()
  loadAllCiphers()
}

btnEditBack?.addEventListener("click", closeEditCipher)
btnEditCancel?.addEventListener("click", closeEditCipher)

btnQuickAdd?.addEventListener("click", () => openEditCipher(null))
btnVaultAdd?.addEventListener("click", () => openEditCipher(null))

btnToggleEditPassEye?.addEventListener("click", () => {
  const isPass = editCipherPassword.type === "password"
  editCipherPassword.type = isPass ? "text" : "password"
})

btnEditGenPass?.addEventListener("click", () => {
  const generated = IrisCrypto.generatePassword({ length: 20 })
  editCipherPassword.value = generated
  editCipherPassword.type = "text"
})

formEditCipher?.addEventListener("submit", (e) => {
  e.preventDefault()
  const id = editCipherId.value.trim() || null
  const title = editCipherTitle.value.trim()
  if (!title) return

  const username = editCipherUsername.value.trim()
  const password = editCipherPassword.value
  const uriStr = editCipherUri.value.trim()
  const totpSecret = editCipherTotp.value.trim()
  const notes = editCipherNotes.value.trim()

  const uris = uriStr
    ? uriStr
        .split(",")
        .map((u) => ({ uri: u.trim(), match: 0 }))
        .filter((u) => u.uri.length > 0)
    : []

  const data = {
    username,
    password,
    uris,
    totpSecret,
    notes,
  }

  btnEditSave.disabled = true
  btnEditSave.textContent = "Saving..."
  editError.style.display = "none"

  ext.runtime.sendMessage(
    {
      action: "SAVE_CIPHER",
      payload: {
        id,
        type: "LOGIN",
        title,
        data,
      },
    },
    (res) => {
      btnEditSave.disabled = false
      btnEditSave.textContent = "Save to Vault"

      if (res?.success) {
        closeEditCipher()
      } else {
        editError.textContent = res?.error || "Failed to save item"
        editError.style.display = "block"
      }
    }
  )
})

btnEditDelete?.addEventListener("click", () => {
  const id = editCipherId.value.trim()
  if (!id) return

  if (!confirm("Are you sure you want to delete this credential?")) return

  btnEditDelete.disabled = true
  ext.runtime.sendMessage(
    {
      action: "DELETE_CIPHER",
      payload: { id },
    },
    (res) => {
      btnEditDelete.disabled = false
      if (res?.success) {
        closeEditCipher()
      } else {
        editError.textContent = res?.error || "Failed to delete item"
        editError.style.display = "block"
      }
    }
  )
})

// Vault Search Filter
vaultSearchInput.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim()
  if (!q) {
    renderVaultList(allCiphers)
    return
  }
  const filtered = allCiphers.filter((c) => {
    if (c.title.toLowerCase().includes(q)) return true
    if (c.data?.username && c.data.username.toLowerCase().includes(q))
      return true
    return false
  })
  renderVaultList(filtered)
})

/**
 * TOTP Live Ticker
 */
function startTotpTicker() {
  if (totpInterval) clearInterval(totpInterval)

  function updateTickers() {
    const rem = IrisTotp.getRemainingSeconds()
    document.querySelectorAll(".totp-ticker").forEach((el) => {
      el.textContent = String(rem)
    })
  }

  updateTickers()
  totpInterval = setInterval(updateTickers, 1000)
}

/**
 * Tab Navigation
 */
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"))
    tabContents.forEach((c) => c.classList.remove("active"))

    btn.classList.add("active")
    const targetId = btn.dataset.tab
    document.getElementById(targetId)?.classList.add("active")
  })
})

/**
 * Password Generator Logic
 */
function generateCredentials() {
  let text = ""
  if (generatorMode === "password") {
    const length = parseInt(sliderPassLength.value, 10)
    labelPassLength.textContent = String(length)
    text = IrisCrypto.generatePassword({
      length,
      uppercase: chkUpper.checked,
      lowercase: chkLower.checked,
      numbers: chkNums.checked,
      symbols: chkSyms.checked,
      avoidAmbiguous: chkAmbig.checked,
    })
  } else {
    const wordCount = parseInt(sliderWordsCount.value, 10)
    labelWordsCount.textContent = String(wordCount)
    text = IrisCrypto.generatePassphrase({
      wordCount,
      separator: inputSeparator.value || "-",
      capitalize: chkCapitalize.checked,
      includeNumber: chkIncludeNum.checked,
    })
  }

  genOutputText.textContent = text
  const entropy = IrisCrypto.calculateEntropy(text)
  const strength =
    entropy >= 100 ? "Very Strong" : entropy >= 64 ? "Strong" : "Moderate"
  genEntropyLabel.textContent = `Entropy: ${entropy} bits • ${strength}`
}

btnTypePassword.addEventListener("click", () => {
  generatorMode = "password"
  btnTypePassword.classList.add("active")
  btnTypePassphrase.classList.remove("active")
  genPassControls.style.display = "flex"
  genPassphraseControls.style.display = "none"
  generateCredentials()
})

btnTypePassphrase.addEventListener("click", () => {
  generatorMode = "passphrase"
  btnTypePassphrase.classList.add("active")
  btnTypePassword.classList.remove("active")
  genPassphraseControls.style.display = "flex"
  genPassControls.style.display = "none"
  generateCredentials()
})

sliderPassLength.addEventListener("input", generateCredentials)
chkUpper.addEventListener("change", generateCredentials)
chkLower.addEventListener("change", generateCredentials)
chkNums.addEventListener("change", generateCredentials)
chkSyms.addEventListener("change", generateCredentials)
chkAmbig.addEventListener("change", generateCredentials)

sliderWordsCount.addEventListener("input", generateCredentials)
inputSeparator.addEventListener("input", generateCredentials)
chkCapitalize.addEventListener("change", generateCredentials)
chkIncludeNum.addEventListener("change", generateCredentials)

btnGenRefresh.addEventListener("click", generateCredentials)

btnGenCopy.addEventListener("click", () => {
  navigator.clipboard.writeText(genOutputText.textContent)
  btnGenCopy.style.background = "#10b981"
  setTimeout(() => (btnGenCopy.style.background = ""), 1000)
})

btnGenFill.addEventListener("click", async () => {
  const pass = genOutputText.textContent
  if (currentTab?.id) {
    await ext.tabs.sendMessage(currentTab.id, {
      action: "FILL_INPUTS",
      payload: { username: "", password: pass },
    })
    window.close()
  }
})

/**
 * Settings Tab Logic
 */
btnSaveSettings.addEventListener("click", async () => {
  const serverUrl = settingServerUrl.value.trim() || "http://localhost:4000"
  const autoLockMinutes = parseInt(settingAutoLock.value, 10)

  await IrisApi.setServerUrl(serverUrl)
  await ext.storage.local.set({ autoLockMinutes })

  loginServerUrl.value = serverUrl
  loginServerLabel.textContent = serverUrl

  btnSaveSettings.textContent = "Saved!"
  btnSaveSettings.style.background = "#10b981"
  setTimeout(() => {
    btnSaveSettings.textContent = "Save Settings"
    btnSaveSettings.style.background = ""
  }, 1200)
})

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", init)

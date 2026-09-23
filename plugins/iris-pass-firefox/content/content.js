/**
 * IRIS Pass — Content Script
 * 1. WebAuthn Passkey Interceptor & In-Page Modal UI
 * 2. In-Field Autofill Badges & Dropdown (Bitwarden-style, active-only)
 */

; (function () {
  if (window.__IRIS_CONTENT_SCRIPT_ATTACHED__) return
  window.__IRIS_CONTENT_SCRIPT_ATTACHED__ = true

  const ext = typeof browser !== "undefined" ? browser : chrome



  // ----------------------------------------------------
  // Portal & DOM Isolation Helper
  // ----------------------------------------------------
  let irisPassPortal = null
  let inertObserver = null

  function getOrCreatePortal() {
    if (irisPassPortal && irisPassPortal.isConnected) {
      return irisPassPortal
    }

    let portal = document.getElementById("iris-pass-portal")
    if (!portal) {
      portal = document.createElement("div")
      portal.id = "iris-pass-portal"
      portal.setAttribute("data-iris-pass-portal", "true")
      portal.className = "iris-pass-portal-root"
    }

    // Attach to document.documentElement (sibling to <body>).
    // This completely isolates all IRIS Pass overlays, dialogs, badges, and dropdowns
    // from <body> modal focus-traps and ariaHideOutside sweeps (React Aria, Radix UI, Base UI, etc.)
    // which set `inert` or `aria-hidden` on all children of document.body.
    const targetParent = document.documentElement || document.body
    if (portal.parentElement !== targetParent) {
      targetParent.appendChild(portal)
    }

    // Ensure inert or aria-hidden attributes can never disable IRIS Pass UI
    if (!inertObserver) {
      inertObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes") {
            const el = m.target
            if (m.attributeName === "inert" && el.hasAttribute("inert")) {
              el.removeAttribute("inert")
            }
            if (
              m.attributeName === "aria-hidden" &&
              el.getAttribute("aria-hidden") === "true"
            ) {
              el.removeAttribute("aria-hidden")
            }
          }
        }
      })
      inertObserver.observe(portal, {
        attributes: true,
        subtree: true,
        attributeFilter: ["inert", "aria-hidden"],
      })
    }

    irisPassPortal = portal
    return portal
  }

  // Prevent host page modal frameworks (React Aria, Radix, Base UI) from stealing focus
  // or capturing clicks outside their own modals when interacting with IRIS Pass
  function isIrisPassTarget(target) {
    if (!target || !(target instanceof Element)) return false
    return Boolean(
      target.closest(
        "#iris-pass-portal, .iris-pass-portal-root, .iris-passkey-dialog-overlay, .iris-passkey-dialog, .iris-pass-dropdown, .iris-pass-field-icon, .iris-totp-floating-widget, .iris-qr-capture-overlay, .iris-pass-toast"
      )
    )
  }

  // Prevent host page modal frameworks (React Aria, Radix UI, Base UI, floating-ui)
  // from treating clicks/focus on IRIS Pass as "outside interactions" (which dismisses host modals or steals focus)
  const CAPTURE_ISOLATED_EVENTS = [
    "pointerdown",
    "mousedown",
    "touchstart",
    "focusin",
  ]

  CAPTURE_ISOLATED_EVENTS.forEach((evtName) => {
    window.addEventListener(
      evtName,
      (e) => {
        if (isIrisPassTarget(e.target)) {
          // Stop propagation in capture phase on window so document-level outside click listeners
          // (such as React Aria useInteractOutside) never receive the event and never close host modals
          e.stopPropagation()

          // Ensure focusable IRIS Pass elements receive native focus
          if (
            (evtName === "pointerdown" || evtName === "mousedown") &&
            typeof e.target?.focus === "function" &&
            (e.target.tagName === "INPUT" ||
              e.target.tagName === "SELECT" ||
              e.target.tagName === "BUTTON" ||
              e.target.tagName === "TEXTAREA" ||
              e.target.getAttribute("tabindex") !== null)
          ) {
            e.target.focus()
          }
        }
      },
      true // Capture phase!
    )
  })

  // Prevent bubbling events inside IRIS Pass UI from reaching document/body handlers
  const BUBBLE_ISOLATED_EVENTS = [
    "pointerdown",
    "mousedown",
    "mouseup",
    "click",
    "touchstart",
    "touchend",
    "focusin",
  ]

  BUBBLE_ISOLATED_EVENTS.forEach((evtName) => {
    window.addEventListener(
      evtName,
      (e) => {
        if (isIrisPassTarget(e.target)) {
          e.stopPropagation()
        }
      },
      false
    )
  })

  // ----------------------------------------------------
  // Toast Notifications
  // ----------------------------------------------------
  let toastTimeout = null

  function showToast(message) {
    if (toastTimeout) {
      clearTimeout(toastTimeout)
      const old = document.querySelector(".iris-pass-toast")
      if (old) old.remove()
    }

    const toast = document.createElement("div")
    toast.className = "iris-pass-toast"
    const iconUrl = ext.runtime.getURL("icons/icon-48.png")

    const toastImg = document.createElement("img")
    toastImg.src = iconUrl
    toastImg.alt = "IRIS Pass"
    toastImg.className = "iris-pass-toast-img"

    const toastSpan = document.createElement("span")
    toastSpan.textContent = message

    toast.appendChild(toastImg)
    toast.appendChild(toastSpan)
    getOrCreatePortal().appendChild(toast)

    toastTimeout = setTimeout(() => {
      toast.style.opacity = "0"
      toast.style.transition = "opacity 0.2s ease"
      setTimeout(() => toast.remove(), 200)
    }, 3500)
  }

  // ----------------------------------------------------
  // In-Page Passkey Modal Dialogs
  // ----------------------------------------------------
  let activePasskeyModal = null

  function removePasskeyModal() {
    if (activePasskeyModal) {
      activePasskeyModal.remove()
      activePasskeyModal = null
    }
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

  function showUnlockPromptForPasskey(requestId, options, mode) {
    removePasskeyModal()

    const { rpId } = options || {}
    const overlay = document.createElement("div")
    overlay.className = "iris-passkey-dialog-overlay"

    const dialog = document.createElement("div")
    dialog.className = "iris-passkey-dialog"

    const iconDiv = document.createElement("div")
    iconDiv.className = "iris-passkey-icon"
    const lockSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    lockSvg.setAttribute("viewBox", "0 0 24 24")
    const lockRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    lockRect.setAttribute("x", "3")
    lockRect.setAttribute("y", "11")
    lockRect.setAttribute("width", "18")
    lockRect.setAttribute("height", "11")
    lockRect.setAttribute("rx", "2")
    lockRect.setAttribute("ry", "2")
    const lockPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
    lockPath.setAttribute("d", "M7 11V7a5 5 0 0 1 10 0v4")
    lockSvg.appendChild(lockRect)
    lockSvg.appendChild(lockPath)
    iconDiv.appendChild(lockSvg)

    const title = document.createElement("h3")
    title.className = "iris-passkey-title"
    title.textContent = "IRIS Pass is Locked"

    const subtitle = document.createElement("p")
    subtitle.className = "iris-passkey-subtitle"
    subtitle.textContent = `Please open the IRIS Pass extension icon in your browser toolbar to unlock your vault with your Master Password for ${rpId || window.location.hostname}.`

    const actions = document.createElement("div")
    actions.className = "iris-passkey-actions"

    const btnCheckUnlocked = document.createElement("button")
    btnCheckUnlocked.type = "button"
    btnCheckUnlocked.className = "iris-passkey-btn primary"
    btnCheckUnlocked.id = "btn-pk-check-unlocked"
    btnCheckUnlocked.textContent = "I've Unlocked IRIS Pass"

    const btnFallback = document.createElement("button")
    btnFallback.type = "button"
    btnFallback.className = "iris-passkey-btn secondary"
    btnFallback.id = "btn-pk-unlock-fallback"
    btnFallback.textContent = "Use Device Passkey"

    const btnCancel = document.createElement("button")
    btnCancel.type = "button"
    btnCancel.className = "iris-passkey-btn text"
    btnCancel.id = "btn-pk-unlock-cancel"
    btnCancel.textContent = "Cancel"

    actions.appendChild(btnCheckUnlocked)
    actions.appendChild(btnFallback)
    actions.appendChild(btnCancel)

    dialog.appendChild(iconDiv)
    dialog.appendChild(title)
    dialog.appendChild(subtitle)
    dialog.appendChild(actions)

    overlay.appendChild(dialog)
    getOrCreatePortal().appendChild(overlay)
    activePasskeyModal = overlay

    btnCancel.addEventListener("click", () => {
      removePasskeyModal()
      const actionName =
        mode === "create" ? "PASSKEY_CREATE_RESPONSE" : "PASSKEY_GET_RESPONSE"
      window.postMessage(
        {
          source: "IRIS_PASSKEY_CONTENT",
          action: actionName,
          requestId,
          canceled: true,
        },
        window.location.origin
      )
    })

    btnFallback.addEventListener("click", () => {
      removePasskeyModal()
      const actionName =
        mode === "create" ? "PASSKEY_CREATE_RESPONSE" : "PASSKEY_GET_RESPONSE"
      window.postMessage(
        {
          source: "IRIS_PASSKEY_CONTENT",
          action: actionName,
          requestId,
          fallback: true,
        },
        window.location.origin
      )
    })

    btnCheckUnlocked.addEventListener("click", () => {
      btnCheckUnlocked.disabled = true
      btnCheckUnlocked.textContent = "Checking Status..."
      ext.runtime.sendMessage({ action: "GET_STATUS" }, (res) => {
        btnCheckUnlocked.disabled = false
        btnCheckUnlocked.textContent = "I've Unlocked IRIS Pass"
        if (res?.isUnlocked) {
          removePasskeyModal()
          if (mode === "create") {
            handlePasskeyCreateRequest(requestId, options)
          } else {
            handlePasskeyGetRequest(requestId, options)
          }
        } else {
          showToast("Vault is still locked. Click the IRIS Pass icon to unlock.")
        }
      })
    })
  }

  /**
   * Handle WebAuthn Passkey Registration Request
   */
  async function handlePasskeyCreateRequest(requestId, options) {
    removePasskeyModal()

    const {
      rpId,
      rpName,
      userName,
      userDisplayName,
      userId,
      challenge,
      origin,
    } = options || {}

    // Query vault for existing matching credentials for this site to allow multi-account selection
    ext.runtime.sendMessage(
      {
        action: "GET_MATCHING_LOGINS",
        payload: { url: window.location.href },
      },
      (matchesRes) => {
        if (ext.runtime?.lastError) {
          console.warn("[IRIS Pass] Extension runtime error:", ext.runtime.lastError)
          showToast("IRIS Pass was reloaded. Please refresh this page.")
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_CREATE_RESPONSE",
              requestId,
              fallback: true,
            },
            window.location.origin
          )
          return
        }

        if (matchesRes?.isUnlocked === false) {
          showUnlockPromptForPasskey(requestId, options, "create")
          return
        }

        const matches = matchesRes?.matches || []

        const overlay = document.createElement("div")
        overlay.className = "iris-passkey-dialog-overlay"

        const dialog = document.createElement("div")
        dialog.className = "iris-passkey-dialog"

        const iconDiv = document.createElement("div")
        iconDiv.className = "iris-passkey-icon"
        const iconImg = document.createElement("img")
        iconImg.src = ext.runtime.getURL("icons/icon-48.png")
        iconImg.alt = "IRIS Pass"
        iconImg.className = "iris-passkey-dialog-logo"
        iconDiv.appendChild(iconImg)

        const title = document.createElement("h3")
        title.className = "iris-passkey-title"
        title.textContent = "Save Passkey to IRIS Pass"

        const subtitle = document.createElement("p")
        subtitle.className = "iris-passkey-subtitle"
        subtitle.textContent = "A passkey allows you to sign in safely and quickly without entering a password."

        const details = document.createElement("div")
        details.className = "iris-passkey-details"

        let selectAccount = null
        if (matches.length > 0) {
          const rowCol = document.createElement("div")
          rowCol.className = "iris-passkey-row-col"

          const label = document.createElement("span")
          label.className = "label"
          label.textContent = "Save to Account / Vault Item"
          rowCol.appendChild(label)

          selectAccount = document.createElement("select")
          selectAccount.id = "iris-pk-select-account"
          selectAccount.className = "iris-passkey-select"

          matches.forEach((m) => {
            const isCurrent = m.data?.username && m.data.username.toLowerCase() === (userName || "").toLowerCase()
            const hasPasskey = Boolean(m.data?.passkey)
            const opt = document.createElement("option")
            opt.value = m.id
            opt.selected = isCurrent
            opt.textContent = `${m.title} (${m.data?.username || "No username"})${hasPasskey ? " • Passkey Saved" : ""}`
            selectAccount.appendChild(opt)
          })

          const newOpt = document.createElement("option")
          newOpt.value = "new"
          newOpt.selected = matches.every((m) => m.data?.username?.toLowerCase() !== (userName || "").toLowerCase())
          newOpt.textContent = `+ Create new vault item "${userName || rpName || "Passkey"}"`
          selectAccount.appendChild(newOpt)

          rowCol.appendChild(selectAccount)
          details.appendChild(rowCol)
        } else {
          const row = document.createElement("div")
          row.className = "iris-passkey-row"

          const label = document.createElement("span")
          label.className = "label"
          label.textContent = "Account"

          const val = document.createElement("span")
          val.className = "value"
          val.textContent = userName || "Passkey"

          row.appendChild(label)
          row.appendChild(val)
          details.appendChild(row)
        }

        const rpRow = document.createElement("div")
        rpRow.className = "iris-passkey-row"
        const rpLabel = document.createElement("span")
        rpLabel.className = "label"
        rpLabel.textContent = "Relying Party"
        const rpVal = document.createElement("span")
        rpVal.className = "value"
        rpVal.textContent = rpName || rpId || window.location.hostname
        rpRow.appendChild(rpLabel)
        rpRow.appendChild(rpVal)
        details.appendChild(rpRow)

        const actions = document.createElement("div")
        actions.className = "iris-passkey-actions"

        const btnSave = document.createElement("button")
        btnSave.type = "button"
        btnSave.className = "iris-passkey-btn primary"
        btnSave.id = "btn-pk-save"
        btnSave.textContent = "Save Passkey"

        const btnFallback = document.createElement("button")
        btnFallback.type = "button"
        btnFallback.className = "iris-passkey-btn secondary"
        btnFallback.id = "btn-pk-fallback"
        btnFallback.textContent = "Use Security Key / Windows Hello"

        const btnCancel = document.createElement("button")
        btnCancel.type = "button"
        btnCancel.className = "iris-passkey-btn text"
        btnCancel.id = "btn-pk-cancel"
        btnCancel.textContent = "Cancel"

        actions.appendChild(btnSave)
        actions.appendChild(btnFallback)
        actions.appendChild(btnCancel)

        dialog.appendChild(iconDiv)
        dialog.appendChild(title)
        dialog.appendChild(subtitle)
        dialog.appendChild(details)
        dialog.appendChild(actions)

        overlay.appendChild(dialog)
        getOrCreatePortal().appendChild(overlay)
        activePasskeyModal = overlay

        btnCancel.addEventListener("click", () => {
          removePasskeyModal()
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_CREATE_RESPONSE",
              requestId,
              canceled: true,
            },
            window.location.origin
          )
        })

        btnFallback.addEventListener("click", () => {
          removePasskeyModal()
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_CREATE_RESPONSE",
              requestId,
              fallback: true,
            },
            window.location.origin
          )
        })

        btnSave.addEventListener("click", () => {
          btnSave.disabled = true
          btnSave.textContent = "Saving Passkey..."

          const targetCipherId = selectAccount ? selectAccount.value : "new"

          ext.runtime.sendMessage(
            {
              action: "PASSKEY_CREATE_CREDENTIAL",
              payload: {
                rpId,
                rpName,
                userName,
                userDisplayName,
                userId,
                challenge,
                origin: origin || window.location.origin,
                url: window.location.href,
                targetCipherId,
              },
            },
            (res) => {
              removePasskeyModal()

              if (!res?.success) {
                const errMsg = res?.error || "Failed to create passkey"
                showToast(`Passkey error: ${errMsg}`)
                window.postMessage(
                  {
                    source: "IRIS_PASSKEY_CONTENT",
                    action: "PASSKEY_CREATE_RESPONSE",
                    requestId,
                    error: errMsg,
                  },
                  window.location.origin
                )
                return
              }

              showToast(`Passkey saved to IRIS Pass for ${userName || rpId}!`)

              // Resolve to page script
              window.postMessage(
                {
                  source: "IRIS_PASSKEY_CONTENT",
                  action: "PASSKEY_CREATE_RESPONSE",
                  requestId,
                  success: true,
                  credential: res.credential,
                },
                window.location.origin
              )
            }
          )
        })
      }
    )
  }

  /**
   * Handle WebAuthn Passkey Authentication Request
   */
  async function handlePasskeyGetRequest(requestId, options) {
    removePasskeyModal()

    const { rpId, challenge, origin, allowCredentials } = options || {}

    ext.runtime.sendMessage(
      {
        action: "PASSKEY_GET_CREDENTIALS",
        payload: { rpId, url: window.location.href, allowCredentials },
      },
      async (res) => {
        if (ext.runtime?.lastError) {
          console.warn("[IRIS Pass] Extension runtime error:", ext.runtime.lastError)
          showToast("IRIS Pass was reloaded. Please refresh this page.")
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_GET_RESPONSE",
              requestId,
              fallback: true,
            },
            "*"
          )
          return
        }

        if (res?.isUnlocked === false) {
          showUnlockPromptForPasskey(requestId, options, "get")
          return
        }

        const passkeys = res?.passkeys || res?.credentials || []

        if (passkeys.length === 0) {
          // No passkeys saved in vault for this RP: fallback to native browser passkeys
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_GET_RESPONSE",
              requestId,
              fallback: true,
            },
            window.location.origin
          )
          return
        }

        const overlay = document.createElement("div")
        overlay.className = "iris-passkey-dialog-overlay"

        const dialog = document.createElement("div")
        dialog.className = "iris-passkey-dialog"

        const iconDiv = document.createElement("div")
        iconDiv.className = "iris-passkey-icon"
        const iconImg = document.createElement("img")
        iconImg.src = ext.runtime.getURL("icons/icon-48.png")
        iconImg.alt = "IRIS Pass"
        iconImg.className = "iris-passkey-dialog-logo"
        iconDiv.appendChild(iconImg)

        const title = document.createElement("h3")
        title.className = "iris-passkey-title"
        title.textContent = "Sign in with Passkey"

        const subtitle = document.createElement("p")
        subtitle.className = "iris-passkey-subtitle"
        subtitle.textContent = "Use your passkey saved in IRIS Pass to sign in."

        const details = document.createElement("div")
        details.className = "iris-passkey-details"

        let authSelect = null
        if (passkeys.length > 1) {
          const rowCol = document.createElement("div")
          rowCol.className = "iris-passkey-row-col"

          const label = document.createElement("span")
          label.className = "label"
          label.textContent = "Select Account"
          rowCol.appendChild(label)

          authSelect = document.createElement("select")
          authSelect.id = "iris-pk-auth-account"
          authSelect.className = "iris-passkey-select"

          passkeys.forEach((p) => {
            const opt = document.createElement("option")
            opt.value = p.credentialId || p.id
            opt.textContent = `${p.userName || "Account"} (${p.cipherTitle || p.title || "Passkey"})`
            authSelect.appendChild(opt)
          })

          rowCol.appendChild(authSelect)
          details.appendChild(rowCol)
        } else {
          const row = document.createElement("div")
          row.className = "iris-passkey-row"

          const label = document.createElement("span")
          label.className = "label"
          label.textContent = "Account"

          const val = document.createElement("span")
          val.className = "value"
          val.textContent = passkeys[0].userName || "Passkey"

          row.appendChild(label)
          row.appendChild(val)
          details.appendChild(row)
        }

        const rpRow = document.createElement("div")
        rpRow.className = "iris-passkey-row"
        const rpLabel = document.createElement("span")
        rpLabel.className = "label"
        rpLabel.textContent = "Relying Party"
        const rpVal = document.createElement("span")
        rpVal.className = "value"
        rpVal.textContent = rpId || window.location.hostname
        rpRow.appendChild(rpLabel)
        rpRow.appendChild(rpVal)
        details.appendChild(rpRow)

        const actions = document.createElement("div")
        actions.className = "iris-passkey-actions"

        const btnSignin = document.createElement("button")
        btnSignin.type = "button"
        btnSignin.className = "iris-passkey-btn primary"
        btnSignin.id = "btn-pk-signin"
        btnSignin.textContent = "Sign In with IRIS Pass"

        const btnFallback = document.createElement("button")
        btnFallback.type = "button"
        btnFallback.className = "iris-passkey-btn secondary"
        btnFallback.id = "btn-pk-fallback"
        btnFallback.textContent = "Use Another Method"

        const btnCancel = document.createElement("button")
        btnCancel.type = "button"
        btnCancel.className = "iris-passkey-btn text"
        btnCancel.id = "btn-pk-cancel"
        btnCancel.textContent = "Cancel"

        actions.appendChild(btnSignin)
        actions.appendChild(btnFallback)
        actions.appendChild(btnCancel)

        dialog.appendChild(iconDiv)
        dialog.appendChild(title)
        dialog.appendChild(subtitle)
        dialog.appendChild(details)
        dialog.appendChild(actions)

        overlay.appendChild(dialog)
        getOrCreatePortal().appendChild(overlay)
        activePasskeyModal = overlay

        btnCancel.addEventListener("click", () => {
          removePasskeyModal()
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_GET_RESPONSE",
              requestId,
              canceled: true,
            },
            window.location.origin
          )
        })

        btnFallback.addEventListener("click", () => {
          removePasskeyModal()
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_GET_RESPONSE",
              requestId,
              fallback: true,
            },
            window.location.origin
          )
        })

        btnSignin.addEventListener("click", () => {
          btnSignin.disabled = true
          btnSignin.textContent = "Signing In..."

          const chosenCredId = authSelect
            ? authSelect.value
            : (passkeys[0].credentialId || passkeys[0].id)

          ext.runtime.sendMessage(
            {
              action: "PASSKEY_SIGN_ASSERTION",
              payload: {
                credentialId: chosenCredId,
                rpId,
                challenge,
                origin: origin || window.location.origin,
                url: window.location.href,
              },
            },
            (signRes) => {
              removePasskeyModal()

              if (!signRes?.success) {
                const errMsg =
                  signRes?.error || "Failed to sign passkey assertion"
                showToast(`Passkey error: ${errMsg}`)
                window.postMessage(
                  {
                    source: "IRIS_PASSKEY_CONTENT",
                    action: "PASSKEY_GET_RESPONSE",
                    requestId,
                    error: errMsg,
                  },
                  window.location.origin
                )
                return
              }

              showToast(
                `Signed in with IRIS Pass (${signRes.userName || "Passkey"})`
              )

              window.postMessage(
                {
                  source: "IRIS_PASSKEY_CONTENT",
                  action: "PASSKEY_GET_RESPONSE",
                  requestId,
                  success: true,
                  credential: signRes.credential,
                },
                window.location.origin
              )
            }
          )
        })
      }
    )
  }

  // Listen for messages from injected passkey script
  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== "IRIS_PASSKEY_PAGE"
    ) {
      return
    }

    if (event.data.action === "PASSKEY_CREATE_REQUEST") {
      handlePasskeyCreateRequest(event.data.requestId, event.data.options)
    } else if (event.data.action === "PASSKEY_GET_REQUEST") {
      handlePasskeyGetRequest(event.data.requestId, event.data.options)
    }
  })

  // ----------------------------------------------------
  // Autofill Simulation (React / Angular / Vue compatible)
  // ----------------------------------------------------
  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element)
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value)
    } else {
      element.value = value
    }

    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
  }

  function fillForm(username, password) {
    const passwordInputs = Array.from(
      document.querySelectorAll('input[type="password"]')
    ).filter((el) => el.offsetParent !== null)

    const userInputs = Array.from(
      document.querySelectorAll(
        'input[type="text"], input[type="email"], input[name*="user"], input[name*="email"], input[id*="user"], input[id*="email"], input[id*="identifier"], input[autocomplete="username"]'
      )
    ).filter((el) => el.offsetParent !== null && el.type !== "hidden")

    let filled = false

    if (password && passwordInputs.length > 0) {
      passwordInputs.forEach((p) => setNativeValue(p, password))
      filled = true
    }

    if (username && userInputs.length > 0) {
      setNativeValue(userInputs[0], username)
      filled = true
    }

    if (filled) {
      showToast("Credentials autofilled by IRIS Pass")
    }
  }

  // Handle messages from background / popup
  ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "FILL_INPUTS") {
      const { username, password } = message.payload
      fillForm(username, password)
      sendResponse({ success: true })
      return true
    }

    if (message.action === "COPY_TO_CLIPBOARD") {
      const { text, label } = message.payload
      navigator.clipboard.writeText(text).then(() => {
        showToast(`${label || "Code"} copied to clipboard!`)
      })
      sendResponse({ success: true })
      return true
    }

    if (message.action === "START_QR_CAPTURE") {
      startScreenQrCapture()
      sendResponse({ success: true })
      return true
    }

    if (message.action === "SHOW_TOTP_TIMER") {
      const { secret, label, initialCode } = message.payload || {}
      showFloatingTotpWidget(secret, label, initialCode)
      sendResponse({ success: true })
      return true
    }

    if (message.action === "QR_SCAN_SUCCESS") {
      const parsed = message.payload
      showToast(`Scanned QR Code! 2FA Secret imported: ${parsed.secret?.slice(0, 4)}...`)
      sendResponse({ success: true })
      return true
    }

    if (message.action === "CLEAR_CLIPBOARD_IF_MATCHES") {
      try {
        const ta = document.createElement("textarea")
        ta.value = ""
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand("copy")
        ta.remove()
        showToast("Clipboard cleared for security")
      } catch (e) {
        try {
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText("").then(() => {
              showToast("Clipboard cleared for security")
            }).catch(() => {})
          }
        } catch (e2) {}
      }
      sendResponse({ success: true })
      return true
    }
  })

  // ----------------------------------------------------
  // Screen QR Code Area Capture Overlay
  // ----------------------------------------------------
  let activeQrOverlay = null

  function startScreenQrCapture() {
    if (activeQrOverlay) activeQrOverlay.remove()

    const overlay = document.createElement("div")
    overlay.className = "iris-qr-capture-overlay"

    const banner = document.createElement("div")
    banner.className = "iris-qr-capture-banner"
    banner.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      <span>Click and drag to select the QR code on your screen</span>
      <span class="iris-qr-key-badge">ESC to cancel</span>
    `
    overlay.appendChild(banner)

    const selectionBox = document.createElement("div")
    selectionBox.className = "iris-qr-selection-box"
    selectionBox.style.display = "none"
    overlay.appendChild(selectionBox)

    let startX = 0
    let startY = 0
    let isDragging = false

    function onMouseDown(e) {
      if (e.button !== 0) return
      isDragging = true
      startX = e.clientX
      startY = e.clientY
      selectionBox.style.left = `${startX}px`
      selectionBox.style.top = `${startY}px`
      selectionBox.style.width = "0px"
      selectionBox.style.height = "0px"
      selectionBox.style.display = "block"
    }

    function onMouseMove(e) {
      if (!isDragging) return
      const curX = e.clientX
      const curY = e.clientY
      const left = Math.min(startX, curX)
      const top = Math.min(startY, curY)
      const width = Math.abs(curX - startX)
      const height = Math.abs(curY - startY)

      selectionBox.style.left = `${left}px`
      selectionBox.style.top = `${top}px`
      selectionBox.style.width = `${width}px`
      selectionBox.style.height = `${height}px`
    }

    function onMouseUp(e) {
      if (!isDragging) return
      isDragging = false
      const curX = e.clientX
      const curY = e.clientY
      const x = Math.min(startX, curX)
      const y = Math.min(startY, curY)
      const width = Math.abs(curX - startX)
      const height = Math.abs(curY - startY)

      cleanUp()

      if (width < 15 || height < 15) {
        showToast("Selection was too small. Scan cancelled.")
        return
      }

      showToast("Analyzing QR code from selected area...")
      ext.runtime.sendMessage(
        {
          action: "PROCESS_QR_SCREENSHOT",
          payload: {
            bounds: {
              x,
              y,
              width,
              height,
              dpr: window.devicePixelRatio || 1,
            },
          },
        },
        (res) => {
          if (res?.success && res.result?.secret) {
            navigator.clipboard.writeText(res.result.secret).catch(() => {})
            showToast(`QR Code decoded! 2FA Secret: ${res.result.secret.slice(0, 4)}... (Copied to clipboard)`)
          } else {
            showToast(res?.error || "Could not decode QR code. Please try again.")
          }
        }
      )
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        cleanUp()
        showToast("QR code scan cancelled")
      }
    }

    function cleanUp() {
      overlay.remove()
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("keydown", onKeyDown)
      activeQrOverlay = null
    }

    overlay.addEventListener("mousedown", onMouseDown)
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("keydown", onKeyDown)

    getOrCreatePortal().appendChild(overlay)
    activeQrOverlay = overlay
  }

  // ----------------------------------------------------
  // Expiring Floating TOTP Countdown Widget
  // ----------------------------------------------------
  let activeTotpWidget = null
  let totpCountdownInterval = null
  let loginSuccessCleanup = null

  function showFloatingTotpWidget(secret, label = "2FA Code", initialCode = "") {
    if (totpCountdownInterval) clearInterval(totpCountdownInterval)
    if (activeTotpWidget) {
      activeTotpWidget.remove()
      activeTotpWidget = null
    }
    if (loginSuccessCleanup) {
      loginSuccessCleanup()
      loginSuccessCleanup = null
    }

    if (!secret) return

    const widget = document.createElement("div")
    widget.className = "iris-totp-floating-widget"

    function getRemaining() {
      const epoch = Math.floor(Date.now() / 1000)
      return 30 - (epoch % 30)
    }

    let curCode = initialCode
    const iconUrl = ext.runtime.getURL("icons/icon-48.png")

    const widgetHeader = document.createElement("div")
    widgetHeader.className = "iris-totp-widget-header"

    const widgetTitle = document.createElement("div")
    widgetTitle.className = "iris-totp-widget-title"

    const widgetLogo = document.createElement("img")
    widgetLogo.src = iconUrl
    widgetLogo.alt = "IRIS Pass"
    widgetLogo.className = "iris-totp-widget-logo"

    const widgetLabel = document.createElement("span")
    widgetLabel.textContent = label

    widgetTitle.appendChild(widgetLogo)
    widgetTitle.appendChild(widgetLabel)

    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "iris-totp-widget-close"
    closeBtn.title = "Dismiss"
    closeBtn.textContent = "✕"

    widgetHeader.appendChild(widgetTitle)
    widgetHeader.appendChild(closeBtn)

    const widgetBody = document.createElement("div")
    widgetBody.className = "iris-totp-widget-body"

    const codeDisplay = document.createElement("span")
    codeDisplay.className = "iris-totp-widget-code"
    codeDisplay.id = "totp-code-display"
    codeDisplay.textContent = curCode || "••••••"

    const timerBadge = document.createElement("span")
    timerBadge.className = "iris-totp-widget-timer-badge"

    const clockSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    clockSvg.setAttribute("width", "12")
    clockSvg.setAttribute("height", "12")
    clockSvg.setAttribute("viewBox", "0 0 24 24")
    clockSvg.setAttribute("fill", "none")
    clockSvg.setAttribute("stroke", "currentColor")
    clockSvg.setAttribute("stroke-width", "2")
    const clockCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    clockCircle.setAttribute("cx", "12")
    clockCircle.setAttribute("cy", "12")
    clockCircle.setAttribute("r", "10")
    const clockPolyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
    clockPolyline.setAttribute("points", "12 6 12 12 16 14")
    clockSvg.appendChild(clockCircle)
    clockSvg.appendChild(clockPolyline)

    const secondsDisplay = document.createElement("span")
    secondsDisplay.id = "totp-seconds-display"
    secondsDisplay.textContent = `${getRemaining()}s`

    timerBadge.appendChild(clockSvg)
    timerBadge.appendChild(secondsDisplay)

    widgetBody.appendChild(codeDisplay)
    widgetBody.appendChild(timerBadge)

    const widgetFooter = document.createElement("div")
    widgetFooter.className = "iris-totp-widget-footer"

    const statusHint = document.createElement("span")
    statusHint.id = "totp-status-hint"
    statusHint.textContent = "Code in clipboard"

    const refreshHint = document.createElement("span")
    refreshHint.textContent = "Auto-refreshes"

    widgetFooter.appendChild(statusHint)
    widgetFooter.appendChild(refreshHint)

    widget.appendChild(widgetHeader)
    widget.appendChild(widgetBody)
    widget.appendChild(widgetFooter)

    getOrCreatePortal().appendChild(widget)
    activeTotpWidget = widget

    closeBtn.addEventListener("click", () => {
      dismissWidget()
    })

    // Initial code generation if not provided
    if (!curCode && typeof IrisTotp !== "undefined") {
      IrisTotp.generateTotp(secret).then((code) => {
        if (code && codeDisplay) {
          curCode = code
          codeDisplay.textContent = code
          navigator.clipboard.writeText(code).catch(() => {})
        }
      })
    } else if (curCode) {
      navigator.clipboard.writeText(curCode).catch(() => {})
    }

    const initialUrl = window.location.href
    const initialAuthInputs = Array.from(
      document.querySelectorAll(
        'input[type="password"], input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="2fa" i], input[name*="totp" i], input[name*="code" i]'
      )
    )

    let lastRemaining = getRemaining()

    totpCountdownInterval = setInterval(async () => {
      // Check if user navigated or logged in (SPA route transition / URL change)
      if (window.location.href !== initialUrl) {
        dismissWidget(true)
        return
      }

      // Check if auth/login form inputs have unmounted/disappeared
      if (initialAuthInputs.length > 0) {
        const anyOriginalConnected = initialAuthInputs.some((el) => el.isConnected)
        const anyCurrentAuth = document.querySelector(
          'input[type="password"], input[autocomplete="one-time-code"]'
        )
        if (!anyOriginalConnected && !anyCurrentAuth) {
          dismissWidget(true)
          return
        }
      }

      const rem = getRemaining()
      if (secondsDisplay) secondsDisplay.textContent = `${rem}s`

      // When timer expires (countdown reaches 0 or wraps around)
      if (rem <= 1 && lastRemaining <= 1) {
        if (secondsDisplay) secondsDisplay.textContent = "0s"
        if (statusHint) {
          statusHint.textContent = "Code expired"
          statusHint.style.color = "#fb7185"
        }
        setTimeout(() => {
          dismissWidget(false)
        }, 500)
        return
      }
      if (rem > lastRemaining || rem === 30) {
        // Expired into next period
        dismissWidget(false)
        return
      }
      lastRemaining = rem
    }, 1000)

    let domObserver = null
    try {
      domObserver = new MutationObserver(() => {
        if (window.location.href !== initialUrl) {
          dismissWidget(true)
        } else if (initialAuthInputs.length > 0) {
          const anyOriginalConnected = initialAuthInputs.some((el) => el.isConnected)
          const anyCurrentAuth = document.querySelector(
            'input[type="password"], input[autocomplete="one-time-code"]'
          )
          if (!anyOriginalConnected && !anyCurrentAuth) {
            dismissWidget(true)
          }
        }
      })
      domObserver.observe(document.body, { childList: true, subtree: true })
    } catch {}

    function dismissWidget(success = false) {
      if (totpCountdownInterval) clearInterval(totpCountdownInterval)
      if (domObserver) {
        domObserver.disconnect()
        domObserver = null
      }
      if (loginSuccessCleanup) {
        loginSuccessCleanup()
        loginSuccessCleanup = null
      }
      if (activeTotpWidget) {
        if (success) {
          activeTotpWidget.style.borderColor = "#10b981"
          if (statusHint) {
            statusHint.textContent = "Signed in successfully ✓"
            statusHint.style.color = "#10b981"
          }
        }
        activeTotpWidget.style.opacity = "0"
        activeTotpWidget.style.transition = "opacity 0.3s ease, transform 0.3s ease"
        activeTotpWidget.style.transform = "translateY(10px)"
        setTimeout(() => {
          if (activeTotpWidget) {
            activeTotpWidget.remove()
            activeTotpWidget = null
          }
        }, 350)
      }
    }

    // Login Success Event Listeners
    function handlePotentialLoginClick(e) {
      const btn = e.target.closest('button, input[type="submit"], [role="button"]')
      if (!btn) return
      const text = (btn.textContent || btn.value || "").toLowerCase()
      if (/sign\s*in|log\s*in|verify|continue|submit|next|authenticate|confirm|enter/i.test(text)) {
        setTimeout(() => {
          if (
            window.location.href !== initialUrl ||
            !document.querySelector('input[type="password"], input[autocomplete="one-time-code"]')
          ) {
            dismissWidget(true)
          }
        }, 600)
        setTimeout(() => {
          if (
            window.location.href !== initialUrl ||
            !document.querySelector('input[type="password"], input[autocomplete="one-time-code"]')
          ) {
            dismissWidget(true)
          }
        }, 1500)
      }
    }

    function handleKeyDown(e) {
      if (e.key === "Enter") {
        setTimeout(() => {
          if (
            window.location.href !== initialUrl ||
            !document.querySelector('input[type="password"], input[autocomplete="one-time-code"]')
          ) {
            dismissWidget(true)
          }
        }, 800)
      }
    }

    function handleFormSubmit() {
      setTimeout(() => {
        dismissWidget(true)
      }, 800)
    }

    function handleUrlChange() {
      dismissWidget(true)
    }

    document.addEventListener("submit", handleFormSubmit, { capture: true })
    document.addEventListener("click", handlePotentialLoginClick, { capture: true })
    document.addEventListener("keydown", handleKeyDown, { capture: true })
    window.addEventListener("popstate", handleUrlChange)
    window.addEventListener("hashchange", handleUrlChange)
    window.addEventListener("pagehide", handleUrlChange)

    // Auto dismiss after 3 minutes max
    const autoTimeout = setTimeout(() => {
      dismissWidget(false)
    }, 180000)

    loginSuccessCleanup = () => {
      clearTimeout(autoTimeout)
      if (domObserver) {
        domObserver.disconnect()
        domObserver = null
      }
      document.removeEventListener("submit", handleFormSubmit, { capture: true })
      document.removeEventListener("click", handlePotentialLoginClick, { capture: true })
      document.removeEventListener("keydown", handleKeyDown, { capture: true })
      window.removeEventListener("popstate", handleUrlChange)
      window.removeEventListener("hashchange", handleUrlChange)
      window.removeEventListener("pagehide", handleUrlChange)
    }
  }

  // ----------------------------------------------------
  // In-Field Badges & Dropdown (Bitwarden Style)
  // ----------------------------------------------------
  let activeDropdown = null
  let activeDropdownTarget = null
  const inputIconMap = new Map()

  function removeDropdown() {
    if (activeDropdown) {
      activeDropdown.remove()
      activeDropdown = null
    }
    if (activeDropdownTarget) {
      const prevTarget = activeDropdownTarget
      activeDropdownTarget = null
      const icon = inputIconMap.get(prevTarget)
      if (icon) {
        icon.classList.remove("active")
        if (document.activeElement !== prevTarget) {
          icon.classList.remove("visible")
        }
      }
    }
  }

  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".iris-pass-field-icon") &&
      !e.target.closest(".iris-pass-dropdown")
    ) {
      removeDropdown()
    }
  })

  function updateDropdownPosition(dropdown, targetInput, iconEl) {
    if (!dropdown || !targetInput) return
    const inputRect = targetInput.getBoundingClientRect()
    const iconRect = iconEl ? iconEl.getBoundingClientRect() : null

    const dropdownWidth = 280

    // Anchor horizontally under the icon: align right edge of dropdown with right edge of icon
    let left =
      iconRect && iconRect.width > 0
        ? iconRect.right - dropdownWidth + 4
        : inputRect.right - dropdownWidth

    // Guard left and right viewport edges
    if (left < 10) {
      left = Math.max(10, inputRect.left)
    }
    if (left + dropdownWidth > window.innerWidth - 10) {
      left = window.innerWidth - dropdownWidth - 10
    }

    let top = inputRect.bottom + 6

    // If dropdown would overflow bottom of viewport, check if it can open upwards
    const dropdownHeight = dropdown.offsetHeight || 220
    if (
      top + dropdownHeight > window.innerHeight - 10 &&
      inputRect.top > dropdownHeight + 10
    ) {
      top = inputRect.top - dropdownHeight - 6
    }

    dropdown.style.position = "fixed"
    dropdown.style.top = `${top}px`
    dropdown.style.left = `${left}px`
    dropdown.style.width = `${dropdownWidth}px`
  }

  function showFieldDropdown(targetInput, iconEl) {
    removeDropdown()
    activeDropdownTarget = targetInput
    iconEl.classList.add("visible", "active")

    ext.runtime.sendMessage(
      {
        action: "GET_MATCHING_LOGINS",
        payload: { url: window.location.href },
      },
      (response) => {
        const isUnlocked = response?.isUnlocked
        const matches = response?.matches || []

        const dropdown = document.createElement("div")
        dropdown.className = "iris-pass-dropdown"
        updateDropdownPosition(dropdown, targetInput, iconEl)

        // Locked State: show Bitwarden-style unlock card
        if (isUnlocked === false) {
          const lockedCard = document.createElement("div")
          lockedCard.className = "iris-pass-dropdown-locked-card"

          const iconBox = document.createElement("div")
          iconBox.className = "iris-pass-dropdown-locked-icon"
          const lockSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
          lockSvg.setAttribute("viewBox", "0 0 24 24")
          const lockRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
          lockRect.setAttribute("x", "5")
          lockRect.setAttribute("y", "11")
          lockRect.setAttribute("width", "14")
          lockRect.setAttribute("height", "10")
          lockRect.setAttribute("rx", "2")
          const lockCirc = document.createElementNS("http://www.w3.org/2000/svg", "circle")
          lockCirc.setAttribute("cx", "12")
          lockCirc.setAttribute("cy", "16")
          lockCirc.setAttribute("r", "1")
          const lockPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
          lockPath.setAttribute("d", "M8 11V7a4 4 0 0 1 8 0v4")
          lockSvg.appendChild(lockRect)
          lockSvg.appendChild(lockCirc)
          lockSvg.appendChild(lockPath)
          iconBox.appendChild(lockSvg)

          const lockTitle = document.createElement("div")
          lockTitle.className = "iris-pass-dropdown-locked-title"
          lockTitle.textContent = "IRIS Pass is Locked"

          const lockDesc = document.createElement("div")
          lockDesc.className = "iris-pass-dropdown-locked-desc"
          lockDesc.textContent = "Unlock your vault to access and autofill credentials for this website."

          const unlockBtn = document.createElement("button")
          unlockBtn.type = "button"
          unlockBtn.className = "iris-pass-dropdown-unlock-btn"
          unlockBtn.id = "btn-unlock-from-dropdown"

          const btnLockSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
          btnLockSvg.setAttribute("width", "14")
          btnLockSvg.setAttribute("height", "14")
          btnLockSvg.setAttribute("viewBox", "0 0 24 24")
          btnLockSvg.setAttribute("fill", "none")
          btnLockSvg.setAttribute("stroke", "currentColor")
          btnLockSvg.setAttribute("stroke-width", "2")
          const bRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
          bRect.setAttribute("x", "5")
          bRect.setAttribute("y", "11")
          bRect.setAttribute("width", "14")
          bRect.setAttribute("height", "10")
          bRect.setAttribute("rx", "2")
          const bPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
          bPath.setAttribute("d", "M8 11V7a4 4 0 0 1 8 0v4")
          btnLockSvg.appendChild(bRect)
          btnLockSvg.appendChild(bPath)

          const btnSpan = document.createElement("span")
          btnSpan.textContent = "Unlock IRIS Pass"

          unlockBtn.appendChild(btnLockSvg)
          unlockBtn.appendChild(btnSpan)

          lockedCard.appendChild(iconBox)
          lockedCard.appendChild(lockTitle)
          lockedCard.appendChild(lockDesc)
          lockedCard.appendChild(unlockBtn)

          unlockBtn.addEventListener("click", (e) => {
            e.preventDefault()
            e.stopPropagation()
            ext.runtime.sendMessage({ action: "OPEN_UNLOCK_WINDOW" })
            removeDropdown()
          })
          dropdown.appendChild(lockedCard)
          getOrCreatePortal().appendChild(dropdown)
          activeDropdown = dropdown
          return
        }

        const searchWrap = document.createElement("div")
        searchWrap.className = "iris-pass-dropdown-search-wrap"

        const searchSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        searchSvg.setAttribute("class", "iris-pass-dropdown-search-icon")
        searchSvg.setAttribute("viewBox", "0 0 24 24")
        searchSvg.setAttribute("width", "13")
        searchSvg.setAttribute("height", "13")
        searchSvg.setAttribute("stroke", "currentColor")
        searchSvg.setAttribute("stroke-width", "2")
        searchSvg.setAttribute("fill", "none")
        const searchCirc = document.createElementNS("http://www.w3.org/2000/svg", "circle")
        searchCirc.setAttribute("cx", "11")
        searchCirc.setAttribute("cy", "11")
        searchCirc.setAttribute("r", "8")
        const searchLine = document.createElementNS("http://www.w3.org/2000/svg", "line")
        searchLine.setAttribute("x1", "21")
        searchLine.setAttribute("y1", "21")
        searchLine.setAttribute("x2", "16.65")
        searchLine.setAttribute("y2", "16.65")
        searchSvg.appendChild(searchCirc)
        searchSvg.appendChild(searchLine)

        const searchInput = document.createElement("input")
        searchInput.type = "text"
        searchInput.className = "iris-pass-dropdown-search-input"
        searchInput.placeholder = "Search logins..."
        searchInput.autocomplete = "off"

        searchWrap.appendChild(searchSvg)
        searchWrap.appendChild(searchInput)
        dropdown.appendChild(searchWrap)

        searchWrap.addEventListener("click", (e) => e.stopPropagation())
        searchWrap.addEventListener("mousedown", (e) => e.stopPropagation())

        const list = document.createElement("div")
        list.className = "iris-pass-dropdown-list"

        function fillCredential(m, passwordVal) {
          const isTargetPassword = targetInput.type === "password"
          if (isTargetPassword) {
            setNativeValue(targetInput, passwordVal || "")
            // Find companion username
            const root = targetInput.closest("form") || document.body
            const uInputs = Array.from(
              root.querySelectorAll(
                'input[type="text"], input[type="email"], input[id*="identifier"]'
              )
            ).filter((el) => el.offsetParent !== null && el !== targetInput)
            if (uInputs.length > 0 && m.data?.username) {
              setNativeValue(uInputs[0], m.data.username)
            }
          } else {
            setNativeValue(targetInput, m.data?.username || "")
            // Find companion password
            const root = targetInput.closest("form") || document.body
            const pInputs = Array.from(
              root.querySelectorAll('input[type="password"]')
            ).filter((el) => el.offsetParent !== null)
            if (pInputs.length > 0 && passwordVal) {
              setNativeValue(pInputs[0], passwordVal)
            }
          }

          showToast(`Autofilled from IRIS Pass (${m.title})`)

          if (m.data?.totpSecret) {
            ext.runtime.sendMessage({
              action: "PERFORM_AUTOFILL",
              payload: { cipherId: m.id },
            })
          }

          removeDropdown()
        }

        let searchQuery = ""
        function renderItems() {
          list.innerHTML = ""

          const filtered = matches.filter((m) => {
            if (!searchQuery) return true
            const q = searchQuery.toLowerCase()
            const matchTitle = m.title?.toLowerCase().includes(q)
            const matchUser = m.data?.username?.toLowerCase().includes(q)
            return matchTitle || matchUser
          })

          if (filtered.length === 0) {
            const empty = document.createElement("div")
            empty.style.padding = "14px 12px"
            empty.style.fontSize = "11px"
            empty.style.color = "#a19da8"
            empty.style.textAlign = "center"
            empty.textContent = searchQuery
              ? "No matching credentials"
              : "No matching credentials in vault"
            list.appendChild(empty)
            return
          }

          filtered.forEach((m) => {
            const wrap = document.createElement("div")
            wrap.className = "iris-pass-dropdown-item-wrap"

            const row = document.createElement("div")
            row.className = "iris-pass-dropdown-row"

            const item = document.createElement("button")
            item.type = "button"
            item.className = "iris-pass-dropdown-item"
            const hasPasskey = Boolean(m.data?.passkey)
            const hasTotp = Boolean(m.data?.totpSecret)
            const additional = m.data?.additionalPasswords || []
            const hasMultiplePasswords = additional.length > 0

            const itemTopRow = document.createElement("div")
            itemTopRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; width: 100%;"

            const itemTitle = document.createElement("span")
            itemTitle.className = "iris-pass-dropdown-item-title"
            itemTitle.textContent = m.title

            const itemBadges = document.createElement("div")
            itemBadges.style.cssText = "display: flex; gap: 4px;"

            if (hasPasskey) {
              const pkBadge = document.createElement("span")
              pkBadge.style.cssText = "font-size: 9px; padding: 1px 4px; border-radius: 4px; background: rgba(216,0,166,0.15); color: #d800a6; border: 1px solid rgba(216,0,166,0.3);"
              pkBadge.textContent = "Passkey"
              itemBadges.appendChild(pkBadge)
            }
            if (hasTotp) {
              const totpBadge = document.createElement("span")
              totpBadge.style.cssText = "font-size: 9px; padding: 1px 4px; border-radius: 4px; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3);"
              totpBadge.textContent = "2FA"
              itemBadges.appendChild(totpBadge)
            }

            itemTopRow.appendChild(itemTitle)
            itemTopRow.appendChild(itemBadges)

            const itemUser = document.createElement("span")
            itemUser.className = "iris-pass-dropdown-item-user"
            itemUser.textContent = m.data?.username || "No username"

            item.appendChild(itemTopRow)
            item.appendChild(itemUser)

            // Primary click fills primary password
            item.addEventListener("click", (e) => {
              e.preventDefault()
              e.stopPropagation()
              fillCredential(m, m.data?.password || "")
            })

            row.appendChild(item)

            // If has multiple passwords, add arrow dropdown button
            if (hasMultiplePasswords) {
              const arrowBtn = document.createElement("button")
              arrowBtn.type = "button"
              arrowBtn.className = "iris-pass-dropdown-arrow-btn"
              arrowBtn.title = "Select password"

              const arrSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
              arrSvg.setAttribute("viewBox", "0 0 24 24")
              arrSvg.setAttribute("width", "13")
              arrSvg.setAttribute("height", "13")
              arrSvg.setAttribute("stroke", "currentColor")
              arrSvg.setAttribute("stroke-width", "2")
              arrSvg.setAttribute("fill", "none")
              const arrPoly = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
              arrPoly.setAttribute("points", "6 9 12 15 18 9")
              arrSvg.appendChild(arrPoly)
              arrowBtn.appendChild(arrSvg)

              const subMenu = document.createElement("div")
              subMenu.className = "iris-pass-dropdown-submenu"

              // Option 1: Primary Password
              const primarySubBtn = document.createElement("button")
              primarySubBtn.type = "button"
              primarySubBtn.className = "iris-pass-dropdown-sub-item"
              const primSpan1 = document.createElement("span")
              primSpan1.textContent = "Primary Password"
              const primSpan2 = document.createElement("span")
              primSpan2.style.cssText = "font-size: 10px; color: #7a7782;"
              primSpan2.textContent = "(Default)"
              primarySubBtn.appendChild(primSpan1)
              primarySubBtn.appendChild(primSpan2)

              primarySubBtn.addEventListener("click", (e) => {
                e.preventDefault()
                e.stopPropagation()
                fillCredential(m, m.data?.password || "")
              })
              subMenu.appendChild(primarySubBtn)

              // Option 2...N: Additional Passwords
              additional.forEach((ap) => {
                const subBtn = document.createElement("button")
                subBtn.type = "button"
                subBtn.className = "iris-pass-dropdown-sub-item"
                const aSpan = document.createElement("span")
                aSpan.textContent = ap.name || "Password"
                subBtn.appendChild(aSpan)
                subBtn.addEventListener("click", (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  fillCredential(m, ap.value || "")
                })
                subMenu.appendChild(subBtn)
              })

              arrowBtn.addEventListener("click", (e) => {
                e.preventDefault()
                e.stopPropagation()
                const isOpen = subMenu.classList.contains("open")
                if (isOpen) {
                  subMenu.classList.remove("open")
                  arrowBtn.classList.remove("open")
                } else {
                  // Close other open submenus first
                  list.querySelectorAll(".iris-pass-dropdown-submenu.open").forEach((el) => el.classList.remove("open"))
                  list.querySelectorAll(".iris-pass-dropdown-arrow-btn.open").forEach((el) => el.classList.remove("open"))
                  subMenu.classList.add("open")
                  arrowBtn.classList.add("open")
                }
              })

              row.appendChild(arrowBtn)
              wrap.appendChild(row)
              wrap.appendChild(subMenu)
            } else {
              wrap.appendChild(row)
            }

            list.appendChild(wrap)
          })
        }

        searchInput.addEventListener("input", (e) => {
          searchQuery = e.target.value.trim()
          renderItems()
        })

        renderItems()

        dropdown.appendChild(list)
        getOrCreatePortal().appendChild(dropdown)
        activeDropdown = dropdown
        updateDropdownPosition(dropdown, targetInput, iconEl)
      }
    )
  }

  function isCredentialInput(el) {
    if (!el || el.tagName !== "INPUT") return false
    const type = (el.type || "text").toLowerCase()

    if (
      type === "hidden" ||
      type === "submit" ||
      type === "button" ||
      type === "reset" ||
      type === "checkbox" ||
      type === "radio" ||
      type === "file" ||
      type === "image" ||
      type === "color" ||
      type === "range" ||
      type === "date" ||
      type === "datetime-local" ||
      type === "time" ||
      type === "month" ||
      type === "week" ||
      type === "number"
    ) {
      return false
    }

    if (el.disabled || el.readOnly) return false

    // Password inputs are always credentials
    if (type === "password") return true

    // Email inputs are credential candidates
    if (type === "email") return true

    // Check autocomplete attribute
    const auto = (el.getAttribute("autocomplete") || "").toLowerCase()
    if (
      auto.includes("username") ||
      auto.includes("email") ||
      auto.includes("webauthn") ||
      auto.includes("current-password") ||
      auto.includes("new-password") ||
      auto.includes("one-time-code")
    ) {
      return true
    }

    // Heuristics on name, id, placeholder, aria-label, testid
    const identifier = [
      el.name,
      el.id,
      el.placeholder,
      el.getAttribute("aria-label"),
      el.getAttribute("data-testid"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    if (
      /(user|login|email|identifier|account|member|signin|phone|auth|pass)/i.test(
        identifier
      )
    ) {
      return true
    }

    // If inside a form or container that also has a password field
    const container = el.closest("form") || el.parentElement?.parentElement
    if (container && container.querySelector('input[type="password"]')) {
      return true
    }

    return false
  }

  function getTrailingButtonOffset(input, icon, rect) {
    let offset = 26 // default offset from right edge
    try {
      const style = window.getComputedStyle(input)
      const paddingRight = parseFloat(style.paddingRight) || 0

      // If input has notable right padding (e.g. >= 28px), site provided space for an eye toggle or action
      if (paddingRight >= 28) {
        offset = Math.max(offset, paddingRight + 4)
      }

      // Check sibling buttons, SVGs, clickable icons inside parent or ancestor container overlapping right edge
      const parent = input.parentElement
      if (parent) {
        const candidates = parent.querySelectorAll(
          'button, svg, [role="button"], a, [class*="eye" i], [class*="show" i], [class*="toggle" i], [class*="reveal" i], [class*="icon" i]'
        )
        for (const el of candidates) {
          if (el === icon || el.contains(icon) || (icon && icon.contains(el))) continue
          const elRect = el.getBoundingClientRect()
          // Check if element is visible and located near the right edge of input (within input vertical bounds)
          if (
            elRect.width > 0 &&
            elRect.height > 0 &&
            elRect.right <= rect.right + 12 &&
            elRect.left >= rect.right - 80 &&
            elRect.bottom > rect.top &&
            elRect.top < rect.bottom
          ) {
            const fromRight = rect.right - elRect.left
            if (fromRight > 10) {
              offset = Math.max(offset, fromRight + 26)
            }
          }
        }
      }
    } catch (e) {}

    // Cap offset so icon stays safely within the input boundary
    return Math.min(offset, Math.max(26, rect.width - 26))
  }

  function updateIconPosition(input, icon) {
    if (!input || !icon) return
    const rect = input.getBoundingClientRect()
    if (
      rect.width === 0 ||
      rect.height === 0 ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight
    ) {
      icon.style.display = "none"
      return
    }

    icon.style.display = "flex"
    const top = rect.top + (rect.height - 20) / 2
    const offsetFromRight = getTrailingButtonOffset(input, icon, rect)
    const left = rect.right - offsetFromRight
    icon.style.top = `${top}px`
    icon.style.left = `${left}px`
  }

  let fieldResizeObserver = null
  if (typeof ResizeObserver !== "undefined") {
    fieldResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const input = entry.target
        const icon = inputIconMap.get(input)
        if (icon) {
          updateIconPosition(input, icon)
        }
      }
    })
  }

  let fieldIntersectionObserver = null
  if (typeof IntersectionObserver !== "undefined") {
    fieldIntersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const input = entry.target
        const icon = inputIconMap.get(input)
        if (icon && entry.isIntersecting) {
          updateIconPosition(input, icon)
        }
      }
    }, { threshold: 0.1 })
  }

  function attachBadges() {
    const allInputs = Array.from(document.querySelectorAll("input"))

    allInputs.forEach((input) => {
      if (input.dataset.irisPassAttached) return
      if (!isCredentialInput(input)) return

      input.dataset.irisPassAttached = "true"

      const icon = document.createElement("button")
      icon.type = "button"
      icon.className = "iris-pass-field-icon"
      icon.title = "IRIS Pass Autofill"
      const iconUrl = ext.runtime.getURL("icons/icon-48.png")

      const iconImg = document.createElement("img")
      iconImg.src = iconUrl
      iconImg.alt = "IRIS Pass"
      iconImg.className = "iris-pass-badge-img"
      icon.appendChild(iconImg)

      inputIconMap.set(input, icon)

      // Observe size & visibility changes
      if (fieldResizeObserver) fieldResizeObserver.observe(input)
      if (fieldIntersectionObserver) fieldIntersectionObserver.observe(input)

      let isInputHovered = false
      let isIconHovered = false

      function showIcon() {
        updateIconPosition(input, icon)
        icon.classList.add("visible")
      }

      function hideIcon() {
        if (document.activeElement === input) return
        if (isInputHovered || isIconHovered) return
        if (activeDropdownTarget === input) return
        icon.classList.remove("visible")
      }

      input.addEventListener("focus", showIcon)
      input.addEventListener("input", () => {
        ext.runtime.sendMessage({ action: "PING_ACTIVITY" }).catch(() => {})
      })
      input.addEventListener("mouseenter", () => {
        isInputHovered = true
        showIcon()
      })
      input.addEventListener("mouseleave", () => {
        isInputHovered = false
        setTimeout(hideIcon, 120)
      })
      input.addEventListener("blur", () => {
        setTimeout(hideIcon, 150)
      })

      icon.addEventListener("mouseenter", () => {
        isIconHovered = true
        showIcon()
      })
      icon.addEventListener("mouseleave", () => {
        isIconHovered = false
        setTimeout(hideIcon, 120)
      })

      icon.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (activeDropdownTarget === input) {
          removeDropdown()
        } else {
          showFieldDropdown(input, icon)
        }
      })

      // If input already has focus when script attaches
      if (document.activeElement === input) {
        showIcon()
      }

      getOrCreatePortal().appendChild(icon)
    })
  }

  function updateAllVisibleIcons() {
    inputIconMap.forEach((icon, input) => {
      if (icon.classList.contains("visible") || document.activeElement === input) {
        updateIconPosition(input, icon)
      }
    })
    if (activeDropdown && activeDropdownTarget) {
      const icon = inputIconMap.get(activeDropdownTarget)
      updateDropdownPosition(activeDropdown, activeDropdownTarget, icon)
    }
  }

  // Global focusin listener: guarantees that when any credential input gets focus (in OAuth popups, external windows, etc.)
  // badges are attached and the icon appears immediately.
  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target
      if (target && target.tagName === "INPUT") {
        attachBadges()
        const icon = inputIconMap.get(target)
        if (icon) {
          updateIconPosition(target, icon)
          icon.classList.add("visible")
        }
      }
    },
    true
  )

  window.addEventListener("scroll", updateAllVisibleIcons, {
    passive: true,
    capture: true,
  })
  window.addEventListener("resize", updateAllVisibleIcons, { passive: true })
  window.addEventListener("focus", () => {
    attachBadges()
    updateAllVisibleIcons()
  })
  window.addEventListener("pageshow", () => {
    attachBadges()
    updateAllVisibleIcons()
  })
  window.addEventListener("load", () => {
    attachBadges()
    updateAllVisibleIcons()
  })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      attachBadges()
      updateAllVisibleIcons()
    }
  })

  // Scan on DOM load and mutations
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachBadges)
  } else {
    attachBadges()
  }

  let mutationDebounceTimer = null
  const observer = new MutationObserver(() => {
    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer)
    mutationDebounceTimer = setTimeout(() => {
      attachBadges()
      updateAllVisibleIcons()
    }, 40)
  })

  const rootTarget = document.documentElement || document.body
  if (rootTarget) {
    observer.observe(rootTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "type", "disabled", "readonly"],
    })
  }
})()

/**
 * Akaromi for Firefox — Content Script Coordinator
 */
;(function () {
  "use strict"

  const ext = typeof browser !== "undefined" ? browser : chrome

  let akaromiPortal = null
  let inertObserver = null

  function getOrCreatePortal() {
    if (akaromiPortal && akaromiPortal.isConnected) {
      return akaromiPortal
    }

    let portal = document.getElementById("akaromi-portal") || document.getElementById("iris-pass-portal")
    if (!portal) {
      portal = document.createElement("div")
      portal.id = "akaromi-portal"
      portal.setAttribute("data-akaromi-portal", "true")
      portal.className = "akaromi-portal-root iris-pass-portal-root"
    }

    // Attach to document.body (or document.documentElement fallback)
    const targetParent = document.body || document.documentElement
    if (portal.parentElement !== targetParent) {
      targetParent.appendChild(portal)
    }

    // Ensure inert or aria-hidden attributes can never disable Akaromi UI
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

    akaromiPortal = portal
    return portal
  }

  // Prevent host page modal frameworks (React Aria, Radix, Base UI) from stealing focus
  // or capturing clicks outside their own modals when interacting with Akaromi
  function isAkaromiTarget(target) {
    if (!target || !(target instanceof Element)) return false
    if (
      target.closest(
        ".iris-qr-capture-overlay, .iris-qr-selection-box, .iris-qr-capture-banner, .iris-qr-size-badge"
      )
    ) {
      return false
    }
    return Boolean(
      target.closest(
        "#akaromi-portal, #iris-pass-portal, .akaromi-portal-root, .iris-pass-portal-root, .iris-passkey-dialog-overlay, .iris-passkey-dialog, .akaromi-dropdown, .iris-pass-dropdown, .akaromi-field-icon, .iris-pass-field-icon, .iris-totp-floating-widget, .iris-pass-toast"
      )
    )
  }

  // Prevent host page modal frameworks (React Aria, Radix UI, Base UI, floating-ui)
  // from treating clicks/focus on Akaromi as "outside interactions" (which dismisses host modals or blocks clicks)
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
        if (isAkaromiTarget(e.target)) {
          // Stop propagation in capture phase on window so document-level outside click listeners
          // (such as React Aria useInteractOutside) never receive the event and never close host modals
          e.stopPropagation()

          // Ensure focusable Akaromi elements receive native focus
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

  // Prevent bubbling events inside Akaromi UI from reaching document/body handlers
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
        if (isAkaromiTarget(e.target)) {
          e.stopPropagation()
        }
      },
      false
    )
  })

  function showToast(message, duration = 3000) {
    const portal = getOrCreatePortal()
    const toast = document.createElement("div")
    toast.className = "iris-pass-toast"
    toast.textContent = message
    portal.appendChild(toast)

    requestAnimationFrame(() => toast.classList.add("visible"))
    setTimeout(() => {
      toast.classList.remove("visible")
      setTimeout(() => toast.remove(), 250)
    }, duration)
  }

  // ----------------------------------------------------
  // Initial Scan & Mutation Observer
  // ----------------------------------------------------
  function scanAndAttachBadges() {
    const portal = getOrCreatePortal()
    const inputs = document.querySelectorAll("input")
    inputs.forEach((input) => {
      globalThis.AkaromiBadge?.attachBadgeToInput(input, portal)
    })
  }

  let mutationTimer = null
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false
    let shouldCleanup = false

    for (const m of mutations) {
      if (m.addedNodes.length > 0) shouldScan = true
      if (m.removedNodes.length > 0) shouldCleanup = true
    }

    if (shouldCleanup) {
      globalThis.AkaromiBadge?.cleanupRemovedInputs()
    }

    if (shouldScan) {
      clearTimeout(mutationTimer)
      mutationTimer = setTimeout(scanAndAttachBadges, 60)
    }
  })

  function init() {
    scanAndAttachBadges()
    const rootTarget = document.documentElement || document.body
    if (rootTarget) {
      observer.observe(rootTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "type", "disabled", "readonly"],
      })
    }

    // Capture dynamic inputs immediately on user interaction
    document.addEventListener(
      "focusin",
      (e) => {
        if (e.target && e.target.tagName === "INPUT") {
          scanAndAttachBadges()
          const icon = globalThis.AkaromiBadge?.getIconForInput(e.target)
          if (icon) {
            globalThis.AkaromiBadge?.updateIconPosition(e.target, icon)
            icon.classList.add("visible")
          }
        }
      },
      true
    )

    document.addEventListener(
      "mouseover",
      (e) => {
        if (e.target && e.target.tagName === "INPUT") {
          scanAndAttachBadges()
        }
      },
      true
    )

    window.addEventListener("scroll", () => globalThis.AkaromiBadge?.updateAllVisibleIcons(), {
      passive: true,
      capture: true,
    })
    window.addEventListener("resize", () => globalThis.AkaromiBadge?.updateAllVisibleIcons(), { passive: true })
    window.addEventListener("focus", () => {
      scanAndAttachBadges()
      globalThis.AkaromiBadge?.updateAllVisibleIcons()
    })
    window.addEventListener("pageshow", () => {
      scanAndAttachBadges()
      globalThis.AkaromiBadge?.updateAllVisibleIcons()
    })
    window.addEventListener("load", () => {
      scanAndAttachBadges()
      globalThis.AkaromiBadge?.updateAllVisibleIcons()
    })
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scanAndAttachBadges()
        globalThis.AkaromiBadge?.updateAllVisibleIcons()
      }
    })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }

  // ----------------------------------------------------
  // WebAuthn Passkey Modals & Bridge (Page <-> Content <-> Background)
  // ----------------------------------------------------
  let activePasskeyModal = null

  function removePasskeyModal() {
    if (activePasskeyModal) {
      activePasskeyModal.remove()
      activePasskeyModal = null
    }
  }

  function handlePasskeyCreateRequest(requestId, options) {
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

    // First check status / matching logins
    ext.runtime.sendMessage(
      {
        action: "GET_MATCHING_LOGINS",
        payload: { url: window.location.href },
      },
      (matchesRes) => {
        if (ext.runtime?.lastError) {
          console.warn("[Akaromi] Extension runtime error:", ext.runtime.lastError)
          showToast("Akaromi passkey error: extension background unavailable")
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_CREATE_RESPONSE",
              requestId,
              canceled: true,
              error: "Akaromi extension background unavailable",
            },
            window.location.origin
          )
          return
        }

        if (matchesRes?.isUnlocked === false) {
          showToast("Akaromi is locked. Click the toolbar icon to unlock.")
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_CREATE_RESPONSE",
              requestId,
              canceled: true,
              error: "Akaromi vault is locked. Please unlock via the extension toolbar.",
            },
            window.location.origin
          )
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
        iconImg.alt = "Akaromi"
        iconImg.className = "iris-passkey-dialog-logo"
        iconDiv.appendChild(iconImg)

        const title = document.createElement("h3")
        title.className = "iris-passkey-title"
        title.textContent = "Save Passkey to Akaromi"

        const subtitle = document.createElement("p")
        subtitle.className = "iris-passkey-subtitle"
        subtitle.textContent = "Passkeys allow you to sign in safely and quickly without entering a password."

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
            const isCurrent =
              m.data?.username &&
              userName &&
              m.data.username.toLowerCase() === userName.toLowerCase()
            const hasPasskey = Boolean(m.data?.passkey)
            const opt = document.createElement("option")
            opt.value = m.id
            opt.selected = isCurrent
            opt.textContent = `${m.title} (${m.data?.username || "No username"})${hasPasskey ? " • Passkey Saved" : ""}`
            selectAccount.appendChild(opt)
          })

          const newOpt = document.createElement("option")
          newOpt.value = "new"
          newOpt.selected = !matches.some(
            (m) =>
              m.data?.username &&
              userName &&
              m.data.username.toLowerCase() === userName.toLowerCase()
          )
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
          val.textContent = userName || userDisplayName || "Account"

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
        btnFallback.textContent = "Use Device Passkey / Hello"

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
                    success: false,
                    error: errMsg,
                  },
                  window.location.origin
                )
                return
              }

              showToast(`Passkey saved for ${userName || rpId}!`)

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

  function handlePasskeyGetRequest(requestId, options) {
    removePasskeyModal()

    const { rpId, challenge, origin, allowCredentials } = options || {}

    ext.runtime.sendMessage(
      {
        action: "PASSKEY_GET_CREDENTIALS",
        payload: { rpId, url: window.location.href, allowCredentials },
      },
      (res) => {
        if (ext.runtime?.lastError) {
          console.warn("[Akaromi] Extension runtime error:", ext.runtime.lastError)
          showToast("Akaromi passkey error: extension background unavailable")
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_GET_RESPONSE",
              requestId,
              canceled: true,
              error: "Akaromi extension background unavailable",
            },
            window.location.origin
          )
          return
        }

        if (res?.isUnlocked === false) {
          showToast("Akaromi is locked. Click the toolbar icon to unlock.")
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_GET_RESPONSE",
              requestId,
              canceled: true,
              error: "Akaromi vault is locked. Please unlock via the extension toolbar.",
            },
            window.location.origin
          )
          return
        }

        const passkeys = res?.passkeys || []

        if (passkeys.length === 0) {
          // No passkeys saved in vault for this RP: cancel cleanly with toast rather than hanging native WebAuthn
          showToast("No passkey found in Akaromi")
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_GET_RESPONSE",
              requestId,
              canceled: true,
              error: "No passkey found in Akaromi",
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
        iconImg.alt = "Akaromi"
        iconImg.className = "iris-passkey-dialog-logo"
        iconDiv.appendChild(iconImg)

        const title = document.createElement("h3")
        title.className = "iris-passkey-title"
        title.textContent = "Sign in with Passkey"

        const subtitle = document.createElement("p")
        subtitle.className = "iris-passkey-subtitle"
        subtitle.textContent = "Use your passkey saved in Akaromi to sign in."

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
            opt.value = p.credentialId
            opt.textContent = `${p.userName} (${p.title || p.cipherTitle || "Passkey"})`
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
          val.textContent = passkeys[0].userName || "Account"

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
        btnSignin.textContent = "Sign In with Akaromi"

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
            : passkeys[0].credentialId

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
                    success: false,
                    error: errMsg,
                  },
                  window.location.origin
                )
                return
              }

              showToast(
                `Signed in with Akaromi (${signRes.userName || "Passkey"})`
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
  // Extension Message Handler
  // ----------------------------------------------------
  ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "PING") {
      sendResponse({ pong: true })
      return true
    }

    if (message.action === "FILL_INPUTS" || message.action === "FILL_CREDENTIALS") {
      const { username, password, totpSecret, title } = message.payload || {}
      globalThis.AkaromiFill?.fillCredential({
        title,
        data: { username, password, totpSecret },
      })
      showToast("Credentials autofilled by Akaromi")
      sendResponse({ success: true })
      return true
    }

    if (message.action === "START_QR_CAPTURE") {
      if (window !== window.top) return
      startScreenQrCapture()
      sendResponse({ success: true })
      return true
    }

    if (message.action === "SHOW_TOTP_TIMER" || message.action === "SHOW_FLOATING_TOTP_WIDGET") {
      const { secret, label, initialCode } = message.payload || {}
      showFloatingTotpWidget(secret, label, initialCode)
      sendResponse({ success: true })
      return true
    }

    if (message.action === "QR_SCAN_SUCCESS") {
      const parsed = message.payload || {}
      if (parsed.secret) {
        copyToClipboard(parsed.secret)
      }
      showToast(`Scanned QR Code! 2FA Secret imported: ${parsed.secret?.slice(0, 4)}...`)
      sendResponse({ success: true })
      return true
    }

    if (message.action === "CLEAR_CLIPBOARD_IF_MATCHES") {
      try {
        const expected = message.payload?.text
        if (navigator.clipboard?.readText) {
          navigator.clipboard.readText().then((current) => {
            if (!expected || current === expected) {
              navigator.clipboard.writeText("").then(() => {
                showToast("Clipboard cleared for security")
              }).catch(() => {})
            }
          }).catch(() => {
            navigator.clipboard.writeText("").then(() => {
              showToast("Clipboard cleared for security")
            }).catch(() => {})
          })
        } else if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText("").then(() => {
            showToast("Clipboard cleared for security")
          }).catch(() => {})
        }
      } catch {}
      sendResponse({ success: true })
      return true
    }
  })

  const domParser = new DOMParser()
  function safeSetTemplate(element, htmlString) {
    element.replaceChildren()
    const doc = domParser.parseFromString(htmlString, "text/html")
    while (doc.body.firstChild) {
      element.appendChild(doc.body.firstChild)
    }
  }

  function escapeHtml(str) {
    if (!str) return ""
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function copyToClipboard(text) {
    if (!text) return
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => copyToClipboardFallback(text))
      } else {
        copyToClipboardFallback(text)
      }
    } catch {
      copyToClipboardFallback(text)
    }
    ext.runtime.sendMessage({ action: "COPY_TO_CLIPBOARD", payload: { text } }).catch(() => {})
  }

  function copyToClipboardFallback(text) {
    try {
      const el = document.createElement("textarea")
      el.value = text
      el.style.position = "fixed"
      el.style.opacity = "0"
      ;(document.body || document.documentElement).appendChild(el)
      el.focus()
      el.select()
      document.execCommand("copy")
      el.remove()
    } catch {}
  }

  // ----------------------------------------------------
  // Screen QR Code Area Capture Overlay
  // ----------------------------------------------------
  let activeQrOverlay = null
  function startScreenQrCapture() {
    if (activeQrOverlay) {
      try {
        activeQrOverlay.remove()
      } catch {}
      activeQrOverlay = null
    }

    const overlay = document.createElement("div")
    overlay.className = "iris-qr-capture-overlay"

    const banner = document.createElement("div")
    banner.className = "iris-qr-capture-banner"
    safeSetTemplate(
      banner,
      `<span style="display:inline-flex;align-items:center;gap:8px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="5" height="5" x="3" y="3" rx="1"/>
          <rect width="5" height="5" x="16" y="3" rx="1"/>
          <rect width="5" height="5" x="3" y="16" rx="1"/>
          <path d="M21 16v3a2 2 0 0 1-2 2h-3M21 12h-4M12 21v-4M12 12v3M12 7h4M7 12H3"/>
        </svg>
        <span>Click and drag to select the QR code on your screen</span>
      </span>
      <span class="iris-qr-key-badge">ESC to cancel</span>`
    )
    overlay.appendChild(banner)

    const selectionBox = document.createElement("div")
    selectionBox.className = "iris-qr-selection-box"
    selectionBox.style.display = "none"

    const sizeBadge = document.createElement("div")
    sizeBadge.className = "iris-qr-size-badge"
    sizeBadge.style.display = "none"
    selectionBox.appendChild(sizeBadge)

    overlay.appendChild(selectionBox)

    let startX = 0
    let startY = 0
    let isDragging = false
    let currentPointerId = null

    function onPointerDown(e) {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      isDragging = true
      currentPointerId = e.pointerId !== undefined ? e.pointerId : null
      startX = e.clientX
      startY = e.clientY

      if (currentPointerId !== null && typeof overlay.setPointerCapture === "function") {
        try {
          overlay.setPointerCapture(currentPointerId)
        } catch {}
      }

      overlay.style.background = "transparent"
      selectionBox.style.left = `${startX}px`
      selectionBox.style.top = `${startY}px`
      selectionBox.style.width = "0px"
      selectionBox.style.height = "0px"
      selectionBox.style.display = "block"
      sizeBadge.textContent = "0 × 0"
      sizeBadge.style.display = "block"
    }

    function onPointerMove(e) {
      if (!isDragging) return
      e.preventDefault()
      e.stopPropagation()

      const curX = Math.max(0, Math.min(window.innerWidth, e.clientX))
      const curY = Math.max(0, Math.min(window.innerHeight, e.clientY))
      const left = Math.min(startX, curX)
      const top = Math.min(startY, curY)
      const width = Math.abs(curX - startX)
      const height = Math.abs(curY - startY)

      selectionBox.style.left = `${left}px`
      selectionBox.style.top = `${top}px`
      selectionBox.style.width = `${width}px`
      selectionBox.style.height = `${height}px`
      sizeBadge.textContent = `${width} × ${height}`
    }

    function onPointerUp(e) {
      if (!isDragging) return
      isDragging = false
      e.preventDefault()
      e.stopPropagation()

      if (currentPointerId !== null && typeof overlay.releasePointerCapture === "function") {
        try {
          overlay.releasePointerCapture(currentPointerId)
        } catch {}
      }

      const curX = Math.max(0, Math.min(window.innerWidth, e.clientX))
      const curY = Math.max(0, Math.min(window.innerHeight, e.clientY))
      const x = Math.min(startX, curX)
      const y = Math.min(startY, curY)
      const width = Math.abs(curX - startX)
      const height = Math.abs(curY - startY)

      cleanUp()

      if (width < 20 || height < 20) {
        showToast("Selection was too small. Scan cancelled.")
        return
      }

      showToast("Analyzing QR code from selected area...")

      // Double requestAnimationFrame ensures overlay removal is repainted before taking screenshot
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
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
                  innerWidth: window.innerWidth,
                  innerHeight: window.innerHeight,
                },
              },
            },
            (res) => {
              if (res?.success && res.result?.secret) {
                copyToClipboard(res.result.secret)
                showToast("QR code decoded! 2FA Secret imported. Open Akaromi to save.")
              } else {
                showToast(res?.error || "Could not decode QR code. Please try selecting the QR code again.")
              }
            }
          )
        })
      })
    }

    function onPointerCancel() {
      if (isDragging) {
        isDragging = false
        cleanUp()
      }
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        cleanUp()
        showToast("QR code scan cancelled")
      }
    }

    function cleanUp() {
      if (currentPointerId !== null && typeof overlay.releasePointerCapture === "function") {
        try {
          overlay.releasePointerCapture(currentPointerId)
        } catch {}
      }
      try {
        overlay.remove()
      } catch {}
      window.removeEventListener("pointermove", onPointerMove, true)
      window.removeEventListener("pointerup", onPointerUp, true)
      window.removeEventListener("pointercancel", onPointerCancel, true)
      window.removeEventListener("mousemove", onPointerMove, true)
      window.removeEventListener("mouseup", onPointerUp, true)
      document.removeEventListener("keydown", onKeyDown, true)
      activeQrOverlay = null
    }

    overlay.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("pointermove", onPointerMove, true)
    window.addEventListener("pointerup", onPointerUp, true)
    window.addEventListener("pointercancel", onPointerCancel, true)

    // Fallback mouse listeners in case pointer events aren't fully routed
    overlay.addEventListener("mousedown", onPointerDown, true)
    window.addEventListener("mousemove", onPointerMove, true)
    window.addEventListener("mouseup", onPointerUp, true)

    document.addEventListener("keydown", onKeyDown, true)

    const mountRoot = document.documentElement || document.body
    mountRoot.appendChild(overlay)
    activeQrOverlay = overlay
  }

  // ----------------------------------------------------
  // Expiring Floating TOTP Countdown Widget & Auto-Copier
  // ----------------------------------------------------
  let activeTotpWidget = null
  let totpCountdownInterval = null

  async function showFloatingTotpWidget(secret, label = "2FA Code", initialCode = "") {
    if (totpCountdownInterval) {
      clearInterval(totpCountdownInterval)
      totpCountdownInterval = null
    }
    if (activeTotpWidget) {
      try {
        activeTotpWidget.remove()
      } catch {}
      activeTotpWidget = null
    }
    if (!secret) return

    const cleanSecret = String(secret).trim()

    // Normalized URL (domain + path, ignoring query string & hash fragments)
    function getNormalizedUrl() {
      try {
        const u = new URL(window.location.href)
        const path = u.pathname.replace(/\/+$/, "") || "/"
        return `${u.origin.toLowerCase()}${path}`
      } catch {
        const path = (window.location.pathname || "/").replace(/\/+$/, "") || "/"
        return `${(window.location.origin || "").toLowerCase()}${path}`
      }
    }

    const initialNormalizedUrl = getNormalizedUrl()

    // Helper to generate TOTP code
    function getCode() {
      if (typeof IrisTotp !== "undefined" && typeof IrisTotp.generateTotpSync === "function") {
        try {
          const c = IrisTotp.generateTotpSync(cleanSecret)
          if (c) return c
        } catch {}
      }
      return new Promise((resolve) => {
        ext.runtime.sendMessage(
          { action: "GENERATE_TOTP", payload: { secret: cleanSecret } },
          (res) => resolve(res?.code || "")
        )
      })
    }

    // Helper to get remaining seconds in current 30s window
    function getRemainingSeconds() {
      if (typeof IrisTotp !== "undefined" && typeof IrisTotp.getRemainingSeconds === "function") {
        return IrisTotp.getRemainingSeconds(30)
      }
      const epoch = Math.floor(Date.now() / 1000)
      return 30 - (epoch % 30)
    }

    function formatCode(c) {
      if (!c) return "••••••"
      const str = String(c).trim()
      if (str.length === 6) {
        return `${str.slice(0, 3)} ${str.slice(3)}`
      }
      return str
    }

    // Copy to clipboard + show corner toast
    function copyTotpCode(codeToCopy, isAutoRefresh = false) {
      if (!codeToCopy) return
      copyToClipboard(codeToCopy)

      showToast(isAutoRefresh ? `New 2FA Code ${formatCode(codeToCopy)} copied to clipboard` : `2FA Code ${formatCode(codeToCopy)} copied to clipboard`)
    }

    let currentCode = initialCode || (await getCode())
    if (currentCode) {
      copyTotpCode(currentCode, false)
    }

    const widget = document.createElement("div")
    widget.className = "iris-totp-floating-widget"
    widget.setAttribute("role", "alert")
    widget.setAttribute("aria-live", "polite")

    const iconUrl = ext.runtime.getURL("icons/icon-48.png")
    const initialRem = getRemainingSeconds()

    safeSetTemplate(
      widget,
      `<div class="iris-totp-widget-header">
        <div class="iris-totp-widget-title">
          <img src="${iconUrl}" class="iris-totp-widget-logo" alt="Akaromi" />
          <span class="iris-totp-widget-account-name">${escapeHtml(label)}</span>
        </div>
        <button type="button" class="iris-totp-widget-close" aria-label="Dismiss" title="Dismiss">✕</button>
      </div>

      <div class="iris-totp-widget-body" id="totp-body-card">
        <div class="iris-totp-widget-code-wrap">
          <span class="iris-totp-widget-code" id="totp-code-display">${formatCode(currentCode)}</span>
        </div>
        <div class="iris-totp-widget-actions">
          <button type="button" class="iris-totp-widget-copy-btn" id="totp-copy-btn" title="Copy code">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <span id="totp-copy-btn-text">Copy</span>
          </button>
          <span class="iris-totp-widget-timer-badge" id="totp-seconds-display">${initialRem}s</span>
        </div>
      </div>

      <div class="iris-totp-progress-track">
        <div class="iris-totp-progress-bar" id="totp-progress-bar" style="width: ${(initialRem / 30) * 100}%;"></div>
      </div>

      <div class="iris-totp-widget-footer">
        <span class="iris-totp-status-hint" id="totp-status-hint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span id="totp-hint-text">Code in clipboard</span>
        </span>
        <button type="button" class="iris-totp-quick-fill-btn" id="totp-quick-fill-btn" style="display:none;">Autofill 2FA</button>
      </div>`
    )

    const mountRoot = document.documentElement || document.body
    mountRoot.appendChild(widget)
    activeTotpWidget = widget
    requestAnimationFrame(() => widget.classList.add("visible"))

    // Element references
    const codeDisplay = widget.querySelector("#totp-code-display")
    const secDisplay = widget.querySelector("#totp-seconds-display")
    const progressBar = widget.querySelector("#totp-progress-bar")
    const copyBtn = widget.querySelector("#totp-copy-btn")
    const copyBtnText = widget.querySelector("#totp-copy-btn-text")
    const hintText = widget.querySelector("#totp-hint-text")
    const bodyCard = widget.querySelector("#totp-body-card")
    const quickFillBtn = widget.querySelector("#totp-quick-fill-btn")
    const closeBtn = widget.querySelector(".iris-totp-widget-close")

    // Check if an OTP/2FA input is visible on page for quick fill
    function checkOtpInput() {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled])'))
      const otpInput = inputs.find((el) => {
        const auto = (el.getAttribute("autocomplete") || "").toLowerCase()
        if (auto === "one-time-code") return true
        const id = (el.name + " " + el.id + " " + el.placeholder).toLowerCase()
        return /(otp|2fa|totp|auth[-_]?code|verification[-_]?code|security[-_]?code)/i.test(id)
      })
      if (otpInput && quickFillBtn) {
        quickFillBtn.style.display = "inline-flex"
        quickFillBtn.onclick = (e) => {
          e.preventDefault()
          e.stopPropagation()
          if (currentCode) {
            globalThis.AkaromiFill?.setNativeValue(otpInput, currentCode)
            globalThis.AkaromiFill?.dispatchInputEvents(otpInput)
            if (hintText) hintText.textContent = "2FA Code filled into field"
            setTimeout(() => dismissWidget(), 1500)
          }
        }
      }
    }
    checkOtpInput()

    function dismissWidget() {
      if (totpCountdownInterval) {
        clearInterval(totpCountdownInterval)
        totpCountdownInterval = null
      }
      document.removeEventListener("submit", onFormSubmit, true)
      if (activeTotpWidget) {
        activeTotpWidget.classList.remove("visible")
        setTimeout(() => {
          try {
            activeTotpWidget?.remove()
          } catch {}
          activeTotpWidget = null
        }, 250)
      }
    }

    closeBtn?.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      dismissWidget()
    })

    copyBtn?.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (currentCode) {
        copyTotpCode(currentCode, false)
        if (copyBtnText) copyBtnText.textContent = "Copied!"
        if (hintText) hintText.textContent = "Code copied to clipboard"
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = "Copy"
        }, 1500)
      }
    })

    // Track user login completion
    let isUserLoggedIn = false
    function onFormSubmit() {
      isUserLoggedIn = true
      if (hintText) hintText.textContent = "Login submitted"
      setTimeout(() => dismissWidget(), 1200)
    }
    document.addEventListener("submit", onFormSubmit, true)

    // Countdown and Auto-Refresh on Expiry
    let lastStep = Math.floor(Date.now() / 1000 / 30)
    let cycleCount = 0
    const MAX_CYCLES = 6 // Up to 3 minutes of auto-refreshes

    totpCountdownInterval = setInterval(async () => {
      if (isUserLoggedIn) return

      // Dismiss widget if URL domain or path changed (ignoring query & hash)
      if (getNormalizedUrl() !== initialNormalizedUrl) {
        dismissWidget()
        return
      }

      const currentStep = Math.floor(Date.now() / 1000 / 30)
      const rem = getRemainingSeconds()

      // Update timer UI
      if (secDisplay) {
        secDisplay.textContent = `${rem}s`
        if (rem <= 5) {
          secDisplay.className = "iris-totp-widget-timer-badge danger"
        } else if (rem <= 10) {
          secDisplay.className = "iris-totp-widget-timer-badge warning"
        } else {
          secDisplay.className = "iris-totp-widget-timer-badge"
        }
      }

      if (progressBar) {
        progressBar.style.width = `${(rem / 30) * 100}%`
        if (rem <= 5) {
          progressBar.style.backgroundColor = "#fb7185"
        } else if (rem <= 10) {
          progressBar.style.backgroundColor = "#facc15"
        } else {
          progressBar.style.backgroundColor = "#38bdf8"
        }
      }

      // Check OTP input again in case page dynamically showed 2FA step
      checkOtpInput()

      // EXPIRED? If the 30-second epoch stepped forward and user didn't login yet:
      if (currentStep !== lastStep) {
        lastStep = currentStep
        cycleCount++

        if (cycleCount > MAX_CYCLES) {
          if (hintText) hintText.textContent = "Auto-refresh paused. Click to renew."
          if (bodyCard) {
            bodyCard.style.cursor = "pointer"
            bodyCard.onclick = async () => {
              cycleCount = 0
              bodyCard.style.cursor = ""
              bodyCard.onclick = null
              const newCode = await getCode()
              if (newCode) {
                currentCode = newCode
                copyTotpCode(newCode, true)
                if (codeDisplay) codeDisplay.textContent = formatCode(newCode)
                if (hintText) hintText.textContent = "Renewed & copied to clipboard"
              }
            }
          }
          return
        }

        // GENERATE & COPY NEXT CODE!
        const nextCode = await getCode()
        if (nextCode) {
          currentCode = nextCode
          // Copy next code to clipboard immediately
          copyTotpCode(nextCode, true)

          // Update display & flash animation
          if (codeDisplay) codeDisplay.textContent = formatCode(nextCode)
          if (hintText) hintText.textContent = "Code expired — new code copied!"

          if (bodyCard) {
            bodyCard.classList.remove("flashing")
            void bodyCard.offsetWidth // Force reflow
            bodyCard.classList.add("flashing")
          }
        }
      }
    }, 1000)
  }

  globalThis.AkaromiTotp = {
    showFloatingTotpWidget,
  }
})()

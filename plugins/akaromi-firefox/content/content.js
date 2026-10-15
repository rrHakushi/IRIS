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
    return Boolean(
      target.closest(
        "#akaromi-portal, #iris-pass-portal, .akaromi-portal-root, .iris-pass-portal-root, .iris-passkey-dialog-overlay, .iris-passkey-dialog, .akaromi-dropdown, .iris-pass-dropdown, .akaromi-field-icon, .iris-pass-field-icon, .iris-totp-floating-widget, .iris-qr-capture-overlay, .iris-pass-toast"
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

    if (message.action === "FILL_INPUTS") {
      const { username, password } = message.payload || {}
      globalThis.AkaromiFill?.fillCredential({ data: { username, password } })
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

    if (message.action === "SHOW_TOTP_TIMER") {
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
        if (navigator.clipboard?.writeText) {
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
    safeSetTemplate(
      banner,
      `<span>Click and drag to select the QR code on your screen</span>
      <span class="iris-qr-key-badge">ESC to cancel</span>`
    )
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
            bounds: { x, y, width, height, dpr: window.devicePixelRatio || 1 },
          },
        },
        (res) => {
          if (res?.success && res.result?.secret) {
            copyToClipboard(res.result.secret)
            showToast(`QR Code decoded! 2FA Secret copied to clipboard.`)
          } else {
            showToast(res?.error || "Could not decode QR code. Please try again.")
          }
        }
      )
    }

    function copyToClipboard(text) {
      try {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).catch(() => copyToClipboardFallback(text))
        } else {
          copyToClipboardFallback(text)
        }
      } catch {
        copyToClipboardFallback(text)
      }
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

  function showFloatingTotpWidget(secret, label = "2FA Code", initialCode = "") {
    if (totpCountdownInterval) clearInterval(totpCountdownInterval)
    if (activeTotpWidget) activeTotpWidget.remove()
    if (!secret) return

    const widget = document.createElement("div")
    widget.className = "iris-totp-floating-widget"

    function getRemaining() {
      const epoch = Math.floor(Date.now() / 1000)
      return 30 - (epoch % 30)
    }

    const iconUrl = ext.runtime.getURL("icons/icon-48.png")
    safeSetTemplate(
      widget,
      `<div class="iris-totp-widget-header">
        <div class="iris-totp-widget-title">
          <img src="${iconUrl}" class="iris-totp-widget-logo" alt="Akaromi" />
          <span>${label}</span>
        </div>
        <button type="button" class="iris-totp-widget-close" title="Dismiss">✕</button>
      </div>
      <div class="iris-totp-widget-body">
        <span class="iris-totp-widget-code" id="totp-code-display">${initialCode || "••••••"}</span>
        <span class="iris-totp-widget-timer-badge" id="totp-seconds-display">${getRemaining()}s</span>
      </div>
      <div class="iris-totp-widget-footer">
        <span id="totp-status-hint">Code in clipboard</span>
        <span>Auto-refreshes</span>
      </div>`
    )

    getOrCreatePortal().appendChild(widget)
    activeTotpWidget = widget

    widget.querySelector(".iris-totp-widget-close")?.addEventListener("click", () => {
      clearInterval(totpCountdownInterval)
      widget.remove()
    })

    if (!initialCode && typeof IrisTotp !== "undefined") {
      IrisTotp.generateTotp(secret).then((code) => {
        if (code) {
          const display = widget.querySelector("#totp-code-display")
          if (display) display.textContent = code
          navigator.clipboard.writeText(code).catch(() => {})
        }
      })
    } else if (initialCode) {
      navigator.clipboard.writeText(initialCode).catch(() => {})
    }

    totpCountdownInterval = setInterval(() => {
      const rem = getRemaining()
      const secDisplay = widget.querySelector("#totp-seconds-display")
      if (secDisplay) secDisplay.textContent = `${rem}s`
      if (rem <= 1) {
        setTimeout(() => {
          clearInterval(totpCountdownInterval)
          widget.remove()
        }, 800)
      }
    }, 1000)
  }
})()

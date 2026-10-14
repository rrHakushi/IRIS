/**
 * Akaromi for Firefox — Content Script Coordinator
 */
;(function () {
  "use strict"

  const ext = typeof browser !== "undefined" ? browser : chrome

  function getOrCreatePortal() {
    let portal = document.getElementById("akaromi-portal") || document.getElementById("iris-pass-portal")
    if (!portal) {
      portal = document.createElement("div")
      portal.id = "akaromi-portal"
      portal.setAttribute("data-akaromi-portal", "true")
      portal.className = "akaromi-portal-root iris-pass-portal-root"
      ;(document.body || document.documentElement).appendChild(portal)
    }
    return portal
  }

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
      mutationTimer = setTimeout(scanAndAttachBadges, 80)
    }
  })

  function init() {
    scanAndAttachBadges()
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true })
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }

  // ----------------------------------------------------
  // WebAuthn Passkey Bridge (Page <-> Content <-> Background)
  // ----------------------------------------------------
  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== "IRIS_PASSKEY_PAGE"
    ) {
      return
    }

    if (event.data.action === "PASSKEY_CREATE_REQUEST") {
      ext.runtime.sendMessage(
        { action: "PASSKEY_CREATE_CREDENTIAL", payload: event.data.options },
        (res) => {
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_CREATE_RESPONSE",
              requestId: event.data.requestId,
              result: res,
            },
            "*"
          )
        }
      )
    } else if (event.data.action === "PASSKEY_GET_REQUEST") {
      ext.runtime.sendMessage(
        { action: "PASSKEY_GET_CREDENTIALS", payload: event.data.options },
        (res) => {
          if (res?.credentials && res.credentials.length > 0) {
            // Sign assertion with first matching passkey
            const cred = res.credentials[0]
            ext.runtime.sendMessage(
              {
                action: "PASSKEY_SIGN_ASSERTION",
                payload: {
                  credentialId: cred.id || cred.credentialId,
                  challenge: event.data.options?.challenge,
                },
              },
              (signRes) => {
                window.postMessage(
                  {
                    source: "IRIS_PASSKEY_CONTENT",
                    action: "PASSKEY_GET_RESPONSE",
                    requestId: event.data.requestId,
                    result: signRes,
                  },
                  "*"
                )
              }
            )
          } else {
            window.postMessage(
              {
                source: "IRIS_PASSKEY_CONTENT",
                action: "PASSKEY_GET_RESPONSE",
                requestId: event.data.requestId,
                result: { success: false, error: "No matching passkey found" },
              },
              "*"
            )
          }
        }
      )
    }
  })

  // ----------------------------------------------------
  // Extension Message Handler
  // ----------------------------------------------------
  ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "FILL_INPUTS") {
      const { username, password } = message.payload || {}
      globalThis.AkaromiFill?.fillCredential({ data: { username, password } })
      showToast("Credentials autofilled by Akaromi")
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
            navigator.clipboard.writeText(res.result.secret).catch(() => {})
            showToast(`QR Code decoded! 2FA Secret copied to clipboard.`)
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

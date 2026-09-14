/**
 * IRIS Pass — Content Script
 * 1. WebAuthn Passkey Interceptor & In-Page Modal UI
 * 2. In-Field Autofill Badges & Dropdown (Bitwarden-style, active-only)
 */

;(function () {
  const ext = typeof browser !== "undefined" ? browser : chrome

  // ----------------------------------------------------
  // Ensure Passkey Interceptor Script is Injected
  // ----------------------------------------------------
  function ensurePasskeyInjected() {
    if (window.__IRIS_PASSKEY_INJECTED__) return
    try {
      const s = document.createElement("script")
      s.src = ext.runtime.getURL("content/passkey-injected.js")
      const nonceEl = document.querySelector("script[nonce]")
      if (nonceEl?.nonce) s.nonce = nonceEl.nonce
      s.onload = () => s.remove()
      ;(document.head || document.documentElement).appendChild(s)
    } catch (e) {}
  }

  ensurePasskeyInjected()

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
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2">
        <path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3"></path>
        <rect x="9" y="10" width="6" height="5" rx="1"></rect>
      </svg>
      <span>${message}</span>
    `
    document.body.appendChild(toast)

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
        const matches = matchesRes?.matches || []

        const overlay = document.createElement("div")
        overlay.className = "iris-passkey-dialog-overlay"

        let accountSelectorHtml = ""
        if (matches.length > 0) {
          accountSelectorHtml = `
            <div class="iris-passkey-row-col">
              <span class="label">Save to Account / Vault Item</span>
              <select id="iris-pk-select-account" class="iris-passkey-select">
                ${matches
                  .map((m) => {
                    const isCurrent =
                      m.data?.username &&
                      m.data.username.toLowerCase() ===
                        (userName || "").toLowerCase()
                    const hasPasskey = Boolean(m.data?.passkey)
                    return `
                    <option value="${m.id}" ${isCurrent ? "selected" : ""}>
                      ${m.title} (${m.data?.username || "No username"})${hasPasskey ? " • Passkey Saved" : ""}
                    </option>
                  `
                  })
                  .join("")}
                <option value="new" ${matches.every((m) => m.data?.username?.toLowerCase() !== (userName || "").toLowerCase()) ? "selected" : ""}>
                  + Create new vault item "${userName || rpName}"
                </option>
              </select>
            </div>
          `
        } else {
          accountSelectorHtml = `
            <div class="iris-passkey-row">
              <span class="label">Account</span>
              <span class="value">${userName || "Passkey"}</span>
            </div>
          `
        }

        overlay.innerHTML = `
          <div class="iris-passkey-dialog">
            <div class="iris-passkey-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3"></path>
                <circle cx="12" cy="11" r="3"></circle>
                <path d="M12 14v4m-2 0h4"></path>
              </svg>
            </div>
            <h3 class="iris-passkey-title">Save Passkey to IRIS Pass</h3>
            <p class="iris-passkey-subtitle">A passkey allows you to sign in safely and quickly without entering a password.</p>
            <div class="iris-passkey-details">
              ${accountSelectorHtml}
              <div class="iris-passkey-row">
                <span class="label">Relying Party</span>
                <span class="value">${rpName || rpId}</span>
              </div>
            </div>
            <div class="iris-passkey-actions">
              <button type="button" class="iris-passkey-btn primary" id="btn-pk-save">Save Passkey</button>
              <button type="button" class="iris-passkey-btn secondary" id="btn-pk-fallback">Use Security Key / Windows Hello</button>
              <button type="button" class="iris-passkey-btn text" id="btn-pk-cancel">Cancel</button>
            </div>
          </div>
        `

        document.body.appendChild(overlay)
        activePasskeyModal = overlay

        const btnSave = overlay.querySelector("#btn-pk-save")
        const btnFallback = overlay.querySelector("#btn-pk-fallback")
        const btnCancel = overlay.querySelector("#btn-pk-cancel")
        const selectAccount = overlay.querySelector("#iris-pk-select-account")

        btnCancel.addEventListener("click", () => {
          removePasskeyModal()
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_CREATE_RESPONSE",
              requestId,
              canceled: true,
            },
            "*"
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
            "*"
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
                  "*"
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
                "*"
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
        const passkeys = res?.passkeys || []

        if (passkeys.length === 0) {
          // No passkeys saved in vault for this RP: fallback to native browser passkeys
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

        const overlay = document.createElement("div")
        overlay.className = "iris-passkey-dialog-overlay"

        let accountSelectHtml = ""
        if (passkeys.length > 1) {
          accountSelectHtml = `
            <div class="iris-passkey-row-col">
              <span class="label">Select Account</span>
              <select id="iris-pk-auth-account" class="iris-passkey-select">
                ${passkeys
                  .map(
                    (p) => `
                  <option value="${p.credentialId}">${p.userName} (${p.title})</option>
                `
                  )
                  .join("")}
              </select>
            </div>
          `
        } else {
          accountSelectHtml = `
            <div class="iris-passkey-row">
              <span class="label">Account</span>
              <span class="value">${passkeys[0].userName}</span>
            </div>
          `
        }

        overlay.innerHTML = `
          <div class="iris-passkey-dialog">
            <div class="iris-passkey-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3"></path>
                <circle cx="12" cy="11" r="3"></circle>
                <path d="M12 14v4m-2 0h4"></path>
              </svg>
            </div>
            <h3 class="iris-passkey-title">Sign in with Passkey</h3>
            <p class="iris-passkey-subtitle">Use your passkey saved in IRIS Pass to sign in.</p>
            <div class="iris-passkey-details">
              ${accountSelectHtml}
              <div class="iris-passkey-row">
                <span class="label">Relying Party</span>
                <span class="value">${rpId}</span>
              </div>
            </div>
            <div class="iris-passkey-actions">
              <button type="button" class="iris-passkey-btn primary" id="btn-pk-signin">Sign In with IRIS Pass</button>
              <button type="button" class="iris-passkey-btn secondary" id="btn-pk-fallback">Use Another Method</button>
              <button type="button" class="iris-passkey-btn text" id="btn-pk-cancel">Cancel</button>
            </div>
          </div>
        `

        document.body.appendChild(overlay)
        activePasskeyModal = overlay

        const btnSignin = overlay.querySelector("#btn-pk-signin")
        const btnFallback = overlay.querySelector("#btn-pk-fallback")
        const btnCancel = overlay.querySelector("#btn-pk-cancel")
        const authSelect = overlay.querySelector("#iris-pk-auth-account")

        btnCancel.addEventListener("click", () => {
          removePasskeyModal()
          window.postMessage(
            {
              source: "IRIS_PASSKEY_CONTENT",
              action: "PASSKEY_GET_RESPONSE",
              requestId,
              canceled: true,
            },
            "*"
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
            "*"
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
                    error: errMsg,
                  },
                  "*"
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
                "*"
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
  })

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
        const matches = response?.matches || []
        const rect = targetInput.getBoundingClientRect()

        const dropdown = document.createElement("div")
        dropdown.className = "iris-pass-dropdown"
        dropdown.style.position = "fixed"
        dropdown.style.top = `${rect.bottom + 4}px`
        dropdown.style.left = `${rect.left}px`
        dropdown.style.minWidth = `${Math.max(rect.width, 260)}px`

        const header = document.createElement("div")
        header.className = "iris-pass-dropdown-header"
        header.innerHTML = `
          <span class="iris-pass-dropdown-header-title">IRIS Pass</span>
          <span style="font-size: 10px; color: #a19da8;">${matches.length} matching</span>
        `
        dropdown.appendChild(header)

        const list = document.createElement("div")
        list.className = "iris-pass-dropdown-list"

        if (matches.length === 0) {
          const empty = document.createElement("div")
          empty.style.padding = "14px 12px"
          empty.style.fontSize = "11px"
          empty.style.color = "#a19da8"
          empty.style.textAlign = "center"
          empty.textContent = "No matching credentials in vault"
          list.appendChild(empty)
        } else {
          matches.forEach((m) => {
            const item = document.createElement("button")
            item.type = "button"
            item.className = "iris-pass-dropdown-item"
            const hasPasskey = Boolean(m.data?.passkey)
            const hasTotp = Boolean(m.data?.totpSecret)

            item.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <span class="iris-pass-dropdown-item-title">${m.title}</span>
                <div style="display: flex; gap: 4px;">
                  ${hasPasskey ? '<span style="font-size: 9px; padding: 1px 4px; border-radius: 4px; background: rgba(244,63,94,0.15); color: #f43f5e; border: 1px solid rgba(244,63,94,0.3);">Passkey</span>' : ""}
                  ${hasTotp ? '<span style="font-size: 9px; padding: 1px 4px; border-radius: 4px; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3);">2FA</span>' : ""}
                </div>
              </div>
              <span class="iris-pass-dropdown-item-user">${m.data?.username || "No username"}</span>
            `

            item.addEventListener("click", (e) => {
              e.preventDefault()
              e.stopPropagation()

              const isTargetPassword = targetInput.type === "password"
              if (isTargetPassword) {
                setNativeValue(targetInput, m.data?.password || "")
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
                if (pInputs.length > 0 && m.data?.password) {
                  setNativeValue(pInputs[0], m.data.password)
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
            })

            list.appendChild(item)
          })
        }

        dropdown.appendChild(list)
        document.body.appendChild(dropdown)
        activeDropdown = dropdown
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

    // Check visibility
    const rect = el.getBoundingClientRect()
    if (rect.width < 50 || rect.height < 15) return false

    const style = window.getComputedStyle(el)
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      style.opacity === "0"
    ) {
      return false
    }

    // Email inputs are credential candidates
    if (type === "email") return true

    // Check autocomplete attribute
    const auto = (el.getAttribute("autocomplete") || "").toLowerCase()
    if (
      auto.includes("username") ||
      auto.includes("email") ||
      auto.includes("webauthn") ||
      auto.includes("current-password") ||
      auto.includes("new-password")
    ) {
      return true
    }

    // Heuristics on name, id, placeholder, aria-label
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
      /(user|login|email|identifier|account|member|signin|phone)/i.test(
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

  function updateIconPosition(input, icon) {
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
    const left = rect.right - 26
    icon.style.top = `${top}px`
    icon.style.left = `${left}px`
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
      icon.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3"></path>
          <rect x="9" y="10" width="6" height="5" rx="1"></rect>
        </svg>
      `

      inputIconMap.set(input, icon)

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

      document.body.appendChild(icon)
    })
  }

  function updateAllVisibleIcons() {
    inputIconMap.forEach((icon, input) => {
      if (icon.classList.contains("visible")) {
        updateIconPosition(input, icon)
      }
    })
    if (activeDropdown && activeDropdownTarget) {
      const rect = activeDropdownTarget.getBoundingClientRect()
      activeDropdown.style.top = `${rect.bottom + 4}px`
      activeDropdown.style.left = `${rect.left}px`
    }
  }

  window.addEventListener("scroll", updateAllVisibleIcons, {
    passive: true,
    capture: true,
  })
  window.addEventListener("resize", updateAllVisibleIcons, { passive: true })

  // Scan on DOM load and mutations
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachBadges)
  } else {
    attachBadges()
  }

  const observer = new MutationObserver(() => {
    attachBadges()
  })

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  })
})()

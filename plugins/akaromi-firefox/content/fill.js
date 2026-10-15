/**
 * Akaromi for Firefox — Form Autofill & Input Event Dispatcher
 */
;(function (global) {
  "use strict"

  const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : global.AkaromiExt)

  function dispatchInputEvents(element) {
    if (!element) return
    try {
      element.dispatchEvent(new Event("focus", { bubbles: true }))
      element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }))
      element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }))
      element.dispatchEvent(new Event("blur", { bubbles: true }))
    } catch {}
  }

  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set
    const prototype = Object.getPrototypeOf(element)
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value)
    } else if (valueSetter) {
      valueSetter.call(element, value)
    } else {
      element.value = value
    }
  }

  function fillCredential(cipher, specificPassword = null, initialCode = "") {
    if (!cipher) return
    const data = cipher.data || {}
    const username = data.username || data.email || ""
    const password = specificPassword !== null ? specificPassword : (data.password || "")

    const activeEl = document.activeElement
    const form = (activeEl && activeEl.form) || (activeEl && activeEl.closest("form")) || document

    // Fill Username
    if (username) {
      let userInput = null
      if (activeEl && activeEl.tagName === "INPUT" && activeEl.type !== "password") {
        userInput = activeEl
      } else {
        const textInputs = Array.from(
          form.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')
        ).filter((el) => !global.AkaromiDetection?.isSearchInput(el))

        userInput =
          textInputs.find((el) => /user|login|email/i.test(el.name + " " + el.id + " " + el.placeholder)) ||
          textInputs[0]
      }

      if (userInput) {
        setNativeValue(userInput, username)
        dispatchInputEvents(userInput)
      }
    }

    // Fill Password
    if (password) {
      let passInput = null
      if (activeEl && activeEl.tagName === "INPUT" && activeEl.type === "password") {
        passInput = activeEl
      } else {
        passInput = form.querySelector('input[type="password"]')
      }

      if (passInput) {
        setNativeValue(passInput, password)
        dispatchInputEvents(passInput)
      }
    }

    // Ping background activity
    ext.runtime.sendMessage({ action: "PING_ACTIVITY" }).catch(() => {})

    // Trigger TOTP Auto-Copy & Live Countdown Widget if account has 2FA
    const rawSecret =
      data.totpSecret ||
      data.totp ||
      data.totpUri ||
      data.otpauth ||
      cipher.totpSecret ||
      cipher.totp ||
      cipher.login?.totp ||
      ""
    const totpSecret = typeof rawSecret === "string" ? rawSecret.trim() : ""

    if (totpSecret) {
      const accountLabel = cipher.title || username || "2FA"
      let codeToUse = initialCode
      if (!codeToUse && typeof IrisTotp !== "undefined" && typeof IrisTotp.generateTotpSync === "function") {
        codeToUse = IrisTotp.generateTotpSync(totpSecret)
      }

      let launched = false
      const invokeWidget = () => {
        if (launched) return
        const fn = global.AkaromiTotp?.showFloatingTotpWidget || globalThis.AkaromiTotp?.showFloatingTotpWidget
        if (typeof fn === "function") {
          launched = true
          fn(totpSecret, accountLabel, codeToUse)
        }
      }

      invokeWidget()
      if (!launched) {
        setTimeout(invokeWidget, 100)
      }
    }
  }

  global.AkaromiFill = {
    fillCredential,
    setNativeValue,
    dispatchInputEvents,
  }
})(typeof window !== "undefined" ? window : globalThis)

/**
 * Akaromi for Firefox — Bitwarden-Grade Credential Input Detection
 */
;(function (global) {
  "use strict"

  const SEARCH_REGEX = /(search|query|find|filter|lookup|keyword|term)/i
  const OTP_OR_PROMO_REGEX = /(otp|2fa|totp|captcha|promo|coupon|discount|gift|cvv|cvc|security[_-]?code)/i
  const LOGIN_USER_REGEX = /(user|login|email|identifier|account|member|signin|auth)/i

  /**
   * Checks if an input element is a search box (should NEVER have autofill button)
   */
  function isSearchInput(el) {
    if (!el || el.tagName !== "INPUT") return false
    const type = (el.type || "").toLowerCase()
    if (type === "search") return true

    const role = (el.getAttribute("role") || "").toLowerCase()
    if (role === "search" || role === "searchbox") return true

    const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase()
    if (autocomplete === "username" || autocomplete === "email") return false

    const identifier = [
      el.id,
      el.name,
      el.placeholder,
      el.getAttribute("aria-label"),
      el.className,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return SEARCH_REGEX.test(identifier)
  }

  /**
   * Determines if an element is a valid credential input (username, email, or password)
   * Follows strict Bitwarden heuristics to prevent unwanted badges on non-credential inputs.
   */
  function isCredentialInput(el) {
    if (!el || el.tagName !== "INPUT") return false

    // Ignore extension's own portal elements
    if (el.closest("#akaromi-portal, .akaromi-portal-root, .akaromi-field-icon")) {
      return false
    }

    const type = (el.type || "text").toLowerCase()

    // 1. Exclude unsupported input types
    const excludedTypes = [
      "hidden",
      "submit",
      "button",
      "reset",
      "checkbox",
      "radio",
      "file",
      "image",
      "color",
      "range",
      "date",
      "datetime-local",
      "time",
      "month",
      "week",
      "number",
    ]
    if (excludedTypes.includes(type)) return false

    // 2. Disabled or read-only inputs
    if (el.disabled || el.readOnly) return false

    // 3. Exclude search inputs
    if (isSearchInput(el)) return false

    // 4. Passwords are always credentials
    if (type === "password") return true

    // 5. Exclude OTP, CAPTCHA, promo/coupon, or credit card CVV codes
    const auto = (el.getAttribute("autocomplete") || "").toLowerCase()
    if (auto === "one-time-code") return false

    const identifier = [
      el.id,
      el.name,
      el.placeholder,
      el.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    if (OTP_OR_PROMO_REGEX.test(identifier)) return false

    // 6. Explicit autocomplete attributes
    if (
      auto === "username" ||
      auto === "email" ||
      auto === "webauthn" ||
      auto === "current-password" ||
      auto === "new-password"
    ) {
      return true
    }

    // 7. Email inputs
    if (type === "email") return true

    // 8. Form-association: if in a form containing a password, identify the preceding username field
    const form = el.closest("form")
    if (form) {
      const passwordInputs = Array.from(form.querySelectorAll('input[type="password"]:not([disabled])'))
      if (passwordInputs.length > 0) {
        // Find text/email inputs in this form
        const textInputs = Array.from(
          form.querySelectorAll('input:not([type="hidden"]):not([type="password"]):not([disabled]):not([readonly])')
        ).filter((inp) => !isSearchInput(inp))

        // Only the text input immediately preceding the first password input qualifies as the primary username input
        const firstPass = passwordInputs[0]
        const precedingInputs = textInputs.filter((inp) => {
          return inp.compareDocumentPosition(firstPass) & Node.DOCUMENT_POSITION_FOLLOWING
        })

        if (precedingInputs.length > 0) {
          const primaryUserInput = precedingInputs[precedingInputs.length - 1]
          if (el === primaryUserInput) return true
        }
      }
    }

    // 9. Identifier matching login/username/account keywords
    if (LOGIN_USER_REGEX.test(identifier)) {
      return true
    }

    return false
  }

  global.AkaromiDetection = {
    isCredentialInput,
    isSearchInput,
  }
})(typeof window !== "undefined" ? window : globalThis)

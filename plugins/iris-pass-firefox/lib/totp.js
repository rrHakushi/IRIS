/**
 * IRIS Pass — RFC 6238 TOTP Generator (WebCrypto HMAC-SHA1)
 */
;(function (root) {
  const IrisTotp = {}

  // Base32 Alphabet RFC 4648
  const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

  function base32Decode(str) {
    const clean = str.toUpperCase().replace(/[\s\-_=]/g, "")
    let bits = 0
    let value = 0
    const bytes = []

    for (let i = 0; i < clean.length; i++) {
      const idx = BASE32_CHARS.indexOf(clean.charAt(i))
      if (idx === -1) continue

      value = (value << 5) | idx
      bits += 5

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff)
        bits -= 8
      }
    }

    return new Uint8Array(bytes)
  }

  /**
   * Generates a 6-digit TOTP token from base32 secret
   */
  IrisTotp.generateTotp = async function (secret, timeStepSeconds = 30) {
    if (!secret) return ""

    try {
      const keyBytes = base32Decode(secret)
      if (keyBytes.length === 0) return ""

      const epoch = Math.floor(Date.now() / 1000)
      const counter = Math.floor(epoch / timeStepSeconds)

      const counterBuffer = new ArrayBuffer(8)
      const counterView = new DataView(counterBuffer)
      // In JS, numbers over 32-bit are handled via BigInt or split
      counterView.setUint32(0, Math.floor(counter / 0x100000000))
      counterView.setUint32(4, counter & 0xffffffff)

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
      )

      const signature = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        counterBuffer
      )
      const hashBytes = new Uint8Array(signature)

      const offset = hashBytes[hashBytes.length - 1] & 0xf
      const binary =
        ((hashBytes[offset] & 0x7f) << 24) |
        ((hashBytes[offset + 1] & 0xff) << 16) |
        ((hashBytes[offset + 2] & 0xff) << 8) |
        (hashBytes[offset + 3] & 0xff)

      const otp = binary % 1000000
      return otp.toString().padStart(6, "0")
    } catch (err) {
      console.error("[IrisTotp] Failed to generate TOTP:", err)
      return ""
    }
  }

  /**
   * Returns remaining seconds in the current 30s window
   */
  IrisTotp.getRemainingSeconds = function (timeStepSeconds = 30) {
    const epoch = Math.floor(Date.now() / 1000)
    return timeStepSeconds - (epoch % timeStepSeconds)
  }

  /**
   * Parses an otpauth:// URL or raw Base32 secret string into its parameters.
   * Format: otpauth://totp/Issuer:account?secret=XYZ&issuer=Issuer
   */
  IrisTotp.parseOtpAuthUri = function (uri) {
    if (!uri || typeof uri !== "string") return null
    try {
      const trimmed = uri.trim()
      if (!trimmed.toLowerCase().startsWith("otpauth://")) {
        // If user provided raw secret key instead of URI
        const cleanSecret = trimmed.replace(/[\s\-_=]/g, "").toUpperCase()
        if (/^[A-Z2-7]+=*$/.test(cleanSecret)) {
          return { secret: cleanSecret, digits: 6, period: 30 }
        }
        return null
      }

      const url = new URL(trimmed)
      const secret = url.searchParams.get("secret")
      if (!secret) return null

      const issuerParam = url.searchParams.get("issuer")
      const digitsParam = url.searchParams.get("digits")
      const periodParam = url.searchParams.get("period")

      let label = decodeURIComponent(url.pathname.replace(/^\/\/totp\//, "").replace(/^\/totp\//, ""))
      if (label.includes(":")) {
        const parts = label.split(":")
        label = (parts[parts.length - 1] || "").trim()
      }

      return {
        secret: secret.trim().toUpperCase(),
        label: label || undefined,
        issuer: issuerParam || undefined,
        digits: digitsParam ? parseInt(digitsParam, 10) : 6,
        period: periodParam ? parseInt(periodParam, 10) : 30,
      }
    } catch {
      return null
    }
  }

  root.IrisTotp = IrisTotp
})(typeof self !== "undefined" ? self : this)


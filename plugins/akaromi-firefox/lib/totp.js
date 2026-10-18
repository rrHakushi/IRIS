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
   * Extracts clean Base32 secret from raw string or otpauth:// URI
   */
  IrisTotp.extractSecret = function (secretOrUri) {
    if (!secretOrUri || typeof secretOrUri !== "string") return ""
    const trimmed = secretOrUri.trim()
    if (trimmed.toLowerCase().startsWith("otpauth://")) {
      const parsed = IrisTotp.parseOtpAuthUri(trimmed)
      return parsed?.secret || ""
    }
    return trimmed.replace(/^secret:\s*/i, "").replace(/[\s\-_=]/g, "").toUpperCase()
  }

  // Pure JS SHA-1 implementation (RFC 3174) for synchronous TOTP computation
  function sha1(bytes) {
    const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6]
    let H0 = 0x67452301
    let H1 = 0xefcdab89
    let H2 = 0x98badcfe
    let H3 = 0x10325476
    let H4 = 0xc3d2e1f0

    const len = bytes.length
    const bitLen = len * 8
    const padLen = len % 64 < 56 ? 56 - (len % 64) : 120 - (len % 64)
    const totalLen = len + padLen + 8
    const padded = new Uint8Array(totalLen)
    padded.set(bytes)
    padded[len] = 0x80

    const view = new DataView(padded.buffer)
    view.setUint32(totalLen - 4, bitLen, false)
    view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false)

    const W = new Uint32Array(80)
    for (let i = 0; i < totalLen; i += 64) {
      for (let t = 0; t < 16; t++) {
        W[t] = view.getUint32(i + t * 4, false)
      }
      for (let t = 16; t < 80; t++) {
        const x = W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16]
        W[t] = (x << 1) | (x >>> 31)
      }

      let a = H0
      let b = H1
      let c = H2
      let d = H3
      let e = H4

      for (let t = 0; t < 80; t++) {
        let f, k
        if (t < 20) {
          f = (b & c) | (~b & d)
          k = K[0]
        } else if (t < 40) {
          f = b ^ c ^ d
          k = K[1]
        } else if (t < 60) {
          f = (b & c) | (b & d) | (c & d)
          k = K[2]
        } else {
          f = b ^ c ^ d
          k = K[3]
        }
        const temp = (((a << 5) | (a >>> 27)) + f + e + k + W[t]) >>> 0
        e = d
        d = c
        c = (b << 30) | (b >>> 2)
        b = a
        a = temp
      }

      H0 = (H0 + a) >>> 0
      H1 = (H1 + b) >>> 0
      H2 = (H2 + c) >>> 0
      H3 = (H3 + d) >>> 0
      H4 = (H4 + e) >>> 0
    }

    const out = new Uint8Array(20)
    const outView = new DataView(out.buffer)
    outView.setUint32(0, H0, false)
    outView.setUint32(4, H1, false)
    outView.setUint32(8, H2, false)
    outView.setUint32(12, H3, false)
    outView.setUint32(16, H4, false)
    return out
  }

  function hmacSha1(key, message) {
    let k = key
    if (k.length > 64) {
      k = sha1(k)
    }
    const ipad = new Uint8Array(64)
    const opad = new Uint8Array(64)
    for (let i = 0; i < 64; i++) {
      const b = i < k.length ? k[i] : 0
      ipad[i] = b ^ 0x36
      opad[i] = b ^ 0x5c
    }

    const inner = new Uint8Array(64 + message.length)
    inner.set(ipad, 0)
    inner.set(message, 64)
    const innerHash = sha1(inner)

    const outer = new Uint8Array(64 + 20)
    outer.set(opad, 0)
    outer.set(innerHash, 64)
    return sha1(outer)
  }

  /**
   * Synchronously generates a 6-digit TOTP token from base32 secret or otpauth:// URI
   * Supports optional timeOffsetSeconds to compute future/next codes (e.g. +30s)
   */
  IrisTotp.generateTotpSync = function (secretOrUri, timeStepSeconds = 30, timeOffsetSeconds = 0) {
    if (!secretOrUri) return ""
    try {
      const cleanSecret = IrisTotp.extractSecret(secretOrUri)
      if (!cleanSecret) return ""

      const keyBytes = base32Decode(cleanSecret)
      if (keyBytes.length === 0) return ""

      const epoch = Math.floor(Date.now() / 1000) + timeOffsetSeconds
      const counter = Math.floor(epoch / timeStepSeconds)

      const counterBuffer = new Uint8Array(8)
      const counterView = new DataView(counterBuffer.buffer)
      counterView.setUint32(0, Math.floor(counter / 0x100000000), false)
      counterView.setUint32(4, counter & 0xffffffff, false)

      const hashBytes = hmacSha1(keyBytes, counterBuffer)
      const offset = hashBytes[hashBytes.length - 1] & 0xf
      const binary =
        ((hashBytes[offset] & 0x7f) << 24) |
        ((hashBytes[offset + 1] & 0xff) << 16) |
        ((hashBytes[offset + 2] & 0xff) << 8) |
        (hashBytes[offset + 3] & 0xff)

      const otp = binary % 1000000
      return otp.toString().padStart(6, "0")
    } catch (err) {
      console.error("[IrisTotp] Sync generate failed:", err)
      return ""
    }
  }

  /**
   * Generates a 6-digit TOTP token from base32 secret
   * Supports optional timeOffsetSeconds to compute future/next codes (e.g. +30s)
   */
  IrisTotp.generateTotp = async function (secret, timeStepSeconds = 30, timeOffsetSeconds = 0) {
    const syncCode = IrisTotp.generateTotpSync(secret, timeStepSeconds, timeOffsetSeconds)
    if (syncCode) return syncCode
    return ""
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
        const cleanSecret = trimmed.replace(/^secret:\s*/i, "").replace(/[\s\-_=]/g, "").toUpperCase()
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


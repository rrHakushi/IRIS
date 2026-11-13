"use client"

import { hmac } from "@noble/hashes/hmac.js"
import { sha1 } from "@noble/hashes/legacy.js"

// RFC 4648 Base32 alphabet
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

/**
 * Decodes a Base32 encoded string to raw byte array.
 * Strips whitespace, hyphens, and handles padding.
 */
export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s\-_=]/g, "")

  if (clean.length === 0) return new Uint8Array(0)

  let bits = 0
  let value = 0
  const output: number[] = []

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (!char) continue
    const val = BASE32_ALPHABET.indexOf(char)
    if (val === -1) continue

    value = (value << 5) | val
    bits += 5

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return new Uint8Array(output)
}

/**
 * Generates an RFC 6238 TOTP 6-digit code from a Base32 secret string.
 * Uses 30-second time step and HMAC-SHA1.
 */
export function generateTotpCode(
  base32Secret: string,
  timestampMs: number = Date.now(),
  digits: number = 6,
  periodSeconds: number = 30
): string {
  try {
    const key = base32Decode(base32Secret)
    if (key.length === 0) return "------"

    const counter = Math.floor(timestampMs / 1000 / periodSeconds)

    // 8-byte big-endian counter buffer
    const counterBuf = new Uint8Array(8)
    let temp = counter
    for (let i = 7; i >= 0; i--) {
      counterBuf[i] = temp & 0xff
      temp = Math.floor(temp / 256)
    }

    // HMAC-SHA1
    const hmacResult = hmac(sha1, key, counterBuf)

    // Dynamic Truncation (RFC 4226)
    const lastByte = hmacResult[hmacResult.length - 1] ?? 0
    const offset = lastByte & 0x0f
    const b0 = hmacResult[offset] ?? 0
    const b1 = hmacResult[offset + 1] ?? 0
    const b2 = hmacResult[offset + 2] ?? 0
    const b3 = hmacResult[offset + 3] ?? 0

    const binary =
      ((b0 & 0x7f) << 24) |
      ((b1 & 0xff) << 16) |
      ((b2 & 0xff) << 8) |
      (b3 & 0xff)

    const otp = binary % Math.pow(10, digits)
    return otp.toString().padStart(digits, "0")
  } catch {
    return "------"
  }
}

/**
 * Returns the number of seconds remaining in the current 30-second TOTP period (0 to 30).
 */
export function getTotpRemainingSeconds(
  timestampMs: number = Date.now(),
  periodSeconds: number = 30
): number {
  const currentSec = Math.floor(timestampMs / 1000)
  const remainder = currentSec % periodSeconds
  return periodSeconds - remainder
}

export interface OtpAuthParams {
  secret: string
  label?: string
  issuer?: string
  digits?: number
  period?: number
}

/**
 * Parses an otpauth:// URL into its constituent parameters.
 * Format: otpauth://totp/Issuer:account?secret=XYZ&issuer=Issuer
 */
export function parseOtpAuthUri(uri: string): OtpAuthParams | null {
  try {
    const trimmed = uri.trim()
    if (!trimmed.toLowerCase().startsWith("otpauth://")) {
      // If user pasted raw secret key instead of URI
      const cleanSecret = trimmed.replace(/[\s\-]/g, "").toUpperCase()
      if (/^[A-Z2-7]+=*$/.test(cleanSecret)) {
        return { secret: cleanSecret }
      }
      return null
    }

    const url = new URL(trimmed)
    const secret = url.searchParams.get("secret")
    if (!secret) return null

    const issuerParam = url.searchParams.get("issuer")
    const digitsParam = url.searchParams.get("digits")
    const periodParam = url.searchParams.get("period")

    let label = decodeURIComponent(url.pathname.replace(/^\/\/totp\//, ""))
    if (label.includes(":")) {
      const parts = label.split(":")
      label = (parts[parts.length - 1] ?? "").trim()
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

/**
 * Scans an ImageBitmap or HTMLImageElement for QR codes using native BarcodeDetector if supported.
 */
export async function scanQrCodeFromImage(
  imageSource: ImageBitmapSource
): Promise<string | null> {
  if (typeof window !== "undefined" && "BarcodeDetector" in window) {
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector
      const detector = new BarcodeDetectorClass({ formats: ["qr_code"] })
      const barcodes = await detector.detect(imageSource)
      if (barcodes.length > 0 && barcodes[0]?.rawValue) {
        return barcodes[0].rawValue
      }
    } catch (e) {
      console.warn("[TOTP] BarcodeDetector error:", e)
    }
  }
  return null
}

"use client"

import { hkdf } from "@noble/hashes/hkdf.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { scrypt } from "@noble/hashes/scrypt.js"
import { gcm } from "@noble/ciphers/aes.js"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import type { PinUnlockData } from "./pass-types"

const VAULT_SALT = new TextEncoder().encode("iris-pass-salt-v1")
const VAULT_INFO = new TextEncoder().encode("iris-pass-vault-v1")

/**
 * Derives the deterministic 256-bit AES-GCM VaultKey from the unlocked secret key.
 * This key is uniform across web, browser extensions, and mobile/desktop apps.
 */
export function deriveVaultKey(unlockedSecretKey: Uint8Array): Uint8Array {
  return hkdf(sha256, unlockedSecretKey, VAULT_SALT, VAULT_INFO, 32)
}

/**
 * Encrypts arbitrary plaintext string using AES-256-GCM and the derived VaultKey.
 * Output format: ivHex:authTagHex:cipherHex
 */
export function encryptVaultData(
  plaintext: string,
  vaultKey: Uint8Array
): string {
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV
  const plainBytes = new TextEncoder().encode(plaintext)

  const aes = gcm(vaultKey, iv)
  const ciphertextWithTag = aes.encrypt(plainBytes)

  const cipher = ciphertextWithTag.slice(0, -16)
  const authTag = ciphertextWithTag.slice(-16)

  return `${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(cipher)}`
}

/**
 * Decrypts an encrypted payload (ivHex:authTagHex:cipherHex) using AES-256-GCM.
 */
export function decryptVaultData(
  encryptedPayload: string,
  vaultKey: Uint8Array
): string {
  const parts = encryptedPayload.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format")
  }

  const [ivHex, authTagHex, cipherHex] = parts
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error("Missing encrypted payload segments")
  }

  const iv = hexToBytes(ivHex)
  const authTag = hexToBytes(authTagHex)
  const cipher = hexToBytes(cipherHex)

  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
  ciphertextWithTag.set(cipher, 0)
  ciphertextWithTag.set(authTag, cipher.length)

  const aes = gcm(vaultKey, iv)
  const decryptedBytes = aes.decrypt(ciphertextWithTag)

  return new TextDecoder().decode(decryptedBytes)
}

/**
 * Encrypts a structured JavaScript object to an encrypted string.
 */
export function encryptVaultObject<T>(obj: T, vaultKey: Uint8Array): string {
  return encryptVaultData(JSON.stringify(obj), vaultKey)
}

/**
 * Decrypts an encrypted payload and parses the resulting JSON.
 */
export function decryptVaultObject<T>(
  encryptedPayload: string,
  vaultKey: Uint8Array
): T {
  const json = decryptVaultData(encryptedPayload, vaultKey)
  return JSON.parse(json) as T
}

/**
 * Cryptographically zeroizes sensitive key material in memory.
 */
export function zeroize(bytes: Uint8Array): void {
  try {
    crypto.getRandomValues(bytes)
  } catch {
    bytes.fill(0)
  }
}

/**
 * Derives a key via scrypt and encrypts the 256-bit vault key for fast PIN unlock.
 */
export function setupPinUnlock(
  pin: string,
  vaultKey: Uint8Array
): PinUnlockData {
  if (!pin || pin.length < 4) {
    throw new Error("PIN must be at least 4 digits")
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const pinKey = scrypt(pin.normalize("NFKC"), salt, {
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
  })

  const aes = gcm(pinKey, iv)
  const ciphertextWithTag = aes.encrypt(vaultKey)
  zeroize(pinKey)

  const cipher = ciphertextWithTag.slice(0, -16)
  const authTag = ciphertextWithTag.slice(-16)

  return {
    saltHex: bytesToHex(salt),
    ivHex: bytesToHex(iv),
    authTagHex: bytesToHex(authTag),
    cipherHex: bytesToHex(cipher),
  }
}

/**
 * Unlocks the vault key using a PIN and saved PIN unlock data.
 */
export function unlockWithPin(
  pin: string,
  pinData: PinUnlockData
): Uint8Array {
  if (
    !pinData?.saltHex ||
    !pinData?.ivHex ||
    !pinData?.authTagHex ||
    !pinData?.cipherHex
  ) {
    throw new Error("Invalid or missing PIN unlock data")
  }

  const salt = hexToBytes(pinData.saltHex)
  const iv = hexToBytes(pinData.ivHex)
  const authTag = hexToBytes(pinData.authTagHex)
  const cipher = hexToBytes(pinData.cipherHex)

  const pinKey = scrypt(pin.normalize("NFKC"), salt, {
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
  })

  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
  ciphertextWithTag.set(cipher, 0)
  ciphertextWithTag.set(authTag, cipher.length)

  const aes = gcm(pinKey, iv)
  try {
    const decrypted = aes.decrypt(ciphertextWithTag)
    zeroize(pinKey)
    return decrypted
  } catch {
    zeroize(pinKey)
    throw new Error("Incorrect PIN")
  }
}


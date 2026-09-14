"use client"

import { hkdf } from "@noble/hashes/hkdf.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { gcm } from "@noble/ciphers/aes.js"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"

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

"use client"

import { deriveVaultKey, encryptVaultData, decryptVaultData } from "./pass-crypto"

/**
 * Safely decrypts a ciphertext string using the derived vaultKey.
 * If the string is not formatted as ivHex:authTagHex:cipherHex, or decryption fails,
 * returns the original string gracefully.
 */
export function safeDecryptText(
  ciphertext: string | null | undefined,
  vaultKey: Uint8Array | null | undefined
): string {
  if (!ciphertext) return ""
  if (!vaultKey) return ciphertext
  const parts = ciphertext.split(":")
  if (parts.length === 3 && parts[0]?.length === 24 && parts[1]?.length === 32) {
    try {
      return decryptVaultData(ciphertext, vaultKey)
    } catch {
      return ciphertext
    }
  }
  return ciphertext
}

/**
 * Encrypts a text string using the derived vaultKey if available.
 * If no vaultKey is present, returns the trimmed plaintext.
 */
export function safeEncryptText(
  plaintext: string | null | undefined,
  vaultKey: Uint8Array | null | undefined
): string {
  if (!plaintext) return ""
  const trimmed = plaintext.trim()
  if (!trimmed) return ""
  if (!vaultKey) return trimmed
  return encryptVaultData(trimmed, vaultKey)
}

export { deriveVaultKey, encryptVaultData, decryptVaultData }

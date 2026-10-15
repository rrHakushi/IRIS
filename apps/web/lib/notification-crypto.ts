"use client"

import { gcm } from "@noble/ciphers/aes.js"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"

export interface ActionInputDefinition {
  id: string
  label: string
  type?: "text" | "number" | "password" | "textarea"
  placeholder?: string
  required?: boolean
  defaultValue?: string | number
}

export interface ActionSelectOption {
  value: string
  label: string
  description?: string
  icon?: string
}

export interface ActionSelectDefinition {
  id: string
  label: string
  placeholder?: string
  isMultiSelect?: boolean
  options: ActionSelectOption[]
  required?: boolean
}

export interface ActionConfirmDefinition {
  confirmLabel?: string
  confirmVariant?: "default" | "destructive" | "outline" | "secondary"
  rejectLabel?: string
  rejectVariant?: "default" | "destructive" | "outline" | "secondary"
}

export interface NotificationContent {
  title: string
  body: string
  icon?: string
  link?: string
  actionConfirm?: ActionConfirmDefinition
  actionInputs?: ActionInputDefinition[]
  actionSelect?: ActionSelectDefinition
  metadata?: Record<string, unknown>
}

// Backwards-compatible alias
export type PqeNotificationContent = NotificationContent

function pemToBinary(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 ]+-----/g, "")
    .replace(/-----END [A-Z0-9 ]+-----/g, "")
    .replace(/\s+/g, "")
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

let cachedRsaPrivateKey: { pem: string; key: CryptoKey } | null = null

export async function getRsaPrivateKey(
  secretKey: Uint8Array | string
): Promise<CryptoKey> {
  const pem =
    typeof secretKey === "string"
      ? secretKey
      : new TextDecoder().decode(secretKey)
  if (cachedRsaPrivateKey && cachedRsaPrivateKey.pem === pem) {
    return cachedRsaPrivateKey.key
  }
  const binary = pemToBinary(pem)
  const cryptoKey = await window.crypto.subtle.importKey(
    "pkcs8",
    binary,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"]
  )
  cachedRsaPrivateKey = { pem, key: cryptoKey }
  return cryptoKey
}

/**
 * Decrypts a standard RSA-OAEP + AES-256-GCM notification payload on the client
 * using the user's decrypted RSA private key.
 */
export async function decryptNotification(
  encryptedKeyBase64: string,
  encryptedData: string,
  secretKey: Uint8Array | string
): Promise<NotificationContent> {
  const parts = encryptedData.split(":")
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted notification format. Expected iv:authTag:cipher"
    )
  }

  const [ivHex, authTagHex, cipherHex] = parts
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error("Missing encrypted notification segments")
  }

  const iv = hexToBytes(ivHex)
  const authTag = hexToBytes(authTagHex)
  const cipher = hexToBytes(cipherHex)

  // 1. Decrypt 32-byte AES key using RSA-OAEP private key
  const rsaKey = await getRsaPrivateKey(secretKey)
  const encryptedKeyBytes = Uint8Array.from(atob(encryptedKeyBase64), (c) =>
    c.charCodeAt(0)
  )

  const aesKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaKey,
    encryptedKeyBytes
  )
  const aesKey = new Uint8Array(aesKeyBuffer)

  // 2. Symmetric AES-256-GCM payload decryption
  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
  ciphertextWithTag.set(cipher, 0)
  ciphertextWithTag.set(authTag, cipher.length)

  const aes = gcm(aesKey, iv)
  const decryptedBytes = aes.decrypt(ciphertextWithTag)

  const json = new TextDecoder().decode(decryptedBytes)
  return JSON.parse(json) as NotificationContent
}

/** Backwards-compatible alias for decryptPqeNotification */
export const decryptPqeNotification = decryptNotification

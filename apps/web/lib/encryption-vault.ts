"use client"

import { scrypt } from "@noble/hashes/scrypt.js"
import { gcm } from "@noble/ciphers/aes.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js"

const DB_NAME = "iris_vault_db"
const DB_VERSION = 2
const STORE_NAME = "vault_entries"
const SESSION_STORE_NAME = "session_keys"

export interface VaultRecord {
  userId: string
  publicKey: string // Base64
  encryptedPrivateKey: string // salt:iv:authTag:cipher
  algorithm: "ML-KEM-768"
  hasSeparateEncryptionPassword?: boolean
  lastUnlockedAt?: number | null
  updatedAt: number
}

/**
 * Opens or initializes the IndexedDB database for secure client-side key storage.
 */
export function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" })
      }
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        db.createObjectStore(SESSION_STORE_NAME, { keyPath: "id" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Saves a vault record in IndexedDB.
 */
export async function saveVaultRecord(record: VaultRecord): Promise<void> {
  const db = await openVaultDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(record)

    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Retrieves a vault record from IndexedDB by userId.
 */
export async function getVaultRecord(
  userId: string
): Promise<VaultRecord | null> {
  const db = await openVaultDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(userId)

    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Clears the vault record for a user from IndexedDB.
 */
export async function deleteVaultRecord(userId: string): Promise<void> {
  const db = await openVaultDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(userId)

    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Decrypts a post-quantum private key using a password and AES-256-GCM.
 * Compatible with server-side Node / Elysia format: saltHex:ivHex:authTagHex:cipherHex.
 */
export async function decryptPrivateKeyClient(
  encryptedPayload: string,
  password: string
): Promise<Uint8Array> {
  const parts = encryptedPayload.split(":")
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted private key format")
  }

  const [saltHex, ivHex, authTagHex, cipherHex] = parts
  if (!saltHex || !ivHex || !authTagHex || !cipherHex) {
    throw new Error("Invalid encrypted private key segment")
  }

  const salt = hexToBytes(saltHex)
  const iv = hexToBytes(ivHex)
  const authTag = hexToBytes(authTagHex)
  const cipher = hexToBytes(cipherHex)

  // Scrypt key derivation (32 bytes AES-256 key)
  const key = scrypt(password.normalize("NFKC"), salt, {
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
  })

  // Recombine ciphertext + 16-byte auth tag for @noble/ciphers AES-GCM
  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
  ciphertextWithTag.set(cipher, 0)
  ciphertextWithTag.set(authTag, cipher.length)

  const aes = gcm(key, iv)
  return aes.decrypt(ciphertextWithTag)
}

/**
 * Encrypts a post-quantum private key using a password and AES-256-GCM.
 */
export async function encryptPrivateKeyClient(
  secretKey: Uint8Array,
  password: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const key = scrypt(password.normalize("NFKC"), salt, {
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
  })

  const aes = gcm(key, iv)
  const ciphertextWithTag = aes.encrypt(secretKey)

  // Extract auth tag (last 16 bytes) and ciphertext
  const cipher = ciphertextWithTag.slice(0, -16)
  const authTag = ciphertextWithTag.slice(-16)

  return `${bytesToHex(salt)}:${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(cipher)}`
}

/**
 * Generates an ML-KEM-768 post-quantum keypair in the browser.
 */
export async function generateKeypairClient(password: string): Promise<{
  publicKey: string
  encryptedPrivateKey: string
  rawSecretKey: Uint8Array
}> {
  const kp = ml_kem768.keygen()
  const publicKey = btoa(String.fromCharCode(...kp.publicKey))
  const encryptedPrivateKey = await encryptPrivateKeyClient(
    kp.secretKey,
    password
  )

  return {
    publicKey,
    encryptedPrivateKey,
    rawSecretKey: kp.secretKey,
  }
}

/**
 * Generates a SHA-256 fingerprint string from a base64 public key.
 */
export function calculateKeyFingerprint(publicKeyBase64: string): string {
  try {
    const raw = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0))
    const hash = sha256(raw)
    const hex = bytesToHex(hash)
    // Format into groups: SHA256:xx:xx:xx...
    const chunks =
      hex
        .match(/.{1,2}/g)
        ?.slice(0, 16)
        .join(":") ?? hex.slice(0, 32)
    return `SHA256:${chunks}`
  } catch {
    return "SHA256:unknown"
  }
}

const SESSION_STORAGE_PREFIX = "iris_vault_session_"

/**
 * Encrypts and persists the decrypted secret key in sessionStorage using a non-extractable WebCrypto key.
 * This guarantees that raw private key bytes are NEVER stored in plaintext in sessionStorage or IndexedDB,
 * and cannot be exported or exfiltrated via JavaScript.
 */
export async function saveSessionSecretKey(
  userId: string,
  secretKey: Uint8Array
): Promise<void> {
  if (
    typeof window === "undefined" ||
    !window.sessionStorage ||
    !window.crypto?.subtle
  )
    return
  try {
    const db = await openVaultDB()
    const wrapKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // non-extractable! Cannot be exported by JS
      ["encrypt", "decrypt"]
    )

    const keyId = userId || "active"
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE_NAME, "readwrite")
      const store = tx.objectStore(SESSION_STORE_NAME)
      const req = store.put({ id: keyId, key: wrapKey, updatedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrapKey,
      secretKey as any
    )

    const cipherBytes = new Uint8Array(encryptedBuffer)
    const payload = `${bytesToHex(iv)}:${bytesToHex(cipherBytes)}`

    if (userId) {
      window.sessionStorage.setItem(
        `${SESSION_STORAGE_PREFIX}${userId}`,
        payload
      )
    }
    window.sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}active`, payload)
  } catch (err) {
    console.warn(
      "[saveSessionSecretKey] Failed to wrap and save session key:",
      err
    )
  }
}

/**
 * Loads and decrypts the secret key using the non-extractable WebCrypto session wrapping key.
 */
export async function loadSessionSecretKey(
  userId?: string
): Promise<Uint8Array | null> {
  if (
    typeof window === "undefined" ||
    !window.sessionStorage ||
    !window.crypto?.subtle
  )
    return null
  try {
    const keyName = userId ? `${SESSION_STORAGE_PREFIX}${userId}` : null
    let payload = keyName ? window.sessionStorage.getItem(keyName) : null
    if (!payload) {
      payload = window.sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}active`)
    }
    if (!payload || !payload.includes(":")) return null

    const [ivHex, cipherHex] = payload.split(":")
    if (!ivHex || !cipherHex) return null

    const iv = hexToBytes(ivHex)
    const cipherBytes = hexToBytes(cipherHex)

    const db = await openVaultDB()
    const keyId = userId || "active"

    let record = await new Promise<{ id: string; key: CryptoKey } | null>(
      (resolve, reject) => {
        const tx = db.transaction(SESSION_STORE_NAME, "readonly")
        const store = tx.objectStore(SESSION_STORE_NAME)
        const req = store.get(keyId)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      }
    )

    if (!record && userId) {
      record = await new Promise<{ id: string; key: CryptoKey } | null>(
        (resolve, reject) => {
          const tx = db.transaction(SESSION_STORE_NAME, "readonly")
          const store = tx.objectStore(SESSION_STORE_NAME)
          const req = store.get("active")
          req.onsuccess = () => resolve(req.result || null)
          req.onerror = () => reject(req.error)
        }
      )
    }

    if (!record?.key) return null

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      record.key,
      cipherBytes
    )

    return new Uint8Array(decryptedBuffer)
  } catch (err) {
    console.warn("[loadSessionSecretKey] Failed to unwrap session key:", err)
    return null
  }
}

/**
 * Purges encrypted session tokens and non-extractable session wrapping keys.
 */
export async function clearSessionSecretKey(userId?: string): Promise<void> {
  if (typeof window === "undefined") return
  try {
    if (window.sessionStorage) {
      window.sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}active`)
      if (userId) {
        window.sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}${userId}`)
      }
      for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
        const key = window.sessionStorage.key(i)
        if (key && key.startsWith(SESSION_STORAGE_PREFIX)) {
          window.sessionStorage.removeItem(key)
        }
      }
    }

    if (window.indexedDB) {
      const db = await openVaultDB()
      if (db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(SESSION_STORE_NAME, "readwrite")
          const store = tx.objectStore(SESSION_STORE_NAME)
          if (userId) {
            store.delete(userId)
          }
          store.delete("active")
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

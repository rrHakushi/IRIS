"use client";

import { scrypt } from "@noble/hashes/scrypt.js";
import { gcm } from "@noble/ciphers/aes.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";

const DB_NAME = "iris_vault_db";
const DB_VERSION = 1;
const STORE_NAME = "vault_entries";

export interface VaultRecord {
  userId: string;
  publicKey: string; // Base64
  encryptedPrivateKey: string; // salt:iv:authTag:cipher
  algorithm: "ML-KEM-768";
  hasSeparateEncryptionPassword?: boolean;
  lastUnlockedAt?: number | null;
  updatedAt: number;
}

/**
 * Opens or initializes the IndexedDB database for secure client-side key storage.
 */
export function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a vault record in IndexedDB.
 */
export async function saveVaultRecord(record: VaultRecord): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves a vault record from IndexedDB by userId.
 */
export async function getVaultRecord(userId: string): Promise<VaultRecord | null> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(userId);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clears the vault record for a user from IndexedDB.
 */
export async function deleteVaultRecord(userId: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(userId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Decrypts a post-quantum private key using a password and AES-256-GCM.
 * Compatible with server-side Node / Elysia format: saltHex:ivHex:authTagHex:cipherHex.
 */
export async function decryptPrivateKeyClient(
  encryptedPayload: string,
  password: string
): Promise<Uint8Array> {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted private key format");
  }

  const [saltHex, ivHex, authTagHex, cipherHex] = parts;
  if (!saltHex || !ivHex || !authTagHex || !cipherHex) {
    throw new Error("Invalid encrypted private key segment");
  }

  const salt = hexToBytes(saltHex);
  const iv = hexToBytes(ivHex);
  const authTag = hexToBytes(authTagHex);
  const cipher = hexToBytes(cipherHex);

  // Scrypt key derivation (32 bytes AES-256 key)
  const key = scrypt(password.normalize("NFKC"), salt, {
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
  });

  // Recombine ciphertext + 16-byte auth tag for @noble/ciphers AES-GCM
  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length);
  ciphertextWithTag.set(cipher, 0);
  ciphertextWithTag.set(authTag, cipher.length);

  const aes = gcm(key, iv);
  return aes.decrypt(ciphertextWithTag);
}

/**
 * Encrypts a post-quantum private key using a password and AES-256-GCM.
 */
export async function encryptPrivateKeyClient(
  secretKey: Uint8Array,
  password: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = scrypt(password.normalize("NFKC"), salt, {
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
  });

  const aes = gcm(key, iv);
  const ciphertextWithTag = aes.encrypt(secretKey);

  // Extract auth tag (last 16 bytes) and ciphertext
  const cipher = ciphertextWithTag.slice(0, -16);
  const authTag = ciphertextWithTag.slice(-16);

  return `${bytesToHex(salt)}:${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(cipher)}`;
}

/**
 * Generates an ML-KEM-768 post-quantum keypair in the browser.
 */
export async function generateKeypairClient(password: string): Promise<{
  publicKey: string;
  encryptedPrivateKey: string;
  rawSecretKey: Uint8Array;
}> {
  const kp = ml_kem768.keygen();
  const publicKey = btoa(String.fromCharCode(...kp.publicKey));
  const encryptedPrivateKey = await encryptPrivateKeyClient(kp.secretKey, password);

  return {
    publicKey,
    encryptedPrivateKey,
    rawSecretKey: kp.secretKey,
  };
}

/**
 * Generates a SHA-256 fingerprint string from a base64 public key.
 */
export function calculateKeyFingerprint(publicKeyBase64: string): string {
  try {
    const raw = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));
    const hash = sha256(raw);
    const hex = bytesToHex(hash);
    // Format into groups: SHA256:xx:xx:xx...
    const chunks = hex.match(/.{1,2}/g)?.slice(0, 16).join(":") ?? hex.slice(0, 32);
    return `SHA256:${chunks}`;
  } catch {
    return "SHA256:unknown";
  }
}

const SESSION_STORAGE_PREFIX = "iris_vault_session_";

/**
 * Persists the decrypted secret key into sessionStorage so the vault remains unlocked across page reloads (F5).
 * Automatically cleared when the browser tab is closed or when explicitly locked.
 */
export function saveSessionSecretKey(userId: string, secretKey: Uint8Array): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const hex = bytesToHex(secretKey);
    if (userId && userId !== "active") {
      window.sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}${userId}`, hex);
    }
    window.sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}active`, hex);
  } catch (e) {
    console.warn("[EncryptionVault] Could not save session secret key:", e);
  }
}

/**
 * Loads the decrypted secret key from sessionStorage if it exists for the current user.
 */
export function loadSessionSecretKey(userId?: string): Uint8Array | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    if (userId && userId !== "active") {
      const hex = window.sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}${userId}`);
      if (hex) return hexToBytes(hex);
    }
    const fallbackHex = window.sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}active`);
    if (fallbackHex) return hexToBytes(fallbackHex);
    return null;
  } catch {
    return null;
  }
}

/**
 * Removes the decrypted secret key from sessionStorage when locking the vault or logging out.
 */
export function clearSessionSecretKey(userId?: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}active`);
    if (userId) {
      window.sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}${userId}`);
    }
    // Clear all vault sessions
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(SESSION_STORAGE_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

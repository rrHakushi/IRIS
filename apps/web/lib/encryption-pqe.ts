"use client";

import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { gcm } from "@noble/ciphers/aes.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export interface ActionInputDefinition {
  id: string;
  label: string;
  type?: "text" | "number" | "password" | "textarea";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
}

export interface ActionSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface ActionSelectDefinition {
  id: string;
  label: string;
  placeholder?: string;
  isMultiSelect?: boolean;
  options: ActionSelectOption[];
  required?: boolean;
}

export interface ActionConfirmDefinition {
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive" | "outline" | "secondary";
  rejectLabel?: string;
  rejectVariant?: "default" | "destructive" | "outline" | "secondary";
}

export interface PqeNotificationContent {
  title: string;
  body: string;
  icon?: string;
  link?: string;
  actionConfirm?: ActionConfirmDefinition;
  actionInputs?: ActionInputDefinition[];
  actionSelect?: ActionSelectDefinition;
  metadata?: Record<string, unknown>;
}

/**
 * Decrypts a post-quantum encrypted notification payload on the client
 * using the user's decrypted secret key.
 */
export function decryptPqeNotification(
  kemCiphertextBase64: string,
  encryptedData: string,
  secretKey: Uint8Array
): PqeNotificationContent {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted notification format. Expected iv:authTag:cipher");
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error("Missing encrypted notification segments");
  }

  const iv = hexToBytes(ivHex);
  const authTag = hexToBytes(authTagHex);
  const cipher = hexToBytes(cipherHex);

  const rawKemCiphertext = Uint8Array.from(atob(kemCiphertextBase64), (c) => c.charCodeAt(0));

  // 1. Post-Quantum KEM Decapsulation
  const sharedSecret = ml_kem768.decapsulate(rawKemCiphertext, secretKey);

  // 2. Symmetric AES-256-GCM Decryption
  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length);
  ciphertextWithTag.set(cipher, 0);
  ciphertextWithTag.set(authTag, cipher.length);

  const aes = gcm(sharedSecret, iv);
  const decryptedBytes = aes.decrypt(ciphertextWithTag);

  const json = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(json) as PqeNotificationContent;
}

/**
 * Encrypts a notification content object using a recipient's ML-KEM-768 public key.
 */
export function encryptPqeNotification(
  content: PqeNotificationContent,
  publicKeyBase64: string
): { kemCiphertext: string; encryptedData: string } {
  const recipientPublicKey = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));

  // 1. Post-Quantum KEM Encapsulation
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(recipientPublicKey);

  // 2. Symmetric AES-256-GCM payload encryption with random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = gcm(sharedSecret, iv);

  const plaintextBytes = new TextEncoder().encode(JSON.stringify(content));
  const ciphertextWithTag = aes.encrypt(plaintextBytes);

  const cipher = ciphertextWithTag.slice(0, -16);
  const authTag = ciphertextWithTag.slice(-16);

  const encryptedData = `${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(cipher)}`;
  const kemCiphertext = btoa(String.fromCharCode(...cipherText));

  return {
    kemCiphertext,
    encryptedData,
  };
}

"use client"

import { sha256 } from "@noble/hashes/sha2.js"

export type SshKeyAlgorithm = "ED25519" | "RSA_2048" | "RSA_4096"

export interface GeneratedSshKey {
  algorithm: SshKeyAlgorithm
  publicKeyOpenSsh: string
  privateKeyPem: string
  fingerprintSha256: string
}

/**
 * Helper to encode an OpenSSH length-prefixed string/byte field.
 */
function encodeSshString(data: Uint8Array | string): Uint8Array {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
  const length = bytes.length
  const result = new Uint8Array(4 + length)
  result[0] = (length >>> 24) & 0xff
  result[1] = (length >>> 16) & 0xff
  result[2] = (length >>> 8) & 0xff
  result[3] = length & 0xff
  result.set(bytes, 4)
  return result
}

/**
 * Helper to concatenate multiple Uint8Arrays.
 */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/**
 * Converts a raw byte array to Base64 string.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b !== undefined) {
      binary += String.fromCharCode(b)
    }
  }
  return btoa(binary)
}

/**
 * Converts an ArrayBuffer to a PEM formatted string.
 */
function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(buffer)
  const base64 = bytesToBase64(bytes)
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`
}

/**
 * Calculates the SHA-256 fingerprint of an OpenSSH public key blob.
 * Format: SHA256:xxxxxxxxxxxx (matches ssh-keygen -l output)
 */
export function calculateSshFingerprint(rawKeyBlob: Uint8Array): string {
  const hash = sha256(rawKeyBlob)
  const base64 = bytesToBase64(hash).replace(/=+$/, "")
  return `SHA256:${base64}`
}

/**
 * Generates an Ed25519 or RSA SSH keypair directly in the browser using WebCrypto.
 */
export async function generateSshKeypair(
  algorithm: SshKeyAlgorithm = "ED25519",
  comment: string = "user@iris"
): Promise<GeneratedSshKey> {
  if (algorithm === "ED25519") {
    // Generate Ed25519 keypair
    const keyPair = (await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair

    // Export raw public key (32 bytes)
    const rawPublicKey = new Uint8Array(
      await crypto.subtle.exportKey("raw", keyPair.publicKey)
    )

    // Export PKCS#8 private key
    const pkcs8PrivateKey = await crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    )
    const privateKeyPem = arrayBufferToPem(pkcs8PrivateKey, "PRIVATE KEY")

    // Construct OpenSSH wire format:
    // [string: "ssh-ed25519"] [string: 32-byte public key]
    const wireFormat = concatUint8Arrays([
      encodeSshString("ssh-ed25519"),
      encodeSshString(rawPublicKey),
    ])

    const publicKeyOpenSsh = `ssh-ed25519 ${bytesToBase64(wireFormat)} ${comment}`
    const fingerprintSha256 = calculateSshFingerprint(wireFormat)

    return {
      algorithm: "ED25519",
      publicKeyOpenSsh,
      privateKeyPem,
      fingerprintSha256,
    }
  } else {
    const modulusLength = algorithm === "RSA_4096" ? 4096 : 2048

    // Generate RSA keypair
    const keyPair = (await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength,
        publicExponent: new Uint8Array([1, 0, 1]), // 65537
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    )) as CryptoKeyPair

    // Export JWK to extract modulus (n) and exponent (e) for OpenSSH format
    const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey)

    const base64UrlToBytes = (base64url: string): Uint8Array => {
      const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/")
      const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : ""
      const binary = atob(base64 + pad)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    }

    const eBytes = base64UrlToBytes(jwk.e || "")
    let nBytes = base64UrlToBytes(jwk.n || "")

    // OpenSSH mpint format requires high bit to be 0 for positive numbers
    if (nBytes.length > 0 && ((nBytes[0] ?? 0) & 0x80)) {
      const padded = new Uint8Array(nBytes.length + 1)
      padded.set(nBytes, 1)
      nBytes = padded
    }

    const wireFormat = concatUint8Arrays([
      encodeSshString("ssh-rsa"),
      encodeSshString(eBytes),
      encodeSshString(nBytes),
    ])

    const pkcs8PrivateKey = await crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    )
    const privateKeyPem = arrayBufferToPem(pkcs8PrivateKey, "RSA PRIVATE KEY")

    const publicKeyOpenSsh = `ssh-rsa ${bytesToBase64(wireFormat)} ${comment}`
    const fingerprintSha256 = calculateSshFingerprint(wireFormat)

    return {
      algorithm,
      publicKeyOpenSsh,
      privateKeyPem,
      fingerprintSha256,
    }
  }
}

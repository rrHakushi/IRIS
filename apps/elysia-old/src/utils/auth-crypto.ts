import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto"
import { promisify } from "node:util"
import { encode } from "next-auth/jwt"
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js"

const scryptAsync = promisify(scrypt)

/**
 * Standard password hashing utilizing native scrypt with a random 32-byte salt.
 * Produces format: `${saltHex}:${derivedKeyHex}`.
 *
 * @param password - Plaintext password to hash.
 * @returns Serialized salt and hash string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32)
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`
}

/**
 * Timing-safe password verification supporting both IRIS native scrypt format
 * (`${saltHex}:${derivedKeyHex}`) and legacy/migrated bcrypt hashes (`$2a$`, `$2b$`).
 *
 * @param password - Plaintext password supplied by the user.
 * @param storedHash - Hashed password stored in the database.
 * @returns `true` if password matches, `false` otherwise.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!password || !storedHash) {
    return false
  }

  // 1. Scrypt format: "saltHex:hashHex"
  if (storedHash.includes(":")) {
    const parts = storedHash.split(":")
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false
    }

    const salt = Buffer.from(parts[0], "hex")
    const expectedKey = Buffer.from(parts[1], "hex")
    const derivedKey = (await scryptAsync(
      password,
      salt,
      expectedKey.length
    )) as Buffer

    if (derivedKey.length !== expectedKey.length) {
      return false
    }
    return timingSafeEqual(derivedKey, expectedKey)
  }

  // 2. Bun native password verification fallback (supports bcrypt, argon2id)
  if (typeof Bun !== "undefined" && Bun.password?.verify) {
    try {
      return await Bun.password.verify(password, storedHash)
    } catch {
      return false
    }
  }

  return false
}

/**
 * Generates 10 single-use MFA backup codes formatted as `XXXX-XXXX-XXXX-XXXX`.
 * Returns plaintext codes for one-time display to the user, and hashed codes for database storage.
 */
export async function generateBackupCodes(): Promise<{
  plain: string[]
  hashed: string[]
}> {
  const plain: string[] = []
  const hashed: string[] = []
  const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

  for (let i = 0; i < 10; i++) {
    const bytes = randomBytes(16)
    let code = ""
    for (let b = 0; b < 16; b++) {
      code += CHARS[bytes[b]! % CHARS.length]
    }
    const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`
    plain.push(formatted)
    hashed.push(await hashPassword(formatted))
  }

  return { plain, hashed }
}

/**
 * Verifies an entered backup code against an array of hashed backup codes.
 *
 * @param inputCode - Plaintext backup code submitted by the user.
 * @param storedHashes - Array of hashed backup codes from the database.
 * @returns The index of the matched code in `storedHashes`, or -1 if invalid.
 */
export async function verifyBackupCode(
  inputCode: string,
  storedHashes: string[]
): Promise<number> {
  const cleanCode = inputCode.trim().toUpperCase()
  const cleanNoDash = cleanCode.replaceAll("-", "")

  for (let i = 0; i < storedHashes.length; i++) {
    const storedHash = storedHashes[i]
    if (!storedHash) continue

    // Check with and without hyphens
    if (
      (await verifyPassword(cleanCode, storedHash)) ||
      (await verifyPassword(cleanNoDash, storedHash))
    ) {
      return i
    }
  }

  return -1
}

/**
 * Derives a 256-bit encryption key from `NEXTAUTH_SECRET`.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.NEXTAUTH_SECRET || "iris-default-secret-key-32-chars!!"
  return createHash("sha256").update(secret).digest()
}

/**
 * Encrypts sensitive credentials (such as TOTP base32 secrets) using AES-256-GCM.
 *
 * @param plaintext - Data to encrypt.
 * @returns Serialized `ivHex:authTagHex:encryptedHex`.
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`
}

/**
 * Decrypts data previously encrypted with `encryptSecret`.
 *
 * @param serialized - Serialized `ivHex:authTagHex:encryptedHex`.
 * @returns Original plaintext string.
 */
export function decryptSecret(serialized: string): string {
  if (!serialized.includes(":")) {
    // If plaintext or unencrypted, return directly
    return serialized
  }

  const [ivHex, authTagHex, encryptedHex] = serialized.split(":")
  if (!ivHex || !authTagHex || !encryptedHex) {
    return serialized
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const encrypted = Buffer.from(encryptedHex, "hex")

  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

export interface UserSessionTokenData {
  id: string
  username: string
  email: string | null
  passwordChangedAt?: Date | null
  permissions?: number[]
}

/**
 * Signs a NextAuth-compatible JWT session token.
 * Valid for 30 days.
 *
 * @param user - User identity payload.
 * @returns Signed JWT string.
 */
export async function signUserJwt(user: UserSessionTokenData): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET environment variable is not defined")
  }

  const pwdChangedSeconds = user.passwordChangedAt
    ? Math.floor(user.passwordChangedAt.getTime() / 1000)
    : null

  return await encode({
    token: {
      id: user.id,
      username: user.username,
      email: user.email ?? "",
      passwordChangedAt: pwdChangedSeconds,
      iat: Math.floor(Date.now() / 1000),
      error: null,
    },
    secret,
    maxAge: 365 * 24 * 60 * 60, // 1 year (365 days)
  })
}

/**
 * Encrypts a post-quantum private key using AES-256-GCM with a key derived
 * from the user's password via scrypt.
 *
 * Format: `${saltHex}:${ivHex}:${authTagHex}:${ciphertextHex}`
 */
export async function encryptPrivateKey(
  secretKey: Uint8Array | Buffer,
  password: string
): Promise<string> {
  const salt = randomBytes(16)
  const key = (await scryptAsync(password, salt, 32)) as Buffer
  const iv = randomBytes(12)

  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secretKey)),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`
}

/**
 * Decrypts a post-quantum private key previously encrypted with `encryptPrivateKey`.
 *
 * @param encryptedPayload - Formatted string `saltHex:ivHex:authTagHex:ciphertextHex`.
 * @param password - User's encryption or account password.
 * @returns Decrypted private key as Uint8Array.
 */
export async function decryptPrivateKey(
  encryptedPayload: string,
  password: string
): Promise<Uint8Array> {
  const [saltHex, ivHex, authTagHex, encryptedHex] = encryptedPayload.split(":")
  if (!saltHex || !ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted private key format.")
  }

  const salt = Buffer.from(saltHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const encrypted = Buffer.from(encryptedHex, "hex")

  const key = (await scryptAsync(password, salt, 32)) as Buffer
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return new Uint8Array(decrypted)
}

/**
 * Generates an ML-KEM-768 (NIST FIPS 203 Post-Quantum) keypair and encrypts
 * the private key with the user's password using AES-256-GCM.
 *
 * @param password - Plaintext password (account password or separate encryption password).
 * @returns Object containing public key (Base64) and encrypted private key string.
 */
export async function generateUserKeypair(
  password: string
): Promise<{ publicKey: string; encryptedPrivateKey: string }> {
  const { publicKey, secretKey } = ml_kem768.keygen()
  const publicKeyBase64 = Buffer.from(publicKey).toString("base64")
  const encryptedPrivateKey = await encryptPrivateKey(secretKey, password)

  return {
    publicKey: publicKeyBase64,
    encryptedPrivateKey,
  }
}

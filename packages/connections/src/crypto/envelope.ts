import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import type { ConnectionProvider } from "../types/index.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Retrieves the base master encryption secret from environment.
 */
function getMasterSecret(): Buffer {
  const secret =
    process.env.CONNECTIONS_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.APP_SECRET ||
    "iris-default-connections-master-key-32chars";
  return createHash("sha256").update(secret).digest();
}

/**
 * Derives a dedicated 256-bit symmetric encryption key for a given user.
 * Uses HKDF with SHA-256 using the master secret and user ID.
 *
 * @param userId - Unique ID of the user.
 * @param userSalt - Optional secondary user salt (e.g. password salt or vault salt).
 * @returns 32-byte Buffer key.
 */
export function deriveUserConnectionKey(
  userId: string,
  userSalt?: string
): Buffer {
  if (!userId) {
    throw new Error("UserId is required for deriving connection encryption key");
  }

  const master = getMasterSecret();
  const salt = userSalt
    ? createHash("sha256").update(userSalt).digest()
    : Buffer.from(`iris-user-conn-salt:${userId}`, "utf8");

  const info = Buffer.from(`iris:connection-envelope:${userId}`, "utf8");

  // Derive 32 bytes (256 bits) key using HKDF-SHA256
  return Buffer.from(hkdfSync("sha256", master, salt, info, 32));
}

/**
 * Encrypts arbitrary serializable data using AES-256-GCM and the user's derived key.
 *
 * Output format: `ivHex:authTagHex:cipherHex`
 *
 * @param payload - Plaintext object, string, or credentials to encrypt.
 * @param userId - Unique user ID.
 * @param userSalt - Optional extra user salt.
 * @returns Formatted ciphertext string.
 */
export function encryptConnectionData<T = unknown>(
  payload: T,
  userId: string,
  userSalt?: string
): string {
  if (payload === undefined || payload === null) {
    throw new Error("Payload cannot be empty for encryption");
  }

  const key = deriveUserConnectionKey(userId, userSalt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext =
    typeof payload === "string" ? payload : JSON.stringify(payload);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts data previously encrypted with `encryptConnectionData`.
 *
 * @param encryptedPayload - Formatted string `ivHex:authTagHex:cipherHex`.
 * @param userId - Unique user ID.
 * @param userSalt - Optional extra user salt.
 * @returns Decrypted typed payload.
 */
export function decryptConnectionData<T = unknown>(
  encryptedPayload: string,
  userId: string,
  userSalt?: string
): T {
  if (!encryptedPayload) {
    throw new Error("Encrypted payload cannot be empty");
  }

  if (!isEncryptedFormat(encryptedPayload)) {
    // If not encrypted (e.g. legacy plain JSON during dev), parse safely
    try {
      return JSON.parse(encryptedPayload) as T;
    } catch {
      return encryptedPayload as unknown as T;
    }
  }

  const [ivHex, authTagHex, cipherHex] = encryptedPayload.split(":");
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error("Malformed encrypted connection payload format");
  }

  const key = deriveUserConnectionKey(userId, userSalt);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  const plaintext = decrypted.toString("utf8");

  try {
    return JSON.parse(plaintext) as T;
  } catch {
    return plaintext as unknown as T;
  }
}

/**
 * Checks whether a given string adheres to the standard `iv:authTag:cipher` envelope format.
 */
export function isEncryptedFormat(data: string): boolean {
  if (typeof data !== "string") return false;
  const parts = data.split(":");
  return (
    parts.length === 3 &&
    parts[0]!.length === IV_LENGTH * 2 &&
    parts[1]!.length === AUTH_TAG_LENGTH * 2 &&
    parts[2]!.length > 0
  );
}

export interface OAuthStatePayload {
  userId: string;
  provider: ConnectionProvider;
  redirectUri: string;
  codeVerifier?: string;
  returnTo?: string;
  timestamp?: number;
}

/**
 * Creates an HMAC-signed and base64url-encoded OAuth state token.
 * Valid across server restarts without relying on in-memory caches.
 */
export function createOAuthStateToken(payload: OAuthStatePayload): string {
  const master = getMasterSecret();
  const data = JSON.stringify({
    ...payload,
    timestamp: payload.timestamp || Date.now(),
  });
  const dataB64 = Buffer.from(data, "utf8").toString("base64url");
  const signature = createHmac("sha256", master).update(dataB64).digest("base64url");
  return `${dataB64}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-signed OAuth state token.
 * Returns null if the token is forged, tampered, or older than maxAgeMs (default: 15 mins).
 */
export function verifyOAuthStateToken(
  token: string,
  maxAgeMs = 15 * 60 * 1000
): OAuthStatePayload | null {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [dataB64, signature] = token.split(".");
  if (!dataB64 || !signature) return null;

  const master = getMasterSecret();
  const expectedSig = createHmac("sha256", master).update(dataB64).digest("base64url");
  if (signature !== expectedSig) {
    return null;
  }

  try {
    const raw = Buffer.from(dataB64, "base64url").toString("utf8");
    const payload = JSON.parse(raw) as OAuthStatePayload;
    if (!payload.timestamp || Date.now() - payload.timestamp > maxAgeMs) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

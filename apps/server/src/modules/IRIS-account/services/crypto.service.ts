import { Injectable } from "@nestjs/common";
import {
  generateKeyPairSync,
  randomBytes,
  scrypt,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Service responsible for password hashing, asymmetric key generation, and AES-256-GCM private key encryption.
 */
@Injectable()
export class CryptoService {
  /**
   * Hashes a plaintext password using native scrypt with a cryptographically secure 32-byte salt.
   *
   * @param password - The plaintext password to hash.
   * @returns A combined salt and hash string in the format `saltHex:hashHex`.
   */
  public async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(32);
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
  }

  /**
   * Verifies a candidate password against a stored `saltHex:hashHex` string using timing-safe comparison.
   *
   * @param password - Candidate plaintext password.
   * @param combinedHash - Stored hash in `saltHex:hashHex` format.
   * @returns `true` if the password is valid, `false` otherwise.
   */
  public async verifyPassword(password: string, combinedHash: string): Promise<boolean> {
    const parts = combinedHash.split(":");
    if (parts.length !== 2) {
      return false;
    }
    const saltHex = parts[0];
    const hashHex = parts[1];
    if (!saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, "hex");
    const storedHash = Buffer.from(hashHex, "hex");

    const derivedKey = (await scryptAsync(password, salt, storedHash.length)) as Buffer;
    return timingSafeEqual(storedHash, derivedKey);
  }

  /**
   * Generates an Ed25519 asymmetric keypair, encrypts the private key with AES-256-GCM using the user's password,
   * and returns the public key and encrypted private key string.
   *
   * @param password - The user's plaintext password.
   * @returns Object containing the public key PEM and encrypted private key.
   */
  public async generateUserKeypair(
    password: string,
  ): Promise<{ readonly publicKey: string; readonly encryptedPrivateKey: string }> {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const encryptedPrivateKey = await this.encryptPrivateKey(privateKey, password);
    return {
      publicKey,
      encryptedPrivateKey,
    };
  }

  /**
   * Encrypts a private key PEM using AES-256-GCM with a key derived from the given password.
   *
   * @param privateKeyPem - The plaintext private key PEM string.
   * @param password - The encryption password.
   * @returns Formatted ciphertext string: `salt:iv:authTag:ciphertext` in hex.
   */
  public async encryptPrivateKey(privateKeyPem: string, password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    const iv = randomBytes(12);

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(privateKeyPem, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      salt.toString("hex"),
      iv.toString("hex"),
      authTag.toString("hex"),
      encrypted.toString("hex"),
    ].join(":");
  }

  /**
   * Decrypts an encrypted private key string using the user's password.
   *
   * @param encryptedPayload - Formatted string `salt:iv:authTag:ciphertext`.
   * @param password - The user's password.
   * @returns The decrypted private key PEM string.
   */
  public async decryptPrivateKey(encryptedPayload: string, password: string): Promise<string> {
    const [saltHex, ivHex, authTagHex, encryptedHex] = encryptedPayload.split(":");
    if (!saltHex || !ivHex || !authTagHex || !encryptedHex) {
      throw new Error("Invalid encrypted private key format.");
    }

    const salt = Buffer.from(saltHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  /**
   * Generates a random alphanumeric string token.
   *
   * @param length - Number of bytes of entropy.
   * @returns Hex-encoded random string.
   */
  public generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString("hex");
  }
}

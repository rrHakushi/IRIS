import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import type { prisma as PrismaType } from "@IRIS/database"
import { c } from "./colors"
import { hashPassword, generateUserKeypair } from "./auth-crypto"

/**
 * File path where dev credentials are saved and cached.
 */
export const DEV_ACCOUNT_FILE = path.resolve(
  import.meta.dirname,
  "../../dev-account.json"
)

/**
 * Default development credentials matching user specification:
 * - username: "dev"
 * - password: 16 chars, 2 numbers ("2", "6"), 1 special ("!")
 * - email: "dev@iris.local"
 * - permissions: [1] (ADMINISTRATOR)
 * - apiKey: 40-char key with no expiration (expiresAt: null)
 */
export const DEV_ACCOUNT_DEFAULTS = {
  username: "dev",
  email: process.env.DEV_EMAIL || "dev@iris.local",
  password: process.env.DEV_PASSWORD || "DevAdmin26!passw",
  apiKey: process.env.DEV_API_KEY || "iris_dev_key_0192837465abcdef01928374",
  permissions: [1], // IRISFlags.ADMINISTRATOR (superuser bypass)
} as const

/**
 * Structure of the cached development credentials stored in dev-account.json.
 */
export interface DevAccountInfo {
  /** Database user ID. */
  userId: string
  /** Primary username (defaults to "dev"). */
  username: string
  /** Developer email address. */
  email: string
  /** Plaintext password used for local testing. */
  password?: string
  /** Non-expiring API key string. */
  apiKey: string
  /** Array of permission bitfield flags. */
  permissions?: number[]
  /** ISO timestamp when the credentials were saved. */
  createdAt?: string
}

/**
 * Ensures a development user account and infinite-duration API key exist in the database.
 * Always verifies that the user record and API key exist in PostgreSQL.
 *
 * @param prisma - Prisma database client instance
 * @returns Development account information, or null if database was unreachable
 */
export async function ensureDevAccount(
  prisma: typeof PrismaType
): Promise<DevAccountInfo | null> {
  try {
    const { username, email, password, apiKey, permissions } = DEV_ACCOUNT_DEFAULTS

    // 1. Check if dev user exists in database
    let user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user) {
      const passwordHash = await hashPassword(password)
      const { publicKey, encryptedPrivateKey } = await generateUserKeypair(password)
      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          permissions: [...permissions],
          publicKey,
          encryptedPrivateKey,
        },
      })
      console.log(
        `${c.green(c.bold("[Dev Account]"))} Created new dev user in database: ${c.cyan(username)}`
      )
    } else {
      // Ensure existing dev user has admin permissions and encryption keys
      const hasAdmin = user.permissions.includes(1)
      const needsEncryptionKeys = !user.publicKey || !user.encryptedPrivateKey

      if (!hasAdmin || needsEncryptionKeys) {
        let keysToUpdate: { publicKey?: string; encryptedPrivateKey?: string } = {}
        if (needsEncryptionKeys) {
          const { publicKey, encryptedPrivateKey } = await generateUserKeypair(password)
          keysToUpdate = { publicKey, encryptedPrivateKey }
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            permissions: Array.from(new Set([...user.permissions, 1])),
            ...keysToUpdate,
          },
        })
      }
    }

    // 2. Find or create permanent API key (no expiration)
    const keyHash = createHash("sha256").update(apiKey).digest("hex")
    const existingKey = await prisma.apiKey.findFirst({
      where: { hash: keyHash },
    })

    if (!existingKey) {
      await prisma.apiKey.create({
        data: {
          userId: user.id,
          name: "Development API Key",
          prefix: apiKey.slice(0, 16),
          hash: keyHash,
          expiresAt: null, // No expiration!
        },
      })
    }

    const creds: DevAccountInfo = {
      userId: user.id,
      username: user.username.trim(),
      email: user.email,
      password,
      apiKey,
      permissions: [...user.permissions],
      createdAt: new Date().toISOString(),
    }

    // 3. Save / update dev-account.json file on disk
    fs.writeFileSync(
      DEV_ACCOUNT_FILE,
      JSON.stringify(creds, null, 2) + "\n",
      "utf-8"
    )

    console.log(
      `${c.green(c.bold("[Dev Account]"))} Dev account active (${c.cyan(username)} / ${c.dim(email)})`
    )

    return creds
  } catch (err) {
    console.warn("[Dev Account] Could not initialize dev account in DB:", err)
    return null
  }
}

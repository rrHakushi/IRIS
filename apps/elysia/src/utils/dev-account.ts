import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import type { prisma as PrismaType } from "@IRIS/database";
import { c } from "./colors";

const scryptAsync = promisify(scrypt);

/**
 * File path where dev credentials are saved and cached.
 */
export const DEV_ACCOUNT_FILE = path.resolve(
  import.meta.dirname,
  "../../dev-account.json"
);

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
} as const;

/**
 * Hashes password using native scrypt with a 32-byte salt,
 * matching IRIS CryptoService standard format: "saltHex:hashHex".
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32);
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

export interface DevAccountInfo {
  userId: string;
  username: string;
  email: string;
  password?: string;
  apiKey: string;
  permissions?: number[];
  createdAt?: string;
}

/**
 * Ensures a development user account and infinite-duration API key exist.
 *
 * Behavior:
 * 1. If dev-account.json already exists:
 *    Loads and returns credentials directly from disk without querying the database.
 * 2. If dev-account.json does NOT exist:
 *    Queries and creates the dev user and permanent API key in the database,
 *    then writes dev-account.json so future startups skip the DB entirely.
 */
export async function ensureDevAccount(
  prisma: typeof PrismaType
): Promise<DevAccountInfo | null> {
  // Check if credentials file already exists on disk
  if (fs.existsSync(DEV_ACCOUNT_FILE)) {
    try {
      const content = fs.readFileSync(DEV_ACCOUNT_FILE, "utf-8");
      const parsed = JSON.parse(content) as DevAccountInfo;
      if (parsed && parsed.apiKey && parsed.username) {
        console.log(
          `${c.green(c.bold("[Dev Account]"))} Loaded credentials from ${c.cyan("dev-account.json")} ${c.dim("(no DB query)")}`
        );
        return parsed;
      }
    } catch (err) {
      console.warn("[Dev Account] Could not parse existing dev-account.json, re-creating:", err);
    }
  }

  // Not found on disk: create/verify in database
  try {
    const { username, email, password, apiKey, permissions } = DEV_ACCOUNT_DEFAULTS;

    // 1. Find or create dev user
    let user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          permissions: [...permissions],
        },
      });
    } else {
      // Ensure user has admin permissions
      const hasAdmin = user.permissions.includes(1);
      if (!hasAdmin) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            permissions: Array.from(new Set([...user.permissions, 1])),
          },
        });
      }
    }

    // 2. Find or create permanent API key (no expiration)
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const existingKey = await prisma.apiKey.findFirst({
      where: { hash: keyHash },
    });

    if (!existingKey) {
      await prisma.apiKey.create({
        data: {
          userId: user.id,
          name: "Development API Key",
          prefix: apiKey.slice(0, 16),
          hash: keyHash,
          expiresAt: null, // No expiration!
        },
      });
    }

    const creds: DevAccountInfo = {
      userId: user.id,
      username: user.username.trim(),
      email: user.email,
      password,
      apiKey,
      permissions: [...user.permissions],
      createdAt: new Date().toISOString(),
    };

    // Save to dev-account.json so next startup avoids database queries
    fs.writeFileSync(DEV_ACCOUNT_FILE, JSON.stringify(creds, null, 2) + "\n", "utf-8");

    console.log(
      `${c.green(c.bold("[Dev Account]"))} Created dev account in DB and saved to ${c.cyan("dev-account.json")}`
    );

    return creds;
  } catch (err) {
    console.warn("[Dev Account] Could not initialize dev account in DB:", err);
    return null;
  }
}

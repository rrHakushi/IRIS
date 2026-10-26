#!/usr/bin/env bun
/**
 * IRIS Vault & Encryption Key Migration Script
 *
 * Migrates existing user accounts from legacy separate encryption passwords
 * and/or obsolete Post-Quantum ML-KEM keys to the standard RSA-2048 + AES-256-GCM
 * unified encryption scheme where the account password is the single root of trust.
 *
 * It safely:
 * 1. Decrypts the existing secret key using the old encryption password.
 * 2. Decrypts all existing PassCiphers using the derived legacy vault key.
 * 3. Generates a fresh, standard RSA-2048 keypair.
 * 4. Encrypts the new RSA private key using the account password.
 * 5. Re-encrypts all existing PassCiphers using the new vault key.
 * 6. Updates the database and deletes orphaned/unreadable notifications.
 */

import '../apps/elysia/src/load-env'
import { prisma } from '@Iris/db'
import { generateKeyPairSync, createCipheriv, createDecipheriv, randomBytes, scrypt as nodeScrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { hkdf } from '../apps/web/node_modules/@noble/hashes/hkdf.js'
import { sha256 } from '../apps/web/node_modules/@noble/hashes/sha2.js'
import { scrypt as nobleScrypt } from '../apps/web/node_modules/@noble/hashes/scrypt.js'
import { gcm } from '../apps/web/node_modules/@noble/ciphers/aes.js'
import { bytesToHex, hexToBytes } from '../apps/web/node_modules/@noble/hashes/utils.js'

const scryptAsync = promisify(nodeScrypt)

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
}

const VAULT_SALT = new TextEncoder().encode('iris-pass-salt-v1')
const VAULT_INFO = new TextEncoder().encode('iris-pass-vault-v1')

function deriveVaultKey(unlockedSecretKey: Uint8Array): Uint8Array {
  return hkdf(sha256, unlockedSecretKey, VAULT_SALT, VAULT_INFO, 32)
}

function decryptVaultData(encryptedPayload: string, vaultKey: Uint8Array): string {
  const parts = encryptedPayload.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format (expected iv:authTag:cipher)')
  }
  const [ivHex, authTagHex, cipherHex] = parts
  const iv = hexToBytes(ivHex!)
  const authTag = hexToBytes(authTagHex!)
  const cipher = hexToBytes(cipherHex!)

  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
  ciphertextWithTag.set(cipher, 0)
  ciphertextWithTag.set(authTag, cipher.length)

  const aes = gcm(vaultKey, iv)
  const decryptedBytes = aes.decrypt(ciphertextWithTag)
  return new TextDecoder().decode(decryptedBytes)
}

function encryptVaultData(plaintext: string, vaultKey: Uint8Array): string {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plainBytes = new TextEncoder().encode(plaintext)
  const aes = gcm(vaultKey, iv)
  const ciphertextWithTag = aes.encrypt(plainBytes)

  const cipher = ciphertextWithTag.slice(0, -16)
  const authTag = ciphertextWithTag.slice(-16)

  return `${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(cipher)}`
}

function decryptPrivateKey(encryptedPayload: string, password: string): Uint8Array {
  const parts = encryptedPayload.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted private key format (expected salt:iv:authTag:cipher)')
  }
  const [saltHex, ivHex, authTagHex, cipherHex] = parts
  const salt = hexToBytes(saltHex!)
  const iv = hexToBytes(ivHex!)
  const authTag = hexToBytes(authTagHex!)
  const cipher = hexToBytes(cipherHex!)

  const key = nobleScrypt(password.normalize('NFKC'), salt, {
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
  })

  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
  ciphertextWithTag.set(cipher, 0)
  ciphertextWithTag.set(authTag, cipher.length)

  const aes = gcm(key, iv)
  return aes.decrypt(ciphertextWithTag)
}

async function encryptPrivateKey(privateKey: string, password: string): Promise<string> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = (await scryptAsync(password, salt, 32)) as Buffer
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

function promptLine(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(promptText)
    let buffer = ''
    const isTTY = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function')

    const onData = (chunk: Buffer) => {
      const str = chunk.toString('utf8')
      for (const char of str) {
        if (char === '\r' || char === '\n') {
          if (isTTY) process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(buffer.trim())
          return
        } else if (char === '\u0003') {
          if (isTTY) process.stdin.setRawMode(false)
          process.stdout.write('\n' + c.yellow + 'Migration aborted by user.' + c.reset + '\n')
          process.exit(130)
        } else if (char === '\u007f' || char === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1)
            if (isTTY) process.stdout.write('\b \b')
          }
        } else {
          buffer += char
          if (isTTY) process.stdout.write(char)
        }
      }
    }

    if (isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

function promptMasked(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(promptText)
    let buffer = ''
    const isTTY = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function')

    const onData = (chunk: Buffer) => {
      const str = chunk.toString('utf8')
      for (const char of str) {
        if (char === '\r' || char === '\n') {
          if (isTTY) process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(buffer)
          return
        } else if (char === '\u0003') {
          if (isTTY) process.stdin.setRawMode(false)
          process.stdout.write('\n' + c.yellow + 'Migration aborted by user.' + c.reset + '\n')
          process.exit(130)
        } else if (char === '\u007f' || char === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1)
            if (isTTY) process.stdout.write('\b \b')
          }
        } else {
          buffer += char
          if (isTTY) process.stdout.write('*')
        }
      }
    }

    if (isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

export async function migrateUserVault(
  username: string,
  oldEncryptionPassword?: string,
  newAccountPassword?: string
) {
  const user = await prisma.orm.public.User
    .where({ username })
    .first()

  if (!user) {
    console.log(`${c.red}User '${username}' not found.${c.reset}`)
    return false
  }

  const isRsa = user.publicKey?.startsWith('-----BEGIN PUBLIC KEY-----')
  console.log(`\nUser: ${c.cyan}${user.username}${c.reset} (${user.id})`)
  console.log(`  Current Public Key Type: ${isRsa ? c.green + 'RSA-2048' : c.yellow + 'Legacy ML-KEM-768'}${c.reset}`)

  const ciphers = await prisma.orm.public.PassCipher
    .where({ userId: user.id })
    .all()
  console.log(`  Stored PassCiphers (Akaromi): ${c.bold}${ciphers.length}${c.reset}`)

  let oldSecretKey: Uint8Array | null = null
  let oldVaultKey: Uint8Array | null = null

  // 1. If user has encryptedPrivateKey, prompt for old encryption password
  if (user.encryptedPrivateKey) {
    let passwordAttempts = 0
    while (!oldSecretKey) {
      const pass = oldEncryptionPassword || (await promptMasked(`Enter CURRENT encryption password for ${c.cyan}${user.username}${c.reset}: `))
      try {
        oldSecretKey = decryptPrivateKey(user.encryptedPrivateKey, pass)
        oldVaultKey = deriveVaultKey(oldSecretKey)
        console.log(`${c.green}✓ Successfully unlocked current encryption vault.${c.reset}`)
      } catch (err) {
        console.log(`${c.red}Failed to decrypt vault with provided password (invalid tag or corrupted).${c.reset}`)
        passwordAttempts++
        if (oldEncryptionPassword || passwordAttempts >= 3) {
          console.log(`${c.red}Aborting migration for ${username}.${c.reset}`)
          return false
        }
      }
    }
  }

  // 2. If user has ciphers, verify they can be decrypted with oldVaultKey
  const decryptedCiphers: { id: string; title: string; data: string }[] = []
  if (ciphers.length > 0) {
    if (!oldVaultKey) {
      console.log(`${c.red}User has ${ciphers.length} ciphers but no valid vault key to decrypt them.${c.reset}`)
      return false
    }
    console.log(`${c.gray}Decrypting ${ciphers.length} ciphers to verify integrity...${c.reset}`)
    try {
      for (const item of ciphers) {
        const title = decryptVaultData(item.encryptedTitle, oldVaultKey)
        const data = decryptVaultData(item.encryptedData, oldVaultKey)
        decryptedCiphers.push({ id: item.id, title, data })
      }
      console.log(`${c.green}✓ All ${decryptedCiphers.length} ciphers decrypted successfully in memory.${c.reset}`)
    } catch (err: any) {
      console.log(`${c.red}Failed to decrypt existing ciphers with current vault key: ${err?.message || err}${c.reset}`)
      return false
    }
  }

  // 3. Obtain new account password
  let targetAccountPassword = newAccountPassword
  while (!targetAccountPassword) {
    const p1 = await promptMasked(`Enter ACCOUNT password to encrypt keys with (root of trust): `)
    const isValid = await Bun.password.verify(p1, user.passwordHash)
    if (!isValid) {
      console.log(`${c.yellow}Warning: Provided password does not match account password hash in database.${c.reset}`)
      const confirmUse = await promptLine(`Use this password anyway? [y/N]: `)
      if (confirmUse.toLowerCase() !== 'y') continue
    }
    targetAccountPassword = p1
  }

  // 4. Generate new standard RSA-2048 keypair
  console.log(`${c.gray}Generating standard RSA-2048 keypair...${c.reset}`)
  const { publicKey: newPublicKey, privateKey: newPrivateKeyPem } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  // 5. Encrypt new RSA private key with account password
  const newEncryptedPrivateKey = await encryptPrivateKey(newPrivateKeyPem, targetAccountPassword)
  const newSecretKeyBytes = new TextEncoder().encode(newPrivateKeyPem)
  const newVaultKey = deriveVaultKey(newSecretKeyBytes)

  // 6. Re-encrypt all ciphers with new vault key
  if (decryptedCiphers.length > 0) {
    console.log(`${c.gray}Re-encrypting ${decryptedCiphers.length} ciphers with new vault key...${c.reset}`)
    for (const item of decryptedCiphers) {
      const newEncTitle = encryptVaultData(item.title, newVaultKey)
      const newEncData = encryptVaultData(item.data, newVaultKey)
      await prisma.orm.public.PassCipher
        .where({ id: item.id })
        .update({
          encryptedTitle: newEncTitle,
          encryptedData: newEncData,
        })
    }
    console.log(`${c.green}✓ All ${decryptedCiphers.length} ciphers re-encrypted and persisted.${c.reset}`)
  }

  // 7. Update user keys in DB
  await prisma.orm.public.User
    .where({ id: user.id })
    .update({
      publicKey: newPublicKey,
      encryptedPrivateKey: newEncryptedPrivateKey,
    })
  console.log(`${c.green}✓ User keys updated to standard RSA-2048 in database.${c.reset}`)

  // 8. Delete orphaned/unreadable notifications
  const deletedNotifs = await prisma.orm.public.Notification
    .where({ userId: user.id })
    .all()
  if (deletedNotifs.length > 0) {
    for (const n of deletedNotifs) {
      await prisma.orm.public.Notification.where({ id: n.id }).delete()
    }
    console.log(`${c.cyan}✓ Cleared ${deletedNotifs.length} legacy/unreadable notification(s).${c.reset}`)
  }

  console.log(`\n${c.bold}${c.green}════════════════════════════════════════════════════════════════${c.reset}`)
  console.log(`${c.bold}${c.green}✓ Vault migration completed successfully for ${user.username}!${c.reset}`)
  console.log(`  - Account password is now the SINGLE password for both login & vault unlock.`)
  console.log(`  - Standard RSA-2048 keys are active for end-to-end notifications.`)
  console.log(`  - All ${decryptedCiphers.length} Akaromi vault passwords safely preserved & re-encrypted.`)
  console.log(`${c.bold}${c.green}════════════════════════════════════════════════════════════════${c.reset}\n`)
  return true
}

async function main() {
  const args = process.argv.slice(2)
  const usernameArg = args.find((a) => a.startsWith('--user='))?.split('=')[1]
  const oldPassArg = args.find((a) => a.startsWith('--old='))?.split('=')[1]
  const newPassArg = args.find((a) => a.startsWith('--new='))?.split('=')[1]

  if (usernameArg) {
    await migrateUserVault(usernameArg, oldPassArg, newPassArg)
    process.exit(0)
  }

  console.clear()
  console.log(`
${c.bold}${c.cyan}╔════════════════════════════════════════════════════════════════╗
║             IRIS Vault & Encryption Key Migration              ║
║        Migrate Accounts & PassCiphers to Unified RSA-2048      ║
╚════════════════════════════════════════════════════════════════╝${c.reset}
`)

  const users = await prisma.orm.public.User
    .select('id', 'username', 'publicKey', 'encryptedPrivateKey')
    .all()

  for (const u of users) {
    const isRsa = u.publicKey?.startsWith('-----BEGIN PUBLIC KEY-----')
    const status = isRsa ? `${c.green}RSA-2048 (Up to date)${c.reset}` : `${c.yellow}Legacy ML-KEM-768 (Migration needed)${c.reset}`
    console.log(`Account: ${c.cyan}${u.username}${c.reset} | ${status}`)
  }
  console.log('')

  const targetUser = await promptLine(`Enter username to migrate (or 'q' to quit): `)
  if (targetUser.toLowerCase() === 'q' || !targetUser.trim()) {
    console.log('Exiting.')
    process.exit(0)
  }

  await migrateUserVault(targetUser.trim())
  process.exit(0)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
}

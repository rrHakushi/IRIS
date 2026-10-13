import { prisma } from '@IRIS/database'
import { NotFound, BadRequest } from '../../lib/errors'
import {
  decryptPrivateKey,
  encryptPrivateKey,
  generateUserKeypair,
  verifyPassword,
  hashPassword,
} from '../../utils/auth-crypto'

export class AkaromiEncryptionServ {
  /**
   * Retrieves the authenticated user's post-quantum encryption keys and cryptographic salt.
   */
  public static async getEncryptionKeys(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        publicKey: true,
        encryptedPrivateKey: true,
        passwordHash: true,
        encryptionPasswordHash: true,
      },
    })

    if (!user) {
      throw new NotFound('User not found.')
    }

    // Post-quantum encryptedPrivateKey is formatted as: saltHex:ivHex:authTagHex:ciphertextHex
    // Fall back to password hash salt if key has not yet been initialized
    let salt: string | null = null
    if (user.encryptedPrivateKey && user.encryptedPrivateKey.includes(':')) {
      salt = user.encryptedPrivateKey.split(':')[0] || null
    } else if (user.passwordHash && user.passwordHash.includes(':')) {
      salt = user.passwordHash.split(':')[0] || null
    }

    return {
      success: true,
      userId: user.id,
      publicKey: user.publicKey ?? null,
      encryptedPrivateKey: user.encryptedPrivateKey ?? null,
      salt,
      hasEncryptionKeys: Boolean(user.publicKey && user.encryptedPrivateKey),
      hasSeparateEncryptionPassword: false,
    }
  }

  /**
   * Changes the dedicated post-quantum encryption password or initializes it.
   */
  public static async changeEncryptionPassword(
    userId: string,
    body: { currentPassword: string; newEncryptionPassword: string }
  ) {
    const hasLength = body.newEncryptionPassword.length >= 16
    const hasTwoNumbers =
      (body.newEncryptionPassword.match(/\d/g) || []).length >= 2
    const hasTwoSpecials =
      (
        body.newEncryptionPassword.match(
          /[!@#$%^&*(),.?":{}|<>~'_\-+=/\\\[\]\x60]/g
        ) || []
      ).length >= 2
    const hasUpper = /[A-Z]/.test(body.newEncryptionPassword)

    if (!hasLength || !hasTwoNumbers || !hasTwoSpecials || !hasUpper) {
      throw new BadRequest(
        'Encryption password must be at least 16 characters with at least 2 numbers, 2 special characters, and 1 uppercase letter.'
      )
    }

    if (body.currentPassword === body.newEncryptionPassword) {
      throw new BadRequest(
        'New encryption password cannot be identical to current password.'
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        encryptionPasswordHash: true,
        publicKey: true,
        encryptedPrivateKey: true,
      },
    })

    if (!user) {
      throw new NotFound('User not found.')
    }

    // If a separate encryption password is set, verify against it; otherwise check account password
    if (user.encryptionPasswordHash) {
      const isCurrentValid = await verifyPassword(
        body.currentPassword,
        user.encryptionPasswordHash
      )
      if (!isCurrentValid) {
        throw new BadRequest('Incorrect current encryption password.')
      }
    } else {
      const isCurrentValid = await verifyPassword(
        body.currentPassword,
        user.passwordHash
      )
      if (!isCurrentValid) {
        throw new BadRequest('Incorrect current account password.')
      }
    }

    let updatedEncryptedPrivateKey: string
    let updatedPublicKey = user.publicKey

    if (user.encryptedPrivateKey) {
      try {
        const decryptedSecret = await decryptPrivateKey(
          user.encryptedPrivateKey,
          body.currentPassword
        )
        updatedEncryptedPrivateKey = await encryptPrivateKey(
          decryptedSecret,
          body.newEncryptionPassword
        )
      } catch {
        throw new BadRequest('Could not decrypt private key with the provided password.')
      }
    } else {
      const keypair = await generateUserKeypair(body.newEncryptionPassword)
      updatedPublicKey = keypair.publicKey
      updatedEncryptedPrivateKey = keypair.encryptedPrivateKey
    }

    const newEncryptionPasswordHash = await hashPassword(
      body.newEncryptionPassword
    )

    await prisma.user.update({
      where: { id: user.id },
      data: {
        publicKey: updatedPublicKey,
        encryptedPrivateKey: updatedEncryptedPrivateKey,
        encryptionPasswordHash: newEncryptionPasswordHash,
      },
    })

    return {
      success: true,
      message: 'Encryption password updated successfully.',
      publicKey: updatedPublicKey ?? null,
      hasSeparateEncryptionPassword: true,
    }
  }
}

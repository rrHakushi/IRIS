import { prisma } from '@IRIS/database'
import { NotFound, BadRequest } from '../../lib/errors'
import type { AkaromiEncryptionModel } from '../../api/models/akaromi/encryption.model'
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
   * Deprecated: Dedicated encryption passwords have been removed.
   * Vault encryption derives exclusively from the user's account password.
   */
  public static async changeEncryptionPassword(
    _userId: string,
    _body: { currentPassword: string; newEncryptionPassword: string }
  ): Promise<AkaromiEncryptionModel['changePasswordResponse']> {
    throw new BadRequest(
      'Dedicated encryption passwords have been removed. Vault encryption uses your account password exclusively.'
    )
  }
}

import { prisma } from '@IRIS/database'
import { NotFound } from '../../lib/errors'

export class AkaromiEncryptionServ {
  /**
   * Retrieves the authenticated user's post-quantum encryption keys and cryptographic salt.
   */
  public static async getEncryptionKeys(userId: string) {
    const user = await prisma.orm.public.User
      .select('id', 'publicKey', 'encryptedPrivateKey', 'passwordHash')
      .first({ id: userId })

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
    }
  }
}

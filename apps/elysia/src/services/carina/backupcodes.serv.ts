import { prisma } from '@IRIS/database'
import { cache } from '../../utils/cache'
import { generateBackupCodes, verifyBackupCode, signUserJwt } from '../../utils/auth-crypto'
import { BadRequest, NotFound, Unauthorized } from '../../lib/errors'
import type { CarinaBackupCodesModel } from '../../api/models/carina/backupcodes.model'

export abstract class CarinaBackupCodesServ {
  /**
   * Generate initial backup codes for an MFA-protected user account.
   */
  static async generateCodes(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    const hasMfaActive =
      user.TOTPEnabled || user.emailMfaEnabled || user.passkeys.length > 0

    if (!hasMfaActive) {
      throw new BadRequest(
        'Multi-factor authentication must be enabled to generate backup codes.'
      )
    }

    if (user.backupCodes.length > 0) {
      throw new BadRequest(
        'Backup codes have already been generated for this account. Use regenerate to create new ones.'
      )
    }

    const { plain, hashed } = await generateBackupCodes()

    await prisma.user.update({
      where: { id: user.id },
      data: {
        backupCodes: hashed,
      },
    })

    await cache.del(`users:me:user:${user.id}`)
    await cache.del(`user:${user.id}`)

    return {
      success: true,
      backupCodes: plain,
    }
  }

  /**
   * Regenerate 10 new backup recovery codes, replacing all previous ones.
   */
  static async regenerateCodes(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    const hasMfaActive =
      user.TOTPEnabled || user.emailMfaEnabled || user.passkeys.length > 0

    if (!hasMfaActive) {
      throw new BadRequest(
        'Multi-factor authentication must be enabled to generate backup codes.'
      )
    }

    const { plain, hashed } = await generateBackupCodes()

    await prisma.user.update({
      where: { id: user.id },
      data: {
        backupCodes: hashed,
      },
    })

    await cache.del(`users:me:user:${user.id}`)
    await cache.del(`user:${user.id}`)

    return {
      success: true,
      backupCodes: plain,
    }
  }

  /**
   * Verify and consume a single-use backup recovery code.
   * Supports both active login challenges (via mfaTicket) and authenticated verification.
   */
  static async verifyCode(
    userId: string | null | undefined,
    body: CarinaBackupCodesModel['verifyBody']
  ) {
    // 1. Unauthenticated Login Challenge Flow via mfaTicket
    if (body.mfaTicket) {
      const ticketData = await cache.get<{ userId: string }>(
        `auth:mfa-ticket:${body.mfaTicket}`
      )
      if (!ticketData?.userId) {
        throw new BadRequest('Invalid or expired MFA session ticket.')
      }

      const user = await prisma.user.findUnique({
        where: { id: ticketData.userId },
      })

      if (!user) {
        throw new NotFound('User account not found.')
      }

      if (user.backupCodes.length === 0) {
        throw new BadRequest('No backup codes exist for this account.')
      }

      const matchedIndex = await verifyBackupCode(body.code, user.backupCodes)

      if (matchedIndex === -1) {
        throw new Unauthorized('Invalid or previously used backup recovery code.')
      }

      // Consume the matched single-use code
      const updatedCodes = user.backupCodes.filter((_, idx) => idx !== matchedIndex)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          backupCodes: updatedCodes,
        },
      })

      // Invalidate ticket & caches
      await cache.del(`auth:mfa-ticket:${body.mfaTicket}`)
      await cache.del(`users:me:user:${user.id}`)
      await cache.del(`user:${user.id}`)

      // Issue authenticated JWT session token
      const token = await signUserJwt({
        ...user,
        username: user.username.trim(),
      })

      return {
        success: true,
        message: 'Backup code verified successfully',
        remainingCount: updatedCodes.length,
        token,
        user: {
          id: user.id,
          username: user.username.trim(),
          email: user.email,
          passwordChangedAt: user.passwordChangedAt
            ? Math.floor(user.passwordChangedAt.getTime() / 1000)
            : null,
        },
      }
    }

    // 2. Authenticated Verification Flow
    if (!userId) {
      throw new Unauthorized('Authentication required or valid mfaTicket required.')
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    if (user.backupCodes.length === 0) {
      throw new BadRequest('No backup codes exist for this account.')
    }

    const matchedIndex = await verifyBackupCode(body.code, user.backupCodes)

    if (matchedIndex === -1) {
      throw new BadRequest('Invalid or previously used backup recovery code.')
    }

    // Consume the matched single-use code
    const updatedCodes = user.backupCodes.filter((_, idx) => idx !== matchedIndex)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        backupCodes: updatedCodes,
      },
    })

    await cache.del(`users:me:user:${user.id}`)
    await cache.del(`user:${user.id}`)

    return {
      success: true,
      message: 'Backup code verified successfully',
      remainingCount: updatedCodes.length,
    }
  }
}

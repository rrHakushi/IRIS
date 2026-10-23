import { generateSecret, generateURI, verify as verifyTotpCode } from 'otplib'
import QRCode from 'qrcode'
import { prisma } from '@IRIS/database'
import { cache } from '../../utils/cache'
import {
  encryptSecret,
  decryptSecret,
  verifyPassword,
  generateBackupCodes,
  signUserJwt,
} from '../../utils/auth-crypto'
import { BadRequest, NotFound, Unauthorized } from '../../lib/errors'
import type { CarinaTotpModel } from '../../api/models/carina/totp.model'

export abstract class CarinaTotpServ {
  /**
   * Generate a new TOTP secret and QR code for authenticator setup.
   */
  static async setupTotp(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    const secret = generateSecret()
    const isDev = Bun.env.NODE_ENV === 'development' || !Bun.env.NODE_ENV
    const issuer = isDev ? 'Carina Dev' : 'Carina'
    const label = user.email ? `${user.username} (${user.email})` : user.username

    const otpauthUrl = generateURI({
      issuer,
      label,
      secret,
    })

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      margin: 2,
      width: 280,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    // Cache pending TOTP secret for 10 minutes (600s)
    await cache.set(`auth:totp:pending:${user.id}`, secret, 600)

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    }
  }

  /**
   * Verify the TOTP code.
   * Handles either an active login challenge (via mfaTicket) or setup verification (authenticated).
   */
  static async verifyTotp(
    userId: string | null | undefined,
    body: CarinaTotpModel['verifyBody']
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
      if (!user || !user.TOTPSecret || !user.TOTPEnabled) {
        throw new Unauthorized('TOTP is not configured or active on this account.')
      }

      const decryptedSecret = decryptSecret(user.TOTPSecret)
      let isCodeValid = false
      try {
        const verifyResult = await verifyTotpCode({
          token: body.code.trim(),
          secret: decryptedSecret,
          epochTolerance: 30,
        })
        isCodeValid = verifyResult.valid
      } catch {
        isCodeValid = false
      }

      if (!isCodeValid) {
        throw new Unauthorized('Invalid verification code.')
      }

      // Cleanup single-use ticket
      await cache.del(`auth:mfa-ticket:${body.mfaTicket}`)

      // Issue authenticated JWT session token
      const token = await signUserJwt({
        ...user,
        username: user.username.trim(),
      })

      return {
        success: true,
        message: 'Successfully verified and logged in',
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

    // 2. Setup Verification Flow (requires authenticated session)
    if (!userId) {
      throw new Unauthorized('Authentication required or valid mfaTicket required.')
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    const cachedSecret = await cache.get<string>(`auth:totp:pending:${user.id}`)
    const secretToVerify = cachedSecret || body.secret

    if (!secretToVerify) {
      throw new BadRequest(
        'TOTP setup session expired or was not initiated. Please generate a new QR code.'
      )
    }

    let isCodeValid = false
    try {
      const verifyResult = await verifyTotpCode({
        token: body.code.trim(),
        secret: secretToVerify,
        epochTolerance: 30,
      })
      isCodeValid = verifyResult.valid
    } catch {
      isCodeValid = false
    }

    if (!isCodeValid) {
      throw new BadRequest(
        'Invalid verification code. Check that the time on your authenticator device is synchronized.'
      )
    }

    const encryptedSecret = encryptSecret(secretToVerify)

    // Generate backup codes if user doesn't already have them
    let plainBackupCodes: string[] | undefined = undefined
    let hashedBackupCodes: string[] | undefined = undefined

    if (user.backupCodes.length === 0) {
      const generated = await generateBackupCodes()
      plainBackupCodes = generated.plain
      hashedBackupCodes = generated.hashed
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        TOTPSecret: encryptedSecret,
        TOTPEnabled: true,
        ...(hashedBackupCodes ? { backupCodes: hashedBackupCodes } : {}),
      },
    })

    // Clear pending setup and caches
    await cache.del(`auth:totp:pending:${user.id}`)
    await cache.del(`users:me:user:${user.id}`)
    await cache.del(`user:${user.id}`)

    return {
      success: true,
      message: 'TOTP has been enabled',
      backupCodes: plainBackupCodes,
    }
  }

  /**
   * Remove TOTP authenticator from user account.
   */
  static async deleteTotp(
    userId: string,
    body?: CarinaTotpModel['deleteBody'] | null
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    if (!user.TOTPEnabled || !user.TOTPSecret) {
      throw new BadRequest('TOTP is not currently enabled on this account.')
    }

    let isAuthorized = false

    // Option A: Verify via TOTP code
    if (body?.code) {
      const decryptedSecret = decryptSecret(user.TOTPSecret)
      let isCodeValid = false
      try {
        const verifyResult = await verifyTotpCode({
          token: body.code.trim(),
          secret: decryptedSecret,
          epochTolerance: 30,
        })
        isCodeValid = verifyResult.valid
      } catch {
        isCodeValid = false
      }

      if (isCodeValid) {
        isAuthorized = true
      } else {
        throw new Unauthorized('Invalid authenticator verification code.')
      }
    }
    // Option B: Verify via Account Password
    else if (body?.password) {
      if (user.passwordHash) {
        const isPasswordValid = await verifyPassword(
          body.password,
          user.passwordHash
        )
        if (isPasswordValid) {
          isAuthorized = true
        } else {
          throw new Unauthorized('Incorrect password confirmation.')
        }
      } else {
        isAuthorized = true
      }
    }
    // Option C: User has no password (OAuth / Passkey only)
    else if (!user.passwordHash) {
      isAuthorized = true
    }

    if (!isAuthorized) {
      throw new BadRequest(
        'Please enter a 6-digit authenticator code or your account password to disable TOTP.'
      )
    }

    const remainingMfa = user.emailMfaEnabled || user.passkeys.length > 0

    await prisma.user.update({
      where: { id: user.id },
      data: {
        TOTPEnabled: false,
        TOTPSecret: null,
        ...(!remainingMfa ? { backupCodes: [] } : {}),
      },
    })

    await cache.del(`users:me:user:${user.id}`)
    await cache.del(`user:${user.id}`)

    return {
      success: true,
      message: 'TOTP has been disabled',
    }
  }
}

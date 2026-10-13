import { randomInt } from 'node:crypto'
import { prisma } from '@IRIS/database'
import { cache } from '../../utils/cache'
import {
  verifyPassword,
  generateBackupCodes,
  signUserJwt,
} from '../../utils/auth-crypto'
import {
  BadRequest,
  NotFound,
  Unauthorized,
  TooManyRequests,
} from '../../lib/errors'
import { EmailService } from '../email/email.serv'
import type { CarinaEmail2faModel } from '../../api/models/carina/email-2fa.model'

/**
 * Mask an email address for privacy in API responses (e.g. `al***e@example.com`).
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@')
  if (!domain || !localPart) return '***@***'

  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`
  }

  const firstChar = localPart[0]
  const lastChar = localPart[localPart.length - 1]
  return `${firstChar}***${lastChar}@${domain}`
}

export abstract class CarinaEmail2faServ {
  /**
   * Initiate Email 2FA setup for the authenticated user by generating
   * and emailing a 6-digit confirmation code.
   */
  static async setupEmail2fa(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    if (!user.email) {
      throw new BadRequest(
        'An email address must be associated with your account before enabling Email 2FA.'
      )
    }

    if (user.emailMfaEnabled) {
      throw new BadRequest(
        'Email two-factor authentication is already enabled on this account.'
      )
    }

    // Cooldown check (60 seconds)
    const cooldownActive = await cache.get<string>(`auth:email-2fa:cooldown:${user.id}`)
    if (cooldownActive) {
      throw new TooManyRequests(
        'Please wait a moment before requesting another verification code.'
      )
    }

    // Generate cryptographically secure 6-digit numeric code
    const code = randomInt(100000, 1000000).toString()

    // Cache pending setup for 10 minutes (600 seconds)
    await cache.set(
      `auth:email-2fa:setup:${user.id}`,
      { code, email: user.email },
      600
    )

    // Set 60-second cooldown
    await cache.set(`auth:email-2fa:cooldown:${user.id}`, '1', 60)

    // Dispatch verification email via BullMQ / EmailService
    await EmailService.sendMfaVerificationEmail(user.email, code, 10)

    return {
      success: true,
      message: 'Verification code sent to registered email',
      email: maskEmail(user.email),
    }
  }

  /**
   * Send or resend an email verification code.
   * Supports either:
   * 1. Login challenge: unauthenticated, provides `mfaTicket` in body.
   * 2. Logged-in setup resend: authenticated session.
   */
  static async sendEmail2fa(
    userId?: string | null,
    body?: CarinaEmail2faModel['sendBody'] | null
  ) {
    // 1. Unauthenticated Login Challenge Flow via mfaTicket
    if (body?.mfaTicket) {
      const ticketData = await cache.get<{ userId: string }>(
        `auth:mfa-ticket:${body.mfaTicket}`
      )

      if (!ticketData || !ticketData.userId) {
        throw new BadRequest('Invalid or expired MFA session ticket.')
      }

      const user = await prisma.user.findUnique({
        where: { id: ticketData.userId },
        select: { id: true, email: true, emailMfaEnabled: true },
      })

      if (!user || !user.email) {
        throw new NotFound('User account or email address not found.')
      }

      if (!user.emailMfaEnabled) {
        throw new BadRequest('Email MFA is not enabled on this account.')
      }

      const cooldown = await cache.get<string>(`auth:email-2fa:cooldown:${user.id}`)
      if (cooldown) {
        throw new TooManyRequests(
          'Please wait a moment before requesting another verification code.'
        )
      }

      const code = randomInt(100000, 1000000).toString()

      // Cache login code for 5 minutes (300 seconds)
      await cache.set(`auth:mfa-email-code:${user.id}`, code, 300)
      await cache.set(`auth:email-2fa:cooldown:${user.id}`, '1', 60)

      await EmailService.sendMfaVerificationEmail(user.email, code, 5)

      return {
        success: true,
        message: 'Verification code sent to registered email',
        email: maskEmail(user.email),
      }
    }

    // 2. Authenticated Resend Setup Flow
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        throw new NotFound(`User with ID '${userId}' was not found.`)
      }

      if (!user.email) {
        throw new BadRequest('No email address registered for this account.')
      }

      if (user.emailMfaEnabled) {
        throw new BadRequest(
          'Email two-factor authentication is already enabled on this account.'
        )
      }

      const cooldown = await cache.get<string>(`auth:email-2fa:cooldown:${user.id}`)
      if (cooldown) {
        throw new TooManyRequests(
          'Please wait a moment before requesting another verification code.'
        )
      }

      const code = randomInt(100000, 1000000).toString()

      await cache.set(
        `auth:email-2fa:setup:${user.id}`,
        { code, email: user.email },
        600
      )
      await cache.set(`auth:email-2fa:cooldown:${user.id}`, '1', 60)

      await EmailService.sendMfaVerificationEmail(user.email, code, 10)

      return {
        success: true,
        message: 'Verification code sent to registered email',
        email: maskEmail(user.email),
      }
    }

    throw new Unauthorized('Authentication required or valid mfaTicket required.')
  }

  /**
   * Verify 2FA email code.
   * Supports either:
   * 1. Login challenge: unauthenticated, provides `mfaTicket` and `code`.
   * 2. Setup verification: authenticated session, provides `code`.
   */
  static async verifyEmail2fa(
    userId?: string | null,
    body?: CarinaEmail2faModel['verifyBody']
  ) {
    if (!body || !body.code) {
      throw new BadRequest('Verification code is required.')
    }

    const cleanCode = body.code.trim()

    // 1. Unauthenticated Login Challenge Verification
    if (body.mfaTicket) {
      const ticketData = await cache.get<{ userId: string }>(
        `auth:mfa-ticket:${body.mfaTicket}`
      )

      if (!ticketData || !ticketData.userId) {
        throw new BadRequest('Invalid or expired MFA session ticket.')
      }

      const user = await prisma.user.findUnique({
        where: { id: ticketData.userId },
      })

      if (!user || !user.email) {
        throw new NotFound('User account not found.')
      }

      if (!user.emailMfaEnabled) {
        throw new BadRequest('Email MFA is not enabled on this account.')
      }

      const cachedCode = await cache.get<string>(`auth:mfa-email-code:${user.id}`)

      if (!cachedCode || cachedCode !== cleanCode) {
        throw new Unauthorized('Invalid verification code.')
      }

      // Cleanup single-use codes and ticket
      await cache.del(`auth:mfa-email-code:${user.id}`)
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

    // 2. Authenticated 2FA Setup Verification
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { passkeys: true },
      })

      if (!user) {
        throw new NotFound(`User with ID '${userId}' was not found.`)
      }

      const cachedSetup = await cache.get<{ code: string; email: string }>(
        `auth:email-2fa:setup:${user.id}`
      )

      if (!cachedSetup) {
        throw new BadRequest(
          'Email 2FA setup session expired or was not initiated. Please request a new verification code.'
        )
      }

      if (cachedSetup.code !== cleanCode) {
        throw new BadRequest('Invalid verification code.')
      }

      // Generate initial recovery backup codes if this is the first MFA method enabled
      let plainBackupCodes: string[] | undefined = undefined
      let hashedBackupCodes: string[] | undefined = undefined

      const otherMfaActive = user.TOTPEnabled || user.passkeys.length > 0
      if (!otherMfaActive && user.backupCodes.length === 0) {
        const generated = await generateBackupCodes()
        plainBackupCodes = generated.plain
        hashedBackupCodes = generated.hashed
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailMfaEnabled: true,
          ...(hashedBackupCodes ? { backupCodes: hashedBackupCodes } : {}),
        },
      })

      // Clean up caches
      await cache.del(`auth:email-2fa:setup:${user.id}`)
      await cache.del(`users:me:user:${user.id}`)
      await cache.del(`user:${user.id}`)

      return {
        success: true,
        message: 'Email two-factor authentication has been enabled',
        backupCodes: plainBackupCodes,
      }
    }

    throw new Unauthorized('Authentication required or valid mfaTicket required.')
  }

  /**
   * Remove Email 2FA from account.
   * Requires an authenticated session. Optionally accepts a confirmation password or verification code.
   */
  static async deleteEmail2fa(
    userId: string,
    body?: CarinaEmail2faModel['deleteBody'] | null
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    if (!user.emailMfaEnabled) {
      throw new BadRequest(
        'Email two-factor authentication is not currently enabled on this account.'
      )
    }

    // Optional confirmation verification
    if (body?.password) {
      if (user.passwordHash) {
        const isPasswordValid = await verifyPassword(body.password, user.passwordHash)
        if (!isPasswordValid) {
          throw new Unauthorized('Incorrect password confirmation.')
        }
      }
    }

    const remainingMfa = user.TOTPEnabled || user.passkeys.length > 0

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailMfaEnabled: false,
        ...(!remainingMfa ? { backupCodes: [] } : {}),
      },
    })

    // Invalidate user cache
    await cache.del(`users:me:user:${user.id}`)
    await cache.del(`user:${user.id}`)

    return {
      success: true,
      message: 'Email two-factor authentication has been disabled',
    }
  }
}

import { randomBytes } from 'node:crypto'
import { prisma, or, toDate, countOf } from '@Iris/db'
import { isReservedKeyword } from '@IRIS/shared'
import { IRISFlags } from '@IRIS/permissions'
import { cache } from '../../utils/cache'
import {
  hashPassword,
  verifyPassword,
  signUserJwt,
  generateUserKeypair,
  encryptPrivateKey,
  decryptPrivateKey,
} from '../../utils/auth-crypto'
import { BadRequest, Conflict, NotFound, Unauthorized } from '../../lib/errors'
import { EmailService } from '../email/email.serv'
import type { CarinaAuthModel } from '../../api/models/carina/auth.model'
import { getDomainConfig } from '../../utils/domain'
import { LogFactory } from '@Iris/logger'

const logger = new LogFactory('CarinaAuth')

/** In-memory cache tracking whether an administrator account already exists. */
let hasAdminCached: boolean | null = null

export abstract class CarinaAuthServ {
  /**
   * Authenticate a user via username/email and password.
   * Returns JWT session token or MFA challenge ticket if 2FA is active.
   */
  static async login(body: CarinaAuthModel['loginBody']) {
    const rawIdentifier = body.identifier.trim()
    const lowerIdentifier = rawIdentifier.toLowerCase()

    // 1. Locate user by username or email
    const user = await prisma.orm.public.User
      .where((u) => or(u.email.eq(lowerIdentifier), u.username.eq(rawIdentifier)))
      .include('passkeys')
      .first()

    if (!user) {
      throw new Unauthorized('No account was found with the provided identifier.')
    }

    // 2. Verify password
    const isPasswordValid = await verifyPassword(body.password, user.passwordHash)
    if (!isPasswordValid) {
      throw new Unauthorized('The password provided is incorrect for this account.')
    }

    // 3. Inspect MFA requirements
    const hasTotp = user.TOTPEnabled && Boolean(user.TOTPSecret)
    const hasEmail = user.emailMfaEnabled
    const hasPasskeys = user.passkeys.length > 0
    const isMfaActive = hasTotp || hasEmail || hasPasskeys

    if (isMfaActive) {
      const mfaTicket = `mfa_${randomBytes(24).toString('hex')}`

      // Cache ticket for 5 minutes (300 seconds)
      await cache.set(`auth:mfa-ticket:${mfaTicket}`, { userId: user.id }, 300)

      const allowedMfaTypes: ('totp' | 'email' | 'passkey')[] = []
      if (hasTotp) allowedMfaTypes.push('totp')
      if (hasEmail) allowedMfaTypes.push('email')
      if (hasPasskeys) allowedMfaTypes.push('passkey')

      return {
        success: true,
        mfaRequired: true,
        mfaTicket,
        allowedMfaTypes,
        user: null,
        token: null,
      }
    }

    // 4. Auto-upgrade user keys to standard RSA-2048 if missing or legacy and user has no stored ciphers
    if (
      !user.publicKey ||
      !user.publicKey.startsWith('-----BEGIN PUBLIC KEY-----') ||
      !user.encryptedPrivateKey
    ) {
      const hasCiphers = await prisma.orm.public.PassCipher
        .where({ userId: user.id })
        .first()
      if (!hasCiphers) {
        try {
          const { publicKey, encryptedPrivateKey } = await generateUserKeypair(body.password)
          await prisma.orm.public.User.where({ id: user.id }).update({
            publicKey,
            encryptedPrivateKey,
          })
          logger.info(`Auto-upgraded encryption keys to RSA-2048 for user ${user.username}`)
        } catch (keyErr) {
          logger.warn(`Failed to auto-upgrade keys for ${user.username}: ${keyErr}`)
        }
      }
    }

    // 5. Issue authenticated session token
    const token = await signUserJwt({
      ...user,
      permissions: [...user.permissions],
      username: user.username.trim(),
    })

    return {
      success: true,
      mfaRequired: false,
      mfaTicket: null,
      allowedMfaTypes: null,
      user: {
        id: user.id,
        username: user.username.trim(),
        email: user.email,
        passwordChangedAt: user.passwordChangedAt
          ? Math.floor(toDate(user.passwordChangedAt).getTime() / 1000)
          : null,
      },
      token,
    }
  }

  /**
   * Register a new user account with scrypt password and post-quantum keys.
   */
  static async register(body: CarinaAuthModel['registerBody']) {
    const cleanUsername = body.username.trim()
    const sanitizedUsername = cleanUsername.replace(/[^a-zA-Z0-9_]/g, '')
    const lowerUsername = sanitizedUsername.toLowerCase()
    const lowerEmail = body.email.trim().toLowerCase()

    if (sanitizedUsername.length < 3) {
      throw new BadRequest(
        'Username must contain at least 3 characters and only consist of alphanumeric characters or underscores.'
      )
    }

    // 1. Reserved keyword check from @IRIS/shared
    if (isReservedKeyword(lowerUsername)) {
      throw new Conflict(
        `The username '${sanitizedUsername}' is a reserved system or language keyword and cannot be registered.`
      )
    }

    // 2. Uniqueness check for username & email
    const conflicts = await prisma.orm.public.User
      .where((u) => or(u.email.eq(lowerEmail), u.username.eq(lowerUsername)))
      .select('email', 'username')
      .all()

    if (conflicts.length > 0) {
      const isEmailTaken = conflicts.some(
        (u) => u.email.trim().toLowerCase() === lowerEmail
      )
      const isUsernameTaken = conflicts.some(
        (u) => u.username.trim().toLowerCase() === lowerUsername
      )

      if (isEmailTaken && isUsernameTaken) {
        throw new Conflict(
          `Both the username '${sanitizedUsername}' and email address '${lowerEmail}' are already registered.`
        )
      } else if (isEmailTaken) {
        throw new Conflict(
          `An account with the email address '${lowerEmail}' already exists. Please sign in or use password recovery.`
        )
      } else {
        throw new Conflict(
          `The username '${sanitizedUsername}' is already taken. Please choose another username.`
        )
      }
    }

    // 3. Admin initialization check
    if (hasAdminCached === null) {
      const userCount = await countOf(prisma.orm.public.User)
      hasAdminCached = userCount > 0
    }

    const permissions: number[] = []
    if (!hasAdminCached) {
      permissions.push(Number(IRISFlags.ADMINISTRATOR))
      hasAdminCached = true
    }

    // 4. Secure password hash via scrypt
    const passwordHash = await hashPassword(body.password)

    // 5. Generate Post-Quantum (ML-KEM-768) keypair derived from account password
    const { publicKey, encryptedPrivateKey } = await generateUserKeypair(body.password)

    // 6. Persist user in database
    const user = await prisma.orm.public.User.create({
      username: sanitizedUsername,
      email: lowerEmail,
      passwordHash,
      permissions,
      publicKey,
      encryptedPrivateKey,
    })

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordChangedAt: null,
        publicKey: user.publicKey ?? null,
      },
    }
  }

  /**
   * Change user password for an authenticated session.
   */
  static async changePassword(
    userId: string,
    body: CarinaAuthModel['changePasswordBody']
  ) {
    const user = await prisma.orm.public.User.first({ id: userId })

    if (!user) {
      throw new NotFound(`User account with ID '${userId}' could not be found.`)
    }

    // 1. Verify existing password
    const isCurrentValid = await verifyPassword(
      body.currentPassword,
      user.passwordHash
    )

    if (!isCurrentValid) {
      throw new Unauthorized(
        'The current password entered is incorrect. Please verify and try again.'
      )
    }

    if (body.currentPassword === body.newPassword) {
      throw new BadRequest(
        'The new password cannot be identical to the current password.'
      )
    }

    // 2. Envelope re-encryption of post-quantum private key
    let updatedEncryptedPrivateKey = user.encryptedPrivateKey
    let updatedPublicKey = user.publicKey

    if (user.encryptedPrivateKey) {
      try {
        const decryptedSecret = await decryptPrivateKey(
          user.encryptedPrivateKey,
          body.currentPassword
        )
        updatedEncryptedPrivateKey = await encryptPrivateKey(
          decryptedSecret,
          body.newPassword
        )
      } catch {
        // If decryption fails, leave as-is
      }
    } else {
      const keypair = await generateUserKeypair(body.newPassword)
      updatedPublicKey = keypair.publicKey
      updatedEncryptedPrivateKey = keypair.encryptedPrivateKey
    }

    // 3. Hash new password and record passwordChangedAt
    const newHash = await hashPassword(body.newPassword)
    const now = new Date()

    await prisma.orm.public.User
      .where({ id: user.id })
      .update({
        passwordHash: newHash,
        publicKey: updatedPublicKey,
        encryptedPrivateKey: updatedEncryptedPrivateKey,
        passwordChangedAt: now,
      })

    return {
      success: true,
      message: 'Password changed successfully',
    }
  }

  /**
   * Request a password reset token.
   * Generates and caches the reset token for 15 minutes.
   * Email delivery service is intentionally empty as requested.
   */
  static async forgotPassword(body: CarinaAuthModel['forgotPasswordBody']) {
    const lowerEmail = body.email.trim().toLowerCase()

    // 1. Locate user account by email
    const user = await prisma.orm.public.User
      .where({ email: lowerEmail })
      .select('id', 'email')
      .first()

    if (user && user.email) {
      // 2. Generate secure 256-bit reset token
      const resetToken = randomBytes(32).toString('hex')

      // Cache token for 15 minutes (900 seconds)
      await cache.set(`auth:pwd-reset:${resetToken}`, user.id, 900)

      // 3. Dispatch reset link (empty service function as requested)
      await this.sendPasswordResetEmail(user.email, resetToken)
    }

    // Always return success response to prevent user enumeration
    return {
      success: true,
      message: 'Password recovery instructions sent to email',
    }
  }

  /**
   * Email delivery service for password resets via BullMQ queue.
   */
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<void> {
    const baseUrl = getDomainConfig().url
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`
    await EmailService.sendPasswordResetEmail(email, resetUrl, 15)
  }

  /**
   * Reset user password using a verified reset token from cache.
   */
  static async resetPassword(body: CarinaAuthModel['resetPasswordBody']) {
    // 1. Validate reset token from cache
    const userId = await cache.get<string>(`auth:pwd-reset:${body.token}`)

    if (!userId) {
      throw new BadRequest(
        'The password reset token is either invalid, has expired, or has already been used. Please request a new reset link.'
      )
    }

    // 2. Hash new password and generate fresh Post-Quantum keypair
    const newHash = await hashPassword(body.newPassword)
    const { publicKey, encryptedPrivateKey } = await generateUserKeypair(
      body.newPassword
    )
    const now = new Date()

    await prisma.orm.public.User
      .where({ id: userId })
      .update({
        passwordHash: newHash,
        publicKey,
        encryptedPrivateKey,
        passwordChangedAt: now,
      })

    // 3. Invalidate token immediately
    await cache.del(`auth:pwd-reset:${body.token}`)

    return {
      success: true,
      message: 'Password reset successfully',
    }
  }
}

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { prisma } from '@IRIS/database'
import { cache } from '../../utils/cache'
import { generateBackupCodes } from '../../utils/auth-crypto'
import { BadRequest, NotFound } from '../../lib/errors'
import type { CarinaPasskeysModel } from '../../api/models/carina/passkeys.model'

function getOriginAndRpId(request: Request) {
  const originHeader = request.headers.get('origin') || request.headers.get('referer')
  const allowedOrigins = new Set<string>()

  if (process.env.NEXTAUTH_URL) allowedOrigins.add(process.env.NEXTAUTH_URL)
  if (process.env.NEXT_PUBLIC_URL) allowedOrigins.add(process.env.NEXT_PUBLIC_URL)
  allowedOrigins.add('http://localhost:3000')
  allowedOrigins.add('http://127.0.0.1:3000')
  allowedOrigins.add('http://localhost:4000')

  if (originHeader) {
    try {
      const u = new URL(originHeader)
      allowedOrigins.add(`${u.protocol}//${u.host}`)
    } catch {}
  }

  let rpID = 'localhost'
  try {
    const primaryOrigin = originHeader || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const hostname = new URL(primaryOrigin).hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      rpID = 'localhost'
    } else if (process.env.RP_ID && process.env.RP_ID.trim()) {
      rpID = process.env.RP_ID.trim()
    } else {
      rpID = hostname
    }
  } catch {
    rpID = 'localhost'
  }

  return {
    expectedOrigin: Array.from(allowedOrigins),
    rpID,
  }
}

export abstract class CarinaPasskeysServ {
  /**
   * List registered passkeys for the user with pagination (10 per page default).
   */
  static async listPasskeys(
    userId: string,
    query: { page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10))
    const skip = (page - 1) * limit

    const [total, passkeys] = await Promise.all([
      prisma.passkey.count({
        where: { userId },
      }),
      prisma.passkey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          createdAt: true,
          transports: true,
        },
      }),
    ])

    return {
      success: true,
      total,
      page,
      limit,
      passkeys: passkeys.map((pk) => ({
        id: pk.id,
        name: pk.name,
        createdAt: pk.createdAt.toISOString(),
        transports: pk.transports,
      })),
    }
  }

  /**
   * Generate WebAuthn passkey registration options challenge.
   */
  static async createRegistrationChallenge(userId: string, request: Request) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    const { rpID } = getOriginAndRpId(request)

    const options = await generateRegistrationOptions({
      rpName: 'IRIS',
      rpID,
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.username,
      userDisplayName: user.username,
      excludeCredentials: user.passkeys.map((pk) => ({
        id: pk.id,
        type: 'public-key' as const,
        transports: pk.transports as any,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestationType: 'none',
    })

    // Cache challenge for 5 minutes (300 seconds)
    await cache.set(`auth:passkey-reg:${user.id}`, options.challenge, 300)

    return options
  }

  /**
   * Verify WebAuthn registration response and save new passkey.
   */
  static async verifyRegistration(
    userId: string,
    body: CarinaPasskeysModel['verifyBody'],
    request: Request
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    })

    if (!user) {
      throw new NotFound(`User with ID '${userId}' was not found.`)
    }

    // 1. Retrieve challenge from cache
    const expectedChallenge = await cache.get<string>(`auth:passkey-reg:${user.id}`)
    if (!expectedChallenge) {
      throw new BadRequest('Passkey registration challenge expired or not initiated.')
    }

    const { expectedOrigin, rpID } = getOriginAndRpId(request)

    // 2. Verify WebAuthn registration response
    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: body.passkeyResponse as any,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Passkey registration verification error'
      throw new BadRequest(msg)
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequest('Passkey registration verification failed.')
    }

    const {
      id: credentialID,
      publicKey: credentialPublicKey,
      counter,
      transports,
    } = verification.registrationInfo.credential

    // 3. Generate initial backup codes if this is user's first 2FA setup
    let backupCodes: string[] | undefined = undefined
    const isOtherMfaActive = user.TOTPEnabled || user.emailMfaEnabled
    if (!isOtherMfaActive && user.backupCodes.length === 0) {
      const generated = await generateBackupCodes()
      await prisma.user.update({
        where: { id: user.id },
        data: { backupCodes: generated.hashed },
      })
      backupCodes = generated.plain
    }

    // 4. Persist passkey in database
    await prisma.passkey.create({
      data: {
        id: credentialID,
        publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
        transports:
          transports ?? body.passkeyResponse.response?.transports ?? [],
        name: (body.name || '').trim() || 'Passkey',
        userId: user.id,
      },
    })

    // 5. Clean up cached challenge and user cache
    await cache.del(`auth:passkey-reg:${user.id}`)
    await cache.del(`users:me:user:${user.id}`)
    await cache.del(`user:${user.id}`)

    return {
      success: true,
      message: 'Passkey registered successfully',
      backupCodes,
    }
  }

  /**
   * Delete a registered passkey belonging to the user.
   */
  static async deletePasskey(userId: string, passkeyId: string) {
    const passkey = await prisma.passkey.findFirst({
      where: { id: passkeyId, userId },
    })

    if (!passkey) {
      throw new NotFound(`Passkey with ID '${passkeyId}' was not found.`)
    }

    await prisma.passkey.delete({
      where: { id: passkey.id },
    })

    // Check remaining MFA methods
    const remainingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    })

    if (remainingUser) {
      const remainingMfa =
        remainingUser.TOTPEnabled ||
        remainingUser.emailMfaEnabled ||
        remainingUser.passkeys.length > 0

      if (!remainingMfa && remainingUser.backupCodes.length > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { backupCodes: [] },
        })
      }
    }

    await cache.del(`users:me:user:${userId}`)
    await cache.del(`user:${userId}`)

    return {
      success: true,
      message: `Passkey '${passkeyId}' deleted successfully.`,
    }
  }
}

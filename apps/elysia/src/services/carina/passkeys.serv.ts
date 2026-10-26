import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { prisma, countOf, or, toDate } from '@Iris/db'
import { cache } from '../../utils/cache'
import { generateBackupCodes, signUserJwt } from '../../utils/auth-crypto'
import { BadRequest, NotFound } from '../../lib/errors'
import type { CarinaPasskeysModel } from '../../api/models/carina/passkeys.model'
import { getDomainConfig } from '../../utils/domain'

function getOriginAndRpId(request: Request) {
  const domainConfig = getDomainConfig()
  const originHeader = request.headers.get('origin') || request.headers.get('referer')
  const allowedOrigins = new Set<string>()

  allowedOrigins.add(domainConfig.origin)
  if (domainConfig.hostname === 'localhost' || domainConfig.hostname === '127.0.0.1') {
    allowedOrigins.add('http://localhost:3000')
    allowedOrigins.add('http://127.0.0.1:3000')
    allowedOrigins.add('http://localhost:4000')
  }

  if (originHeader) {
    try {
      const u = new URL(originHeader)
      allowedOrigins.add(`${u.protocol}//${u.host}`)
    } catch {}
  }

  return {
    expectedOrigin: Array.from(allowedOrigins),
    rpID: domainConfig.rpId,
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
      countOf(prisma.orm.public.Passkey.where({ userId })),
      prisma.orm.public.Passkey.where({ userId })
        .orderBy((pk) => pk.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .select('id', 'name', 'createdAt', 'transports')
        .all(),
    ])

    return {
      success: true,
      total,
      page,
      limit,
      passkeys: passkeys.map((pk) => ({
        id: pk.id,
        name: pk.name,
        createdAt: toDate(pk.createdAt).toISOString(),
        transports: [...pk.transports],
      })),
    }
  }

  /**
   * Generate WebAuthn passkey registration options challenge.
   */
  static async createRegistrationChallenge(userId: string, request: Request) {
    const user = await prisma.orm.public.User.where({ id: userId })
      .include('passkeys')
      .first()

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
   * Generate WebAuthn passkey authentication/login options challenge.
   */
  static async createLoginChallenge(
    body?: { identifier?: string },
    request?: Request
  ) {
    const { rpID } = getOriginAndRpId(request || new Request('http://localhost'))

    let allowCredentials: any[] | undefined = undefined

    if (body?.identifier) {
      const rawIdentifier = body.identifier.trim()
      const lowerIdentifier = rawIdentifier.toLowerCase()

      const user = await prisma.orm.public.User.where(
        (u) => or(u.email.eq(lowerIdentifier), u.username.eq(rawIdentifier))
      )
        .include('passkeys')
        .first()

      if (user && user.passkeys.length > 0) {
        allowCredentials = user.passkeys.map((pk) => ({
          id: pk.id,
          type: 'public-key' as const,
          transports: pk.transports as any,
        }))
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    })

    await cache.set(
      `auth:passkey-auth:${options.challenge}`,
      options.challenge,
      300
    )

    return {
      challenge: options.challenge,
      rpId: options.rpId ?? rpID,
      allowCredentials: options.allowCredentials?.map((cred) => ({
        id: cred.id,
        type: 'public-key' as const,
        transports: cred.transports,
      })),
      timeout: options.timeout ?? 60000,
      userVerification: options.userVerification,
    }
  }

  /**
   * Verify WebAuthn passkey authentication/login assertion response.
   */
  static async verifyLogin(
    body: { passkeyResponse: any },
    request: Request
  ) {
    if (!body?.passkeyResponse) {
      throw new BadRequest('Missing passkey response payload.')
    }

    const resp = body.passkeyResponse
    const credentialId = resp.id || resp.rawId
    if (!credentialId) {
      throw new BadRequest('Missing passkey credential ID.')
    }

    const passkey = await prisma.orm.public.Passkey.where({ id: credentialId })
      .include('user')
      .first()

    if (!passkey || !passkey.user) {
      throw new NotFound('Passkey credential not recognized on this server.')
    }

    const clientDataJSONB64 = resp.response?.clientDataJSON
    if (!clientDataJSONB64) {
      throw new BadRequest('Missing clientDataJSON in passkey assertion.')
    }

    let clientDataJSONString = ''
    try {
      clientDataJSONString = Buffer.from(clientDataJSONB64, 'base64url').toString('utf8')
    } catch {
      clientDataJSONString = Buffer.from(clientDataJSONB64, 'base64').toString('utf8')
    }

    let clientDataObj: any
    try {
      clientDataObj = JSON.parse(clientDataJSONString)
    } catch {
      throw new BadRequest('Invalid clientDataJSON format.')
    }

    const challenge = clientDataObj.challenge
    if (!challenge) {
      throw new BadRequest('Missing challenge in clientDataJSON.')
    }

    const expectedChallenge = await cache.get<string>(`auth:passkey-auth:${challenge}`)
    if (!expectedChallenge) {
      throw new BadRequest('Passkey authentication challenge expired or not found. Please try again.')
    }

    const { expectedOrigin, rpID } = getOriginAndRpId(request)

    let verification: any
    try {
      verification = await verifyAuthenticationResponse({
        response: resp,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(passkey.publicKey, 'base64url'),
          counter: passkey.counter,
          transports: passkey.transports as any,
        },
      })
    } catch (err: unknown) {
      // Multi-device passkeys (e.g. iCloud Keychain, Bitwarden, 1Password, Windows Hello)
      // often do not increment signature counters across synced devices. If the counter
      // check fails because it is static or equal, retry with counter: 0 to verify signature.
      if (err instanceof Error && err.message.includes('was lower than expected')) {
        try {
          verification = await verifyAuthenticationResponse({
            response: resp,
            expectedChallenge,
            expectedOrigin,
            expectedRPID: rpID,
            credential: {
              id: passkey.id,
              publicKey: Buffer.from(passkey.publicKey, 'base64url'),
              counter: 0,
              transports: passkey.transports as any,
            },
          })
        } catch (retryErr: unknown) {
          const msg = retryErr instanceof Error ? retryErr.message : 'Passkey assertion verification failed'
          throw new BadRequest(msg)
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Passkey assertion verification failed'
        throw new BadRequest(msg)
      }
    }

    if (!verification.verified) {
      throw new BadRequest('Passkey authentication verification failed.')
    }

    const newCounter = verification.authenticationInfo?.newCounter ?? passkey.counter
    await prisma.orm.public.Passkey.where({ id: passkey.id }).update({
      counter: Math.max(passkey.counter, newCounter),
    })

    await cache.del(`auth:passkey-auth:${challenge}`)

    // Issue authenticated JWT session token
    const pwdChangedAt = toDate(passkey.user.passwordChangedAt)
    const token = await signUserJwt({
      ...passkey.user,
      username: passkey.user.username.trim(),
      permissions: [...passkey.user.permissions],
      passwordChangedAt: pwdChangedAt,
    })

    return {
      success: true,
      token,
      user: {
        id: passkey.user.id,
        username: passkey.user.username,
        email: passkey.user.email,
        passwordChangedAt: pwdChangedAt
          ? Math.floor(pwdChangedAt.getTime() / 1000)
          : null,
      },
    }
  }

  /**
   * Verify WebAuthn registration response and save new passkey.
   */
  static async verifyRegistration(
    userId: string,
    body: CarinaPasskeysModel['verifyBody'],
    request: Request
  ) {
    const user = await prisma.orm.public.User.where({ id: userId })
      .include('passkeys')
      .first()

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
      await prisma.orm.public.User.where({ id: user.id }).update({
        backupCodes: generated.hashed,
      })
      backupCodes = generated.plain
    }

    // 4. Persist passkey in database
    await prisma.orm.public.Passkey.create({
      id: credentialID,
      publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter,
      transports:
        transports ?? body.passkeyResponse.response?.transports ?? [],
      name: (body.name || '').trim() || 'Passkey',
      userId: user.id,
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
    const passkey = await prisma.orm.public.Passkey.where({ id: passkeyId, userId }).first()

    if (!passkey) {
      throw new NotFound(`Passkey with ID '${passkeyId}' was not found.`)
    }

    await prisma.orm.public.Passkey.where({ id: passkey.id }).delete()

    // Check remaining MFA methods
    const remainingUser = await prisma.orm.public.User.where({ id: userId })
      .include('passkeys')
      .first()

    if (remainingUser) {
      const remainingMfa =
        remainingUser.TOTPEnabled ||
        remainingUser.emailMfaEnabled ||
        remainingUser.passkeys.length > 0

      if (!remainingMfa && remainingUser.backupCodes.length > 0) {
        await prisma.orm.public.User.where({ id: userId }).update({
          backupCodes: [],
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

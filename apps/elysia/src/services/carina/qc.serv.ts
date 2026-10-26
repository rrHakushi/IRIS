import { randomBytes } from 'node:crypto'
import { prisma, toDate } from '@IRIS/database'
import { cache } from '../../utils/cache'
import { signUserJwt } from '../../utils/auth-crypto'
import { BadRequest } from '../../lib/errors'
import type { CarinaQcModel } from '../../api/models/carina/qc.model'
import { getDomainConfig } from '../../utils/domain'

interface QuickConnectSessionData {
  status: 'pending' | 'approved'
  code: string
  deviceName: string
  userId: string | null
}

export abstract class CarinaQcServ {
  /**
   * Generate an 8-character human-readable pairing code and 256-bit polling session token.
   */
  static async generateSession(body?: CarinaQcModel['generateBody'] | null) {
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = randomBytes(8)
    let rawCode = ''
    for (let i = 0; i < 8; i++) {
      rawCode += CHARS[bytes[i]! % CHARS.length]
    }
    const code = `${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`

    // Generate private 256-bit unguessable polling session token
    const sessionToken = randomBytes(32).toString('hex')

    const baseUrl = getDomainConfig().url
    const qrPayload = `${baseUrl.replace(/\/$/, '')}/qc?code=${code}`

    const sessionData: QuickConnectSessionData = {
      status: 'pending',
      code,
      deviceName: body?.deviceName ?? 'Device',
      userId: null,
    }

    // Store pairing records in cache (300 seconds TTL)
    await Promise.all([
      cache.set(`auth:quickconnect:code:${code}`, sessionToken, 300),
      cache.set(`auth:quickconnect:session:${sessionToken}`, sessionData, 300),
    ])

    return {
      code,
      sessionToken,
      qrPayload,
      expiresIn: 300,
    }
  }

  /**
   * Approve a device pairing session using an authenticated user session.
   */
  static async approveSession(
    userId: string,
    body: CarinaQcModel['approveBody']
  ) {
    const raw = (body.code || '').trim().toUpperCase()
    const cleanNoDash = raw.replaceAll('-', '')
    const formattedCode =
      cleanNoDash.length === 8
        ? `${cleanNoDash.slice(0, 4)}-${cleanNoDash.slice(4, 8)}`
        : raw

    // 1. Resolve sessionToken from code
    const sessionToken =
      (await cache.get<string>(`auth:quickconnect:code:${formattedCode}`)) ||
      (await cache.get<string>(`auth:quickconnect:code:${raw}`))

    if (!sessionToken) {
      throw new BadRequest('Invalid or expired device pairing code.')
    }

    // 2. Fetch session data
    const sessionData = await cache.get<QuickConnectSessionData>(
      `auth:quickconnect:session:${sessionToken}`
    )

    if (!sessionData) {
      throw new BadRequest('Device pairing session expired.')
    }

    // 3. Mark session as approved with current user's ID
    await cache.set(
      `auth:quickconnect:session:${sessionToken}`,
      {
        ...sessionData,
        status: 'approved',
        userId,
      },
      300
    )

    // Delete the code lookup so it cannot be claimed twice
    await Promise.all([
      cache.del(`auth:quickconnect:code:${formattedCode}`),
      cache.del(`auth:quickconnect:code:${raw}`),
    ])

    return {
      success: true,
      message: 'Device approved successfully',
    }
  }

  /**
   * Poll quick connect pairing session status and retrieve JWT once approved.
   */
  static async checkStatus(sessionToken: string) {
    const sessionData = await cache.get<QuickConnectSessionData>(
      `auth:quickconnect:session:${sessionToken}`
    )

    if (!sessionData) {
      return {
        status: 'expired' as const,
        user: null,
        token: null,
      }
    }

    if (sessionData.status === 'pending' || !sessionData.userId) {
      return {
        status: 'pending' as const,
        user: null,
        token: null,
      }
    }

    // Fetch approving user
    const user = await prisma.orm.public.User.where({ id: sessionData.userId }).first()

    if (!user) {
      await cache.del(`auth:quickconnect:session:${sessionToken}`)
      return {
        status: 'expired' as const,
        user: null,
        token: null,
      }
    }

    // Keep session cached for 30s to allow client polling to consume token safely
    await cache.set(
      `auth:quickconnect:session:${sessionToken}`,
      sessionData,
      30
    )

    const passwordChangedDate = user.passwordChangedAt
      ? toDate(user.passwordChangedAt)
      : null

    // Issue JWT token
    const token = await signUserJwt({
      id: user.id,
      username: user.username.trim(),
      email: user.email,
      passwordChangedAt: passwordChangedDate,
      permissions: [...user.permissions],
    })

    return {
      status: 'approved' as const,
      user: {
        id: user.id,
        username: user.username.trim(),
        email: user.email,
        passwordChangedAt: passwordChangedDate
          ? Math.floor(passwordChangedDate.getTime() / 1000)
          : null,
      },
      token,
    }
  }
}

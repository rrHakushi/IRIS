import { Elysia } from 'elysia'
import { decode } from 'next-auth/jwt'
import { prisma as defaultPrisma, type PrismaClient } from '@IRIS/database'
import { Unauthorized } from '../lib/errors'
import { hashApiKey } from '../utils/auth-crypto'

export type DatabaseClient = PrismaClient

export interface SessionUser {
  id: string
  username: string
  email: string | null
  permissions: number[]
}

export class Session {
  readonly isAuthenticated: boolean
  readonly user: SessionUser | null
  readonly token: string | null

  constructor(user: SessionUser | null, token: string | null = null) {
    this.user = user
    this.isAuthenticated = user !== null
    this.token = token
  }

  getUser(): SessionUser | null {
    return this.user
  }

  requireUser(): SessionUser {
    if (!this.user) {
      throw new Unauthorized('Authentication required')
    }
    return this.user
  }
}

export const NEXTAUTH_SESSION_COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
  'session',
] as const

export async function resolveSessionFromRequest(
  request: Request,
  prisma: DatabaseClient = defaultPrisma
): Promise<{ user: SessionUser | null; token: string | null }> {
  const secret = process.env.NEXTAUTH_SECRET || 'iris-default-secret-key-32-chars!!'

  // 1. Try Authorization header Bearer token
  const authHeader = request.headers.get('authorization')
  let rawToken: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    rawToken = authHeader.slice(7).trim()
  }

  // 2. Try Cookies if no bearer header
  if (!rawToken) {
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [key, ...v] = c.trim().split('=')
          return [key, decodeURIComponent(v.join('='))]
        })
      )
      for (const name of NEXTAUTH_SESSION_COOKIE_NAMES) {
        if (cookies[name]) {
          rawToken = cookies[name]
          break
        }
      }
    }
  }

  if (!rawToken) {
    return { user: null, token: null }
  }

  try {
    const decoded = (await decode({ token: rawToken, secret })) as any
    if (!decoded || !decoded.id) {
      return { user: null, token: null }
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        permissions: true,
        passwordChangedAt: true,
      },
    })

    if (!dbUser) {
      return { user: null, token: null }
    }

    // Verify token validity against passwordChangedAt
    if (dbUser.passwordChangedAt && decoded.iat) {
      const pwdChangedSeconds = Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
      if (decoded.iat < pwdChangedSeconds) {
        return { user: null, token: null }
      }
    }

    return {
      user: {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        permissions: dbUser.permissions,
      },
      token: rawToken,
    }
  } catch {
    // JWT decoding failed, proceed to OAuth token resolution
  }

  // 2. Try OAuth 2.0 Bearer Token
  try {
    const oauthToken = await prisma.oAuthAccessToken.findUnique({
      where: { token: rawToken },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            permissions: true,
          },
        },
      },
    })

    if (
      oauthToken &&
      !oauthToken.revokedAt &&
      oauthToken.expiresAt.getTime() > Date.now()
    ) {
      return {
        user: {
          id: oauthToken.user.id,
          username: oauthToken.user.username.trim(),
          email: oauthToken.user.email,
          permissions: oauthToken.user.permissions,
        },
        token: rawToken,
      }
    }
  } catch {}

  // 3. Try API Key from headers (x-api-key, apikey, x-api, Authorization: ApiKey)
  const xApiKey =
    request.headers.get('x-api-key') ||
    request.headers.get('apikey') ||
    request.headers.get('x-api') ||
    (authHeader?.startsWith('ApiKey ') ? authHeader.slice(7).trim() : null)

  if (xApiKey && xApiKey.trim().length > 0) {
    try {
      const keyHash = hashApiKey(xApiKey.trim())
      const keyRecord = await prisma.apiKey.findFirst({
        where: { hash: keyHash },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              permissions: true,
            },
          },
        },
      })

      if (
        keyRecord &&
        (!keyRecord.expiresAt || keyRecord.expiresAt.getTime() > Date.now())
      ) {
        prisma.apiKey
          .update({
            where: { id: keyRecord.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => {})

        return {
          user: {
            id: keyRecord.user.id,
            username: keyRecord.user.username.trim(),
            email: keyRecord.user.email,
            permissions: keyRecord.user.permissions,
          },
          token: null,
        }
      }
    } catch {}
  }

  return { user: null, token: null }
}

export interface SessionPluginOptions {
  prisma?: DatabaseClient
}

/**
 * Elysia session plugin providing request-scoped session resolution.
 */
export const session = (options?: SessionPluginOptions) =>
  (app: Elysia) =>
    app.derive(async ({ request }) => {
      const { user, token } = await resolveSessionFromRequest(
        request,
        options?.prisma ?? defaultPrisma
      )
      return {
        session: new Session(user, token),
      }
    })



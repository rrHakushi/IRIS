import '../load-env'
import { Elysia } from 'elysia'
import { bearer } from '@elysia/bearer'
import { jwt } from '@elysia/jwt'
import { jwtVerify } from 'jose'
import { prisma as defaultPrisma, type PrismaClient, toDate } from '@IRIS/database'
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

/**
 * Resolves an authenticated user session from a Request.
 *
 * Supports:
 * 1. Bearer Token (`Authorization: Bearer <jwt>`)
 * 2. Session Cookie (`Cookie: session=<jwt>`)
 * 3. OAuth 2.0 Access Token (`Authorization: Bearer <oauth_token>`)
 * 4. API Key (`x-api-key`, `apikey`, `x-api`, `Authorization: ApiKey <key>`)
 */
export async function resolveSessionFromRequest(
  request: Request,
  prisma: DatabaseClient = defaultPrisma,
  injectedBearer?: string,
  injectedSessionCookie?: string
): Promise<{ user: SessionUser | null; token: string | null }> {
  const secret = Bun.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }

  const authHeader = request.headers.get('authorization')
  let rawToken: string | null = null

  // 1. Try Authorization header Bearer token
  if (injectedBearer && injectedBearer.trim().length > 0) {
    rawToken = injectedBearer.trim()
  } else if (authHeader?.startsWith('Bearer ')) {
    rawToken = authHeader.slice(7).trim()
  }

  // 2. Try session cookie if no Bearer header
  if (!rawToken) {
    if (injectedSessionCookie && injectedSessionCookie.trim().length > 0) {
      rawToken = injectedSessionCookie.trim()
    } else {
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map((c) => {
            const [key, ...v] = c.trim().split('=')
            return [key, decodeURIComponent(v.join('='))]
          })
        )
        if (cookies.session) {
          rawToken = cookies.session
        }
      }
    }
  }

  // If a token was provided, evaluate as JWT first, then OAuth token
  if (rawToken) {
    try {
      const secretKey = new TextEncoder().encode(secret)
      const { payload } = await jwtVerify(rawToken, secretKey)

      if (payload && payload.id) {
        const dbUser = await prisma.orm.public.User
          .select('id', 'username', 'email', 'permissions', 'passwordChangedAt')
          .first({ id: payload.id as string })

        if (dbUser) {
          let isRevoked = false
          if (dbUser.passwordChangedAt && payload.iat) {
            const pwdChangedSeconds = Math.floor(
              toDate(dbUser.passwordChangedAt).getTime() / 1000
            )
            if ((payload.iat as number) < pwdChangedSeconds) {
              isRevoked = true
            }
          }

          if (!isRevoked) {
            return {
              user: {
                id: dbUser.id,
                username: dbUser.username,
                email: dbUser.email,
                permissions: [...dbUser.permissions],
              },
              token: rawToken,
            }
          }
        }
      }
    } catch {
      // JWT decoding failed, proceed to OAuth token resolution
    }

    // Try OAuth 2.0 Bearer Token in DB
    try {
      const oauthToken = await prisma.orm.public.OAuthAccessToken
        .where({ token: rawToken })
        .include('user', (u) =>
          u.select('id', 'username', 'email', 'permissions')
        )
        .first()

      if (
        oauthToken &&
        oauthToken.user &&
        !oauthToken.revokedAt &&
        toDate(oauthToken.expiresAt).getTime() > Date.now()
      ) {
        return {
          user: {
            id: oauthToken.user.id,
            username: oauthToken.user.username.trim(),
            email: oauthToken.user.email,
            permissions: [...oauthToken.user.permissions],
          },
          token: rawToken,
        }
      }
    } catch {}
  }

  // 3. Try API Key from headers (x-api-key, apikey, x-api, Authorization: ApiKey)
  const xApiKey =
    request.headers.get('x-api-key') ||
    request.headers.get('apikey') ||
    request.headers.get('x-api') ||
    (authHeader?.startsWith('ApiKey ') ? authHeader.slice(7).trim() : null)

  if (xApiKey && xApiKey.trim().length > 0) {
    try {
      const keyHash = hashApiKey(xApiKey.trim())
      const keyRecord = await prisma.orm.public.ApiKey
        .where({ hash: keyHash })
        .include('user', (u) =>
          u.select('id', 'username', 'email', 'permissions')
        )
        .first()

      if (
        keyRecord &&
        keyRecord.user &&
        (!keyRecord.expiresAt || toDate(keyRecord.expiresAt).getTime() > Date.now())
      ) {
        prisma.orm.public.ApiKey
          .where({ id: keyRecord.id })
          .update({ lastUsedAt: new Date() })
          .catch(() => {})

        return {
          user: {
            id: keyRecord.user.id,
            username: keyRecord.user.username.trim(),
            email: keyRecord.user.email,
            permissions: [...keyRecord.user.permissions],
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
export const session = (options?: SessionPluginOptions) => {
  const secret = Bun.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }

  return new Elysia({ name: 'iris-session' })
    .use(bearer())
    .use(jwt({ name: 'jwt', secret, exp: '365d' }))
    .derive('global', async ({ request, bearer: bearerToken, cookie }) => {
      const { user, token } = await resolveSessionFromRequest(
        request,
        options?.prisma ?? defaultPrisma,
        bearerToken,
        cookie?.session?.value as string | undefined
      )
      return {
        session: new Session(user, token),
      }
    })
}

export default session

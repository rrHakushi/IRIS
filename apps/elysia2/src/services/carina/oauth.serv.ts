import { prisma } from '@IRIS/database'
import {
  SUPPORTED_SCOPES,
  parseScopes,
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  verifyClientSecret,
  verifyPkceChallenge,
  generateSecureToken,
  getIssuerUrl,
} from '../../utils/oauth'
import {
  BadRequest,
  Forbidden,
  NotFound,
  Unauthorized,
} from '../../lib/errors'
import type { SessionUser } from '../../plugins/session'
import type { CarinaOAuthModel } from '../../api/models/carina/oauth.model'

export abstract class CarinaOAuthServ {
  /**
   * RFC 8414 & OpenID Connect Discovery document.
   */
  static getOpenIdConfiguration() {
    const issuer = getIssuerUrl()
    return {
      issuer,
      authorization_endpoint: `${issuer}/carina/oauth/authorize`,
      token_endpoint: `${issuer}/carina/oauth/token`,
      userinfo_endpoint: `${issuer}/carina/oauth/userinfo`,
      revocation_endpoint: `${issuer}/carina/oauth/revoke`,
      introspection_endpoint: `${issuer}/carina/oauth/introspect`,
      registration_endpoint: `${issuer}/carina/oauth/register`,
      scopes_supported: [...SUPPORTED_SCOPES],
      response_types_supported: ['code'],
      grant_types_supported: [
        'authorization_code',
        'refresh_token',
        'client_credentials',
      ],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
    }
  }

  /**
   * RFC 8414 OAuth 2.0 Authorization Server Metadata.
   */
  static getOAuthAuthorizationServerMetadata() {
    const issuer = getIssuerUrl()
    return {
      issuer,
      authorization_endpoint: `${issuer}/carina/oauth/authorize`,
      token_endpoint: `${issuer}/carina/oauth/token`,
      revocation_endpoint: `${issuer}/carina/oauth/revoke`,
      introspection_endpoint: `${issuer}/carina/oauth/introspect`,
      registration_endpoint: `${issuer}/carina/oauth/register`,
      scopes_supported: [...SUPPORTED_SCOPES],
      response_types_supported: ['code'],
      grant_types_supported: [
        'authorization_code',
        'refresh_token',
        'client_credentials',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
    }
  }

  /**
   * Validate and retrieve client details for authorization prompt.
   */
  static async getAuthorize(
    query: CarinaOAuthModel['authorizeQuery'],
    sessionUser: SessionUser | null
  ) {
    const { client_id, redirect_uri, scope, state } = query

    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: client_id },
    })

    if (!client) {
      throw new NotFound(`OAuth application '${client_id}' was not found.`)
    }

    // Validate redirect URI against registered list if configured
    if (client.redirectUris.length > 0 && !client.redirectUris.includes(redirect_uri)) {
      throw new BadRequest(
        `The redirect URI '${redirect_uri}' is not registered for this client application.`
      )
    }

    const requestedScopes = parseScopes(scope)

    return {
      success: true,
      client: {
        id: client.id,
        clientId: client.clientId,
        name: client.name,
        description: client.description,
        logoUrl: client.logoUrl,
        websiteUrl: client.websiteUrl,
        isPublic: client.isPublic,
        isTrusted: client.isTrusted,
      },
      requestedScopes,
      redirectUri: redirect_uri,
      state: state || null,
      currentUser: sessionUser
        ? {
            id: sessionUser.id,
            username: sessionUser.username,
            email: sessionUser.email,
          }
        : null,
    }
  }

  /**
   * Process user consent and issue a single-use authorization code.
   */
  static async postAuthorize(
    body: CarinaOAuthModel['authorizeBody'],
    sessionUser: SessionUser
  ) {
    const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = body

    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: client_id },
    })

    if (!client) {
      throw new NotFound(`OAuth application '${client_id}' was not found.`)
    }

    if (client.redirectUris.length > 0 && !client.redirectUris.includes(redirect_uri)) {
      throw new BadRequest(
        `The redirect URI '${redirect_uri}' is not registered for this client application.`
      )
    }

    const requestedScopes = parseScopes(scope)

    // Record user consent for this client
    await prisma.oAuthConsent.upsert({
      where: {
        userId_clientId: {
          userId: sessionUser.id,
          clientId: client.id,
        },
      },
      update: {
        scopes: requestedScopes,
      },
      create: {
        userId: sessionUser.id,
        clientId: client.id,
        scopes: requestedScopes,
      },
    })

    // Generate single-use authorization code (10 minutes TTL)
    const authCode = generateSecureToken('iris_code_', 24)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.oAuthAuthorizationCode.create({
      data: {
        code: authCode,
        clientId: client.id,
        userId: sessionUser.id,
        redirectUri: redirect_uri,
        scopes: requestedScopes,
        codeChallenge: code_challenge || null,
        codeChallengeMethod: code_challenge_method || 'S256',
        expiresAt,
      },
    })

    // Construct callback redirect URI
    let redirectUrl: string
    try {
      const parsedUrl = new URL(redirect_uri)
      parsedUrl.searchParams.set('code', authCode)
      if (state) {
        parsedUrl.searchParams.set('state', state)
      }
      redirectUrl = parsedUrl.toString()
    } catch {
      const joiner = redirect_uri.includes('?') ? '&' : '?'
      const statePart = state ? `&state=${encodeURIComponent(state)}` : ''
      redirectUrl = `${redirect_uri}${joiner}code=${encodeURIComponent(authCode)}${statePart}`
    }

    return {
      success: true,
      code: authCode,
      redirectUrl,
      state: state || null,
    }
  }

  /**
   * RFC 6749 Token Endpoint: Exchange authorization code or refresh token.
   */
  static async postToken(
    body: CarinaOAuthModel['tokenBody'],
    authHeader?: string | null
  ) {
    let effectiveClientId = body.client_id
    let effectiveClientSecret = body.client_secret

    // Parse HTTP Basic Authentication (Authorization: Basic <base64>)
    if (authHeader && authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.slice(6).trim(), 'base64').toString('utf-8')
        const [u, p] = decoded.split(':')
        if (u && !effectiveClientId) effectiveClientId = u
        if (p && !effectiveClientSecret) effectiveClientSecret = p
      } catch {}
    }

    const { grant_type } = body

    // -------------------------------------------------------------------------
    // 1. Authorization Code Grant
    // -------------------------------------------------------------------------
    if (grant_type === 'authorization_code') {
      const { code, redirect_uri, code_verifier } = body

      if (!code) {
        throw new BadRequest("Missing required 'code' parameter.")
      }

      const authCode = await prisma.oAuthAuthorizationCode.findUnique({
        where: { code },
        include: { client: true, user: true },
      })

      if (!authCode) {
        throw new BadRequest('Invalid or expired authorization code.')
      }

      // Replay detection: Revoke all tokens if code is presented more than once
      if (authCode.usedAt !== null) {
        await prisma.oAuthAccessToken.updateMany({
          where: { clientId: authCode.clientId, userId: authCode.userId },
          data: { revokedAt: new Date() },
        })
        throw new BadRequest('Authorization code already used. Potential replay detected.')
      }

      if (authCode.expiresAt.getTime() < Date.now()) {
        throw new BadRequest('Authorization code has expired.')
      }

      if (redirect_uri && authCode.redirectUri !== redirect_uri) {
        throw new BadRequest('The redirect_uri provided does not match the authorization request.')
      }

      // Verify PKCE Challenge
      if (authCode.codeChallenge) {
        if (!code_verifier) {
          throw new BadRequest("Missing 'code_verifier' required for PKCE verification.")
        }
        const method = (authCode.codeChallengeMethod as 'S256' | 'plain') || 'S256'
        const isPkceValid = verifyPkceChallenge(code_verifier, authCode.codeChallenge, method)
        if (!isPkceValid) {
          throw new BadRequest('PKCE verification failed: code_verifier does not match challenge.')
        }
      }

      // Verify Client Credentials for confidential clients
      if (!authCode.client.isPublic && authCode.client.clientSecret) {
        if (!effectiveClientSecret || !verifyClientSecret(effectiveClientSecret, authCode.client.clientSecret)) {
          throw new Unauthorized('Client authentication failed.')
        }
      }

      // Mark authorization code as used
      await prisma.oAuthAuthorizationCode.update({
        where: { id: authCode.id },
        data: { usedAt: new Date() },
      })

      // Issue Bearer Access Token (30 days) and Refresh Token (90 days)
      const accessToken = generateSecureToken('iris_at_', 32)
      const refreshToken = generateSecureToken('iris_rt_', 32)
      const accessExpiresAt = new Date(Date.now() + 30 * 86400 * 1000)
      const refreshExpiresAt = new Date(Date.now() + 90 * 86400 * 1000)

      await Promise.all([
        prisma.oAuthAccessToken.create({
          data: {
            token: accessToken,
            clientId: authCode.clientId,
            userId: authCode.userId,
            scopes: authCode.scopes,
            expiresAt: accessExpiresAt,
          },
        }),
        prisma.oAuthRefreshToken.create({
          data: {
            token: refreshToken,
            clientId: authCode.clientId,
            userId: authCode.userId,
            scopes: authCode.scopes,
            expiresAt: refreshExpiresAt,
          },
        }),
      ])

      return {
        access_token: accessToken,
        token_type: 'Bearer' as const,
        expires_in: 30 * 86400,
        refresh_token: refreshToken,
        scope: authCode.scopes.join(' '),
      }
    }

    // -------------------------------------------------------------------------
    // 2. Refresh Token Grant
    // -------------------------------------------------------------------------
    if (grant_type === 'refresh_token') {
      const { refresh_token } = body
      if (!refresh_token) {
        throw new BadRequest("Missing 'refresh_token' parameter.")
      }

      const tokenRecord = await prisma.oAuthRefreshToken.findUnique({
        where: { token: refresh_token },
        include: { client: true },
      })

      if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt.getTime() < Date.now()) {
        throw new BadRequest('Invalid, expired, or revoked refresh token.')
      }

      const newAccessToken = generateSecureToken('iris_at_', 32)
      const newRefreshToken = generateSecureToken('iris_rt_', 32)
      const accessExpiresAt = new Date(Date.now() + 30 * 86400 * 1000)
      const refreshExpiresAt = new Date(Date.now() + 90 * 86400 * 1000)

      // Rotate refresh token
      await prisma.oAuthRefreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      })

      await Promise.all([
        prisma.oAuthAccessToken.create({
          data: {
            token: newAccessToken,
            clientId: tokenRecord.clientId,
            userId: tokenRecord.userId,
            scopes: tokenRecord.scopes,
            expiresAt: accessExpiresAt,
          },
        }),
        prisma.oAuthRefreshToken.create({
          data: {
            token: newRefreshToken,
            clientId: tokenRecord.clientId,
            userId: tokenRecord.userId,
            scopes: tokenRecord.scopes,
            expiresAt: refreshExpiresAt,
          },
        }),
      ])

      return {
        access_token: newAccessToken,
        token_type: 'Bearer' as const,
        expires_in: 30 * 86400,
        refresh_token: newRefreshToken,
        scope: tokenRecord.scopes.join(' '),
      }
    }

    // -------------------------------------------------------------------------
    // 3. Client Credentials Grant
    // -------------------------------------------------------------------------
    if (grant_type === 'client_credentials') {
      if (!effectiveClientId || !effectiveClientSecret) {
        throw new Unauthorized('Client ID and Client Secret are required.')
      }

      const client = await prisma.oAuthClient.findUnique({
        where: { clientId: effectiveClientId },
      })

      if (!client || !client.clientSecret || !verifyClientSecret(effectiveClientSecret, client.clientSecret)) {
        throw new Unauthorized('Invalid client credentials.')
      }

      const accessToken = generateSecureToken('iris_at_', 32)
      const accessExpiresAt = new Date(Date.now() + 30 * 86400 * 1000)
      const scopes = parseScopes(body.scope)

      await prisma.oAuthAccessToken.create({
        data: {
          token: accessToken,
          clientId: client.id,
          userId: client.userId,
          scopes,
          expiresAt: accessExpiresAt,
        },
      })

      return {
        access_token: accessToken,
        token_type: 'Bearer' as const,
        expires_in: 30 * 86400,
        scope: scopes.join(' '),
      }
    }

    throw new BadRequest(`Unsupported grant_type '${grant_type}'.`)
  }

  /**
   * OIDC UserInfo endpoint: returns identity claims for the authenticated subject.
   */
  static async getUserinfo(sessionUser: SessionUser) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        username: true,
        email: true,
        permissions: true,
      },
    })

    if (!user) {
      throw new NotFound('User profile not found.')
    }

    return {
      sub: user.id,
      id: user.id,
      username: user.username,
      name: user.username,
      email: user.email,
      email_verified: Boolean(user.email),
      permissions: user.permissions,
    }
  }

  /**
   * RFC 7009 Token Revocation endpoint.
   */
  static async postRevoke(body: CarinaOAuthModel['revokeBody']) {
    const { token } = body
    if (token) {
      await Promise.all([
        prisma.oAuthAccessToken.updateMany({
          where: { token },
          data: { revokedAt: new Date() },
        }),
        prisma.oAuthRefreshToken.updateMany({
          where: { token },
          data: { revokedAt: new Date() },
        }),
      ])
    }

    return {
      success: true,
      message: 'Token has been revoked',
    }
  }

  /**
   * RFC 7662 Token Introspection endpoint.
   */
  static async postIntrospect(body: CarinaOAuthModel['introspectBody']) {
    const { token } = body
    if (!token) {
      return { active: false }
    }

    // 1. Check access token
    const accessToken = await prisma.oAuthAccessToken.findUnique({
      where: { token },
      include: { client: true },
    })

    if (accessToken && !accessToken.revokedAt && accessToken.expiresAt.getTime() > Date.now()) {
      return {
        active: true,
        client_id: accessToken.client.clientId,
        sub: accessToken.userId,
        scope: accessToken.scopes.join(' '),
        exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
      }
    }

    // 2. Check refresh token
    const refreshToken = await prisma.oAuthRefreshToken.findUnique({
      where: { token },
      include: { client: true },
    })

    if (refreshToken && !refreshToken.revokedAt && refreshToken.expiresAt.getTime() > Date.now()) {
      return {
        active: true,
        client_id: refreshToken.client.clientId,
        sub: refreshToken.userId,
        scope: refreshToken.scopes.join(' '),
        exp: Math.floor(refreshToken.expiresAt.getTime() / 1000),
      }
    }

    return { active: false }
  }

  /**
   * RFC 7591 Dynamic Client Registration endpoint.
   */
  static async postRegisterClient(
    body: CarinaOAuthModel['registerClientBody'],
    sessionUser: SessionUser | null
  ) {
    let ownerUserId = sessionUser?.id

    if (!ownerUserId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } })
      if (!firstUser) {
        throw new BadRequest('No user accounts available to associate client registration.')
      }
      ownerUserId = firstUser.id
    }

    const clientId = generateClientId()
    const isPublic = Boolean(body.is_public)
    let rawSecret: string | undefined = undefined
    let hashedSecret: string | null = null

    if (!isPublic) {
      rawSecret = generateClientSecret()
      hashedSecret = hashClientSecret(rawSecret)
    }

    const scopes = parseScopes(body.scope)

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret: hashedSecret,
        name: body.client_name.trim(),
        redirectUris: body.redirect_uris,
        logoUrl: body.logo_uri || null,
        websiteUrl: body.client_uri || null,
        allowedScopes: scopes,
        isPublic,
        userId: ownerUserId,
      },
    })

    return {
      client_id: client.clientId,
      client_secret: rawSecret,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      scopes: client.allowedScopes,
    }
  }

  // ===========================================================================
  // Developer Apps Management
  // ===========================================================================

  static async listApps(userId: string) {
    const clients = await prisma.oAuthClient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      clients: clients.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        name: c.name,
        description: c.description,
        logoUrl: c.logoUrl,
        websiteUrl: c.websiteUrl,
        redirectUris: c.redirectUris,
        isPublic: c.isPublic,
        isTrusted: c.isTrusted,
        createdAt: c.createdAt.toISOString(),
      })),
    }
  }

  static async createApp(
    userId: string,
    body: CarinaOAuthModel['createAppBody']
  ) {
    const clientId = generateClientId()
    const isPublic = Boolean(body.isPublic)
    let rawSecret: string | undefined = undefined
    let hashedSecret: string | null = null

    if (!isPublic) {
      rawSecret = generateClientSecret()
      hashedSecret = hashClientSecret(rawSecret)
    }

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret: hashedSecret,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        redirectUris: body.redirectUris,
        logoUrl: body.logoUrl?.trim() || null,
        websiteUrl: body.websiteUrl?.trim() || null,
        allowedScopes: [...SUPPORTED_SCOPES],
        isPublic,
        userId,
      },
    })

    return {
      success: true,
      client: {
        id: client.id,
        clientId: client.clientId,
        clientSecret: rawSecret,
        name: client.name,
        description: client.description,
        logoUrl: client.logoUrl,
        websiteUrl: client.websiteUrl,
        redirectUris: client.redirectUris,
        isPublic: client.isPublic,
        isTrusted: client.isTrusted,
        createdAt: client.createdAt.toISOString(),
      },
    }
  }

  static async getApp(userId: string, idOrClientId: string) {
    const client = await prisma.oAuthClient.findFirst({
      where: {
        OR: [{ id: idOrClientId }, { clientId: idOrClientId }],
        userId,
      },
    })

    if (!client) {
      throw new NotFound(`OAuth application '${idOrClientId}' was not found.`)
    }

    return {
      success: true,
      client: {
        id: client.id,
        clientId: client.clientId,
        name: client.name,
        description: client.description,
        logoUrl: client.logoUrl,
        websiteUrl: client.websiteUrl,
        redirectUris: client.redirectUris,
        isPublic: client.isPublic,
        isTrusted: client.isTrusted,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
      },
    }
  }

  static async updateApp(
    userId: string,
    idOrClientId: string,
    body: CarinaOAuthModel['updateAppBody']
  ) {
    const client = await prisma.oAuthClient.findFirst({
      where: {
        OR: [{ id: idOrClientId }, { clientId: idOrClientId }],
        userId,
      },
    })

    if (!client) {
      throw new NotFound(`OAuth application '${idOrClientId}' was not found.`)
    }

    const updated = await prisma.oAuthClient.update({
      where: { id: client.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
        ...(body.redirectUris !== undefined ? { redirectUris: body.redirectUris } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl.trim() || null } : {}),
        ...(body.websiteUrl !== undefined ? { websiteUrl: body.websiteUrl.trim() || null } : {}),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      },
    })

    return {
      success: true,
      client: {
        id: updated.id,
        clientId: updated.clientId,
        name: updated.name,
        description: updated.description,
        logoUrl: updated.logoUrl,
        websiteUrl: updated.websiteUrl,
        redirectUris: updated.redirectUris,
        isPublic: updated.isPublic,
        isTrusted: updated.isTrusted,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    }
  }

  static async deleteApp(userId: string, idOrClientId: string) {
    const client = await prisma.oAuthClient.findFirst({
      where: {
        OR: [{ id: idOrClientId }, { clientId: idOrClientId }],
        userId,
      },
    })

    if (!client) {
      throw new NotFound(`OAuth application '${idOrClientId}' was not found.`)
    }

    await prisma.oAuthClient.delete({
      where: { id: client.id },
    })

    return {
      success: true,
      message: `OAuth application '${client.name}' deleted successfully.`,
    }
  }

  static async regenerateSecret(userId: string, idOrClientId: string) {
    const client = await prisma.oAuthClient.findFirst({
      where: {
        OR: [{ id: idOrClientId }, { clientId: idOrClientId }],
        userId,
      },
    })

    if (!client) {
      throw new NotFound(`OAuth application '${idOrClientId}' was not found.`)
    }

    const newSecret = generateClientSecret()
    const hashed = hashClientSecret(newSecret)

    await prisma.oAuthClient.update({
      where: { id: client.id },
      data: { clientSecret: hashed },
    })

    return {
      success: true,
      clientSecret: newSecret,
    }
  }

  // ===========================================================================
  // User Grants Management
  // ===========================================================================

  static async listAuthorizations(userId: string) {
    const consents = await prisma.oAuthConsent.findMany({
      where: { userId },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      authorizations: consents.map((c) => ({
        id: c.id,
        clientId: c.client.clientId,
        appName: c.client.name,
        appLogo: c.client.logoUrl,
        websiteUrl: c.client.websiteUrl,
        scopes: c.scopes,
        authorizedAt: c.createdAt.toISOString(),
      })),
    }
  }

  static async revokeAuthorization(userId: string, idOrClientId: string) {
    const consent = await prisma.oAuthConsent.findFirst({
      where: {
        userId,
        OR: [
          { id: idOrClientId },
          { client: { clientId: idOrClientId } },
          { clientId: idOrClientId },
        ],
      },
    })

    if (!consent) {
      throw new NotFound('User authorization grant not found.')
    }

    await Promise.all([
      prisma.oAuthConsent.delete({
        where: { id: consent.id },
      }),
      prisma.oAuthAccessToken.updateMany({
        where: { userId, clientId: consent.clientId },
        data: { revokedAt: new Date() },
      }),
      prisma.oAuthRefreshToken.updateMany({
        where: { userId, clientId: consent.clientId },
        data: { revokedAt: new Date() },
      }),
    ])

    return {
      success: true,
      message: 'Authorization grant and associated tokens have been revoked.',
    }
  }
}

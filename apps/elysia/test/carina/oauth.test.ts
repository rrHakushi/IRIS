import { describe, expect, it, beforeEach } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
import { Elysia } from 'elysia'
import { carinaOAuthDiscovery } from '../../src/api/controllers/carina/oauth-discovery.ctrl'
import { carinaOAuth } from '../../src/api/controllers/carina/oauth.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt, hashPassword } from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for OAuth 2.0 / OIDC
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string | null
  passwordHash: string
  permissions: number[]
  passwordChangedAt: Date | null
}

interface MockOAuthClient {
  id: string
  clientId: string
  clientSecret: string | null
  name: string
  description: string | null
  logoUrl: string | null
  websiteUrl: string | null
  redirectUris: string[]
  allowedScopes: string[]
  isPublic: boolean
  isTrusted: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
}

interface MockAuthCode {
  id: string
  code: string
  clientId: string
  userId: string
  redirectUri: string
  scopes: string[]
  codeChallenge: string | null
  codeChallengeMethod: string | null
  expiresAt: Date
  usedAt: Date | null
}

interface MockToken {
  id: string
  token: string
  clientId: string
  userId: string
  scopes: string[]
  expiresAt: Date
  revokedAt: Date | null
}

interface MockConsent {
  id: string
  userId: string
  clientId: string
  scopes: string[]
  createdAt: Date
  updatedAt: Date
}

let mockUsers: MockUser[] = []
let mockClients: MockOAuthClient[] = []
let mockCodes: MockAuthCode[] = []
let mockAccessTokens: MockToken[] = []
let mockRefreshTokens: MockToken[] = []
let mockConsents: MockConsent[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: 'user-alice-123',
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: '',
      permissions: [1],
      passwordChangedAt: null,
    },
    {
      id: 'user-bob-456',
      username: 'bob',
      email: 'bob@example.com',
      passwordHash: '',
      permissions: [0],
      passwordChangedAt: null,
    },
  ]

  mockClients = []
  mockCodes = []
  mockAccessTokens = []
  mockRefreshTokens = []
  mockConsents = []

  // User queries
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id || u.email === where.email) || null
  }
  ;(prisma.user.findFirst as any) = async () => {
    return mockUsers[0] || null
  }

  // OAuthClient queries
  ;(prisma.oAuthClient.findUnique as any) = async ({ where }: any) => {
    return mockClients.find((c) => c.id === where.id || c.clientId === where.clientId) || null
  }
  ;(prisma.oAuthClient.findFirst as any) = async ({ where }: any) => {
    return (
      mockClients.find((c) => {
        if (where.userId && c.userId !== where.userId) return false
        if (where.clientId && c.clientId !== where.clientId) return false
        if (where.OR) {
          return where.OR.some((cond: any) => cond.id === c.id || cond.clientId === c.clientId)
        }
        return true
      }) || null
    )
  }
  ;(prisma.oAuthClient.findMany as any) = async ({ where }: any) => {
    return mockClients.filter((c) => (where?.userId ? c.userId === where.userId : true))
  }
  ;(prisma.oAuthClient.create as any) = async ({ data }: any) => {
    const newClient: MockOAuthClient = {
      id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      description: null,
      logoUrl: null,
      websiteUrl: null,
      allowedScopes: [],
      isPublic: false,
      isTrusted: false,
      ...data,
    }
    mockClients.push(newClient)
    return newClient
  }
  ;(prisma.oAuthClient.update as any) = async ({ where, data }: any) => {
    const client = mockClients.find((c) => c.id === where.id)
    if (!client) throw new Error('Client not found')
    Object.assign(client, data, { updatedAt: new Date() })
    return client
  }
  ;(prisma.oAuthClient.delete as any) = async ({ where }: any) => {
    const idx = mockClients.findIndex((c) => c.id === where.id)
    if (idx !== -1) mockClients.splice(idx, 1)
    return { success: true }
  }

  // OAuthAuthorizationCode queries
  ;(prisma.oAuthAuthorizationCode.findUnique as any) = async ({ where }: any) => {
    const code = mockCodes.find((c) => c.code === where.code)
    if (!code) return null
    const client = mockClients.find((c) => c.id === code.clientId)!
    const user = mockUsers.find((u) => u.id === code.userId)!
    return { ...code, client, user }
  }
  ;(prisma.oAuthAuthorizationCode.create as any) = async ({ data }: any) => {
    const newCode: MockAuthCode = {
      id: `code-${Date.now()}`,
      usedAt: null,
      ...data,
    }
    mockCodes.push(newCode)
    return newCode
  }
  ;(prisma.oAuthAuthorizationCode.update as any) = async ({ where, data }: any) => {
    const code = mockCodes.find((c) => c.id === where.id)
    if (!code) throw new Error('Code not found')
    Object.assign(code, data)
    return code
  }

  // OAuthAccessToken queries
  ;(prisma.oAuthAccessToken.findUnique as any) = async ({ where, include }: any) => {
    const token = mockAccessTokens.find((t) => t.token === where.token)
    if (!token) return null
    if (include?.client) {
      const client = mockClients.find((c) => c.id === token.clientId)!
      return { ...token, client }
    }
    if (include?.user) {
      const user = mockUsers.find((u) => u.id === token.userId)!
      return { ...token, user }
    }
    return { ...token }
  }
  ;(prisma.oAuthAccessToken.create as any) = async ({ data }: any) => {
    const newToken: MockToken = {
      id: `at-${Date.now()}`,
      revokedAt: null,
      ...data,
    }
    mockAccessTokens.push(newToken)
    return newToken
  }
  ;(prisma.oAuthAccessToken.updateMany as any) = async ({ where, data }: any) => {
    let count = 0
    for (const t of mockAccessTokens) {
      if (where.token && t.token !== where.token) continue
      if (where.clientId && t.clientId !== where.clientId) continue
      if (where.userId && t.userId !== where.userId) continue
      Object.assign(t, data)
      count++
    }
    return { count }
  }

  // OAuthRefreshToken queries
  ;(prisma.oAuthRefreshToken.findUnique as any) = async ({ where, include }: any) => {
    const token = mockRefreshTokens.find((t) => t.token === where.token)
    if (!token) return null
    if (include?.client) {
      const client = mockClients.find((c) => c.id === token.clientId)!
      return { ...token, client }
    }
    return { ...token }
  }
  ;(prisma.oAuthRefreshToken.create as any) = async ({ data }: any) => {
    const newToken: MockToken = {
      id: `rt-${Date.now()}`,
      revokedAt: null,
      ...data,
    }
    mockRefreshTokens.push(newToken)
    return newToken
  }
  ;(prisma.oAuthRefreshToken.update as any) = async ({ where, data }: any) => {
    const token = mockRefreshTokens.find((t) => t.id === where.id)
    if (!token) throw new Error('Token not found')
    Object.assign(token, data)
    return token
  }
  ;(prisma.oAuthRefreshToken.updateMany as any) = async ({ where, data }: any) => {
    let count = 0
    for (const t of mockRefreshTokens) {
      if (where.token && t.token !== where.token) continue
      if (where.clientId && t.clientId !== where.clientId) continue
      if (where.userId && t.userId !== where.userId) continue
      Object.assign(t, data)
      count++
    }
    return { count }
  }

  // OAuthConsent queries
  ;(prisma.oAuthConsent.upsert as any) = async ({ where, create, update }: any) => {
    const existing = mockConsents.find(
      (c) => c.userId === where.userId_clientId.userId && c.clientId === where.userId_clientId.clientId
    )
    if (existing) {
      Object.assign(existing, update, { updatedAt: new Date() })
      return existing
    }
    const newConsent: MockConsent = {
      id: `consent-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...create,
    }
    mockConsents.push(newConsent)
    return newConsent
  }
  ;(prisma.oAuthConsent.findMany as any) = async ({ where }: any) => {
    return mockConsents
      .filter((c) => (where.userId ? c.userId === where.userId : true))
      .map((c) => {
        const client = mockClients.find((cli) => cli.id === c.clientId)!
        return { ...c, client }
      })
  }
  ;(prisma.oAuthConsent.findFirst as any) = async ({ where }: any) => {
    return (
      mockConsents.find((c) => {
        if (where.userId && c.userId !== where.userId) return false
        if (where.OR) {
          const client = mockClients.find((cli) => cli.id === c.clientId)
          return where.OR.some(
            (cond: any) =>
              cond.id === c.id ||
              cond.clientId === c.clientId ||
              (client && cond.client?.clientId === client.clientId)
          )
        }
        return true
      }) || null
    )
  }
  ;(prisma.oAuthConsent.delete as any) = async ({ where }: any) => {
    const idx = mockConsents.findIndex((c) => c.id === where.id)
    if (idx !== -1) mockConsents.splice(idx, 1)
    return { success: true }
  }
}

// -----------------------------------------------------------------------------
// Test App Initialization
// -----------------------------------------------------------------------------

const app = new Elysia()
  .onError(({ error, set }) => {
    if (isHttpError(error)) {
      set.status = error.status
      return error.toResponse()
    }
  })
  .use(carinaOAuthDiscovery)
  .use(carinaOAuth)

describe('Comprehensive Carina OAuth 2.0 & OIDC Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  const testPassword = 'AliceSuperPassword123!'

  beforeEach(async () => {
    setupPrismaMock()

    const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
    aliceUser.passwordHash = await hashPassword(testPassword)

    aliceToken = await signUserJwt({
      id: 'user-alice-123',
      username: 'alice',
      email: 'alice@example.com',
    })

    bobToken = await signUserJwt({
      id: 'user-bob-456',
      username: 'bob',
      email: 'bob@example.com',
    })
  })

  // ===========================================================================
  // 1. Discovery Endpoints (RFC Root Endpoints)
  // ===========================================================================
  describe('OpenID Connect & OAuth 2.0 Discovery', () => {
    it('GET /.well-known/openid-configuration returns valid OIDC discovery document', async () => {
      const res = await app.handle(
        new Request('http://localhost/.well-known/openid-configuration')
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.issuer).toBeDefined()
      expect(data.authorization_endpoint).toContain('/carina/oauth/authorize')
      expect(data.token_endpoint).toContain('/carina/oauth/token')
      expect(data.userinfo_endpoint).toContain('/carina/oauth/userinfo')
      expect(data.revocation_endpoint).toContain('/carina/oauth/revoke')
      expect(data.introspection_endpoint).toContain('/carina/oauth/introspect')
      expect(data.registration_endpoint).toContain('/carina/oauth/register')
      expect(data.code_challenge_methods_supported).toContain('S256')
      expect(data.scopes_supported).toContain('identify')
      expect(data.scopes_supported).toContain('profile')
    })

    it('GET /.well-known/oauth-authorization-server returns valid RFC 8414 metadata', async () => {
      const res = await app.handle(
        new Request('http://localhost/.well-known/oauth-authorization-server')
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.issuer).toBeDefined()
      expect(data.authorization_endpoint).toContain('/carina/oauth/authorize')
      expect(data.token_endpoint).toContain('/carina/oauth/token')
      expect(data.revocation_endpoint).toContain('/carina/oauth/revoke')
      expect(data.introspection_endpoint).toContain('/carina/oauth/introspect')
    })
  })

  // ===========================================================================
  // 2. Dynamic Client Registration (RFC 7591)
  // ===========================================================================
  describe('POST /carina/oauth/register', () => {
    it('creates a new OAuth application dynamically and issues credentials', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/oauth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_name: 'Test Client App',
            redirect_uris: ['https://clientapp.test/callback'],
            scope: 'identify profile lists:read',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.client_id).toMatch(/^iris_app_/)
      expect(data.client_secret).toMatch(/^iris_sec_/)
      expect(data.client_name).toBe('Test Client App')
      expect(data.redirect_uris).toEqual(['https://clientapp.test/callback'])
    })
  })

  // ===========================================================================
  // 3. OAuth Authorization Flow with PKCE
  // ===========================================================================
  describe('OAuth 2.0 Authorization Endpoint Flow', () => {
    let clientId: string
    let clientSecret: string
    const redirectUri = 'https://clientapp.test/callback'
    let codeVerifier: string
    let codeChallenge: string

    beforeEach(async () => {
      // Register test client app
      const regRes = await app.handle(
        new Request('http://localhost/carina/oauth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_name: 'PKCE Client App',
            redirect_uris: [redirectUri],
          }),
        })
      )
      const regData = await regRes.json()
      clientId = regData.client_id
      clientSecret = regData.client_secret

      // Generate PKCE code_verifier and S256 code_challenge
      codeVerifier = randomBytes(32).toString('base64url')
      codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    })

    it('GET /carina/oauth/authorize fails (404) for unknown client', async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/carina/oauth/authorize?client_id=iris_app_unknown&redirect_uri=${encodeURIComponent(
            redirectUri
          )}`
        )
      )
      expect(res.status).toBe(404)
    })

    it('GET /carina/oauth/authorize fails (400) for unregistered redirect_uri', async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/carina/oauth/authorize?client_id=${clientId}&redirect_uri=https://malicious.test/hack`
        )
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.detail).toContain('redirect URI')
    })

    it('GET /carina/oauth/authorize succeeds and returns client details and requested scopes', async () => {
      const res = await app.handle(
        new Request(
          `http://localhost/carina/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}&scope=identify%20lists:read&state=xyz123`,
          {
            headers: { authorization: `Bearer ${aliceToken}` },
          }
        )
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.client.clientId).toBe(clientId)
      expect(data.state).toBe('xyz123')
      expect(data.currentUser.username).toBe('alice')
      expect(data.requestedScopes).toContain('identify')
    })

    it('POST /carina/oauth/authorize fails (401) when user is unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/oauth/authorize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            redirect_uri: redirectUri,
          }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('POST /carina/oauth/authorize approves grant and issues single-use authorization code', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/oauth/authorize', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: 'identify profile email lists:write',
            state: 'state_token_777',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.code).toMatch(/^iris_code_/)
      expect(data.redirectUrl).toContain('code=' + encodeURIComponent(data.code))
      expect(data.redirectUrl).toContain('state=state_token_777')
    })

    it('Full authorization_code token exchange flow with PKCE and UserInfo retrieval', async () => {
      // 1. Authorize and obtain code
      const authRes = await app.handle(
        new Request('http://localhost/carina/oauth/authorize', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: 'identify profile email',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
          }),
        })
      )
      const authData = await authRes.json()
      const authCode = authData.code

      // 2. Exchange code at /carina/oauth/token (with correct code_verifier and client_secret)
      const tokenRes = await app.handle(
        new Request('http://localhost/carina/oauth/token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: authCode,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }),
        })
      )
      expect(tokenRes.status).toBe(200)
      const tokenData = await tokenRes.json()
      expect(tokenData.access_token).toMatch(/^iris_at_/)
      expect(tokenData.token_type).toBe('Bearer')
      expect(tokenData.refresh_token).toMatch(/^iris_rt_/)
      expect(tokenData.expires_in).toBeGreaterThan(0)

      // 3. UserInfo using issued access_token
      const userinfoRes = await app.handle(
        new Request('http://localhost/carina/oauth/userinfo', {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
        })
      )
      expect(userinfoRes.status).toBe(200)
      const userinfoData = await userinfoRes.json()
      expect(userinfoData.sub).toBe('user-alice-123')
      expect(userinfoData.username).toBe('alice')
      expect(userinfoData.email).toBe('alice@example.com')

      // 4. Introspect active access token
      const introRes = await app.handle(
        new Request('http://localhost/carina/oauth/introspect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: tokenData.access_token }),
        })
      )
      expect(introRes.status).toBe(200)
      const introData = await introRes.json()
      expect(introData.active).toBe(true)
      expect(introData.sub).toBe('user-alice-123')

      // 5. Replay Attack Prevention: Using same authCode again must fail
      const replayRes = await app.handle(
        new Request('http://localhost/carina/oauth/token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: authCode,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }),
        })
      )
      expect(replayRes.status).toBe(400)

      // 6. Refresh Token flow: Exchange refresh_token for fresh access token
      const refreshRes = await app.handle(
        new Request('http://localhost/carina/oauth/token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: tokenData.refresh_token,
          }),
        })
      )
      expect(refreshRes.status).toBe(200)
      const refreshData = await refreshRes.json()
      expect(refreshData.access_token).toMatch(/^iris_at_/)

      // 7. Revoke Token: Revoke access token
      const revokeRes = await app.handle(
        new Request('http://localhost/carina/oauth/revoke', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: tokenData.access_token }),
        })
      )
      expect(revokeRes.status).toBe(200)

      // Introspect again -> now inactive
      const postRevokeIntro = await app.handle(
        new Request('http://localhost/carina/oauth/introspect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: tokenData.access_token }),
        })
      )
      const postRevokeData = await postRevokeIntro.json()
      expect(postRevokeData.active).toBe(false)
    })
  })

  // ===========================================================================
  // 4. Developer Apps Management
  // ===========================================================================
  describe('Developer Apps Management (/carina/oauth/apps)', () => {
    let createdAppId: string

    it('POST /carina/oauth/apps creates new application with plaintext secret returned once', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/oauth/apps', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            name: 'Alice Dev App',
            description: 'My custom developer app',
            redirectUris: ['https://alice.app/callback'],
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.client.clientId).toMatch(/^iris_app_/)
      expect(data.client.clientSecret).toMatch(/^iris_sec_/)
      expect(data.client.name).toBe('Alice Dev App')
      createdAppId = data.client.id
    })

    it('GET /carina/oauth/apps lists developer applications', async () => {
      // Create an app first
      await app.handle(
        new Request('http://localhost/carina/oauth/apps', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            name: 'Alice App 2',
            redirectUris: ['https://alice2.app/callback'],
          }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/carina/oauth/apps', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.clients.length).toBeGreaterThanOrEqual(1)
      // Secrets must NOT be returned in list
      expect(data.clients[0].clientSecret).toBeUndefined()
    })

    it('GET /carina/oauth/apps/:id returns details of single app', async () => {
      const createRes = await app.handle(
        new Request('http://localhost/carina/oauth/apps', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            name: 'Target App',
            redirectUris: ['https://target.app/cb'],
          }),
        })
      )
      const createData = await createRes.json()

      const res = await app.handle(
        new Request(`http://localhost/carina/oauth/apps/${createData.client.id}`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.client.name).toBe('Target App')
    })

    it('PATCH /carina/oauth/apps/:id updates application configuration', async () => {
      const createRes = await app.handle(
        new Request('http://localhost/carina/oauth/apps', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            name: 'Original App Name',
            redirectUris: ['https://orig.app/cb'],
          }),
        })
      )
      const createData = await createRes.json()

      const updateRes = await app.handle(
        new Request(`http://localhost/carina/oauth/apps/${createData.client.id}`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            name: 'Updated App Name',
            description: 'New Description',
          }),
        })
      )
      expect(updateRes.status).toBe(200)
      const updateData = await updateRes.json()
      expect(updateData.client.name).toBe('Updated App Name')
      expect(updateData.client.description).toBe('New Description')
    })

    it('POST /carina/oauth/apps/:id/regenerate-secret rotates client secret', async () => {
      const createRes = await app.handle(
        new Request('http://localhost/carina/oauth/apps', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            name: 'Rotate App',
            redirectUris: ['https://rotate.app/cb'],
          }),
        })
      )
      const createData = await createRes.json()

      const res = await app.handle(
        new Request(`http://localhost/carina/oauth/apps/${createData.client.id}/regenerate-secret`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.clientSecret).toMatch(/^iris_sec_/)
      expect(data.clientSecret).not.toBe(createData.client.clientSecret)
    })

    it('DELETE /carina/oauth/apps/:id permanently deletes application', async () => {
      const createRes = await app.handle(
        new Request('http://localhost/carina/oauth/apps', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            name: 'To Delete App',
            redirectUris: ['https://del.app/cb'],
          }),
        })
      )
      const createData = await createRes.json()

      const delRes = await app.handle(
        new Request(`http://localhost/carina/oauth/apps/${createData.client.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)

      // Confirm 404
      const getRes = await app.handle(
        new Request(`http://localhost/carina/oauth/apps/${createData.client.id}`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(getRes.status).toBe(404)
    })
  })

  // ===========================================================================
  // 5. User Authorizations Management
  // ===========================================================================
  describe('User Authorizations Grants Management', () => {
    it('GET /carina/oauth/authorizations and DELETE /carina/oauth/authorizations/:id', async () => {
      // 1. Create client and authorize consent
      const regRes = await app.handle(
        new Request('http://localhost/carina/oauth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            client_name: 'Third-Party Reader',
            redirect_uris: ['https://thirdparty.test/cb'],
          }),
        })
      )
      const regData = await regRes.json()

      await app.handle(
        new Request('http://localhost/carina/oauth/authorize', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            client_id: regData.client_id,
            redirect_uri: 'https://thirdparty.test/cb',
            scope: 'identify profile lists:read',
          }),
        })
      )

      // 2. Query authorizations
      const authsRes = await app.handle(
        new Request('http://localhost/carina/oauth/authorizations', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(authsRes.status).toBe(200)
      const authsData = await authsRes.json()
      expect(authsData.authorizations.length).toBeGreaterThanOrEqual(1)
      const grant = authsData.authorizations.find((a: any) => a.clientId === regData.client_id)
      expect(grant).toBeDefined()
      expect(grant.appName).toBe('Third-Party Reader')

      // 3. Revoke authorization
      const revRes = await app.handle(
        new Request(`http://localhost/carina/oauth/authorizations/${grant.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(revRes.status).toBe(200)

      // Confirm revoked
      const afterRes = await app.handle(
        new Request('http://localhost/carina/oauth/authorizations', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      const afterData = await afterRes.json()
      expect(afterData.authorizations.find((a: any) => a.clientId === regData.client_id)).toBeUndefined()
    })
  })
})

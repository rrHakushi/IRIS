import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { carinaConnections } from '../../src/api/controllers/carina/connections.ctrl'
import { CarinaConnectionsServ } from '../../src/services/carina/connections.serv'
import {
  encryptConnectionData,
  decryptConnectionData,
  getConnectionAdapter,
  createOAuthStateToken,
} from '@IRIS/connections'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@Iris/db'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Connections and Users
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  passwordChangedAt: Date | null
}

interface MockConnection {
  id: string
  userId: string
  provider: any
  authType: any
  externalId: string | null
  displayName: string | null
  avatarUrl: string | null
  profileUrl: string | null
  encryptedData: string
  status: any
  errorMessage: string | null
  settings: any
  lastSyncedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

let mockUsers: MockUser[] = []
let mockConnections: MockConnection[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      passwordChangedAt: null,
    },
  ]

  mockConnections = []

  // Mock User findUnique
  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock Connection findUnique
  ;((prisma as any).connection.findUnique as any) = async ({ where }: any) => {
    return mockConnections.find((c) => c.id === where.id) ?? null
  }

  // Mock Connection findFirst
  ;((prisma as any).connection.findFirst as any) = async ({ where }: any) => {
    return (
      mockConnections.find((c) => {
        if (where.userId && c.userId !== where.userId) return false
        if (where.provider && c.provider !== where.provider) return false
        if (where.externalId && c.externalId !== where.externalId) return false
        return true
      }) ?? null
    )
  }

  // Mock Connection findMany
  ;((prisma as any).connection.findMany as any) = async ({
    where,
    orderBy,
    skip = 0,
    take = 10,
  }: any) => {
    let filtered = mockConnections.filter((c) => {
      if (where.userId && c.userId !== where.userId) return false
      if (where.provider && c.provider !== where.provider) return false
      if (where.status && c.status !== where.status) return false
      return true
    })

    if (orderBy?.createdAt === 'desc') {
      filtered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    return filtered.slice(skip, skip + take)
  }

  // Mock Connection count
  ;((prisma as any).connection.count as any) = async ({ where }: any) => {
    return mockConnections.filter((c) => {
      if (where.userId && c.userId !== where.userId) return false
      if (where.provider && c.provider !== where.provider) return false
      if (where.status && c.status !== where.status) return false
      return true
    }).length
  }

  // Mock Connection create
  ;((prisma as any).connection.create as any) = async ({ data }: any) => {
    const item: MockConnection = {
      id: `conn-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      userId: data.userId,
      provider: data.provider,
      authType: data.authType ?? 'OAUTH2',
      externalId: data.externalId ?? null,
      displayName: data.displayName ?? null,
      avatarUrl: data.avatarUrl ?? null,
      profileUrl: data.profileUrl ?? null,
      encryptedData: data.encryptedData,
      status: data.status ?? 'CONNECTED',
      errorMessage: data.errorMessage ?? null,
      settings: data.settings ?? null,
      lastSyncedAt: data.lastSyncedAt ?? null,
      expiresAt: data.expiresAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockConnections.push(item)
    return item
  }

  // Mock Connection update
  ;((prisma as any).connection.update as any) = async ({ where, data }: any) => {
    const item = mockConnections.find((c) => c.id === where.id)
    if (!item) throw new Error('Connection not found')

    if (data.encryptedData !== undefined) item.encryptedData = data.encryptedData
    if (data.status !== undefined) item.status = data.status
    if (data.errorMessage !== undefined) item.errorMessage = data.errorMessage
    if (data.settings !== undefined) item.settings = data.settings
    if (data.externalId !== undefined) item.externalId = data.externalId
    if (data.displayName !== undefined) item.displayName = data.displayName
    if (data.avatarUrl !== undefined) item.avatarUrl = data.avatarUrl
    if (data.profileUrl !== undefined) item.profileUrl = data.profileUrl
    if (data.lastSyncedAt !== undefined) item.lastSyncedAt = data.lastSyncedAt
    if (data.expiresAt !== undefined) item.expiresAt = data.expiresAt
    item.updatedAt = new Date()

    return item
  }

  // Mock Connection delete
  ;((prisma as any).connection.delete as any) = async ({ where }: any) => {
    const idx = mockConnections.findIndex((c) => c.id === where.id)
    if (idx === -1) throw new Error('Connection not found')
    const [deleted] = mockConnections.splice(idx, 1)
    return deleted
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
    if (error instanceof ValidationError) {
      set.status = 422
      return {
        type: 'validation',
        title: 'Unprocessable Content',
        status: 422,
        code: 'validation',
        detail: error.message,
      }
    }
  })
  .use(carinaConnections)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Carina Connected Accounts Test Suite', () => {
  let aliceToken: string
  let bobToken: string

  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'

  beforeEach(async () => {
    setupPrismaMock()

    aliceToken = await signUserJwt({
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
    })
    bobToken = await signUserJwt({
      id: BOB_ID,
      username: 'bob',
      email: 'bob@example.com',
    })
  })

  // ===========================================================================
  // 1. GET /carina/connections/providers (List available third-party providers)
  // ===========================================================================

  describe('GET /carina/connections/providers', () => {
    it('returns list of supported providers with capabilities and metadata', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/providers', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(Array.isArray(json.providers)).toBe(true)
      expect(json.total).toBeGreaterThanOrEqual(10)

      // Ensure key providers are registered
      const providerKeys = json.providers.map((p: any) => p.provider)
      expect(providerKeys).toContain('MAL')
      expect(providerKeys).toContain('ANILIST')
      expect(providerKeys).toContain('SIMKL')
      expect(providerKeys).toContain('BANGUMI')
      expect(providerKeys).toContain('STEAM')
      expect(providerKeys).toContain('SONARR')
      expect(providerKeys).toContain('RADARR')

      // Check schema shape
      const mal = json.providers.find((p: any) => p.provider === 'MAL')
      expect(mal.name).toBe('MyAnimeList')
      expect(mal.capabilities.supportsOAuth).toBe(true)
      expect(mal.capabilities.supportsSearch).toBe(true)
      expect(mal.capabilities.supportsLibrarySync).toBe(true)
    })
  })

  // ===========================================================================
  // 2. GET /carina/connections (List user connections with pagination)
  // ===========================================================================

  describe('GET /carina/connections', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections', { method: 'GET' })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('returns empty connections list when user has none', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.total).toBe(0)
      expect(json.connections).toEqual([])
      expect(json.pagination.page).toBe(1)
      expect(json.pagination.limit).toBe(10)
      expect(json.pagination.hasMore).toBe(false)
    })

    it('returns paginated connections strictly isolated to authenticated user', async () => {
      // Alice has 3 connections
      for (const p of ['MAL', 'ANILIST', 'STEAM'] as const) {
        await (prisma as any).connection.create({
          data: {
            userId: ALICE_ID,
            provider: p,
            encryptedData: encryptConnectionData({ token: `token-${p}` }, ALICE_ID),
            displayName: `Alice on ${p}`,
          },
        })
      }

      // Bob has 1 connection
      await (prisma as any).connection.create({
        data: {
          userId: BOB_ID,
          provider: 'MAL',
          encryptedData: encryptConnectionData({ token: 'bob-mal' }, BOB_ID),
          displayName: 'Bob on MAL',
        },
      })

      const res = await app.handle(
        new Request('http://localhost/carina/connections', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.total).toBe(3)
      expect(json.connections.length).toBe(3)
      // Verify raw encrypted tokens are never leaked
      for (const conn of json.connections) {
        expect((conn as any).encryptedData).toBeUndefined()
        expect(conn.userId).toBe(ALICE_ID)
      }

      // Bob only sees his 1 connection
      const bobRes = await app.handle(
        new Request('http://localhost/carina/connections', {
          method: 'GET',
          headers: { Authorization: `Bearer ${bobToken}` },
        })
      )
      const bobJson = await bobRes.json()
      expect(bobJson.total).toBe(1)
      expect(bobJson.connections[0].displayName).toBe('Bob on MAL')
    })

    it('filters connections by provider and status', async () => {
      await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'MAL',
          status: 'CONNECTED',
          encryptedData: encryptConnectionData({ t: 1 }, ALICE_ID),
        },
      })
      await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'STEAM',
          status: 'ERROR',
          errorMessage: 'Token expired',
          encryptedData: encryptConnectionData({ t: 2 }, ALICE_ID),
        },
      })

      const malRes = await app.handle(
        new Request('http://localhost/carina/connections?provider=MAL', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      const malJson = await malRes.json()
      expect(malJson.total).toBe(1)
      expect(malJson.connections[0].provider).toBe('MAL')

      const errRes = await app.handle(
        new Request('http://localhost/carina/connections?status=ERROR', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      const errJson = await errRes.json()
      expect(errJson.total).toBe(1)
      expect(errJson.connections[0].status).toBe('ERROR')
      expect(errJson.connections[0].errorMessage).toBe('Token expired')
    })

    it('fails (422) on invalid query parameters (e.g. limit > 50)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections?limit=100', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 3. GET /carina/connections/:connectionId (Get single connection info)
  // ===========================================================================

  describe('GET /carina/connections/:connectionId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/conn-123', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when connection ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/non-existent-id', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('fails (404) when trying to access another user connection', async () => {
      const bobConn = await (prisma as any).connection.create({
        data: {
          userId: BOB_ID,
          provider: 'MAL',
          encryptedData: encryptConnectionData({ t: 'bob' }, BOB_ID),
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/connections/${bobConn.id}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('returns single connection details strictly by UUID', async () => {
      const aliceConn = await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'MAL',
          externalId: '12345',
          displayName: 'AliceMAL',
          avatarUrl: 'https://example.com/mal.jpg',
          encryptedData: encryptConnectionData({ token: 'abc' }, ALICE_ID),
          settings: { librarySync: true },
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/connections/${aliceConn.id}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.connection.id).toBe(aliceConn.id)
      expect(json.connection.provider).toBe('MAL')
      expect(json.connection.displayName).toBe('AliceMAL')
      expect(json.connection.settings).toEqual({ librarySync: true })
    })
  })

  // ===========================================================================
  // 4. PATCH /carina/connections/:connectionId (Update connection settings)
  // ===========================================================================

  describe('PATCH /carina/connections/:connectionId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/conn-123', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { autoSync: false } }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when connection ID does not exist or belongs to another user', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/missing-conn-id', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ displayName: 'New Name' }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('updates connection settings and custom profile display info successfully', async () => {
      const conn = await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'MAL',
          displayName: 'Old Name',
          settings: { autoSync: true, scrobble: false },
          encryptedData: encryptConnectionData({ t: 1 }, ALICE_ID),
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/connections/${conn.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: 'Updated Alice MAL',
            settings: { scrobble: true },
          }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.connection.displayName).toBe('Updated Alice MAL')
      // Settings should be merged
      expect(json.connection.settings).toEqual({ autoSync: true, scrobble: true })
      expect(json.message).toBe('Connection updated successfully')
    })
  })

  // ===========================================================================
  // 5. DELETE /carina/connections/:connectionId (Disconnect account)
  // ===========================================================================

  describe('DELETE /carina/connections/:connectionId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/conn-123', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when connection ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/missing-id', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (404) when trying to delete another user connection', async () => {
      const bobConn = await (prisma as any).connection.create({
        data: {
          userId: BOB_ID,
          provider: 'MAL',
          encryptedData: encryptConnectionData({ t: 'bob' }, BOB_ID),
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/connections/${bobConn.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('disconnects and deletes connection record successfully', async () => {
      const conn = await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'MAL',
          encryptedData: encryptConnectionData({ t: 1 }, ALICE_ID),
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/connections/${conn.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(conn.id)
      expect(json.message).toBe('Connection disconnected successfully')

      // Verify it is gone
      const verifyRes = await app.handle(
        new Request(`http://localhost/carina/connections/${conn.id}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(verifyRes.status).toBe(404)
    })
  })

  // ===========================================================================
  // 6. GET /carina/connections/:connectionId/auth (Get OAuth initiation URL)
  // ===========================================================================

  describe('GET /carina/connections/:connectionId/auth', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/MAL/auth', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when target provider or connection ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/NONEXISTENT_PROVIDER/auth', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (400) when provider does not support OAuth (e.g. Radarr)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/RADARR/auth', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toContain('does not support OAuth')
    })

    it('generates OAuth initiation URL by provider identifier (e.g. MAL)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/MAL/auth', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.provider).toBe('MAL')
      expect(json.url).toContain('https://myanimelist.net/v1/oauth2/authorize')
      expect(json.state).toBeDefined()
    })

    it('generates OAuth initiation URL for an existing connection ID', async () => {
      const conn = await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'MAL',
          encryptedData: encryptConnectionData({ t: 'old' }, ALICE_ID),
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/connections/${conn.id}/auth`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.provider).toBe('MAL')
      expect(json.url).toContain('https://myanimelist.net/v1/oauth2/authorize')
    })
  })

  // ===========================================================================
  // 7. GET /carina/connections/:connectionId/callback (OAuth callback handler)
  // ===========================================================================

  describe('GET /carina/connections/:connectionId/callback', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/MAL/callback?code=123&state=xyz', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) when OAuth provider returns an error query parameter', async () => {
      const res = await app.handle(
        new Request(
          'http://localhost/carina/connections/MAL/callback?error=access_denied&error_description=User+denied+access',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${aliceToken}` },
          }
        )
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toBe('User denied access')
    })

    it('fails (400) when code or state parameter is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/MAL/callback', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toContain('Missing required OAuth code or state parameter')
    })

    it('fails (400) when state token is forged or invalid', async () => {
      const res = await app.handle(
        new Request(
          'http://localhost/carina/connections/MAL/callback?code=valid_code&state=forged.state',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${aliceToken}` },
          }
        )
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toBe('Invalid or expired OAuth state token')
    })

    it('fails (400) when state token belongs to a different user (CSRF prevention)', async () => {
      // Bob generates a state token
      const bobState = createOAuthStateToken({
        userId: BOB_ID,
        provider: 'MAL',
        redirectUri: 'http://localhost:4000/carina/connections/callback',
      })

      // Alice tries to use Bob's state token
      const res = await app.handle(
        new Request(
          `http://localhost/carina/connections/MAL/callback?code=some_code&state=${bobState}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${aliceToken}` },
          }
        )
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toBe('OAuth state user mismatch')
    })

    it('successfully processes callback, exchanges code, and saves encrypted connection', async () => {
      const adapter = getConnectionAdapter('MAL')

      // Mock exchangeAuthCode and getProfile on adapter
      const originalExchange = adapter.exchangeAuthCode
      const originalProfile = adapter.getProfile

      try {
        adapter.exchangeAuthCode = async () => ({
          accessToken: 'mock_mal_access_token_xyz',
          refreshToken: 'mock_mal_refresh_token_abc',
          expiresAt: new Date(Date.now() + 3600000),
          tokenType: 'Bearer',
        })

        adapter.getProfile = async () => ({
          id: 'mal_user_999',
          username: 'alice_in_mal',
          displayName: 'Alice MAL Profile',
          avatarUrl: 'https://example.com/avatar.jpg',
          profileUrl: 'https://myanimelist.net/profile/alice_in_mal',
        })

        const stateToken = createOAuthStateToken({
          userId: ALICE_ID,
          provider: 'MAL',
          redirectUri: 'http://localhost:4000/carina/connections/callback',
        })

        const res = await app.handle(
          new Request(
            `http://localhost/carina/connections/MAL/callback?code=mock_auth_code_123&state=${stateToken}`,
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${aliceToken}` },
            }
          )
        )
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(json.connection.provider).toBe('MAL')
        expect(json.connection.externalId).toBe('mal_user_999')
        expect(json.connection.displayName).toBe('Alice MAL Profile')
        expect(json.connection.status).toBe('CONNECTED')

        // Verify stored in DB with encrypted credentials
        const saved = mockConnections.find((c) => c.externalId === 'mal_user_999')
        expect(saved).toBeDefined()
        expect(saved?.userId).toBe(ALICE_ID)
        const decrypted = decryptConnectionData<any>(saved!.encryptedData, ALICE_ID)
        expect(decrypted.accessToken).toBe('mock_mal_access_token_xyz')
      } finally {
        adapter.exchangeAuthCode = originalExchange
        adapter.getProfile = originalProfile
      }
    })
  })

  // ===========================================================================
  // 8. POST /carina/connections/:connectionId/sync (Trigger manual sync)
  // ===========================================================================

  describe('POST /carina/connections/:connectionId/sync', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/conn-123/sync', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when connection ID does not exist or belongs to another user', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/missing-id/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('successfully syncs connection library and updates lastSyncedAt', async () => {
      const conn = await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'MAL',
          encryptedData: encryptConnectionData(
            { accessToken: 'mock_token' },
            ALICE_ID
          ),
        },
      })

      const adapter = getConnectionAdapter('MAL')
      const originalGetLibrary = adapter.getLibrary

      try {
        adapter.getLibrary = async () => [
          {
            id: '1',
            externalId: '52991',
            mediaType: 'ANIME',
            title: 'Sousou no Frieren',
            status: 'COMPLETED',
            progress: 28,
            score: 10,
            provider: 'MAL',
            updatedAt: new Date(),
          },
        ]

        const res = await app.handle(
          new Request(`http://localhost/carina/connections/${conn.id}/sync`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${aliceToken}` },
          })
        )
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(json.id).toBe(conn.id)
        expect(json.syncedItemsCount).toBe(1)
        expect(json.lastSyncedAt).toBeDefined()
        expect(json.message).toBe('Library synced successfully')

        // Verify DB update
        const updated = await (prisma as any).connection.findUnique({
          where: { id: conn.id },
        })
        expect(updated?.lastSyncedAt).toBeDefined()
        expect(updated?.status).toBe('CONNECTED')
      } finally {
        adapter.getLibrary = originalGetLibrary
      }
    })
  })

  // ===========================================================================
  // 9. POST /carina/connections/:connectionId/test (Test connection health)
  // ===========================================================================

  describe('POST /carina/connections/:connectionId/test', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/conn-123/test', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when connection ID does not exist or belongs to another user', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/connections/missing-id/test', {
          method: 'POST',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('tests connection successfully when credentials are valid', async () => {
      const conn = await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'MAL',
          encryptedData: encryptConnectionData(
            { accessToken: 'valid_token' },
            ALICE_ID
          ),
        },
      })

      const adapter = getConnectionAdapter('MAL')
      const originalTest = adapter.testConnection

      try {
        adapter.testConnection = async () => ({
          ok: true,
          message: 'Connection successful',
          profile: {
            id: 'mal_999',
            username: 'alice',
            displayName: 'Alice',
          },
        })

        const res = await app.handle(
          new Request(`http://localhost/carina/connections/${conn.id}/test`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${aliceToken}` },
          })
        )
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(json.ok).toBe(true)
        expect(json.status).toBe('CONNECTED')
        expect(json.message).toBe('Connection successful')
        expect(json.profile.username).toBe('alice')

        const updated = await (prisma as any).connection.findUnique({
          where: { id: conn.id },
        })
        expect(updated?.status).toBe('CONNECTED')
        expect(updated?.errorMessage).toBeNull()
      } finally {
        adapter.testConnection = originalTest
      }
    })

    it('updates connection status to ERROR when test fails', async () => {
      const conn = await (prisma as any).connection.create({
        data: {
          userId: ALICE_ID,
          provider: 'MAL',
          encryptedData: encryptConnectionData(
            { accessToken: 'expired_token' },
            ALICE_ID
          ),
        },
      })

      const adapter = getConnectionAdapter('MAL')
      const originalTest = adapter.testConnection

      try {
        adapter.testConnection = async () => ({
          ok: false,
          message: 'OAuth token has expired',
        })

        const res = await app.handle(
          new Request(`http://localhost/carina/connections/${conn.id}/test`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${aliceToken}` },
          })
        )
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(json.ok).toBe(false)
        expect(json.status).toBe('ERROR')
        expect(json.message).toBe('OAuth token has expired')

        const updated = await (prisma as any).connection.findUnique({
          where: { id: conn.id },
        })
        expect(updated?.status).toBe('ERROR')
        expect(updated?.errorMessage).toBe('OAuth token has expired')
      } finally {
        adapter.testConnection = originalTest
      }
    })
  })
})

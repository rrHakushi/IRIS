import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { carinaApiKeys } from '../../src/api/controllers/carina/apikeys.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt, hashApiKey } from '../../src/utils/auth-crypto'
import { prisma } from '@Iris/db'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for API Keys and Users
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string | null
  permissions: number[]
  passwordChangedAt: Date | null
}

interface MockApiKey {
  id: string
  userId: string
  name: string
  prefix: string
  hash: string
  createdAt: Date
  updatedAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
}

let mockUsers: MockUser[] = []
let mockApiKeys: MockApiKey[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: 'user-alice-123',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [1],
      passwordChangedAt: null,
    },
    {
      id: 'user-bob-456',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [0],
      passwordChangedAt: null,
    },
  ]

  mockApiKeys = []

  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  ;((prisma as any).apiKey.count as any) = async ({ where }: any) => {
    return mockApiKeys.filter((k) => k.userId === where.userId).length
  }

  ;((prisma as any).apiKey.findMany as any) = async ({ where, skip = 0, take = 10 }: any) => {
    return mockApiKeys
      .filter((k) => k.userId === where.userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(skip, skip + take)
  }

  ;((prisma as any).apiKey.findFirst as any) = async ({ where }: any) => {
    return (
      mockApiKeys.find((k) => {
        if (where.id && k.id !== where.id) return false
        if (where.userId && k.userId !== where.userId) return false
        return true
      }) ?? null
    )
  }

  ;((prisma as any).apiKey.create as any) = async ({ data }: any) => {
    const newKey: MockApiKey = {
      id: `key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: data.userId,
      name: data.name,
      prefix: data.prefix,
      hash: data.hash,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
      expiresAt: data.expiresAt ?? null,
    }
    mockApiKeys.push(newKey)
    return newKey
  }

  ;((prisma as any).apiKey.update as any) = async ({ where, data }: any) => {
    const key = mockApiKeys.find((k) => k.id === where.id)
    if (!key) throw new Error('Key not found')

    if (data.name !== undefined) key.name = data.name
    if (data.hash !== undefined) key.hash = data.hash
    if (data.prefix !== undefined) key.prefix = data.prefix
    if (data.lastUsedAt !== undefined) key.lastUsedAt = data.lastUsedAt
    if (data.expiresAt !== undefined) key.expiresAt = data.expiresAt
    key.updatedAt = new Date()

    return key
  }

  ;((prisma as any).apiKey.delete as any) = async ({ where }: any) => {
    const idx = mockApiKeys.findIndex((k) => k.id === where.id)
    if (idx === -1) throw new Error('Key not found')
    const [deleted] = mockApiKeys.splice(idx, 1)
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
  })
  .use(carinaApiKeys)

describe('Comprehensive Carina API Keys Test Suite', () => {
  let aliceToken: string
  let bobToken: string

  beforeEach(async () => {
    setupPrismaMock()
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
  // 1. GET /carina/auth/apikeys Scenarios
  // ===========================================================================
  describe('GET /carina/auth/apikeys', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
      expect(data.title).toBe('Unauthorized')
      expect(data.detail).toContain('Authentication required')
    })

    it('returns empty list for a user with no keys', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.total).toBe(0)
      expect(data.page).toBe(1)
      expect(data.limit).toBe(10)
      expect(data.apiKeys).toEqual([])
    })

    it('returns paginated keys (10 per page default)', async () => {
      // Create 15 keys for Alice
      for (let i = 1; i <= 15; i++) {
        mockApiKeys.push({
          id: `key-alice-${i}`,
          userId: 'user-alice-123',
          name: `Alice Key ${i}`,
          prefix: `iris-key-${i.toString().padStart(8, '0')}`,
          hash: hashApiKey(`raw-key-${i}`),
          createdAt: new Date(Date.now() + i * 1000),
          updatedAt: new Date(Date.now() + i * 1000),
          lastUsedAt: null,
          expiresAt: null,
        })
      }

      // Page 1 (default 10 items)
      const res1 = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res1.status).toBe(200)
      const data1 = await res1.json()
      expect(data1.success).toBe(true)
      expect(data1.total).toBe(15)
      expect(data1.page).toBe(1)
      expect(data1.limit).toBe(10)
      expect(data1.apiKeys.length).toBe(10)
      // Descending order by createdAt
      expect(data1.apiKeys[0].name).toBe('Alice Key 15')

      // Page 2 (remaining 5 items)
      const res2 = await app.handle(
        new Request('http://localhost/carina/auth/apikeys?page=2&limit=10', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res2.status).toBe(200)
      const data2 = await res2.json()
      expect(data2.total).toBe(15)
      expect(data2.page).toBe(2)
      expect(data2.apiKeys.length).toBe(5)
      expect(data2.apiKeys[4].name).toBe('Alice Key 1')
    })

    it('isolates user keys between accounts', async () => {
      // Alice creates 2 keys, Bob creates 1
      mockApiKeys.push(
        {
          id: 'key-alice-a',
          userId: 'user-alice-123',
          name: 'Alice Only',
          prefix: 'iris-key-alice000',
          hash: 'hash-a',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsedAt: null,
          expiresAt: null,
        },
        {
          id: 'key-bob-b',
          userId: 'user-bob-456',
          name: 'Bob Only',
          prefix: 'iris-key-bob00000',
          hash: 'hash-b',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsedAt: null,
          expiresAt: null,
        }
      )

      const aliceRes = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      const aliceData = await aliceRes.json()
      expect(aliceData.total).toBe(1)
      expect(aliceData.apiKeys[0].name).toBe('Alice Only')

      const bobRes = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      const bobData = await bobRes.json()
      expect(bobData.total).toBe(1)
      expect(bobData.apiKeys[0].name).toBe('Bob Only')
    })

    it('fails (422) on invalid query parameters (e.g. page < 1)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys?page=0', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 2. POST /carina/auth/apikeys Scenarios
  // ===========================================================================
  describe('POST /carina/auth/apikeys', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Production Scraper' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) when name is missing or empty string in payload', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: '' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when name consists only of whitespace', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: '     ' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('cannot be empty or contain only whitespace')
    })

    it('fails (422) when name exceeds 64 characters', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: 'A'.repeat(65) }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('successfully creates permanent API key without expiration', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: 'CLI Tool Key' }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.rawKey).toMatch(/^iris-key-[a-f0-9]{48}$/)
      expect(data.apiKey.name).toBe('CLI Tool Key')
      expect(data.apiKey.prefix).toBe(data.rawKey.slice(0, 17))
      expect(data.apiKey.expiresAt).toBeNull()
      expect(data.apiKey.lastUsedAt).toBeNull()

      // Verify stored in mock database with hash
      expect(mockApiKeys.length).toBe(1)
      expect(mockApiKeys[0]!.hash).toBe(hashApiKey(data.rawKey))
    })

    it('successfully creates expiring API key with expirationDays', async () => {
      const beforeTime = Date.now()
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: '30-Day Testing Key', expirationDays: 30 }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.apiKey.expiresAt).not.toBeNull()

      const expiresDate = new Date(data.apiKey.expiresAt!).getTime()
      const expectedMin = beforeTime + 30 * 24 * 60 * 60 * 1000 - 5000
      const expectedMax = beforeTime + 30 * 24 * 60 * 60 * 1000 + 5000
      expect(expiresDate).toBeGreaterThanOrEqual(expectedMin)
      expect(expiresDate).toBeLessThanOrEqual(expectedMax)
    })
  })

  // ===========================================================================
  // 3. PATCH /carina/auth/apikeys/:keyId Scenarios
  // ===========================================================================
  describe('PATCH /carina/auth/apikeys/:keyId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-123', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Renamed Key' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when keyId does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/nonexistent-key', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: 'Renamed Key' }),
        })
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.code).toBe('not-found')
      expect(data.detail).toContain('nonexistent-key')
    })

    it('fails (404) when attempting to update another user’s key (cross-user protection)', async () => {
      // Bob owns this key
      mockApiKeys.push({
        id: 'key-bob-secure',
        userId: 'user-bob-456',
        name: 'Bob Key',
        prefix: 'iris-key-bob12345',
        hash: 'hash-bob',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
      })

      // Alice tries to update Bob's key
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-bob-secure', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: 'Hacked Key' }),
        })
      )
      expect(res.status).toBe(404)
      expect(mockApiKeys[0]!.name).toBe('Bob Key') // Unchanged
    })

    it('fails (400) when updating with empty or whitespace name', async () => {
      mockApiKeys.push({
        id: 'key-alice-rename',
        userId: 'user-alice-123',
        name: 'Original Key',
        prefix: 'iris-key-alice123',
        hash: 'hash-alice',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
      })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-alice-rename', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: '   ' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
    })

    it('successfully renames API key', async () => {
      mockApiKeys.push({
        id: 'key-alice-rename',
        userId: 'user-alice-123',
        name: 'Old Label',
        prefix: 'iris-key-alice123',
        hash: 'hash-alice',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
      })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-alice-rename', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: 'New Cool Label' }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.apiKey.name).toBe('New Cool Label')
      expect(mockApiKeys[0]!.name).toBe('New Cool Label')
    })
  })

  // ===========================================================================
  // 4. DELETE /carina/auth/apikeys/:keyId Scenarios
  // ===========================================================================
  describe('DELETE /carina/auth/apikeys/:keyId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-123', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when key does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/nonexistent', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (404) when attempting to delete another user’s key', async () => {
      mockApiKeys.push({
        id: 'key-bob-delete-me',
        userId: 'user-bob-456',
        name: 'Bob Secret Key',
        prefix: 'iris-key-bob99999',
        hash: 'hash-bob-delete',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
      })

      // Alice tries to delete Bob's key
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-bob-delete-me', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      expect(mockApiKeys.length).toBe(1) // Still present
    })

    it('successfully deletes user API key', async () => {
      mockApiKeys.push({
        id: 'key-alice-to-delete',
        userId: 'user-alice-123',
        name: 'To Delete',
        prefix: 'iris-key-del00000',
        hash: 'hash-alice-delete',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
      })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-alice-to-delete', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('deleted successfully')
      expect(mockApiKeys.length).toBe(0)
    })
  })

  // ===========================================================================
  // 5. POST /carina/auth/apikeys/:keyId/regenerate Scenarios
  // ===========================================================================
  describe('POST /carina/auth/apikeys/:keyId/regenerate', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-123/regenerate', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when keyId does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/missing-key/regenerate', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.code).toBe('not-found')
    })

    it('fails (404) when attempting to regenerate another user’s key', async () => {
      mockApiKeys.push({
        id: 'key-bob-regen',
        userId: 'user-bob-456',
        name: 'Bob Regen Key',
        prefix: 'iris-key-bobregen1',
        hash: 'old-hash-bob',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: null,
      })

      // Alice tries to regenerate Bob's key
      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-bob-regen/regenerate', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      expect(mockApiKeys[0]!.hash).toBe('old-hash-bob') // Unchanged
    })

    it('successfully regenerates key, rolling new secret and clearing lastUsedAt', async () => {
      const oldUsedAt = new Date('2026-01-01T12:00:00Z')
      mockApiKeys.push({
        id: 'key-alice-regen',
        userId: 'user-alice-123',
        name: 'Active Sync Key',
        prefix: 'iris-key-oldprefix',
        hash: 'old-sha256-hash',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        lastUsedAt: oldUsedAt,
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/apikeys/key-alice-regen/regenerate', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.rawKey).toMatch(/^iris-key-[a-f0-9]{48}$/)
      expect(data.apiKey.id).toBe('key-alice-regen')
      expect(data.apiKey.name).toBe('Active Sync Key')
      expect(data.apiKey.prefix).toBe(data.rawKey.slice(0, 17))
      expect(data.apiKey.prefix).not.toBe('iris-key-oldprefix')
      expect(data.apiKey.lastUsedAt).toBeNull()
      expect(data.apiKey.expiresAt).toBe('2027-01-01T00:00:00.000Z')

      // Check DB entry updated
      const updatedInDb = mockApiKeys[0]!
      expect(updatedInDb.hash).toBe(hashApiKey(data.rawKey))
      expect(updatedInDb.hash).not.toBe('old-sha256-hash')
      expect(updatedInDb.prefix).toBe(data.apiKey.prefix)
      expect(updatedInDb.lastUsedAt).toBeNull()
    })
  })
})

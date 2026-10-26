import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { kiroshiHistory } from '../../src/api/controllers/kiroshi/history.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { encryptConnectionData } from '@IRIS/connections'
import { prisma } from '@Iris/db'

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  passwordChangedAt: Date | null
}

interface MockSearchHistory {
  id: string
  userId: string
  encryptedQuery: string
  category: string
  createdAt: Date
}

let mockUsers: MockUser[] = []
let mockHistories: MockSearchHistory[] = []

function setupPrismaMock() {
  mockHistories = []
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [],
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      passwordChangedAt: null,
    },
  ]

  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  ;((prisma as any).searchHistory.findMany as any) = async ({ where, orderBy, take }: any) => {
    let result = mockHistories.filter((h) => {
      if (where.userId && h.userId !== where.userId) return false
      if (where.createdAt?.gte && h.createdAt.getTime() < where.createdAt.gte.getTime()) {
        return false
      }
      return true
    })

    if (orderBy?.createdAt === 'desc') {
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    if (take) {
      result = result.slice(0, take)
    }

    return result
  }

  ;((prisma as any).searchHistory.deleteMany as any) = async ({ where }: any) => {
    const initialLen = mockHistories.length
    mockHistories = mockHistories.filter((h) => {
      if (where.userId && h.userId !== where.userId) return true
      if (where.id && h.id !== where.id) return true
      return false
    })
    return { count: initialLen - mockHistories.length }
  }
}

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
  .use(kiroshiHistory)

describe('Comprehensive Kiroshi Search History Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'

  beforeEach(async () => {
    Bun.env.JWT_SECRET = 'test-iris-secret-key-at-least-32-chars!'
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
  // 1. GET /kiroshi/history
  // ===========================================================================

  describe('GET /kiroshi/history', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/history', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('returns empty array when user has no search history', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/history', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.history).toEqual([])
    })

    it('decrypts stored queries, deduplicates identical terms, and isolates users', async () => {
      const t0 = new Date(Date.now() - 5000)
      const t1 = new Date(Date.now() - 2000)
      const t2 = new Date()

      mockHistories.push(
        {
          id: 'sh_1',
          userId: ALICE_ID,
          encryptedQuery: encryptConnectionData('elysiajs framework', ALICE_ID),
          category: 'general',
          createdAt: t0,
        },
        {
          id: 'sh_2',
          userId: ALICE_ID,
          encryptedQuery: encryptConnectionData('elysiajs framework', ALICE_ID), // Duplicate query
          category: 'general',
          createdAt: t1,
        },
        {
          id: 'sh_3',
          userId: ALICE_ID,
          encryptedQuery: encryptConnectionData('bun runtime benchmarks', ALICE_ID),
          category: 'it',
          createdAt: t2,
        },
        {
          id: 'sh_bob',
          userId: BOB_ID,
          encryptedQuery: encryptConnectionData('bob private search', BOB_ID),
          category: 'general',
          createdAt: t2,
        }
      )

      const res = await app.handle(
        new Request('http://localhost/kiroshi/history', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.history.length).toBe(2) // Deduplicated 'elysiajs framework' and 'bun runtime benchmarks'

      expect(data.history[0].query).toBe('bun runtime benchmarks')
      expect(data.history[0].category).toBe('it')
      expect(data.history[1].query).toBe('elysiajs framework')

      // Bob's record is excluded
      expect(data.history.find((h: any) => h.id === 'sh_bob')).toBeUndefined()
    })

    it('excludes entries older than 30 days', async () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
      mockHistories.push({
        id: 'sh_expired',
        userId: ALICE_ID,
        encryptedQuery: encryptConnectionData('ancient search', ALICE_ID),
        category: 'general',
        createdAt: fortyDaysAgo,
      })

      const res = await app.handle(
        new Request('http://localhost/kiroshi/history', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.history.length).toBe(0)
    })
  })

  // ===========================================================================
  // 2. DELETE /kiroshi/history
  // ===========================================================================

  describe('DELETE /kiroshi/history', () => {
    beforeEach(() => {
      mockHistories.push(
        {
          id: 'h_alice_1',
          userId: ALICE_ID,
          encryptedQuery: 'enc1',
          category: 'general',
          createdAt: new Date(),
        },
        {
          id: 'h_alice_2',
          userId: ALICE_ID,
          encryptedQuery: 'enc2',
          category: 'general',
          createdAt: new Date(),
        },
        {
          id: 'h_bob_1',
          userId: BOB_ID,
          encryptedQuery: 'enc_bob',
          category: 'general',
          createdAt: new Date(),
        }
      )
    })

    it('clears all history for authenticated user while leaving other users unaffected', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/history', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)

      // Alice's items cleared
      expect(mockHistories.filter((h) => h.userId === ALICE_ID).length).toBe(0)
      // Bob's items remain
      expect(mockHistories.filter((h) => h.userId === BOB_ID).length).toBe(1)
    })

    it('deletes specific history item when query ?id= is supplied', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/history?id=h_alice_1', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      expect(mockHistories.find((h) => h.id === 'h_alice_1')).toBeUndefined()
      expect(mockHistories.find((h) => h.id === 'h_alice_2')).toBeDefined()
    })
  })

  // ===========================================================================
  // 3. DELETE /kiroshi/history/:id
  // ===========================================================================

  describe('DELETE /kiroshi/history/:id', () => {
    it('fails (404) when history record does not exist or belongs to another user', async () => {
      mockHistories.push({
        id: 'h_bob_private',
        userId: BOB_ID,
        encryptedQuery: 'enc',
        category: 'general',
        createdAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/kiroshi/history/h_bob_private', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('successfully deletes specified individual history item by ID', async () => {
      mockHistories.push({
        id: 'h_alice_target',
        userId: ALICE_ID,
        encryptedQuery: 'enc',
        category: 'general',
        createdAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/kiroshi/history/h_alice_target', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(mockHistories.find((h) => h.id === 'h_alice_target')).toBeUndefined()
    })
  })
})

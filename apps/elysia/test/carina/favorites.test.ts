import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { carinaFavorites } from '../../src/api/controllers/carina/favorites.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Favorites and Users
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  customization: any
  passwordChangedAt: Date | null
}

interface MockFavorite {
  id: string
  userId: string
  type: string
  targetId: number
  createdAt: Date
}

let mockUsers: MockUser[] = []
let mockFavorites: MockFavorite[] = []

function setupPrismaMock() {
  mockFavorites = []
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [],
      customization: {},
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      customization: {},
      passwordChangedAt: null,
    },
  ]

  // Mock User findUnique
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock Favorite findUnique
  ;(prisma.favorite.findUnique as any) = async ({ where }: any) => {
    if (where.userId_type_targetId) {
      const key = where.userId_type_targetId
      return (
        mockFavorites.find(
          (f) =>
            f.userId === key.userId &&
            f.type === key.type &&
            f.targetId === key.targetId
        ) ?? null
      )
    }
    if (where.id) {
      return mockFavorites.find((f) => f.id === where.id) ?? null
    }
    return null
  }

  // Mock Favorite upsert
  ;(prisma.favorite.upsert as any) = async ({ where, create }: any) => {
    const key = where.userId_type_targetId
    const existing = mockFavorites.find(
      (f) =>
        f.userId === key.userId &&
        f.type === key.type &&
        f.targetId === key.targetId
    )
    if (existing) {
      return existing
    }
    const created: MockFavorite = {
      id: `fav-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      userId: create.userId,
      type: create.type,
      targetId: create.targetId,
      createdAt: new Date(),
    }
    mockFavorites.push(created)
    return created
  }

  // Mock Favorite delete
  ;(prisma.favorite.delete as any) = async ({ where }: any) => {
    const idx = mockFavorites.findIndex((f) => f.id === where.id)
    if (idx === -1) throw new Error('Favorite not found')
    const [deleted] = mockFavorites.splice(idx, 1)
    return deleted
  }
}

// -----------------------------------------------------------------------------
// Test App Initialization
// -----------------------------------------------------------------------------

const app = new Elysia()
  .error(({ error, set }) => {
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
  .use(carinaFavorites)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Carina Favorites Test Suite', () => {
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
  // 1. POST /carina/favorites (Add media to user favorites)
  // ===========================================================================
  describe('POST /carina/favorites', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ category: 'anime', targetId: 101 }),
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (400) when category and type are missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ targetId: 101 }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
      expect(json.detail).toBe('Category or type is required.')
    })

    it('fails (400) when given an invalid category', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ category: 'invalid_domain', targetId: 101 }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
      expect(json.detail).toContain("Invalid favorite category: 'invalid_domain'")
    })

    it('fails (422) when targetId is missing or invalid', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ category: 'anime' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('successfully adds media to user favorites strictly by IDs', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ category: 'anime', targetId: 101 }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.favorite.userId).toBe(ALICE_ID)
      expect(json.favorite.type).toBe('ANIME')
      expect(json.favorite.targetId).toBe(101)
      expect(json.favorite.id).toBeDefined()
      expect(mockFavorites.length).toBe(1)
    })

    it('supports alias `type` and handles hyphenated domains (e.g. music-album)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ type: 'music-album', targetId: 202 }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.favorite.type).toBe('MUSIC_ALBUM')
      expect(json.favorite.targetId).toBe(202)
    })

    it('is idempotent when user adds the same favorite multiple times', async () => {
      // First add
      await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ category: 'manga', targetId: 303 }),
        })
      )

      // Duplicate add
      const res = await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ category: 'manga', targetId: 303 }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.favorite.targetId).toBe(303)
      expect(mockFavorites.length).toBe(1)
    })
  })

  // ===========================================================================
  // 2. GET /carina/favorites/:category/:targetId (Check if target is in favorites)
  // ===========================================================================
  describe('GET /carina/favorites/:category/:targetId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites/anime/101', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (400) when given an invalid category in URL', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites/unknown_cat/101', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
    })

    it('returns isFavorite: false when item is not in favorites', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites/anime/999', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.isFavorite).toBe(false)
      expect(json.favorite).toBeNull()
    })

    it('returns isFavorite: true with details when item is favorited', async () => {
      // Add favorite
      await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ category: 'game', targetId: 404 }),
        })
      )

      // Check favorite
      const res = await app.handle(
        new Request('http://localhost/carina/favorites/game/404', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.isFavorite).toBe(true)
      expect(json.favorite).toBeDefined()
      expect(json.favorite.userId).toBe(ALICE_ID)
      expect(json.favorite.type).toBe('GAME')
      expect(json.favorite.targetId).toBe(404)
    })

    it('isolates favorites between different users', async () => {
      // Alice favorites anime 101
      await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ category: 'anime', targetId: 101 }),
        })
      )

      // Bob checks if anime 101 is in his favorites -> false
      const res = await app.handle(
        new Request('http://localhost/carina/favorites/anime/101', {
          method: 'GET',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.isFavorite).toBe(false)
      expect(json.favorite).toBeNull()
    })
  })

  // ===========================================================================
  // 3. DELETE /carina/favorites/:category/:targetId (Remove target from favorites)
  // ===========================================================================
  describe('DELETE /carina/favorites/:category/:targetId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites/anime/101', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (400) when given an invalid category', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites/invalid/101', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
    })

    it('fails (404) when attempting to remove an item not in favorites', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/favorites/anime/999', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('successfully removes media from favorites', async () => {
      // Add favorite
      await app.handle(
        new Request('http://localhost/carina/favorites', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ category: 'movie', targetId: 505 }),
        })
      )
      expect(mockFavorites.length).toBe(1)

      // Remove favorite
      const delRes = await app.handle(
        new Request('http://localhost/carina/favorites/movie/505', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)
      const delJson = await delRes.json()
      expect(delJson.success).toBe(true)
      expect(delJson.targetId).toBe(505)
      expect(delJson.category).toBe('MOVIE')
      expect(mockFavorites.length).toBe(0)

      // Subsequent check confirms it is gone
      const checkRes = await app.handle(
        new Request('http://localhost/carina/favorites/movie/505', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      const checkJson = await checkRes.json()
      expect(checkJson.isFavorite).toBe(false)
    })
  })
})

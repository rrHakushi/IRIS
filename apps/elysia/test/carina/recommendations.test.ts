import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { carinaRecommendations } from '../../src/api/controllers/carina/recommendations.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Recommendations, Votes, and Users
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  customization: any
  passwordChangedAt: Date | null
}

interface MockMediaRecommendation {
  id: number
  userId: string
  sourceType: string
  sourceId: number
  targetType: string
  targetId: number
  body: string | null
  upvotes: number
  downvotes: number
  score: number
  createdAt: Date
  updatedAt: Date
}

interface MockMediaRecommendationVote {
  id: number
  recommendationId: number
  userId: string
  voteType: 'UPVOTE' | 'DOWNVOTE'
  createdAt: Date
  updatedAt: Date
}

let mockUsers: MockUser[] = []
let mockRecommendations: MockMediaRecommendation[] = []
let mockRecommendationVotes: MockMediaRecommendationVote[] = []
let nextRecommendationId = 1
let nextVoteId = 1

const adminWord: number = Number(new IRISBitField().add(IRISFlags.ADMINISTRATOR).toArray()[0]) || 1

function setupPrismaMock() {
  nextRecommendationId = 1
  nextVoteId = 1
  mockRecommendations = []
  mockRecommendationVotes = []

  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [],
      customization: {
        profile: {
          displayName: 'Alice Wonderland',
          avatarUrl: 'https://example.com/alice.png',
        },
      },
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      customization: {
        profile: {
          displayName: 'Bob Builder',
          avatarUrl: 'https://example.com/bob.png',
        },
      },
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'charlie',
      email: 'charlie@example.com',
      permissions: [],
      customization: {
        profile: {
          displayName: null,
          avatarUrl: null,
        },
      },
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      username: 'admin',
      email: 'admin@example.com',
      permissions: [adminWord],
      customization: {},
      passwordChangedAt: null,
    },
  ]

  // Mock User findUnique
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock MediaRecommendation findUnique
  ;(prisma.mediaRecommendation.findUnique as any) = async ({ where }: any) => {
    return mockRecommendations.find((r) => r.id === where.id) ?? null
  }

  // Mock MediaRecommendation findFirst
  ;(prisma.mediaRecommendation.findFirst as any) = async ({ where }: any) => {
    return (
      mockRecommendations.find((r) => {
        if (where.id !== undefined && r.id !== where.id) return false
        if (where.userId && r.userId !== where.userId) return false
        return true
      }) ?? null
    )
  }

  // Mock MediaRecommendation count
  ;(prisma.mediaRecommendation.count as any) = async ({ where }: any) => {
    if (where?.OR && Array.isArray(where.OR)) {
      return mockRecommendations.filter((r) => {
        return where.OR.some((cond: any) => {
          if (cond.sourceType && (r.sourceType !== cond.sourceType || r.sourceId !== cond.sourceId)) {
            return false
          }
          if (cond.targetType && (r.targetType !== cond.targetType || r.targetId !== cond.targetId)) {
            return false
          }
          return true
        })
      }).length
    }
    return mockRecommendations.length
  }

  // Mock MediaRecommendation findMany
  ;(prisma.mediaRecommendation.findMany as any) = async ({
    where,
    skip = 0,
    take = 10,
    orderBy,
  }: any) => {
    let filtered = [...mockRecommendations]

    if (where?.OR && Array.isArray(where.OR)) {
      filtered = filtered.filter((r) => {
        return where.OR.some((cond: any) => {
          if (cond.sourceType && (r.sourceType !== cond.sourceType || r.sourceId !== cond.sourceId)) {
            return false
          }
          if (cond.targetType && (r.targetType !== cond.targetType || r.targetId !== cond.targetId)) {
            return false
          }
          return true
        })
      })
    }

    if (Array.isArray(orderBy)) {
      filtered.sort((a, b) => {
        for (const order of orderBy) {
          if (order.score) {
            const diff = order.score === 'desc' ? b.score - a.score : a.score - b.score
            if (diff !== 0) return diff
          }
          if (order.createdAt) {
            const diff =
              order.createdAt === 'desc'
                ? b.createdAt.getTime() - a.createdAt.getTime()
                : a.createdAt.getTime() - b.createdAt.getTime()
            if (diff !== 0) return diff
          }
        }
        return 0
      })
    }

    return filtered.slice(skip, skip + take).map((r) => {
      const user = mockUsers.find((u) => u.id === r.userId)!
      return {
        ...r,
        user,
      }
    })
  }

  // Mock MediaRecommendation upsert
  ;(prisma.mediaRecommendation.upsert as any) = async ({
    where,
    create,
    update,
  }: any) => {
    const key = where.userId_sourceType_sourceId_targetType_targetId
    let existingIndex = mockRecommendations.findIndex(
      (r) =>
        r.userId === key.userId &&
        r.sourceType === key.sourceType &&
        r.sourceId === key.sourceId &&
        r.targetType === key.targetType &&
        r.targetId === key.targetId
    )

    if (existingIndex >= 0) {
      const existing = mockRecommendations[existingIndex]!
      const updated: MockMediaRecommendation = {
        ...existing,
        body: update.body !== undefined ? update.body : existing.body,
        updatedAt: new Date(),
      }
      mockRecommendations[existingIndex] = updated
      const user = mockUsers.find((u) => u.id === updated.userId)!
      return { ...updated, user }
    } else {
      const created: MockMediaRecommendation = {
        id: nextRecommendationId++,
        userId: create.userId,
        sourceType: create.sourceType,
        sourceId: create.sourceId,
        targetType: create.targetType,
        targetId: create.targetId,
        body: create.body ?? null,
        upvotes: 0,
        downvotes: 0,
        score: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockRecommendations.push(created)
      const user = mockUsers.find((u) => u.id === created.userId)!
      return { ...created, user }
    }
  }

  // Mock MediaRecommendation update
  ;(prisma.mediaRecommendation.update as any) = async ({ where, data }: any) => {
    const idx = mockRecommendations.findIndex((r) => r.id === where.id)
    if (idx === -1) throw new Error('Recommendation not found')
    const rec = mockRecommendations[idx]!
    const updated = {
      ...rec,
      ...data,
      updatedAt: new Date(),
    }
    mockRecommendations[idx] = updated
    const user = mockUsers.find((u) => u.id === updated.userId)!
    return { ...updated, user }
  }

  // Mock MediaRecommendation delete
  ;(prisma.mediaRecommendation.delete as any) = async ({ where }: any) => {
    const idx = mockRecommendations.findIndex((r) => r.id === where.id)
    if (idx === -1) throw new Error('Recommendation not found')
    const [deleted] = mockRecommendations.splice(idx, 1)
    // Cascade delete votes
    mockRecommendationVotes = mockRecommendationVotes.filter(
      (v) => v.recommendationId !== deleted!.id
    )
    return deleted
  }

  // Mock MediaRecommendationVote findMany
  ;(prisma.mediaRecommendationVote.findMany as any) = async ({ where }: any) => {
    return mockRecommendationVotes.filter((v) => {
      if (where.recommendationId?.in && !where.recommendationId.in.includes(v.recommendationId)) {
        return false
      }
      if (where.userId && v.userId !== where.userId) return false
      return true
    })
  }

  // Mock MediaRecommendationVote count
  ;(prisma.mediaRecommendationVote.count as any) = async ({ where }: any) => {
    return mockRecommendationVotes.filter((v) => {
      if (where.recommendationId && v.recommendationId !== where.recommendationId) {
        return false
      }
      if (where.voteType && v.voteType !== where.voteType) return false
      return true
    }).length
  }

  // Mock MediaRecommendationVote upsert
  ;(prisma.mediaRecommendationVote.upsert as any) = async ({
    where,
    create,
    update,
  }: any) => {
    const key = where.recommendationId_userId
    const idx = mockRecommendationVotes.findIndex(
      (v) => v.recommendationId === key.recommendationId && v.userId === key.userId
    )
    if (idx >= 0) {
      const existing = mockRecommendationVotes[idx]!
      const updatedItem: MockMediaRecommendationVote = {
        ...existing,
        voteType: update.voteType,
        updatedAt: new Date(),
      }
      mockRecommendationVotes[idx] = updatedItem
      return updatedItem
    } else {
      const created: MockMediaRecommendationVote = {
        id: nextVoteId++,
        recommendationId: create.recommendationId,
        userId: create.userId,
        voteType: create.voteType,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockRecommendationVotes.push(created)
      return created
    }
  }

  // Mock MediaRecommendationVote deleteMany
  ;(prisma.mediaRecommendationVote.deleteMany as any) = async ({ where }: any) => {
    const initialCount = mockRecommendationVotes.length
    mockRecommendationVotes = mockRecommendationVotes.filter((v) => {
      if (where.recommendationId && v.recommendationId !== where.recommendationId) {
        return true
      }
      if (where.userId && v.userId !== where.userId) return true
      return false
    })
    return { count: initialCount - mockRecommendationVotes.length }
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
  .use(carinaRecommendations)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Carina Recommendations Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  let charlieToken: string
  let adminToken: string

  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'
  const CHARLIE_ID = '00000000-0000-0000-0000-000000000003'
  const ADMIN_ID = '00000000-0000-0000-0000-000000000004'

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

    charlieToken = await signUserJwt({
      id: CHARLIE_ID,
      username: 'charlie',
      email: 'charlie@example.com',
    })

    adminToken = await signUserJwt({
      id: ADMIN_ID,
      username: 'admin',
      email: 'admin@example.com',
    })
  })

  // ===========================================================================
  // 1. POST /carina/recommendations (Submit media recommendation)
  // ===========================================================================
  describe('POST /carina/recommendations', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceType: 'anime',
            sourceId: 101,
            targetType: 'manga',
            targetId: 202,
          }),
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (400) when given an invalid media type', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            sourceType: 'invalid_type',
            sourceId: 101,
            targetType: 'anime',
            targetId: 202,
          }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
      expect(json.detail).toContain("Invalid media type: 'invalid_type'")
    })

    it('fails (400) when attempting self-recommendation (same domain and same ID)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            sourceType: 'anime',
            sourceId: 101,
            targetType: 'anime',
            targetId: 101,
          }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
      expect(json.detail).toBe('Cannot recommend a media item to itself')
    })

    it('fails (422) when payload is missing required fields', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            sourceType: 'anime',
            // Missing sourceId, targetType, targetId
          }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('successfully submits a valid recommendation strictly by IDs', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            sourceType: 'anime',
            sourceId: 101,
            targetType: 'manga',
            targetId: 202,
            body: 'If you loved Steins;Gate anime, read the original manga or visual novel!',
          }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.recommendation.id).toBe(1)
      expect(json.recommendation.userId).toBe(ALICE_ID)
      expect(json.recommendation.sourceType).toBe('ANIME')
      expect(json.recommendation.sourceId).toBe(101)
      expect(json.recommendation.targetType).toBe('MANGA')
      expect(json.recommendation.targetId).toBe(202)
      expect(json.recommendation.body).toBe(
        'If you loved Steins;Gate anime, read the original manga or visual novel!'
      )
      expect(json.recommendation.upvotes).toBe(0)
      expect(json.recommendation.downvotes).toBe(0)
      expect(json.recommendation.score).toBe(0)
      expect(json.recommendation.author.id).toBe(ALICE_ID)
      expect(json.recommendation.author.username).toBe('alice')
      expect(json.recommendation.author.displayName).toBe('Alice Wonderland')
      expect(json.recommendation.author.avatarUrl).toBe('https://example.com/alice.png')
    })

    it('updates recommendation body if the user submits for the same media pair again (upsert)', async () => {
      // First submission
      await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            sourceType: 'anime',
            sourceId: 101,
            targetType: 'manga',
            targetId: 202,
            body: 'Initial thoughts',
          }),
        })
      )

      // Updated submission
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            sourceType: 'anime',
            sourceId: 101,
            targetType: 'manga',
            targetId: 202,
            body: 'Revised comprehensive explanation',
          }),
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.recommendation.id).toBe(1)
      expect(json.recommendation.body).toBe('Revised comprehensive explanation')
      expect(mockRecommendations.length).toBe(1)
    })
  })

  // ===========================================================================
  // 2. GET /carina/recommendations/:type/:id (Get recommendations for media)
  // ===========================================================================
  describe('GET /carina/recommendations/:type/:id', () => {
    it('fails (400) when given an invalid media type in URL', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/not-a-media/101', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
    })

    it('returns empty list when media has no recommendations', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/anime/999', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.total).toBe(0)
      expect(json.recommendations).toEqual([])
      expect(json.pagination.page).toBe(1)
      expect(json.pagination.limit).toBe(10)
      expect(json.pagination.hasMore).toBe(false)
    })

    it('returns recommendations where media is either source or target', async () => {
      // 1. Media is source: Anime 101 -> Manga 201
      await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            sourceType: 'anime',
            sourceId: 101,
            targetType: 'manga',
            targetId: 201,
            body: 'Anime 101 fans will love Manga 201',
          }),
        })
      )

      // 2. Media is target: Movie 301 -> Anime 101
      await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({
            sourceType: 'movie',
            sourceId: 301,
            targetType: 'anime',
            targetId: 101,
            body: 'Movie 301 fans should check out Anime 101',
          }),
        })
      )

      // 3. Unrelated recommendation: Manga 500 -> Manga 501
      await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${charlieToken}`,
          },
          body: JSON.stringify({
            sourceType: 'manga',
            sourceId: 500,
            targetType: 'manga',
            targetId: 501,
          }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/anime/101', {
          method: 'GET',
        })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.total).toBe(2)
      expect(json.recommendations.length).toBe(2)
      expect(json.recommendations[0].author.username).toBeDefined()
    })

    it('populates userVote when caller is authenticated', async () => {
      // Alice recommends Anime 101 -> Manga 201
      await app.handle(
        new Request('http://localhost/carina/recommendations', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            sourceType: 'anime',
            sourceId: 101,
            targetType: 'manga',
            targetId: 201,
          }),
        })
      )

      // Bob votes UPVOTE on recommendation #1
      await app.handle(
        new Request('http://localhost/carina/recommendations/1/vote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({ voteType: 'UPVOTE' }),
        })
      )

      // Bob queries recommendations -> userVote should be UPVOTE
      const bobRes = await app.handle(
        new Request('http://localhost/carina/recommendations/anime/101', {
          method: 'GET',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      const bobJson = await bobRes.json()
      expect(bobJson.recommendations[0].userVote).toBe('UPVOTE')

      // Charlie queries recommendations -> userVote should be null
      const charlieRes = await app.handle(
        new Request('http://localhost/carina/recommendations/anime/101', {
          method: 'GET',
          headers: { authorization: `Bearer ${charlieToken}` },
        })
      )
      const charlieJson = await charlieRes.json()
      expect(charlieJson.recommendations[0].userVote).toBeNull()

      // Unauthenticated query -> userVote should be null or omitted
      const anonRes = await app.handle(
        new Request('http://localhost/carina/recommendations/anime/101', {
          method: 'GET',
        })
      )
      const anonJson = await anonRes.json()
      expect(anonJson.recommendations[0].userVote).toBeNull()
    })

    it('paginates recommendations and sorts by highest score', async () => {
      // Create 3 recommendations with varying scores
      mockRecommendations = [
        {
          id: 1,
          userId: ALICE_ID,
          sourceType: 'ANIME',
          sourceId: 101,
          targetType: 'MANGA',
          targetId: 201,
          body: 'Low score',
          upvotes: 1,
          downvotes: 0,
          score: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
        {
          id: 2,
          userId: BOB_ID,
          sourceType: 'ANIME',
          sourceId: 101,
          targetType: 'MANGA',
          targetId: 202,
          body: 'High score',
          upvotes: 10,
          downvotes: 1,
          score: 9,
          createdAt: new Date('2026-01-02'),
          updatedAt: new Date('2026-01-02'),
        },
        {
          id: 3,
          userId: CHARLIE_ID,
          sourceType: 'ANIME',
          sourceId: 101,
          targetType: 'TV',
          targetId: 203,
          body: 'Medium score',
          upvotes: 5,
          downvotes: 0,
          score: 5,
          createdAt: new Date('2026-01-03'),
          updatedAt: new Date('2026-01-03'),
        },
      ]

      // Query page 1 with limit 2
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/anime/101?page=1&limit=2', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.total).toBe(3)
      expect(json.recommendations.length).toBe(2)
      expect(json.recommendations[0].score).toBe(9) // Rec 2
      expect(json.recommendations[1].score).toBe(5) // Rec 3
      expect(json.pagination.hasMore).toBe(true)

      // Query page 2 with limit 2
      const res2 = await app.handle(
        new Request('http://localhost/carina/recommendations/anime/101?page=2&limit=2', {
          method: 'GET',
        })
      )
      const json2 = await res2.json()
      expect(json2.recommendations.length).toBe(1)
      expect(json2.recommendations[0].score).toBe(1) // Rec 1
      expect(json2.pagination.hasMore).toBe(false)
    })

    it('fails (422) on invalid pagination limit (> 50)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/anime/101?limit=100', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 3. POST /carina/recommendations/:id/vote (Vote on recommendation)
  // ===========================================================================
  describe('POST /carina/recommendations/:id/vote', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/1/vote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ voteType: 'UPVOTE' }),
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (404) when recommendation ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/999/vote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ voteType: 'UPVOTE' }),
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('fails (422) on invalid voteType', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/1/vote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ voteType: 'SUPER_LIKE' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('successfully votes UPVOTE, switches to DOWNVOTE, and clears vote with NONE', async () => {
      // Create recommendation #1
      mockRecommendations = [
        {
          id: 1,
          userId: ALICE_ID,
          sourceType: 'ANIME',
          sourceId: 101,
          targetType: 'MANGA',
          targetId: 201,
          body: 'Great recommendation',
          upvotes: 0,
          downvotes: 0,
          score: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      // 1. Bob votes UPVOTE
      const upRes = await app.handle(
        new Request('http://localhost/carina/recommendations/1/vote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({ voteType: 'UPVOTE' }),
        })
      )
      expect(upRes.status).toBe(200)
      const upJson = await upRes.json()
      expect(upJson.success).toBe(true)
      expect(upJson.upvotes).toBe(1)
      expect(upJson.downvotes).toBe(0)
      expect(upJson.score).toBe(1)
      expect(upJson.userVote).toBe('UPVOTE')

      // 2. Bob changes his vote to DOWNVOTE
      const downRes = await app.handle(
        new Request('http://localhost/carina/recommendations/1/vote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({ voteType: 'DOWNVOTE' }),
        })
      )
      expect(downRes.status).toBe(200)
      const downJson = await downRes.json()
      expect(downJson.upvotes).toBe(0)
      expect(downJson.downvotes).toBe(1)
      expect(downJson.score).toBe(-1)
      expect(downJson.userVote).toBe('DOWNVOTE')

      // 3. Charlie also votes UPVOTE (net score becomes: 1 upvote, 1 downvote = score 0)
      const charlieRes = await app.handle(
        new Request('http://localhost/carina/recommendations/1/vote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${charlieToken}`,
          },
          body: JSON.stringify({ voteType: 'UPVOTE' }),
        })
      )
      const charlieJson = await charlieRes.json()
      expect(charlieJson.upvotes).toBe(1)
      expect(charlieJson.downvotes).toBe(1)
      expect(charlieJson.score).toBe(0)

      // 4. Bob clears his vote with NONE
      const noneRes = await app.handle(
        new Request('http://localhost/carina/recommendations/1/vote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({ voteType: 'NONE' }),
        })
      )
      expect(noneRes.status).toBe(200)
      const noneJson = await noneRes.json()
      expect(noneJson.upvotes).toBe(1)
      expect(noneJson.downvotes).toBe(0)
      expect(noneJson.score).toBe(1)
      expect(noneJson.userVote).toBeNull()
      expect(noneJson.message).toBe('Vote removed successfully')
    })
  })

  // ===========================================================================
  // 4. DELETE /carina/recommendations/:id (Delete recommendation)
  // ===========================================================================
  describe('DELETE /carina/recommendations/:id', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/1', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (404) when recommendation ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/999', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('fails (403) when user is not author and not administrator', async () => {
      // Alice owns recommendation #1
      mockRecommendations = [
        {
          id: 1,
          userId: ALICE_ID,
          sourceType: 'ANIME',
          sourceId: 101,
          targetType: 'MANGA',
          targetId: 201,
          body: 'Alice recommendation',
          upvotes: 0,
          downvotes: 0,
          score: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      // Bob attempts to delete Alice's recommendation
      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.code).toBe('forbidden')
      expect(json.detail).toBe(
        'You do not have permission to delete this recommendation'
      )
    })

    it('allows author to delete their own recommendation', async () => {
      mockRecommendations = [
        {
          id: 1,
          userId: ALICE_ID,
          sourceType: 'ANIME',
          sourceId: 101,
          targetType: 'MANGA',
          targetId: 201,
          body: 'Alice recommendation',
          upvotes: 0,
          downvotes: 0,
          score: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(1)
      expect(json.message).toBe('Recommendation deleted successfully')
      expect(mockRecommendations.length).toBe(0)
    })

    it('allows system administrator to delete any recommendation', async () => {
      mockRecommendations = [
        {
          id: 1,
          userId: ALICE_ID,
          sourceType: 'ANIME',
          sourceId: 101,
          targetType: 'MANGA',
          targetId: 201,
          body: 'Alice recommendation',
          upvotes: 0,
          downvotes: 0,
          score: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const res = await app.handle(
        new Request('http://localhost/carina/recommendations/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${adminToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(1)
      expect(mockRecommendations.length).toBe(0)
    })
  })
})

import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { carinaUsers } from '../../src/api/controllers/carina/users.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'
import { IRISFlags } from '@IRIS/permissions'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Users, Friends, Activity, Favorites, and Badges
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  customization: any
  settings: any
  permissions: number[]
  badges: number[]
  TOTPEnabled: boolean
  emailMfaEnabled: boolean
  publicKey: string | null
  passwordChangedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface MockUserBlock {
  id: string
  blockerId: string
  blockedId: string
  createdAt: Date
}

interface MockFriend {
  id: string
  userId: string
  friendId: string
  nickname: string | null
  isPrivate: boolean
  createdAt: Date
  updatedAt: Date
}

interface MockFriendRequest {
  id: string
  senderId: string
  receiverId: string
  message: string | null
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED'
  createdAt: Date
  updatedAt: Date
}

interface MockActivityLog {
  id: string
  userId: string
  type: string
  mediaType: string | null
  mediaId: number | null
  status: string | null
  progress: number | null
  progressVolumes: number | null
  score: number | null
  title: string | null
  content: string | null
  metadata: any
  isPrivate: boolean
  isSpoiler: boolean
  likeCount: number
  replyCount: number
  createdAt: Date
  updatedAt: Date
}

interface MockFavorite {
  id: string
  userId: string
  type: string
  targetId: number
  createdAt: Date
}

let mockUsers: MockUser[] = []
let mockUserBlocks: MockUserBlock[] = []
let mockFriends: MockFriend[] = []
let mockFriendRequests: MockFriendRequest[] = []
let mockActivityLogs: MockActivityLog[] = []
let mockFavorites: MockFavorite[] = []

let mockAnimeCount = 0
let mockMangaCount = 0
let mockMovieCount = 0
let mockTvCount = 0
let mockGameCount = 0
let mockBookCount = 0
let mockMusicCount = 0
let mockCustomListCount = 0

function setupPrismaMock() {
  const adminPermissionsWord = Number(IRISFlags.ADMINISTRATOR) // bit 0 = 1

  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      customization: {
        profile: {
          displayName: 'Alice Wonderland',
          bio: 'Exploring rabbit holes',
          avatarUrl: 'https://example.com/alice.png',
          bannerUrl: 'https://example.com/alice-banner.png',
          accentColor: '#f43f5e',
        },
      },
      settings: { theme: 'dark' },
      permissions: [0],
      badges: [1], // Badge 1: Owner
      TOTPEnabled: false,
      emailMfaEnabled: false,
      publicKey: null,
      passwordChangedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      customization: {
        profile: {
          displayName: 'Bob Builder',
          bio: 'Can we fix it? Yes we can!',
          avatarUrl: 'https://example.com/bob.png',
        },
      },
      settings: { notifications: true },
      permissions: [0],
      badges: [],
      TOTPEnabled: true,
      emailMfaEnabled: false,
      publicKey: 'test-public-key',
      passwordChangedAt: null,
      createdAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'admin',
      email: 'admin@example.com',
      customization: {
        profile: {
          displayName: 'System Admin',
        },
      },
      settings: {},
      permissions: [adminPermissionsWord],
      badges: [2], // Badge 2: Admin
      TOTPEnabled: false,
      emailMfaEnabled: false,
      publicKey: null,
      passwordChangedAt: null,
      createdAt: new Date('2026-01-03T00:00:00Z'),
      updatedAt: new Date('2026-01-03T00:00:00Z'),
    },
  ]

  mockUserBlocks = []
  mockFriends = []
  mockFriendRequests = []
  mockActivityLogs = []
  mockFavorites = []

  mockAnimeCount = 0
  mockMangaCount = 0
  mockMovieCount = 0
  mockTvCount = 0
  mockGameCount = 0
  mockBookCount = 0
  mockMusicCount = 0
  mockCustomListCount = 0

  // Mock User
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  ;(prisma.user.findFirst as any) = async ({ where }: any) => {
    return (
      mockUsers.find((u) => {
        if (where.id && u.id !== where.id) return false
        if (where.username) {
          if (where.username.equals) {
            const matches =
              u.username.toLowerCase() === where.username.equals.toLowerCase()
            if (!matches) return false
          }
        }
        if (where.email) {
          if (where.email.equals) {
            const matches =
              u.email.toLowerCase() === where.email.equals.toLowerCase()
            if (!matches) return false
          }
        }
        if (where.NOT) {
          if (where.NOT.id && u.id === where.NOT.id) return false
        }
        return true
      }) ?? null
    )
  }

  ;(prisma.user.findMany as any) = async ({ where, skip = 0, take = 10 }: any) => {
    let list = [...mockUsers]
    if (where?.username?.contains) {
      const q = where.username.contains.toLowerCase()
      list = list.filter((u) => u.username.toLowerCase().includes(q))
    }
    return list.slice(skip, skip + take)
  }

  ;(prisma.user.count as any) = async ({ where }: any) => {
    let list = [...mockUsers]
    if (where?.username?.contains) {
      const q = where.username.contains.toLowerCase()
      list = list.filter((u) => u.username.toLowerCase().includes(q))
    }
    return list.length
  }

  ;(prisma.user.update as any) = async ({ where, data }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) throw new Error('User not found')
    if (data.username !== undefined) user.username = data.username
    if (data.email !== undefined) user.email = data.email
    if (data.customization !== undefined) user.customization = data.customization
    if (data.settings !== undefined) user.settings = data.settings
    if (data.badges !== undefined) user.badges = data.badges
    user.updatedAt = new Date()
    return user
  }

  // Mock UserBlock
  ;(prisma.userBlock.findUnique as any) = async ({ where }: any) => {
    if (where.blockerId_blockedId) {
      const { blockerId, blockedId } = where.blockerId_blockedId
      return (
        mockUserBlocks.find(
          (b) => b.blockerId === blockerId && b.blockedId === blockedId
        ) ?? null
      )
    }
    return null
  }

  ;(prisma.userBlock.upsert as any) = async ({ where, create }: any) => {
    const { blockerId, blockedId } = where.blockerId_blockedId
    let existing = mockUserBlocks.find(
      (b) => b.blockerId === blockerId && b.blockedId === blockedId
    )
    if (!existing) {
      existing = {
        id: `block-${Date.now()}-${Math.random()}`,
        blockerId,
        blockedId,
        createdAt: new Date(),
      }
      mockUserBlocks.push(existing)
    }
    return existing
  }

  ;(prisma.userBlock.deleteMany as any) = async ({ where }: any) => {
    let count = 0
    mockUserBlocks = mockUserBlocks.filter((b) => {
      const matches =
        b.blockerId === where.blockerId && b.blockedId === where.blockedId
      if (matches) count++
      return !matches
    })
    return { count }
  }

  // Mock Friend & FriendRequest
  ;(prisma.friend.findFirst as any) = async ({ where }: any) => {
    if (where.OR) {
      return (
        mockFriends.find((f) =>
          where.OR.some(
            (cond: any) => cond.userId === f.userId && cond.friendId === f.friendId
          )
        ) ?? null
      )
    }
    return null
  }

  ;(prisma.friend.count as any) = async ({ where }: any) => {
    if (where?.OR) {
      const targetId = where.OR[0]?.userId ?? where.OR[0]?.friendId
      return mockFriends.filter(
        (f) => f.userId === targetId || f.friendId === targetId
      ).length
    }
    return mockFriends.length
  }

  ;(prisma.friend.deleteMany as any) = async ({ where }: any) => {
    let count = 0
    if (where.OR) {
      mockFriends = mockFriends.filter((f) => {
        const matches = where.OR.some(
          (cond: any) => cond.userId === f.userId && cond.friendId === f.friendId
        )
        if (matches) count++
        return !matches
      })
    }
    return { count }
  }

  ;(prisma.friendRequest.findFirst as any) = async ({ where }: any) => {
    if (where.OR) {
      return (
        mockFriendRequests.find((r) =>
          where.OR.some(
            (cond: any) =>
              cond.senderId === r.senderId &&
              cond.receiverId === r.receiverId &&
              (!cond.status || cond.status === r.status)
          )
        ) ?? null
      )
    }
    return null
  }

  ;(prisma.friendRequest.deleteMany as any) = async ({ where }: any) => {
    let count = 0
    if (where.OR) {
      mockFriendRequests = mockFriendRequests.filter((r) => {
        const matches = where.OR.some(
          (cond: any) => cond.senderId === r.senderId && cond.receiverId === r.receiverId
        )
        if (matches) count++
        return !matches
      })
    }
    return { count }
  }

  // Mock ActivityLog
  ;(prisma.activityLog.count as any) = async ({ where }: any) => {
    return mockActivityLogs.filter((a) => {
      if (where.userId && a.userId !== where.userId) return false
      if (where.isPrivate !== undefined && a.isPrivate !== where.isPrivate) return false
      if (where.type?.in && !where.type.in.includes(a.type)) return false
      return true
    }).length
  }

  ;(prisma.activityLog.findMany as any) = async ({ where, skip = 0, take = 10 }: any) => {
    const filtered = mockActivityLogs.filter((a) => {
      if (where.userId && a.userId !== where.userId) return false
      if (where.isPrivate !== undefined && a.isPrivate !== where.isPrivate) return false
      if (where.type?.in && !where.type.in.includes(a.type)) return false
      return true
    })
    return filtered.slice(skip, skip + take).map((a) => {
      const user = mockUsers.find((u) => u.id === a.userId)!
      return {
        ...a,
        user: {
          id: user.id,
          username: user.username,
          customization: user.customization,
        },
      }
    })
  }

  ;(prisma.activityLog.findUnique as any) = async ({ where }: any) => {
    return mockActivityLogs.find((a) => a.id === where.id) ?? null
  }

  ;(prisma.activityLog.delete as any) = async ({ where }: any) => {
    const idx = mockActivityLogs.findIndex((a) => a.id === where.id)
    if (idx === -1) throw new Error('Activity item not found')
    const [deleted] = mockActivityLogs.splice(idx, 1)
    return deleted
  }

  // Mock Favorites
  ;(prisma.favorite.count as any) = async ({ where }: any) => {
    return mockFavorites.filter((f) => {
      if (where.userId && f.userId !== where.userId) return false
      if (where.type && f.type !== where.type) return false
      return true
    }).length
  }

  ;(prisma.favorite.findMany as any) = async ({ where, skip = 0, take = 10 }: any) => {
    return mockFavorites
      .filter((f) => {
        if (where.userId && f.userId !== where.userId) return false
        if (where.type && f.type !== where.type) return false
        return true
      })
      .slice(skip, skip + take)
  }

  // Mock Media List Counts for Badge Evaluation
  ;(prisma.animeList.count as any) = async () => mockAnimeCount
  ;(prisma.mangaList.count as any) = async () => mockMangaCount
  ;(prisma.movieList.count as any) = async () => mockMovieCount
  ;(prisma.tvList.count as any) = async () => mockTvCount
  ;(prisma.gameList.count as any) = async () => mockGameCount
  ;(prisma.bookList.count as any) = async () => mockBookCount
  ;(prisma.musicList.count as any) = async () => mockMusicCount
  ;(prisma.customList.count as any) = async () => mockCustomListCount
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
  .use(carinaUsers)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Carina Users & Profiles Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  let adminToken: string

  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'
  const ADMIN_ID = '00000000-0000-0000-0000-000000000003'

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
    adminToken = await signUserJwt({
      id: ADMIN_ID,
      username: 'admin',
      email: 'admin@example.com',
    })
  })

  // ===========================================================================
  // 1. GET /carina/users (Search / list users)
  // ===========================================================================
  describe('GET /carina/users', () => {
    it('lists users with pagination defaults (10 per page)', async () => {
      const res = await app.handle(new Request('http://localhost/carina/users'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.users.length).toBe(3)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.total).toBe(3)
      expect(data.users[0].id).toBe(ALICE_ID)
      expect(data.users[0].displayName).toBe('Alice Wonderland')
    })

    it('filters users by search query parameter q', async () => {
      const res = await app.handle(new Request('http://localhost/carina/users?q=bob'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.users.length).toBe(1)
      expect(data.users[0].username).toBe('bob')
    })

    it('fails (422) on invalid pagination limit (> 50)', async () => {
      const res = await app.handle(new Request('http://localhost/carina/users?limit=100'))
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 2. GET /carina/users/me (Return full account info)
  // ===========================================================================
  describe('GET /carina/users/me', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(new Request('http://localhost/carina/users/me'))
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
    })

    it('returns full account information for authenticated user', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/me', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.user.id).toBe(ALICE_ID)
      expect(data.user.username).toBe('alice')
      expect(data.user.email).toBe('alice@example.com')
      expect(data.user.badges).toEqual([1])
      expect(data.user.settings).toEqual({ theme: 'dark' })
    })
  })

  // ===========================================================================
  // 3. PATCH /carina/users/me (Update account info & assets)
  // ===========================================================================
  describe('PATCH /carina/users/me', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ settings: { theme: 'light' } }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) on invalid username pattern (special chars)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/me', {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ username: 'invalid name!' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when updating username to one that is already taken', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/me', {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ username: 'bob' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('already taken')
    })

    it('fails (400) when updating email to one that is already in use', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/me', {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ email: 'bob@example.com' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('already in use')
    })

    it('successfully updates settings and merges convenience assets', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/me', {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            settings: { theme: 'light', fontSize: 'lg' },
            assets: {
              avatarUrl: 'https://example.com/alice-new-avatar.png',
              avatarFrame: 'https://example.com/frame-gold.png',
            },
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Account updated successfully')
      expect(data.user.settings.theme).toBe('light')
      expect(data.user.settings.fontSize).toBe('lg')
      expect(data.user.customization.profile.avatarUrl).toBe(
        'https://example.com/alice-new-avatar.png'
      )
      expect(data.user.customization.profile.avatarFrame).toBe(
        'https://example.com/frame-gold.png'
      )
    })
  })

  // ===========================================================================
  // 4. GET /carina/users/:userId (Public profile info - Strictly IDs!)
  // ===========================================================================
  describe('GET /carina/users/:userId', () => {
    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/00000000-0000-0000-0000-999999999999')
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.code).toBe('not-found')
    })

    it('fails (404) when passing username instead of user ID (strictly IDs only)', async () => {
      // Testing that looking up by username string fails, ensuring only IDs are accepted
      const res = await app.handle(new Request('http://localhost/carina/users/alice'))
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.code).toBe('not-found')
      expect(data.detail).toContain('not found')
    })

    it('successfully returns public profile info strictly by user ID', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.user.id).toBe(ALICE_ID)
      expect(data.user.username).toBe('alice')
      expect(data.user.displayName).toBe('Alice Wonderland')
      expect(data.user.avatarUrl).toBe('https://example.com/alice.png')
      expect(data.user.bannerUrl).toBe('https://example.com/alice-banner.png')
      expect(data.user.badges).toEqual([1])
      expect(data.user.stats).toEqual({
        friendsCount: 0,
        favoritesCount: 0,
        badgesCount: 1,
      })
    })
  })

  // ===========================================================================
  // 5. POST /carina/users/:userId/block & unblock
  // ===========================================================================
  describe('POST /carina/users/:userId/block & /unblock', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/block`, {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/00000000-0000-0000-0000-999999999999/block', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (400) when attempting to block self', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/block`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('cannot block yourself')
    })

    it('successfully blocks target user and severs friendship', async () => {
      // Add a friendship first
      mockFriends.push({
        id: 'f-1',
        userId: ALICE_ID,
        friendId: BOB_ID,
        nickname: null,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/block`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.blockedId).toBe(BOB_ID)
      expect(mockUserBlocks.length).toBe(1)
      expect(mockFriends.length).toBe(0) // severing check
    })

    it('successfully unblocks target user', async () => {
      mockUserBlocks.push({
        id: 'b-1',
        blockerId: ALICE_ID,
        blockedId: BOB_ID,
        createdAt: new Date(),
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/unblock`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('User unblocked successfully')
      expect(mockUserBlocks.length).toBe(0)
    })
  })

  // ===========================================================================
  // 6. GET /carina/users/:userId/friendship
  // ===========================================================================
  describe('GET /carina/users/:userId/friendship', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/friendship`)
      )
      expect(res.status).toBe(401)
    })

    it('returns status "self" when checking own user ID', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/friendship`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('self')
      expect(data.isFriend).toBe(false)
    })

    it('returns status "none" when no relation exists', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/friendship`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('none')
      expect(data.isFriend).toBe(false)
    })

    it('returns status "blocked" when caller blocked target', async () => {
      mockUserBlocks.push({
        id: 'b-1',
        blockerId: ALICE_ID,
        blockedId: BOB_ID,
        createdAt: new Date(),
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/friendship`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('blocked')
      expect(data.isBlocked).toBe(true)
    })

    it('returns status "blocked_by" when target blocked caller', async () => {
      mockUserBlocks.push({
        id: 'b-2',
        blockerId: BOB_ID,
        blockedId: ALICE_ID,
        createdAt: new Date(),
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/friendship`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('blocked_by')
      expect(data.isBlockedBy).toBe(true)
    })

    it('returns status "friends" when mutual friendship exists', async () => {
      mockFriends.push({
        id: 'f-1',
        userId: ALICE_ID,
        friendId: BOB_ID,
        nickname: null,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/friendship`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('friends')
      expect(data.isFriend).toBe(true)
    })

    it('returns status "outgoing_request" when caller sent pending request', async () => {
      mockFriendRequests.push({
        id: 'req-1',
        senderId: ALICE_ID,
        receiverId: BOB_ID,
        message: 'Hello!',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/friendship`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('outgoing_request')
      expect(data.isPending).toBe(true)
      expect(data.requestId).toBe('req-1')
    })
  })

  // ===========================================================================
  // 7. GET /carina/users/:userId/assets
  // ===========================================================================
  describe('GET /carina/users/:userId/assets', () => {
    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/00000000-0000-0000-0000-999999999999/assets')
      )
      expect(res.status).toBe(404)
    })

    it('returns user assets strictly by user ID', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/assets`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.assets.avatarUrl).toBe('https://example.com/alice.png')
      expect(data.assets.bannerUrl).toBe('https://example.com/alice-banner.png')
      expect(data.assets.accentColor).toBe('#f43f5e')
    })
  })

  // ===========================================================================
  // 8. GET /carina/users/:userId/badges
  // ===========================================================================
  describe('GET /carina/users/:userId/badges', () => {
    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/00000000-0000-0000-0000-999999999999/badges')
      )
      expect(res.status).toBe(404)
    })

    it('returns user badges enriched with metadata from @IRIS/shared', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/badges`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.total).toBe(1)
      expect(data.badges[0].id).toBe(1)
      expect(data.badges[0].name).toBe('Owner')
      expect(data.badges[0].icon).toBe('IconCrown')
      expect(data.badges[0].category).toBe('role')
    })
  })

  // ===========================================================================
  // 9. POST /carina/users/:userId/badges/evaluate
  // ===========================================================================
  describe('POST /carina/users/:userId/badges/evaluate', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/badges/evaluate`, {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (403) when normal user tries to evaluate another user ID', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/badges/evaluate`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.code).toBe('forbidden')
      expect(data.detail).toContain('cannot evaluate badges for other users')
    })

    it('successfully evaluates and awards media consumption badges for self', async () => {
      // Simulate Bob having watched 10 anime titles
      mockAnimeCount = 10 // awards badge #4 (First Anime: 1) and #5 (Anime Novice: 10)

      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/badges/evaluate`, {
          method: 'POST',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.newlyAwardedCount).toBe(2)
      expect(data.newlyAwardedBadgeIds).toEqual([4, 5])
      expect(data.badges).toEqual([4, 5])

      // Re-evaluating immediately should award 0 additional badges
      const reRes = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/badges/evaluate`, {
          method: 'POST',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      const reData = await reRes.json()
      expect(reData.newlyAwardedCount).toBe(0)
    })

    it('allows admin to evaluate badges for any user ID', async () => {
      mockMovieCount = 1 // awards badge #26 (First Movie: 1)

      const res = await app.handle(
        new Request(`http://localhost/carina/users/${BOB_ID}/badges/evaluate`, {
          method: 'POST',
          headers: { authorization: `Bearer ${adminToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.newlyAwardedBadgeIds).toContain(26)
    })
  })

  // ===========================================================================
  // 10. GET /carina/users/:userId/activity & /:category
  // ===========================================================================
  describe('GET /carina/users/:userId/activity & /:category', () => {
    beforeEach(() => {
      mockActivityLogs = [
        {
          id: 'act-1',
          userId: ALICE_ID,
          type: 'LIST_ITEM_ADDED',
          mediaType: 'ANIME',
          mediaId: 101,
          status: 'COMPLETED',
          progress: 12,
          progressVolumes: null,
          score: 95,
          title: 'Finished Steins;Gate',
          content: null,
          metadata: null,
          isPrivate: false,
          isSpoiler: false,
          likeCount: 5,
          replyCount: 1,
          createdAt: new Date('2026-02-01T10:00:00Z'),
          updatedAt: new Date('2026-02-01T10:00:00Z'),
        },
        {
          id: 'act-2',
          userId: ALICE_ID,
          type: 'REVIEW_POSTED',
          mediaType: 'ANIME',
          mediaId: 101,
          status: null,
          progress: null,
          progressVolumes: null,
          score: null,
          title: 'Masterpiece review',
          content: 'El Psy Kongroo',
          metadata: null,
          isPrivate: false,
          isSpoiler: false,
          likeCount: 10,
          replyCount: 2,
          createdAt: new Date('2026-02-02T10:00:00Z'),
          updatedAt: new Date('2026-02-02T10:00:00Z'),
        },
        {
          id: 'act-3',
          userId: ALICE_ID,
          type: 'STATUS_POST',
          mediaType: null,
          mediaId: null,
          status: null,
          progress: null,
          progressVolumes: null,
          score: null,
          title: 'Secret thought',
          content: 'This is my private note.',
          metadata: null,
          isPrivate: true, // Private activity
          isSpoiler: false,
          likeCount: 0,
          replyCount: 0,
          createdAt: new Date('2026-02-03T10:00:00Z'),
          updatedAt: new Date('2026-02-03T10:00:00Z'),
        },
      ]
    })

    it('returns public activities and hides private activities from unauthenticated users', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.activities.length).toBe(2) // 2 public, 1 private hidden
      expect(data.activities.some((a: any) => a.id === 'act-3')).toBe(false)
    })

    it('returns private activities to the activity owner', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity`, {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.activities.length).toBe(3) // all 3 visible to owner
      expect(data.activities.some((a: any) => a.id === 'act-3')).toBe(true)
    })

    it('filters activity by category "media"', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity/media`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.activities.length).toBe(1)
      expect(data.activities[0].id).toBe('act-1')
    })

    it('filters activity by category "social"', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity/social`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.activities.length).toBe(1)
      expect(data.activities[0].id).toBe('act-2')
    })

    it('fails (400) when activity category is invalid', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity/nonexistent-category`)
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
    })
  })

  // ===========================================================================
  // 11. DELETE /carina/users/activity/:id
  // ===========================================================================
  describe('DELETE /carina/users/activity/:id', () => {
    beforeEach(() => {
      mockActivityLogs = [
        {
          id: 'act-delete-1',
          userId: ALICE_ID,
          type: 'STATUS_POST',
          mediaType: null,
          mediaId: null,
          status: null,
          progress: null,
          progressVolumes: null,
          score: null,
          title: null,
          content: 'Will be deleted',
          metadata: null,
          isPrivate: false,
          isSpoiler: false,
          likeCount: 0,
          replyCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
    })

    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/activity/act-delete-1', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when activity ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/activity/nonexistent', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (403) when user is not author and not administrator', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/activity/act-delete-1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.code).toBe('forbidden')
      expect(data.detail).toContain('permission to delete')
    })

    it('successfully deletes activity item when caller is author', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/activity/act-delete-1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Activity item deleted successfully')
      expect(mockActivityLogs.length).toBe(0)
    })

    it('successfully deletes activity item when caller is administrator', async () => {
      mockActivityLogs.push({
        id: 'act-delete-admin',
        userId: BOB_ID,
        type: 'STATUS_POST',
        mediaType: null,
        mediaId: null,
        status: null,
        progress: null,
        progressVolumes: null,
        score: null,
        title: null,
        content: 'Admin will delete',
        metadata: null,
        isPrivate: false,
        isSpoiler: false,
        likeCount: 0,
        replyCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/users/activity/act-delete-admin', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${adminToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  // ===========================================================================
  // 12. GET /carina/users/:userId/favorites & /:category
  // ===========================================================================
  describe('GET /carina/users/:userId/favorites & /:category', () => {
    beforeEach(() => {
      mockFavorites = [
        {
          id: 'fav-1',
          userId: ALICE_ID,
          type: 'ANIME',
          targetId: 1001,
          createdAt: new Date(),
        },
        {
          id: 'fav-2',
          userId: ALICE_ID,
          type: 'MANGA',
          targetId: 2002,
          createdAt: new Date(),
        },
      ]
    })

    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/00000000-0000-0000-0000-999999999999/favorites')
      )
      expect(res.status).toBe(404)
    })

    it('returns all user favorites with pagination', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/favorites`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.favorites.length).toBe(2)
      expect(data.pagination.total).toBe(2)
    })

    it('returns favorites filtered by category "anime"', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/favorites/anime`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.favorites.length).toBe(1)
      expect(data.favorites[0].type).toBe('ANIME')
      expect(data.favorites[0].targetId).toBe(1001)
    })

    it('fails (400) when favorite category is invalid', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/favorites/unknown-type`)
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
    })
  })

  // ===========================================================================
  // 13. GET /carina/users/:userId/friends
  // ===========================================================================
  describe('GET /carina/users/:userId/friends', () => {
    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/users/00000000-0000-0000-0000-999999999999/friends')
      )
      expect(res.status).toBe(404)
    })

    it('returns public friends for target user', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/friends`)
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.friends)).toBe(true)
    })
  })
})

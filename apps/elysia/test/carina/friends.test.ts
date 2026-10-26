import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { carinaFriends } from '../../src/api/controllers/carina/friends.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@Iris/db'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Friends, Requests, Blocks, and Media Lists
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  customization: any
  badges: number[]
  passwordChangedAt: Date | null
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

interface MockUserBlock {
  id: string
  blockerId: string
  blockedId: string
}

interface MockMediaListEntry {
  userId: string
  mediaId: number
  status: string
  progress?: number | null
  chaptersProgress?: number | null
  volumesProgress?: number | null
  progressPages?: number | null
  score?: number | null
  private: boolean
  updatedAt: Date
}

let mockUsers: MockUser[] = []
let mockFriends: MockFriend[] = []
let mockFriendRequests: MockFriendRequest[] = []
let mockUserBlocks: MockUserBlock[] = []
let mockAnimeList: MockMediaListEntry[] = []
let mockMangaList: MockMediaListEntry[] = []
let mockMovieList: MockMediaListEntry[] = []
let mockTvList: MockMediaListEntry[] = []
let mockGameList: MockMediaListEntry[] = []
let mockBookList: MockMediaListEntry[] = []
let mockMusicList: MockMediaListEntry[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      customization: {
        profile: {
          displayName: 'Alice Wonderland',
          avatarUrl: 'https://example.com/alice.png',
        },
      },
      badges: [1],
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      customization: {
        profile: {
          displayName: 'Bob Builder',
          avatarUrl: 'https://example.com/bob.png',
        },
      },
      badges: [],
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'charlie',
      email: 'charlie@example.com',
      customization: {
        profile: {
          displayName: 'Charlie Brown',
          avatarUrl: 'https://example.com/charlie.png',
        },
      },
      badges: [],
      passwordChangedAt: null,
    },
  ]

  mockFriends = []
  mockFriendRequests = []
  mockUserBlocks = []
  mockAnimeList = []
  mockMangaList = []
  mockMovieList = []
  mockTvList = []
  mockGameList = []
  mockBookList = []
  mockMusicList = []

  // Mock User
  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock Friends
  ;((prisma as any).friend.count as any) = async ({ where }: any) => {
    return mockFriends.filter((f) => {
      if (where.userId && f.userId !== where.userId) return false
      return true
    }).length
  }

  ;((prisma as any).friend.findMany as any) = async ({ where, skip = 0, take = 10 }: any) => {
    let list = mockFriends.filter((f) => {
      if (where.userId && f.userId !== where.userId) return false
      if (where.friendId?.in && !where.friendId.in.includes(f.friendId)) return false
      return true
    })

    return list.slice(skip, skip + take).map((f) => {
      const friendUser = mockUsers.find((u) => u.id === f.friendId)
      return {
        ...f,
        friend: friendUser
          ? {
              id: friendUser.id,
              username: friendUser.username,
              customization: friendUser.customization,
              badges: friendUser.badges,
            }
          : {
              id: f.friendId,
              username: 'unknown',
              customization: null,
              badges: [],
            },
      }
    })
  }

  ;((prisma as any).friend.findFirst as any) = async ({ where }: any) => {
    return (
      mockFriends.find((f) => {
        if (where.userId && f.userId !== where.userId) return false
        if (where.friendId && f.friendId !== where.friendId) return false
        if (where.id && f.id !== where.id) return false
        if (where.OR) {
          const match = where.OR.some((cond: any) => {
            if (cond.userId && cond.friendId) {
              return cond.userId === f.userId && cond.friendId === f.friendId
            }
            if (cond.friendId) return cond.friendId === f.friendId
            if (cond.id) return cond.id === f.id
            return false
          })
          if (!match) return false
        }
        return true
      }) ?? null
    )
  }

  ;((prisma as any).friend.upsert as any) = async ({ where, create }: any) => {
    const { userId, friendId } = where.userId_friendId
    let existing = mockFriends.find(
      (f) => f.userId === userId && f.friendId === friendId
    )
    if (!existing) {
      existing = {
        id: `friend-${Date.now()}-${Math.random()}`,
        userId,
        friendId,
        nickname: null,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockFriends.push(existing)
    }
    return existing
  }

  ;((prisma as any).friend.deleteMany as any) = async ({ where }: any) => {
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

  // Mock Friend Requests
  ;((prisma as any).friendRequest.count as any) = async ({ where }: any) => {
    return mockFriendRequests.filter((r) => {
      if (where.status && r.status !== where.status) return false
      if (where.senderId && r.senderId !== where.senderId) return false
      if (where.receiverId && r.receiverId !== where.receiverId) return false
      if (where.OR) {
        const matches = where.OR.some(
          (cond: any) =>
            (cond.senderId && r.senderId === cond.senderId) ||
            (cond.receiverId && r.receiverId === cond.receiverId)
        )
        if (!matches) return false
      }
      return true
    }).length
  }

  ;((prisma as any).friendRequest.findMany as any) = async ({ where, skip = 0, take = 10 }: any) => {
    let list = mockFriendRequests.filter((r) => {
      if (where.status && r.status !== where.status) return false
      if (where.senderId && r.senderId !== where.senderId) return false
      if (where.receiverId && r.receiverId !== where.receiverId) return false
      if (where.OR) {
        const matches = where.OR.some(
          (cond: any) =>
            (cond.senderId && r.senderId === cond.senderId) ||
            (cond.receiverId && r.receiverId === cond.receiverId)
        )
        if (!matches) return false
      }
      return true
    })

    return list.slice(skip, skip + take).map((r) => {
      const sender = mockUsers.find((u) => u.id === r.senderId)!
      const receiver = mockUsers.find((u) => u.id === r.receiverId)!
      return {
        ...r,
        sender: {
          id: sender.id,
          username: sender.username,
          customization: sender.customization,
          badges: sender.badges,
        },
        receiver: {
          id: receiver.id,
          username: receiver.username,
          customization: receiver.customization,
          badges: receiver.badges,
        },
      }
    })
  }

  ;((prisma as any).friendRequest.findUnique as any) = async ({ where }: any) => {
    return mockFriendRequests.find((r) => r.id === where.id) ?? null
  }

  ;((prisma as any).friendRequest.findFirst as any) = async ({ where }: any) => {
    return (
      mockFriendRequests.find((r) => {
        if (where.senderId && r.senderId !== where.senderId) return false
        if (where.receiverId && r.receiverId !== where.receiverId) return false
        if (where.status && r.status !== where.status) return false
        return true
      }) ?? null
    )
  }

  ;((prisma as any).friendRequest.create as any) = async ({ data }: any) => {
    const req: MockFriendRequest = {
      id: `req-${Date.now()}-${Math.random()}`,
      senderId: data.senderId,
      receiverId: data.receiverId,
      message: data.message ?? null,
      status: data.status ?? 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockFriendRequests.push(req)
    return req
  }

  ;((prisma as any).friendRequest.delete as any) = async ({ where }: any) => {
    const idx = mockFriendRequests.findIndex((r) => r.id === where.id)
    if (idx === -1) throw new Error('Request not found')
    const [deleted] = mockFriendRequests.splice(idx, 1)
    return deleted
  }

  // Mock User Blocks
  ;((prisma as any).userBlock.findFirst as any) = async ({ where }: any) => {
    if (where.OR) {
      return (
        mockUserBlocks.find((b) =>
          where.OR.some(
            (cond: any) =>
              cond.blockerId === b.blockerId && cond.blockedId === b.blockedId
          )
        ) ?? null
      )
    }
    return null
  }

  ;((prisma as any).userBlock.findMany as any) = async ({ where }: any) => {
    return mockUserBlocks
      .filter((b) => !where?.blockerId || b.blockerId === where.blockerId)
      .map((b) => {
        const blockedUser = mockUsers.find((u) => u.id === b.blockedId)
        return {
          ...b,
          blocked: blockedUser
            ? {
                id: blockedUser.id,
                username: blockedUser.username,
                customization: blockedUser.customization,
                badges: blockedUser.badges,
              }
            : {
                id: b.blockedId,
                username: 'unknown',
                customization: null,
                badges: [],
              },
        }
      })
  }

  // Mock Media List Queries
  ;((prisma as any).animeList.findMany as any) = async ({ where }: any) => {
    return mockAnimeList
      .filter((e) => where.userId.in.includes(e.userId) && e.mediaId === where.animeId)
      .map((e) => ({ ...e, animeId: e.mediaId }))
  }

  ;((prisma as any).mangaList.findMany as any) = async ({ where }: any) => {
    return mockMangaList
      .filter((e) => where.userId.in.includes(e.userId) && e.mediaId === where.mangaId)
      .map((e) => ({ ...e, mangaId: e.mediaId }))
  }

  ;((prisma as any).movieList.findMany as any) = async ({ where }: any) => {
    return mockMovieList
      .filter((e) => where.userId.in.includes(e.userId) && e.mediaId === where.movieId)
      .map((e) => ({ ...e, movieId: e.mediaId }))
  }

  ;((prisma as any).tvList.findMany as any) = async ({ where }: any) => {
    return mockTvList
      .filter((e) => where.userId.in.includes(e.userId) && e.mediaId === where.tvId)
      .map((e) => ({ ...e, tvId: e.mediaId }))
  }

  ;((prisma as any).gameList.findMany as any) = async ({ where }: any) => {
    return mockGameList
      .filter((e) => where.userId.in.includes(e.userId) && e.mediaId === where.gameId)
      .map((e) => ({ ...e, gameId: e.mediaId }))
  }

  ;((prisma as any).bookList.findMany as any) = async ({ where }: any) => {
    return mockBookList
      .filter((e) => where.userId.in.includes(e.userId) && e.mediaId === where.bookId)
      .map((e) => ({ ...e, bookId: e.mediaId }))
  }

  ;((prisma as any).musicList.findMany as any) = async ({ where }: any) => {
    return mockMusicList
      .filter((e) => where.userId.in.includes(e.userId) && e.mediaId === where.musicId)
      .map((e) => ({ ...e, musicId: e.mediaId }))
  }

  // Mock Activity Log
  ;((prisma as any).activityLog.create as any) = async ({ data }: any) => {
    return { id: 'act-new', ...data }
  }

  // Mock $transaction
  ;((prisma as any).$transaction as any) = async (ops: any[]) => {
    return await Promise.all(ops)
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
  .use(carinaFriends)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Carina Friends & Social Graph Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  let charlieToken: string

  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'
  const CHARLIE_ID = '00000000-0000-0000-0000-000000000003'

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
  })

  // ===========================================================================
  // 1. GET /carina/friends (Get friends list)
  // ===========================================================================
  describe('GET /carina/friends', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(new Request('http://localhost/carina/friends'))
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
    })

    it('returns empty friends list when user has no friends', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.friends).toEqual([])
      expect(data.pagination.total).toBe(0)
    })

    it('returns paginated friends list with friend profiles', async () => {
      mockFriends.push({
        id: 'f-1',
        userId: ALICE_ID,
        friendId: BOB_ID,
        nickname: 'Bobby',
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/friends', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.friends.length).toBe(1)
      expect(data.friends[0].friendId).toBe(BOB_ID)
      expect(data.friends[0].nickname).toBe('Bobby')
      expect(data.friends[0].user.username).toBe('bob')
      expect(data.friends[0].user.displayName).toBe('Bob Builder')
    })

    it('fails (422) on invalid pagination limit (> 50)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends?limit=100', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 2. DELETE /carina/friends/:friendId (Remove friend - strictly IDs)
  // ===========================================================================
  describe('DELETE /carina/friends/:friendId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/friends/${BOB_ID}`, {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when friendship does not exist', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/friends/${BOB_ID}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.code).toBe('not-found')
      expect(data.detail).toContain('Friendship not found')
    })

    it('fails (404) when passing username instead of user ID (strictly IDs only)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/bob', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('successfully removes friendship bilaterally', async () => {
      mockFriends.push(
        {
          id: 'f-1',
          userId: ALICE_ID,
          friendId: BOB_ID,
          nickname: null,
          isPrivate: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'f-2',
          userId: BOB_ID,
          friendId: ALICE_ID,
          nickname: null,
          isPrivate: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      )

      const res = await app.handle(
        new Request(`http://localhost/carina/friends/${BOB_ID}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Friend removed successfully')
      expect(mockFriends.length).toBe(0)
    })
  })

  // ===========================================================================
  // 3. GET /carina/friends/requests (Get pending requests)
  // ===========================================================================
  describe('GET /carina/friends/requests', () => {
    beforeEach(() => {
      mockFriendRequests = [
        {
          id: 'req-1',
          senderId: BOB_ID,
          receiverId: ALICE_ID,
          message: 'Hey Alice!',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'req-2',
          senderId: ALICE_ID,
          receiverId: CHARLIE_ID,
          message: 'Hey Charlie!',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
    })

    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests')
      )
      expect(res.status).toBe(401)
    })

    it('lists incoming friend requests by default', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.requests.length).toBe(1)
      expect(data.requests[0].id).toBe('req-1')
      expect(data.requests[0].sender.id).toBe(BOB_ID)
      expect(data.requests[0].sender.username).toBe('bob')
    })

    it('lists outgoing friend requests with ?type=outgoing', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests?type=outgoing', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.requests.length).toBe(1)
      expect(data.requests[0].id).toBe('req-2')
      expect(data.requests[0].receiver.id).toBe(CHARLIE_ID)
    })

    it('lists all pending requests with ?type=all', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests?type=all', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.requests.length).toBe(2)
    })
  })

  // ===========================================================================
  // 4. POST /carina/friends/requests (Send friend request - strictly IDs)
  // ===========================================================================
  describe('POST /carina/friends/requests', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ targetUserId: BOB_ID }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) when attempting to send request to self', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ targetUserId: ALICE_ID }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('cannot send a friend request to yourself')
    })

    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ targetUserId: '00000000-0000-0000-0000-999999999999' }),
        })
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.code).toBe('not-found')
    })

    it('fails (400) when either user has blocked the other', async () => {
      mockUserBlocks.push({
        id: 'block-1',
        blockerId: BOB_ID,
        blockedId: ALICE_ID,
      })

      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ targetUserId: BOB_ID }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('blocked user')
    })

    it('fails (400) when users are already friends', async () => {
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
        new Request('http://localhost/carina/friends/requests', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ targetUserId: BOB_ID }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('already friends')
    })

    it('fails (400) when outgoing request is already pending', async () => {
      mockFriendRequests.push({
        id: 'req-pending',
        senderId: ALICE_ID,
        receiverId: BOB_ID,
        message: null,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ targetUserId: BOB_ID }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('already sent and pending')
    })

    it('auto-accepts mutual request when target user already sent a pending request', async () => {
      mockFriendRequests.push({
        id: 'req-bob-to-alice',
        senderId: BOB_ID,
        receiverId: ALICE_ID,
        message: 'Let us be friends!',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ targetUserId: BOB_ID }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('Mutual friend request accepted')
      expect(mockFriends.length).toBe(2) // bilateral friends established
    })

    it('successfully sends a new friend request strictly by user ID', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            targetUserId: BOB_ID,
            message: 'Hello Bob!',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Friend request sent successfully')
      expect(data.requestId).toBeDefined()
      expect(mockFriendRequests.length).toBe(1)
    })
  })

  // ===========================================================================
  // 5. POST /carina/friends/requests/:requestId/accept & /decline
  // ===========================================================================
  describe('POST /carina/friends/requests/:requestId/accept & /decline', () => {
    beforeEach(() => {
      mockFriendRequests = [
        {
          id: 'req-accept-me',
          senderId: BOB_ID,
          receiverId: ALICE_ID,
          message: 'Accept me!',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
    })

    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests/req-accept-me/accept', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when request ID does not exist or receiver does not match', async () => {
      // Bob trying to accept a request sent to Alice
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests/req-accept-me/accept', {
          method: 'POST',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.code).toBe('not-found')
    })

    it('successfully accepts friend request and creates bilateral friendship', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests/req-accept-me/accept', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Friend request accepted successfully')
      expect(data.friendId).toBe(BOB_ID)
      expect(mockFriends.length).toBe(2)
      expect(mockFriendRequests.length).toBe(0)
    })

    it('successfully declines friend request', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/requests/req-accept-me/decline', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Friend request declined successfully')
      expect(mockFriendRequests.length).toBe(0)
      expect(mockFriends.length).toBe(0)
    })
  })

  // ===========================================================================
  // 6. GET /carina/friends/media/:mediaType/:id
  // ===========================================================================
  describe('GET /carina/friends/media/:mediaType/:id', () => {
    beforeEach(() => {
      // Alice is friends with Bob
      mockFriends.push({
        id: 'f-1',
        userId: ALICE_ID,
        friendId: BOB_ID,
        nickname: null,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Bob has tracked Anime ID 101
      mockAnimeList.push({
        userId: BOB_ID,
        mediaId: 101,
        status: 'WATCHING',
        progress: 8,
        score: 90,
        private: false,
        updatedAt: new Date('2026-03-01T12:00:00Z'),
      })
    })

    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/media/anime/101')
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) on invalid mediaType', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/media/unsupported/101', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
    })

    it('returns friend media tracking status', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/media/anime/101', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.mediaType).toBe('anime')
      expect(data.mediaId).toBe(101)
      expect(data.friends.length).toBe(1)
      expect(data.friends[0].friendId).toBe(BOB_ID)
      expect(data.friends[0].status).toBe('WATCHING')
      expect(data.friends[0].progress).toBe(8)
      expect(data.friends[0].score).toBe(90)
      expect(data.friends[0].user.username).toBe('bob')
    })

    it('returns empty array when no friends are tracking the media', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/media/anime/999', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.friends).toEqual([])
    })
  })

  // ===========================================================================
  // 7. POST /carina/friends/recommend (Recommend media directly to friend)
  // ===========================================================================
  describe('POST /carina/friends/recommend', () => {
    beforeEach(() => {
      mockFriends.push({
        id: 'f-1',
        userId: ALICE_ID,
        friendId: BOB_ID,
        nickname: null,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/recommend', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            friendIds: [BOB_ID],
            mediaType: 'anime',
            mediaId: 101,
            mediaTitle: 'Steins;Gate',
          }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) when friendIds contains non-friends', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/recommend', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            friendIds: [CHARLIE_ID], // Charlie is not Alice's friend
            mediaType: 'anime',
            mediaId: 101,
            mediaTitle: 'Steins;Gate',
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('No valid friends selected')
    })

    it('successfully recommends media directly to friend(s)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/friends/recommend', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            friendIds: [BOB_ID],
            mediaType: 'anime',
            mediaId: 101,
            mediaTitle: 'Steins;Gate',
            mediaCover: 'https://example.com/cover.jpg',
            message: 'You have to watch this masterpiece!',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Media recommendation sent to friend(s)')
      expect(data.sentCount).toBe(1)
    })
  })
})

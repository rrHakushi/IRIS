import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { carinaComments } from '../../src/api/controllers/carina/comments.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Comments, Replies, Users, Blocks, and Friends
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  customization: any
  passwordChangedAt: Date | null
}

interface MockListComment {
  id: string
  listOwnerId: string
  mediaType: string
  authorId: string
  content: string
  isSpoiler: boolean
  createdAt: Date
  updatedAt: Date
}

interface MockListCommentReply {
  id: string
  commentId: string
  authorId: string
  content: string
  createdAt: Date
  updatedAt: Date
}

interface MockUserBlock {
  blockerId: string
  blockedId: string
}

interface MockFriend {
  userId: string
  friendId: string
}

let mockUsers: MockUser[] = []
let mockComments: MockListComment[] = []
let mockReplies: MockListCommentReply[] = []
let mockBlocks: MockUserBlock[] = []
let mockFriends: MockFriend[] = []

const adminWord: number = Number(new IRISBitField().add(IRISFlags.ADMINISTRATOR).toArray()[0]) || 1

function setupPrismaMock() {
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
          privacy: {
            allowComments: 'public',
          },
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
        privacy: {
          allowComments: 'everyone',
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
          displayName: 'Charlie Brown',
        },
        privacy: {
          allowComments: 'everyone',
        },
      },
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      username: 'admin',
      email: 'admin@example.com',
      permissions: [adminWord],
      customization: {
        profile: {
          displayName: 'System Admin',
        },
      },
      passwordChangedAt: null,
    },
  ]

  mockComments = []
  mockReplies = []
  mockBlocks = []
  mockFriends = []

  // Mock User findUnique
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock UserBlock findFirst
  ;(prisma.userBlock.findFirst as any) = async ({ where }: any) => {
    if (where.OR) {
      return (
        mockBlocks.find((b) =>
          where.OR.some(
            (cond: any) =>
              cond.blockerId === b.blockerId && cond.blockedId === b.blockedId
          )
        ) ?? null
      )
    }
    return null
  }

  // Mock Friend findFirst
  ;(prisma.friend.findFirst as any) = async ({ where }: any) => {
    if (where.OR) {
      return (
        mockFriends.find((f) =>
          where.OR.some(
            (cond: any) =>
              cond.userId === f.userId && cond.friendId === f.friendId
          )
        ) ?? null
      )
    }
    return (
      mockFriends.find(
        (f) => f.userId === where.userId && f.friendId === where.friendId
      ) ?? null
    )
  }

  // Mock ListComment findUnique
  ;(prisma.listComment.findUnique as any) = async ({ where, include }: any) => {
    const comment = mockComments.find((c) => c.id === where.id)
    if (!comment) return null

    const author = mockUsers.find((u) => u.id === comment.authorId)!
    const reply = mockReplies.find((r) => r.commentId === comment.id)
    let replyWithAuthor: any = null
    if (reply && include?.reply) {
      const replyAuthor = mockUsers.find((u) => u.id === reply.authorId)!
      replyWithAuthor = { ...reply, author: replyAuthor }
    }

    return {
      ...comment,
      author,
      reply: replyWithAuthor ?? reply ?? null,
    }
  }

  // Mock ListComment findMany
  ;(prisma.listComment.findMany as any) = async ({
    where,
    orderBy,
    skip = 0,
    take = 10,
  }: any) => {
    let filtered = mockComments.filter((c) => {
      if (where.listOwnerId && c.listOwnerId !== where.listOwnerId) return false
      if (where.mediaType && c.mediaType !== where.mediaType) return false
      return true
    })

    if (orderBy?.createdAt === 'desc') {
      filtered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    return filtered.slice(skip, skip + take).map((c) => {
      const author = mockUsers.find((u) => u.id === c.authorId)!
      const reply = mockReplies.find((r) => r.commentId === c.id)
      let replyWithAuthor: any = null
      if (reply) {
        const replyAuthor = mockUsers.find((u) => u.id === reply.authorId)!
        replyWithAuthor = { ...reply, author: replyAuthor }
      }
      return {
        ...c,
        author,
        reply: replyWithAuthor,
      }
    })
  }

  // Mock ListComment count
  ;(prisma.listComment.count as any) = async ({ where }: any) => {
    return mockComments.filter((c) => {
      if (where.listOwnerId && c.listOwnerId !== where.listOwnerId) return false
      if (where.mediaType && c.mediaType !== where.mediaType) return false
      return true
    }).length
  }

  // Mock ListComment create
  ;(prisma.listComment.create as any) = async ({ data }: any) => {
    const item: MockListComment = {
      id: `comment-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      listOwnerId: data.listOwnerId,
      mediaType: data.mediaType,
      authorId: data.authorId,
      content: data.content,
      isSpoiler: Boolean(data.isSpoiler),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockComments.push(item)

    const author = mockUsers.find((u) => u.id === item.authorId)!
    return {
      ...item,
      author,
      reply: null,
    }
  }

  // Mock ListComment delete
  ;(prisma.listComment.delete as any) = async ({ where }: any) => {
    const idx = mockComments.findIndex((c) => c.id === where.id)
    if (idx === -1) throw new Error('Comment not found')
    const [deleted] = mockComments.splice(idx, 1)
    // Cascade delete reply
    mockReplies = mockReplies.filter((r) => r.commentId !== deleted!.id)
    return deleted
  }

  // Mock ListCommentReply findUnique
  ;(prisma.listCommentReply.findUnique as any) = async ({ where, include }: any) => {
    const reply = mockReplies.find((r) => r.id === where.id)
    if (!reply) return null

    const author = mockUsers.find((u) => u.id === reply.authorId)!
    let commentWithData: any = null
    if (include?.comment) {
      commentWithData = mockComments.find((c) => c.id === reply.commentId)
    }

    return {
      ...reply,
      author,
      comment: commentWithData,
    }
  }

  // Mock ListCommentReply create
  ;(prisma.listCommentReply.create as any) = async ({ data }: any) => {
    const item: MockListCommentReply = {
      id: `reply-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      commentId: data.commentId,
      authorId: data.authorId,
      content: data.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockReplies.push(item)

    const author = mockUsers.find((u) => u.id === item.authorId)!
    return {
      ...item,
      author,
    }
  }

  // Mock ListCommentReply delete
  ;(prisma.listCommentReply.delete as any) = async ({ where }: any) => {
    const idx = mockReplies.findIndex((r) => r.id === where.id)
    if (idx === -1) throw new Error('Reply not found')
    const [deleted] = mockReplies.splice(idx, 1)
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
  .use(carinaComments)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Carina Comments & Discussions Test Suite', () => {
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
      permissions: [],
    })
    bobToken = await signUserJwt({
      id: BOB_ID,
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
    })
    charlieToken = await signUserJwt({
      id: CHARLIE_ID,
      username: 'charlie',
      email: 'charlie@example.com',
      permissions: [],
    })
    adminToken = await signUserJwt({
      id: ADMIN_ID,
      username: 'admin',
      email: 'admin@example.com',
      permissions: [adminWord],
    })
  })

  // ===========================================================================
  // 1. GET /carina/comments/user/:userId (Get profile comments)
  // ===========================================================================

  describe('GET /carina/comments/user/:userId', () => {
    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/user/missing-uuid', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('returns empty comments list when user profile has no comments', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}`, {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.comments).toEqual([])
      expect(json.pagination.page).toBe(1)
      expect(json.pagination.limit).toBe(10)
      expect(json.pagination.total).toBe(0)
      expect(json.pagination.hasMore).toBe(false)
    })

    it('returns paginated profile comments with author profile metadata', async () => {
      // Create 3 profile comments on Alice's profile
      for (let i = 1; i <= 3; i++) {
        await prisma.listComment.create({
          data: {
            listOwnerId: ALICE_ID,
            mediaType: 'profile',
            authorId: BOB_ID,
            content: `Bob comment #${i}`,
            isSpoiler: false,
          },
        })
      }

      // Also create 1 comment on Bob's profile to verify target isolation
      await prisma.listComment.create({
        data: {
          listOwnerId: BOB_ID,
          mediaType: 'profile',
          authorId: ALICE_ID,
          content: 'Alice comment on Bob',
          isSpoiler: false,
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}`, {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.comments.length).toBe(3)
      expect(json.pagination.total).toBe(3)
      expect(json.comments[0].listOwnerId).toBe(ALICE_ID)
      expect(json.comments[0].mediaType).toBe('profile')
      expect(json.comments[0].author.username).toBe('bob')
      expect(json.comments[0].author.displayName).toBe('Bob Builder')
    })

    it('fails (422) on invalid pagination limit (> 50)', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}?limit=100`, {
          method: 'GET',
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 2. POST /carina/comments/user/:userId (Post comment on user profile)
  // ===========================================================================

  describe('POST /carina/comments/user/:userId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Hello Alice!' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/user/non-existent-user-id', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Hello!' }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (400) when comment content is empty or only whitespace', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: '   ' }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toContain('Comment content cannot be empty')
    })

    it('fails (400) when users have a block relationship', async () => {
      mockBlocks.push({ blockerId: ALICE_ID, blockedId: BOB_ID })

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Trying to comment while blocked' }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toContain('user block')
    })

    it('fails (400) when target user has comments disabled', async () => {
      mockUsers[0]!.customization = {
        profile: {
          privacy: { allowComments: 'disabled' },
        },
      }

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Hello Alice!' }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toContain('disabled comments on their profile')
    })

    it('fails (400) when target user only allows friends and caller is not a friend', async () => {
      mockUsers[0]!.customization = {
        profile: {
          privacy: { allowComments: 'friends' },
        },
      }

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Hello stranger!' }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toContain('Only friends can comment')
    })

    it('successfully posts a comment on profile with spoiler flag', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/user/${ALICE_ID}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: 'Great anime list you have there!',
            isSpoiler: true,
          }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.comment.content).toBe('Great anime list you have there!')
      expect(json.comment.isSpoiler).toBe(true)
      expect(json.comment.listOwnerId).toBe(ALICE_ID)
      expect(json.comment.mediaType).toBe('profile')
      expect(json.comment.author.id).toBe(BOB_ID)
      expect(json.comment.reply).toBeNull()
    })
  })

  // ===========================================================================
  // 3. GET /carina/comments/lists/:userId/:mediaType (Get list comments)
  // ===========================================================================

  describe('GET /carina/comments/lists/:userId/:mediaType', () => {
    it('fails (400) on invalid mediaType', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/lists/${ALICE_ID}/invalid_type`, {
          method: 'GET',
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toContain('Invalid mediaType')
    })

    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/lists/missing-uuid/anime', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(404)
    })

    it('returns paginated comments for specific media list domain', async () => {
      // 2 comments on Alice's anime list
      await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'anime',
          authorId: BOB_ID,
          content: 'Anime list comment 1',
        },
      })
      await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'anime',
          authorId: CHARLIE_ID,
          content: 'Anime list comment 2',
        },
      })

      // 1 comment on Alice's manga list (should not appear in anime list)
      await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'manga',
          authorId: BOB_ID,
          content: 'Manga list comment',
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/lists/${ALICE_ID}/anime`, {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.comments.length).toBe(2)
      expect(json.pagination.total).toBe(2)
      expect(json.comments[0].mediaType).toBe('anime')

      // Query manga list
      const mangaRes = await app.handle(
        new Request(`http://localhost/carina/comments/lists/${ALICE_ID}/manga`, {
          method: 'GET',
        })
      )
      const mangaJson = await mangaRes.json()
      expect(mangaJson.comments.length).toBe(1)
      expect(mangaJson.comments[0].content).toBe('Manga list comment')
    })
  })

  // ===========================================================================
  // 4. POST /carina/comments/lists/:userId/:mediaType (Post list comment)
  // ===========================================================================

  describe('POST /carina/comments/lists/:userId/:mediaType', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/lists/${ALICE_ID}/anime`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Awesome anime list!' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) on invalid mediaType', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/lists/${ALICE_ID}/invalid_domain`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Comment' }),
        })
      )
      expect(res.status).toBe(400)
    })

    it('fails (404) when target user ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/lists/missing-uuid/anime', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Comment' }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (400) when content is empty', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/lists/${ALICE_ID}/game`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: '   ' }),
        })
      )
      expect(res.status).toBe(400)
    })

    it('successfully posts a comment on user media list', async () => {
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/lists/${ALICE_ID}/tv`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bobToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Your TV list is fantastic!' }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.comment.content).toBe('Your TV list is fantastic!')
      expect(json.comment.mediaType).toBe('tv')
      expect(json.comment.listOwnerId).toBe(ALICE_ID)
      expect(json.comment.author.id).toBe(BOB_ID)
    })
  })

  // ===========================================================================
  // 5. POST /carina/comments/:commentId/reply (Reply to comment)
  // ===========================================================================

  describe('POST /carina/comments/:commentId/reply', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/comm-123/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Thank you!' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when comment ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/missing-comment-id/reply', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Thank you!' }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (403) when user is not the list or profile owner (only owner can reply)', async () => {
      // Bob commented on Alice's profile
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Bob commenting',
        },
      })

      // Charlie attempts to reply to the comment
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}/reply`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${charlieToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Charlie trying to reply' }),
        })
      )
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.detail).toContain('Only the list or profile owner can reply')
    })

    it('fails (400) when a reply already exists on the comment (max 1 reply)', async () => {
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Nice profile!',
        },
      })
      // Alice replies once
      await prisma.listCommentReply.create({
        data: {
          commentId: comment.id,
          authorId: ALICE_ID,
          content: 'First reply',
        },
      })

      // Alice tries to reply a second time
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}/reply`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Second reply' }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.detail).toContain('A reply already exists')
    })

    it('successfully posts an owner reply to the comment', async () => {
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Nice profile!',
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}/reply`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Thanks Bob, appreciated!' }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.reply.content).toBe('Thanks Bob, appreciated!')
      expect(json.reply.commentId).toBe(comment.id)
      expect(json.reply.author.id).toBe(ALICE_ID)
      expect(json.reply.author.displayName).toBe('Alice Wonderland')
    })
  })

  // ===========================================================================
  // 6. DELETE /carina/comments/:commentId/reply/:replyId (Delete reply)
  // ===========================================================================

  describe('DELETE /carina/comments/:commentId/reply/:replyId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/comm-1/reply/rep-1', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when reply ID does not exist or comment ID mismatch', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/comm-1/reply/missing-rep-id', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (403) when user is not reply author, not list owner, and not admin', async () => {
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Comment',
        },
      })
      const reply = await prisma.listCommentReply.create({
        data: {
          commentId: comment.id,
          authorId: ALICE_ID,
          content: 'Alice reply',
        },
      })

      // Charlie tries to delete Alice's reply
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}/reply/${reply.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${charlieToken}` },
        })
      )
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.code).toBe('forbidden')
    })

    it('allows reply author (or list owner) to delete the reply', async () => {
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Comment',
        },
      })
      const reply = await prisma.listCommentReply.create({
        data: {
          commentId: comment.id,
          authorId: ALICE_ID,
          content: 'Alice reply',
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}/reply/${reply.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(reply.id)
      expect(json.message).toBe('Reply deleted successfully')
    })

    it('allows system administrator to delete any reply', async () => {
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Comment',
        },
      })
      const reply = await prisma.listCommentReply.create({
        data: {
          commentId: comment.id,
          authorId: ALICE_ID,
          content: 'Alice reply',
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}/reply/${reply.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(reply.id)
    })
  })

  // ===========================================================================
  // 7. DELETE /carina/comments/:commentId (Delete comment)
  // ===========================================================================

  describe('DELETE /carina/comments/:commentId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/comm-123', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when comment ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/comments/missing-comment-id', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (403) when user is not comment author, not list owner, and not admin', async () => {
      // Bob commented on Alice's profile
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Bob comment',
        },
      })

      // Charlie attempts to delete Bob's comment
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${charlieToken}` },
        })
      )
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.code).toBe('forbidden')
    })

    it('allows comment author to delete their own comment', async () => {
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Bob comment',
        },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(comment.id)
      expect(json.message).toBe('Comment deleted successfully')
    })

    it('allows list or profile owner to delete any comment on their page', async () => {
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Bob comment',
        },
      })

      // Alice (owner) deletes Bob's comment
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(comment.id)
    })

    it('allows system administrator to delete any comment', async () => {
      const comment = await prisma.listComment.create({
        data: {
          listOwnerId: ALICE_ID,
          mediaType: 'profile',
          authorId: BOB_ID,
          content: 'Bob comment',
        },
      })

      // Admin deletes comment
      const res = await app.handle(
        new Request(`http://localhost/carina/comments/${comment.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(comment.id)
    })
  })
})

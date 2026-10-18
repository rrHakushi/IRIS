import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { carinaBookmarks } from '../../src/api/controllers/carina/bookmarks.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Bookmarks and Users
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  customization: any
  passwordChangedAt: Date | null
}

interface MockBookmark {
  id: string
  userId: string
  title: string
  url: string
  icon: string | null
  color: string | null
  pinned: boolean
  appId: string | null
  group: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

let mockUsers: MockUser[] = []
let mockBookmarks: MockBookmark[] = []
let nextBookmarkId = 1

const adminWord: number = Number(new IRISBitField().add(IRISFlags.ADMINISTRATOR).toArray()[0]) || 1

function setupPrismaMock() {
  nextBookmarkId = 1
  mockBookmarks = []
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
    {
      id: '00000000-0000-0000-0000-000000000003',
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

  // Mock Bookmark findUnique
  ;(prisma.bookmark.findUnique as any) = async ({ where }: any) => {
    return mockBookmarks.find((b) => b.id === where.id) ?? null
  }

  // Mock Bookmark count
  ;(prisma.bookmark.count as any) = async ({ where }: any) => {
    return mockBookmarks.filter((b) => {
      if (where.userId && b.userId !== where.userId) return false
      if (where.group !== undefined && b.group !== where.group) return false
      if (where.pinned !== undefined && b.pinned !== where.pinned) return false
      return true
    }).length
  }

  // Mock Bookmark findMany
  ;(prisma.bookmark.findMany as any) = async ({
    where,
    skip = 0,
    take = 10,
    orderBy,
  }: any) => {
    let filtered = mockBookmarks.filter((b) => {
      if (where.userId && b.userId !== where.userId) return false
      if (where.group !== undefined && b.group !== where.group) return false
      if (where.pinned !== undefined && b.pinned !== where.pinned) return false
      return true
    })

    if (Array.isArray(orderBy)) {
      filtered.sort((a, b) => {
        for (const order of orderBy) {
          if (order.pinned) {
            const aVal = a.pinned ? 1 : 0
            const bVal = b.pinned ? 1 : 0
            if (aVal !== bVal) {
              return order.pinned === 'desc' ? bVal - aVal : aVal - bVal
            }
          }
          if (order.order) {
            const diff = order.order === 'asc' ? a.order - b.order : b.order - a.order
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

    return filtered.slice(skip, skip + take)
  }

  // Mock Bookmark create
  ;(prisma.bookmark.create as any) = async ({ data }: any) => {
    const item: MockBookmark = {
      id: `bm-${nextBookmarkId++}`,
      userId: data.userId,
      title: data.title,
      url: data.url,
      icon: data.icon ?? null,
      color: data.color ?? null,
      pinned: Boolean(data.pinned),
      appId: data.appId ?? null,
      group: data.group ?? null,
      order: data.order ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockBookmarks.push(item)
    return item
  }

  // Mock Bookmark update
  ;(prisma.bookmark.update as any) = async ({ where, data }: any) => {
    const idx = mockBookmarks.findIndex((b) => b.id === where.id)
    if (idx === -1) throw new Error('Bookmark not found')
    const current = mockBookmarks[idx]!
    const updated: MockBookmark = {
      ...current,
      ...data,
      updatedAt: new Date(),
    }
    mockBookmarks[idx] = updated
    return updated
  }

  // Mock Bookmark delete
  ;(prisma.bookmark.delete as any) = async ({ where }: any) => {
    const idx = mockBookmarks.findIndex((b) => b.id === where.id)
    if (idx === -1) throw new Error('Bookmark not found')
    const [deleted] = mockBookmarks.splice(idx, 1)
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
  .use(carinaBookmarks)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Carina Bookmarks Test Suite', () => {
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
  // 1. GET /carina/bookmarks (Get user bookmarks)
  // ===========================================================================
  describe('GET /carina/bookmarks', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('returns empty list when user has no bookmarks', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.bookmarks).toEqual([])
      expect(json.pagination.total).toBe(0)
      expect(json.pagination.page).toBe(1)
      expect(json.pagination.limit).toBe(10)
      expect(json.pagination.hasMore).toBe(false)
    })

    it('returns user bookmarks sorted by pinned status, order, and creation date', async () => {
      // 1. Normal bookmark order 2
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Manga List',
        url: 'https://iris.app/manga',
        icon: 'book',
        color: '#ff0000',
        pinned: false,
        appId: 'borealis',
        group: 'media',
        order: 2,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      })

      // 2. Pinned bookmark order 1
      mockBookmarks.push({
        id: 'bm-2',
        userId: ALICE_ID,
        title: 'Dashboard',
        url: 'https://iris.app/dashboard',
        icon: 'dashboard',
        color: null,
        pinned: true,
        appId: null,
        group: 'general',
        order: 1,
        createdAt: new Date('2026-01-02'),
        updatedAt: new Date('2026-01-02'),
      })

      // 3. Normal bookmark order 1
      mockBookmarks.push({
        id: 'bm-3',
        userId: ALICE_ID,
        title: 'Anime List',
        url: 'https://iris.app/anime',
        icon: 'movie',
        color: null,
        pinned: false,
        appId: 'borealis',
        group: 'media',
        order: 1,
        createdAt: new Date('2026-01-03'),
        updatedAt: new Date('2026-01-03'),
      })

      // Bob's bookmark (should not appear in Alice's results)
      mockBookmarks.push({
        id: 'bm-4',
        userId: BOB_ID,
        title: 'Bob Secret',
        url: 'https://iris.app/bob',
        icon: null,
        color: null,
        pinned: true,
        appId: null,
        group: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.pagination.total).toBe(3)
      expect(json.bookmarks.length).toBe(3)
      // Pinned bookmark first
      expect(json.bookmarks[0].id).toBe('bm-2')
      expect(json.bookmarks[0].pinned).toBe(true)
      // Normal bookmark with order 1 second
      expect(json.bookmarks[1].id).toBe('bm-3')
      // Normal bookmark with order 2 third
      expect(json.bookmarks[2].id).toBe('bm-1')
    })

    it('filters bookmarks by group or pinned flag', async () => {
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Work Docs',
        url: 'https://iris.app/docs',
        icon: null,
        color: null,
        pinned: true,
        appId: null,
        group: 'work',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockBookmarks.push({
        id: 'bm-2',
        userId: ALICE_ID,
        title: 'Anime',
        url: 'https://iris.app/anime',
        icon: null,
        color: null,
        pinned: false,
        appId: null,
        group: 'entertainment',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Filter by group 'work'
      const groupRes = await app.handle(
        new Request('http://localhost/carina/bookmarks?group=work', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      const groupJson = await groupRes.json()
      expect(groupJson.bookmarks.length).toBe(1)
      expect(groupJson.bookmarks[0].title).toBe('Work Docs')

      // Filter by pinned 'false'
      const pinnedRes = await app.handle(
        new Request('http://localhost/carina/bookmarks?pinned=false', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      const pinnedJson = await pinnedRes.json()
      expect(pinnedJson.bookmarks.length).toBe(1)
      expect(pinnedJson.bookmarks[0].title).toBe('Anime')
    })

    it('fails (422) on invalid pagination limit (> 50)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks?limit=100', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 2. POST /carina/bookmarks (Create bookmark)
  // ===========================================================================
  describe('POST /carina/bookmarks', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: 'My Link',
            url: 'https://example.com',
          }),
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (422) when missing required title or url', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            title: 'My Link',
            // Missing url
          }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when title or url is empty or whitespace only', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            title: '   ',
            url: 'https://example.com',
          }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
      expect(json.detail).toBe('Bookmark title cannot be empty')
    })

    it('successfully creates a bookmark with optional metadata', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            title: 'Iris Docs',
            url: 'https://docs.iris.app',
            icon: 'book',
            color: '#7c3aed',
            pinned: true,
            appId: 'docs',
            group: 'knowledge',
            order: 5,
          }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.bookmark.id).toBeDefined()
      expect(json.bookmark.userId).toBe(ALICE_ID)
      expect(json.bookmark.title).toBe('Iris Docs')
      expect(json.bookmark.url).toBe('https://docs.iris.app')
      expect(json.bookmark.icon).toBe('book')
      expect(json.bookmark.color).toBe('#7c3aed')
      expect(json.bookmark.pinned).toBe(true)
      expect(json.bookmark.appId).toBe('docs')
      expect(json.bookmark.group).toBe('knowledge')
      expect(json.bookmark.order).toBe(5)
      expect(mockBookmarks.length).toBe(1)
      expect(mockBookmarks[0]!.title).toBe('Iris Docs')
      expect(mockBookmarks[0]!.url).toBe('https://docs.iris.app')
    })
  })

  // ===========================================================================
  // 3. PATCH /carina/bookmarks/:bookmarkId (Update bookmark)
  // ===========================================================================
  describe('PATCH /carina/bookmarks/:bookmarkId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'New Title' }),
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (404) when bookmark does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-missing', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ title: 'New Title' }),
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('fails (403) when user is not owner and not administrator', async () => {
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Alice Bookmark',
        url: 'https://iris.app',
        icon: null,
        color: null,
        pinned: false,
        appId: null,
        group: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Bob tries to update Alice's bookmark
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({ title: 'Hacked by Bob' }),
        })
      )
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.code).toBe('forbidden')
    })

    it('fails (400) when updating title to empty string', async () => {
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Alice Bookmark',
        url: 'https://iris.app',
        icon: null,
        color: null,
        pinned: false,
        appId: null,
        group: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ title: '   ' }),
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
      expect(json.detail).toBe('Bookmark title cannot be empty')
    })

    it('successfully updates bookmark fields for owner', async () => {
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Old Title',
        url: 'https://old.url',
        icon: null,
        color: null,
        pinned: false,
        appId: null,
        group: 'old-group',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            title: 'New Title',
            pinned: true,
            color: '#10b981',
            order: 3,
          }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.bookmark.title).toBe('New Title')
      expect(json.bookmark.pinned).toBe(true)
      expect(json.bookmark.color).toBe('#10b981')
      expect(json.bookmark.order).toBe(3)
      expect(json.bookmark.group).toBe('old-group') // Unchanged
    })

    it('allows administrator to update any bookmark', async () => {
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Alice Link',
        url: 'https://alice.link',
        icon: null,
        color: null,
        pinned: false,
        appId: null,
        group: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ title: 'Admin Renamed' }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.bookmark.title).toBe('Admin Renamed')
    })
  })

  // ===========================================================================
  // 4. DELETE /carina/bookmarks/:bookmarkId (Delete bookmark)
  // ===========================================================================
  describe('DELETE /carina/bookmarks/:bookmarkId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('fails (404) when bookmark does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-missing', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('fails (403) when user is not owner and not administrator', async () => {
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Alice Bookmark',
        url: 'https://iris.app',
        icon: null,
        color: null,
        pinned: false,
        appId: null,
        group: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Bob attempts to delete Alice's bookmark
      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.code).toBe('forbidden')
      expect(mockBookmarks.length).toBe(1)
    })

    it('allows owner to delete their own bookmark', async () => {
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Alice Bookmark',
        url: 'https://iris.app',
        icon: null,
        color: null,
        pinned: false,
        appId: null,
        group: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe('bm-1')
      expect(mockBookmarks.length).toBe(0)
    })

    it('allows administrator to delete any bookmark', async () => {
      mockBookmarks.push({
        id: 'bm-1',
        userId: ALICE_ID,
        title: 'Alice Bookmark',
        url: 'https://iris.app',
        icon: null,
        color: null,
        pinned: false,
        appId: null,
        group: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/carina/bookmarks/bm-1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${adminToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(mockBookmarks.length).toBe(0)
    })
  })
})

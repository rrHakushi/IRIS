import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { prisma } from '@NamelessLiberty/db'
import { IRISFlags, IRISBitField } from '@NamelessLiberty/permissions'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { carinaActivity } from '../../src/api/controllers/carina/activity.ctrl'
import { carinaUsers } from '../../src/api/controllers/carina/users.ctrl'
import { borealisPlaylists } from '../../src/api/controllers/borealis/playlists.ctrl'
import { ActivityServ } from '../../src/services/carina/activity.serv'
import { BorealisListsServ } from '../../src/services/borealis/lists.serv'
import { BorealisPlaylistsServ } from '../../src/services/borealis/playlists.serv'
import { CarinaFriendsServ } from '../../src/services/carina/friends.serv'
import { CarinaRecommendationsServ } from '../../src/services/carina/recommendations.serv'
import { CarinaUsersServ } from '../../src/services/carina/users.serv'

// -----------------------------------------------------------------------------
// In-Memory Prisma 8 ORM Mock Infrastructure
// -----------------------------------------------------------------------------

interface MockState {
  User: any[]
  ActivityLog: any[]
  ActivityLike: any[]
  ActivityReply: any[]
  Anime: any[]
  AnimeList: any[]
  Manga: any[]
  MangaList: any[]
  Movie: any[]
  MovieList: any[]
  Tv: any[]
  TvList: any[]
  Game: any[]
  GameList: any[]
  Book: any[]
  BookList: any[]
  Music: any[]
  MusicList: any[]
  Other: any[]
  OtherList: any[]
  Favorite: any[]
  Friend: any[]
  FriendRequest: any[]
  CustomList: any[]
  CustomListCollaborator: any[]
  CustomListEntry: any[]
  MediaRecommendation: any[]
  MediaReview: any[]
  [key: string]: any[]
}

let mockDb: MockState
let seqCounter = 1

const MOCKED_TABLES = [
  'User',
  'ActivityLog',
  'ActivityLike',
  'ActivityReply',
  'Anime',
  'AnimeList',
  'Manga',
  'MangaList',
  'Movie',
  'MovieList',
  'Tv',
  'TvList',
  'Game',
  'GameList',
  'Book',
  'BookList',
  'Music',
  'MusicList',
  'Other',
  'OtherList',
  'Favorite',
  'Friend',
  'FriendRequest',
  'UserBlock',
  'CustomList',
  'CustomListCollaborator',
  'CustomListEntry',
  'CustomListComment',
  'MediaRecommendation',
  'MediaRecommendationVote',
  'MediaReview',
  'MediaReviewVote',
  'Connection',
  'Character',
  'Person',
  'Studio',
] as const

const ORM_MOCK_METHODS = [
  'where',
  'select',
  'include',
  'orderBy',
  'offset',
  'skip',
  'limit',
  'take',
  'all',
  'first',
  'aggregate',
  'count',
  'create',
  'update',
  'delete',
  'deleteAll',
  'deleteAndCount',
] as const

function makePred(value: boolean) {
  return {
    __mockPred: value,
    not() {
      return makePred(!this.__mockPred)
    },
  }
}

function createFieldProxy(row: any): any {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        const val = row?.[prop]
        return {
          eq: (rhs: any) => makePred(val === rhs),
          neq: (rhs: any) => makePred(val !== rhs),
          in: (arr: any[]) => makePred(Array.isArray(arr) && arr.includes(val)),
          notIn: (arr: any[]) => makePred(!Array.isArray(arr) || !arr.includes(val)),
          lt: (rhs: any) => makePred(toComparable(val) < toComparable(rhs)),
          lte: (rhs: any) => makePred(toComparable(val) <= toComparable(rhs)),
          gt: (rhs: any) => makePred(toComparable(val) > toComparable(rhs)),
          gte: (rhs: any) => makePred(toComparable(val) >= toComparable(rhs)),
          ilike: (rhs: any) =>
            makePred(
              typeof val === 'string' &&
                typeof rhs === 'string' &&
                val.toLowerCase().includes(rhs.toLowerCase())
            ),
          like: (rhs: any) =>
            makePred(
              typeof val === 'string' && typeof rhs === 'string' && val.includes(rhs)
            ),
          contains: (rhs: any) =>
            makePred(
              typeof val === 'string' &&
                typeof rhs === 'string' &&
                val.toLowerCase().includes(rhs.toLowerCase())
            ),
          isNull: () => makePred(val === null || val === undefined),
          isNotNull: () => makePred(val !== null && val !== undefined),
          desc: () => ({ field: prop, dir: 'desc' as const }),
          asc: () => ({ field: prop, dir: 'asc' as const }),
        }
      },
    }
  )
}

function toComparable(v: any): number | string {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return new Date(v).getTime()
  }
  return v
}

function evalExpr(expr: any): boolean {
  if (expr === null || expr === undefined) return true
  if (typeof expr === 'boolean') return expr
  if (typeof expr === 'object') {
    if ('__mockPred' in expr) return Boolean(expr.__mockPred)
    if (expr.kind === 'and' && Array.isArray(expr.exprs)) {
      return expr.exprs.every(evalExpr)
    }
    if (expr.kind === 'or' && Array.isArray(expr.exprs)) {
      return expr.exprs.some(evalExpr)
    }
    if (expr.kind === 'not') {
      return !evalExpr(expr.expr)
    }
  }
  return true
}

function matchesWhere(row: any, whereClause: any): boolean {
  if (!whereClause) return true
  if (typeof whereClause === 'function') {
    return evalExpr(whereClause(createFieldProxy(row)))
  }
  if (typeof whereClause === 'object') {
    for (const [k, v] of Object.entries(whereClause)) {
      if (v === undefined) continue
      if (row[k] !== v) return false
    }
  }
  return true
}

function hydrateRow(tableName: string, row: any, includes: string[]): any {
  const clone = { ...row }
  if (includes.includes('user') && clone.userId) {
    clone.user = mockDb.User.find((u) => u.id === clone.userId) ?? null
  }
  if (includes.includes('collaborators') && tableName === 'CustomList') {
    clone.collaborators = mockDb.CustomListCollaborator.filter(
      (c) => c.listId === clone.id
    )
  }
  return clone
}

function createOrmCollection(tableName: string) {
  const makeBuilder = (state: {
    wheres: any[]
    orders: Array<{ field: string; dir: 'asc' | 'desc' }>
    includes: string[]
    skipCount: number
    takeCount?: number
  }) => {
    const getFiltered = (extraWhere?: any): any[] => {
      const store = mockDb[tableName] ?? []
      const conditions = extraWhere ? [...state.wheres, extraWhere] : state.wheres
      return store.filter((row) =>
        conditions.every((w) => matchesWhere(row, w))
      )
    }

    const applySortAndSlice = (rows: any[]) => {
      let result = rows.map((r) => hydrateRow(tableName, r, state.includes))
      if (state.orders.length > 0) {
        result = [...result].sort((a, b) => {
          for (const ord of state.orders) {
            const av = toComparable(a[ord.field])
            const bv = toComparable(b[ord.field])
            if (av < bv) return ord.dir === 'asc' ? -1 : 1
            if (av > bv) return ord.dir === 'asc' ? 1 : -1
          }
          return 0
        })
      }
      if (state.skipCount > 0) {
        result = result.slice(state.skipCount)
      }
      if (state.takeCount !== undefined) {
        result = result.slice(0, state.takeCount)
      }
      return result
    }

    const builder: any = {
      where(w: any) {
        return makeBuilder({ ...state, wheres: [...state.wheres, w] })
      },
      select() {
        return makeBuilder(state)
      },
      include(rel: string) {
        return makeBuilder({ ...state, includes: [...state.includes, rel] })
      },
      orderBy(fnOrObj: any) {
        let nextOrder: { field: string; dir: 'asc' | 'desc' }[] = []
        if (typeof fnOrObj === 'function') {
          const spec = fnOrObj(createFieldProxy({}))
          if (spec?.field) nextOrder = [spec]
          else if (Array.isArray(spec)) nextOrder = spec
        } else if (fnOrObj && typeof fnOrObj === 'object') {
          nextOrder = Object.entries(fnOrObj).map(([field, dir]) => ({
            field,
            dir: dir === 'asc' ? 'asc' : 'desc',
          }))
        }
        return makeBuilder({ ...state, orders: [...state.orders, ...nextOrder] })
      },
      offset(n: number) {
        return makeBuilder({ ...state, skipCount: n })
      },
      skip(n: number) {
        return makeBuilder({ ...state, skipCount: n })
      },
      limit(n: number) {
        return makeBuilder({ ...state, takeCount: n })
      },
      take(n: number) {
        return makeBuilder({ ...state, takeCount: n })
      },
      async all(extraWhere?: any) {
        return applySortAndSlice(getFiltered(extraWhere))
      },
      async first(extraWhere?: any) {
        const list = applySortAndSlice(getFiltered(extraWhere))
        return list[0] ?? null
      },
      async aggregate(fn: any) {
        const count = getFiltered().length
        return fn({ count: () => count })
      },
      async count(extraWhere?: any) {
        return getFiltered(extraWhere).length
      },
      async create(data: any) {
        return createRow(tableName, data)
      },
      async update(data: any) {
        const targets = getFiltered()
        let updatedFirst: any = null
        for (const t of targets) {
          Object.assign(t, data, { updatedAt: data.updatedAt ?? new Date() })
          if (!updatedFirst) updatedFirst = { ...t }
        }
        return updatedFirst
      },
      async delete(extraWhere?: any) {
        const conditions = extraWhere ? [...state.wheres, extraWhere] : state.wheres
        return deleteMatching(tableName, conditions)
      },
      async deleteAll(extraWhere?: any) {
        const conditions = extraWhere ? [...state.wheres, extraWhere] : state.wheres
        return deleteMatching(tableName, conditions)
      },
      async deleteAndCount(extraWhere?: any) {
        const conditions = extraWhere ? [...state.wheres, extraWhere] : state.wheres
        return deleteMatching(tableName, conditions)
      },
    }
    return builder
  }

  return makeBuilder({
    wheres: [],
    orders: [],
    includes: [],
    skipCount: 0,
  })
}

function createRow(tableName: string, data: any) {
  if (!mockDb[tableName]) mockDb[tableName] = []
  const now = new Date()
  const numericTables = new Set([
    'Anime',
    'AnimeList',
    'Manga',
    'MangaList',
    'Movie',
    'MovieList',
    'Tv',
    'TvList',
    'Game',
    'GameList',
    'Book',
    'BookList',
    'Music',
    'MusicList',
    'Other',
    'OtherList',
  ])
  const id =
    data.id ??
    (numericTables.has(tableName)
      ? seqCounter++
      : `${tableName.toLowerCase()}-${seqCounter++}`)
  const row = {
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
    likeCount: 0,
    replyCount: 0,
    isPrivate: false,
    isSpoiler: false,
    private: false,
    ...data,
    id,
  }
  mockDb[tableName].push(row)
  return { ...row }
}

function deleteMatching(tableName: string, wheres: any[]): number {
  const store = mockDb[tableName] ?? []
  const before = store.length
  mockDb[tableName] = store.filter(
    (row) => !wheres.every((w) => matchesWhere(row, w))
  )
  return before - mockDb[tableName].length
}

const flushAsync = async (ms = 20) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const ALICE_ID = '00000000-0000-0000-0000-000000000001'
const BOB_ID = '00000000-0000-0000-0000-000000000002'
const ADMIN_ID = '00000000-0000-0000-0000-000000000003'
const CHARLIE_ID = '00000000-0000-0000-0000-000000000004'

function resetMockDb() {
  seqCounter = 1
  mockDb = {
    User: [
      {
        id: ALICE_ID,
        username: 'alice',
        email: 'alice@example.com',
        permissions: [],
        badges: [],
        passwordChangedAt: null,
        customization: {
          profile: {
            displayName: 'Alice W',
            avatarUrl: 'https://cdn.example/alice-avatar.png',
            avatarFrame: 'neon-blue',
            bannerUrl: 'https://cdn.example/alice-banner.png',
            nameplateUrl: 'https://cdn.example/alice-nameplate.png',
            bio: 'Sci-fi & fantasy nerd',
            statusText: 'Currently reading Dune',
            pronouns: 'she/her',
            displayNameStyle: { font: 'default', effect: 'gradient', color: '#3b82f6' },
          },
        },
      },
      {
        id: BOB_ID,
        username: 'bob',
        email: 'bob@example.com',
        permissions: [],
        badges: [],
        passwordChangedAt: null,
        customization: {
          profile: {
            displayName: 'Bob B',
            avatarUrl: 'https://cdn.example/bob.png',
          },
        },
      },
      {
        id: ADMIN_ID,
        username: 'admin',
        email: 'admin@example.com',
        permissions: [Number(IRISFlags.ADMINISTRATOR)],
        badges: [],
        passwordChangedAt: null,
        customization: {},
      },
      {
        id: CHARLIE_ID,
        username: 'charlie',
        email: 'charlie@example.com',
        permissions: [],
        badges: [],
        passwordChangedAt: null,
        customization: {},
      },
    ],
    ActivityLog: [],
    ActivityLike: [],
    ActivityReply: [],
    Anime: [
      {
        id: 101,
        titlePrimary: 'Frieren: Beyond Journey’s End',
        titleSecondary: 'Sousou no Frieren',
        coverImage: 'https://cdn.example/frieren.jpg',
        bannerImage: 'https://cdn.example/frieren-banner.jpg',
        format: 'TV',
        episodeCount: 28,
        status: 'FINISHED',
      },
      {
        id: 102,
        titlePrimary: 'Dungeon Meshi',
        titleSecondary: 'Delicious in Dungeon',
        coverImage: 'https://cdn.example/meshi.jpg',
        bannerImage: null,
        format: 'TV',
        episodeCount: 24,
        status: 'FINISHED',
      },
    ],
    AnimeList: [],
    Manga: [],
    MangaList: [],
    Movie: [],
    MovieList: [],
    Tv: [],
    TvList: [],
    Game: [],
    GameList: [],
    Book: [
      {
        id: 501,
        titlePrimary: 'Dune',
        titleSecondary: null,
        coverImage: 'https://cdn.example/dune.jpg',
        bannerImage: null,
        format: 'NOVEL',
        chapterCount: 48,
        volumeCount: 3,
        pageCount: 688,
      },
    ],
    BookList: [],
    Music: [],
    MusicList: [],
    Other: [],
    OtherList: [],
    Favorite: [],
    Friend: [],
    FriendRequest: [],
    UserBlock: [],
    CustomList: [],
    CustomListCollaborator: [],
    CustomListEntry: [],
    CustomListComment: [],
    MediaRecommendation: [],
    MediaRecommendationVote: [],
    MediaReview: [],
    MediaReviewVote: [],
    Connection: [],
    Character: [],
    Person: [],
    Studio: [],
  }

  for (const tableName of MOCKED_TABLES) {
    const collection = (prisma.orm.public as any)[tableName]
    if (collection) {
      const mock = createOrmCollection(tableName)
      for (const method of ORM_MOCK_METHODS) {
        collection[method] = mock[method]
      }
    }
  }
}

afterAll(() => {
  for (const tableName of MOCKED_TABLES) {
    const collection = (prisma.orm.public as any)[tableName]
    if (collection) {
      for (const method of ORM_MOCK_METHODS) {
        delete collection[method]
      }
    }
  }
})

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
  .use(carinaActivity)
  .use(carinaUsers)
  .use(borealisPlaylists)

async function authHeaders(userId: string) {
  const u = mockDb.User.find((x) => x.id === userId)!
  const token = await signUserJwt({
    id: u.id,
    username: u.username,
    email: u.email,
    permissions: u.permissions,
  })
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

describe('Carina & Borealis Activity Stream Test Suite (Prisma 8)', () => {
  beforeEach(() => {
    resetMockDb()
  })

  // ===========================================================================
  // 1. STATUS_POST & Rich Author Preview
  // ===========================================================================
  describe('POST /carina/activity (STATUS_POST)', () => {
    it('rejects unauthenticated creation (401) and empty whitespace content (400)', async () => {
      const unauth = await app.handle(
        new Request('http://localhost/carina/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Hello world' }),
        })
      )
      expect(unauth.status).toBe(401)

      const headers = await authHeaders(ALICE_ID)
      const blank = await app.handle(
        new Request('http://localhost/carina/activity', {
          method: 'POST',
          headers,
          body: JSON.stringify({ content: '    ' }),
        })
      )
      expect(blank.status).toBe(400)
    })

    it('rejects missing tagged media (404) and creates STATUS_POST with rich profile fields', async () => {
      const headers = await authHeaders(ALICE_ID)

      const notFound = await app.handle(
        new Request('http://localhost/carina/activity', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: 'Watching missing anime',
            mediaType: 'ANIME',
            mediaId: 999999,
          }),
        })
      )
      expect(notFound.status).toBe(404)

      const okRes = await app.handle(
        new Request('http://localhost/carina/activity', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: 'Episode 26 finale destroyed me',
            isSpoiler: true,
            isPrivate: true,
            mediaType: 'ANIME',
            mediaId: 101,
          }),
        })
      )

      expect(okRes.status).toBe(200)
      const json: any = await okRes.json()
      expect(json.success).toBe(true)
      expect(json.activity.type).toBe('STATUS_POST')
      expect(json.activity.mediaType).toBe('ANIME')
      expect(json.activity.mediaId).toBe(101)
      expect(json.activity.title).toBe('Frieren: Beyond Journey’s End')
      expect(json.activity.isSpoiler).toBe(true)
      expect(json.activity.isPrivate).toBe(true)
      expect(json.activity.canDelete).toBe(true)
      // Verify CarinaUsersModel no longer strips full profile customization
      expect(json.activity.user.bannerUrl).toBe('https://cdn.example/alice-banner.png')
      expect(json.activity.user.nameplateUrl).toBe('https://cdn.example/alice-nameplate.png')
      expect(json.activity.user.bio).toBe('Sci-fi & fantasy nerd')
      expect(json.activity.user.statusText).toBe('Currently reading Dune')
      expect(json.activity.user.pronouns).toBe('she/her')
      expect(json.activity.user.displayNameStyle).toMatchObject({
        font: 'default',
        effect: 'gradient',
        color: '#3b82f6',
      })
    })
  })

  // ===========================================================================
  // 2. Likes, Replies & Privacy Gating
  // ===========================================================================
  describe('ActivityLike & ActivityReply Endpoints', () => {
    it('toggles likes, syncs likeCount & viewer isLiked flag, and blocks private engagement', async () => {
      const aliceLog = createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'STATUS_POST',
        content: 'Public thoughts',
        isPrivate: false,
      })
      const alicePrivateLog = createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'STATUS_POST',
        content: 'Secret note',
        isPrivate: true,
      })

      const bobHeaders = await authHeaders(BOB_ID)

      // Bob cannot like Alice's private status post
      const privRes = await app.handle(
        new Request(`http://localhost/carina/activity/${alicePrivateLog.id}/like`, {
          method: 'POST',
          headers: bobHeaders,
        })
      )
      expect(privRes.status).toBe(403)

      // Bob likes Alice's public post
      const likeRes = await app.handle(
        new Request(`http://localhost/carina/activity/${aliceLog.id}/like`, {
          method: 'POST',
          headers: bobHeaders,
        })
      )
      expect(likeRes.status).toBe(200)
      const likedJson: any = await likeRes.json()
      expect(likedJson.liked).toBe(true)
      expect(likedJson.likeCount).toBe(1)

      // Bob appears as isLiked: true on GET /carina/users/:userId/activity
      const feedRes = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity`, {
          headers: bobHeaders,
        })
      )
      expect(feedRes.status).toBe(200)
      const feedJson: any = await feedRes.json()
      expect(feedJson.activities).toHaveLength(1) // private note excluded for Bob
      expect(feedJson.activities[0].isLiked).toBe(true)
      expect(feedJson.activities[0].likeCount).toBe(1)

      // Bob toggles unlike
      const unlikeRes = await app.handle(
        new Request(`http://localhost/carina/activity/${aliceLog.id}/like`, {
          method: 'POST',
          headers: bobHeaders,
        })
      )
      expect(unlikeRes.status).toBe(200)
      const unlikeJson: any = await unlikeRes.json()
      expect(unlikeJson.liked).toBe(false)
      expect(unlikeJson.likeCount).toBe(0)
    })

    it('creates, lists, authorizes collaborator access, and deletes replies', async () => {
      const list = createRow('CustomList', {
        id: 'clist-1',
        userId: ALICE_ID,
        name: 'Top Picks',
        isPrivate: true,
      })
      createRow('CustomListCollaborator', {
        listId: list.id,
        userId: BOB_ID,
        role: 'VIEWER',
      })
      const sharedAct = createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'CUSTOM_LIST_CREATED',
        title: 'Top Picks',
        isPrivate: true,
        metadata: { customListId: list.id, listName: 'Top Picks', action: 'LIST_CREATED' },
      })

      const bobHeaders = await authHeaders(BOB_ID)
      const charlieHeaders = await authHeaders(CHARLIE_ID)

      // Charlie (not collaborator) is forbidden from reading or replying
      const charlieGet = await app.handle(
        new Request(`http://localhost/carina/activity/${sharedAct.id}/replies`, {
          headers: charlieHeaders,
        })
      )
      expect(charlieGet.status).toBe(403)

      // Bob (collaborator on private custom list) CAN reply!
      const bobReply = await app.handle(
        new Request(`http://localhost/carina/activity/${sharedAct.id}/replies`, {
          method: 'POST',
          headers: bobHeaders,
          body: JSON.stringify({ content: 'Great list!' }),
        })
      )
      expect(bobReply.status).toBe(200)
      const bobReplyJson: any = await bobReply.json()
      expect(bobReplyJson.replyCount).toBe(1)
      expect(bobReplyJson.reply.content).toBe('Great list!')
      expect(bobReplyJson.reply.canDelete).toBe(true)

      // Alice (activity owner) lists & deletes Bob's reply
      const aliceHeaders = await authHeaders(ALICE_ID)
      const listReplies = await app.handle(
        new Request(`http://localhost/carina/activity/${sharedAct.id}/replies`, {
          headers: aliceHeaders,
        })
      )
      expect(listReplies.status).toBe(200)
      const listRepliesJson: any = await listReplies.json()
      expect(listRepliesJson.replies).toHaveLength(1)
      expect(listRepliesJson.replies[0].canDelete).toBe(true)

      // Charlie cannot delete Bob's reply
      const charlieDel = await app.handle(
        new Request(
          `http://localhost/carina/activity/${sharedAct.id}/replies/${bobReplyJson.reply.id}`,
          { method: 'DELETE', headers: charlieHeaders }
        )
      )
      expect(charlieDel.status).toBe(403)

      // Alice deletes Bob's reply
      const aliceDel = await app.handle(
        new Request(
          `http://localhost/carina/activity/${sharedAct.id}/replies/${bobReplyJson.reply.id}`,
          { method: 'DELETE', headers: aliceHeaders }
        )
      )
      expect(aliceDel.status).toBe(200)
      const aliceDelJson: any = await aliceDel.json()
      expect(aliceDelJson.replyCount).toBe(0)
    })
  })

  // ===========================================================================
  // 3. Filtering, Category Mapping ('overview' + action bugfix), Privacy & Delete
  // ===========================================================================
  describe('Carina User Activity Queries & Deletion', () => {
    it('supports domain categories, overview action query filter, privacy rules, and deletion', async () => {
      createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'LIST_ITEM_ADDED',
        mediaType: 'ANIME',
        mediaId: 101,
        title: 'Frieren',
      })
      createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'RECOMMENDATION_POSTED',
        mediaType: 'ANIME',
        mediaId: 101,
        title: 'Recommended Dungeon Meshi',
      })
      createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'USER_MILESTONE',
        title: 'Completed 10 Anime',
        mediaType: 'ANIME',
      })
      const priv = createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'STATUS_POST',
        content: 'Private diary entry',
        isPrivate: true,
      })

      // Public query omits private log
      const pubRes = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity`)
      )
      expect(pubRes.status).toBe(200)
      const pubJson: any = await pubRes.json()
      expect(pubJson.activities).toHaveLength(3)

      // Bugfix test: overview category with explicit ?action=STATUS_POST works for owner
      const aliceHeaders = await authHeaders(ALICE_ID)
      const ovRes = await app.handle(
        new Request(
          `http://localhost/carina/users/${ALICE_ID}/activity/overview?action=STATUS_POST`,
          { headers: aliceHeaders }
        )
      )
      expect(ovRes.status).toBe(200)
      const ovJson: any = await ovRes.json()
      expect(ovJson.activities).toHaveLength(1)
      expect(ovJson.activities[0].id).toBe(priv.id)

      // Domain category includes media items + USER_MILESTONE
      const animeRes = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity/anime`)
      )
      expect(animeRes.status).toBe(200)
      const animeJson: any = await animeRes.json()
      expect(animeJson.activities.length).toBeGreaterThanOrEqual(2)

      // Social category includes RECOMMENDATION_POSTED
      const socialRes = await app.handle(
        new Request(`http://localhost/carina/users/${ALICE_ID}/activity/social`)
      )
      expect(socialRes.status).toBe(200)
      const socialJson: any = await socialRes.json()
      expect(socialJson.activities.some((a: any) => a.type === 'RECOMMENDATION_POSTED')).toBe(true)

      // Admin can delete any activity; Bob cannot delete Alice's
      const bobDel = await app.handle(
        new Request(`http://localhost/carina/users/activity/${priv.id}`, {
          method: 'DELETE',
          headers: await authHeaders(BOB_ID),
        })
      )
      expect(bobDel.status).toBe(403)

      const adminDel = await app.handle(
        new Request(`http://localhost/carina/users/activity/${priv.id}`, {
          method: 'DELETE',
          headers: await authHeaders(ADMIN_ID),
        })
      )
      expect(adminDel.status).toBe(200)
    })
  })

  // ===========================================================================
  // 4. Multi-field Diffs, BOOK Bugfix, Milestones, Imports & Social Emitters
  // ===========================================================================
  describe('Service Emitters & Bug Fixes', () => {
    it('records single consolidated multi-field diff card and fixes BOOK chapters vs pages', async () => {
      // Create book entry
      await BorealisListsServ.upsertBookEntry(ALICE_ID, 501, {
        status: 'IN_PROGRESS',
        progressChapters: 2,
        progressPages: 40,
      })
      await flushAsync(40)

      const mediaLogsAfterAdd = mockDb.ActivityLog.filter(
        (l) => l.type !== 'USER_MILESTONE'
      )
      expect(mediaLogsAfterAdd).toHaveLength(1)
      expect(mediaLogsAfterAdd[0].type).toBe('LIST_ITEM_ADDED')
      expect(mediaLogsAfterAdd[0].progress).toBe(2)
      expect(mediaLogsAfterAdd[0].metadata.progressPages).toBe(40)

      // incrementBook pages works independently of chapters
      await BorealisListsServ.incrementBook(ALICE_ID, 501, {
        count: 10,
        type: 'page',
      })
      await flushAsync(40)
      const pageInc = mockDb.ActivityLog.find(
        (l) => l.type === 'LIST_PROGRESS_UPDATED'
      )
      expect(pageInc).toBeTruthy()
      expect(
        pageInc.metadata.changes.some(
          (c: any) =>
            c.field === 'progressPages' && c.from === 40 && c.to === 50
        )
      ).toBe(true)

      // Update status + chapters + pages + score in ONE save -> emits ONE card with ALL diffs!
      await BorealisListsServ.upsertBookEntry(ALICE_ID, 501, {
        status: 'COMPLETED',
        progressChapters: 48,
        progressPages: 688,
        score: 9.5,
      })
      await flushAsync(40)

      const mediaLogsAfterUpdate = mockDb.ActivityLog.filter(
        (l) => l.type !== 'USER_MILESTONE'
      )
      expect(mediaLogsAfterUpdate).toHaveLength(3)
      const updatedLog = mediaLogsAfterUpdate[2]
      expect(updatedLog.type).toBe('LIST_COMPLETED')
      expect(updatedLog.score).toBe(95)
      expect(updatedLog.metadata.exactScore).toBe(9.5)
      expect(updatedLog.metadata.progressPages).toBe(688)

      const changedFields = updatedLog.metadata.changes.map((c: any) => c.field)
      expect(changedFields).toContain('status')
      expect(changedFields).toContain('progress')
      expect(changedFields).toContain('progressPages')
      expect(changedFields).toContain('score')
    })

    it('emits deduplicated COMPLETED milestone at 10 completed anime + badge milestone', async () => {
      for (let i = 1; i <= 9; i++) {
        createRow('Anime', {
          id: 1000 + i,
          titlePrimary: `Show ${i}`,
          episodeCount: 12,
        })
        createRow('AnimeList', {
          userId: ALICE_ID,
          animeId: 1000 + i,
          status: 'COMPLETED',
          private: false,
        })
      }

      // 10th completed anime triggers COMPLETED:ANIME:10 milestone!
      await BorealisListsServ.upsertAnimeEntry(ALICE_ID, 101, {
        status: 'COMPLETED',
        progress: 28,
        score: 9,
      })
      await flushAsync(40)

      const milestones = mockDb.ActivityLog.filter(
        (l) =>
          l.type === 'USER_MILESTONE' &&
          l.metadata?.milestoneKey === 'COMPLETED:ANIME:10'
      )
      expect(milestones).toHaveLength(1)
      expect(milestones[0].title).toBe('Completed 10 Anime')

      // Re-saving completed entry does NOT duplicate the milestone
      await BorealisListsServ.upsertAnimeEntry(ALICE_ID, 101, {
        status: 'COMPLETED',
        score: 10,
      })
      await flushAsync(40)
      const milestonesAfter = mockDb.ActivityLog.filter(
        (l) =>
          l.type === 'USER_MILESTONE' &&
          l.metadata?.milestoneKey === 'COMPLETED:ANIME:10'
      )
      expect(milestonesAfter).toHaveLength(1)

      // Unlocking a badge creates a deduplicated USER_MILESTONE
      await BorealisPlaylistsServ.createPlaylist(ALICE_ID, {
        name: 'First List',
        isPrivate: false,
      })
      await CarinaUsersServ.evaluateBadges({ id: ALICE_ID, permissions: [] }, ALICE_ID)
      await flushAsync(40)

      const badgeMilestones = mockDb.ActivityLog.filter(
        (l) =>
          l.type === 'USER_MILESTONE' &&
          l.metadata?.milestoneKind === 'BADGE' &&
          l.metadata?.badgeId === 81
      )
      expect(badgeMilestones).toHaveLength(1)
    })

    it('emits single summary entry on bulk import & connection sync (suppressing per-item spam)', async () => {
      await BorealisListsServ.importUserLists(ALICE_ID, {
        items: [
          {
            mediaType: 'anime',
            title: 'Frieren: Beyond Journey’s End',
            status: 'COMPLETED',
            progress: 28,
            score: 10,
          },
          {
            mediaType: 'anime',
            title: 'Dungeon Meshi',
            status: 'IN_PROGRESS',
            progress: 12,
          },
        ],
      })
      await flushAsync(40)

      const summaries = mockDb.ActivityLog.filter(
        (l) => l.metadata?.summaryKind === 'BULK_IMPORT'
      )
      expect(summaries).toHaveLength(1)
      expect(summaries[0].title).toBe('Imported 2 list items')
      expect(mockDb.ActivityLog.filter((l) => l.type === 'LIST_ITEM_ADDED')).toHaveLength(1)

      // Connection sync emits ONE CONNECTION_SYNC summary respecting connection privacy
      ActivityServ.recordImportOrSyncSummaryActivity({
        userId: ALICE_ID,
        source: 'CONNECTION_SYNC',
        provider: 'anilist',
        importedCount: 3,
        updatedCount: 2,
        mediaTypes: ['ANIME'],
        isPrivate: true,
      })
      await flushAsync()

      const syncSummary = mockDb.ActivityLog.find(
        (l) => l.metadata?.summaryKind === 'CONNECTION_SYNC'
      )
      expect(syncSummary).toBeTruthy()
      expect(syncSummary.title).toBe('Synced 5 items from ANILIST')
      expect(syncSummary.isPrivate).toBe(true)
    })

    it('records RECOMMENDATION_POSTED and fixes CustomList + Friend isPrivate sync and reorder noise', async () => {
      // Recommendation activity
      await CarinaRecommendationsServ.submitRecommendation(ALICE_ID, {
        sourceType: 'ANIME',
        sourceId: 101,
        targetType: 'ANIME',
        targetId: 102,
        body: 'Similar comfy fantasy party vibes!',
      })
      await flushAsync()

      const recLog = mockDb.ActivityLog.find(
        (l) => l.type === 'RECOMMENDATION_POSTED'
      )
      expect(recLog).toBeTruthy()
      expect(recLog.mediaId).toBe(101)
      expect(recLog.metadata.targetMediaId).toBe(102)
      expect(recLog.metadata.targetTitle).toBe('Dungeon Meshi')

      // CustomList: create, add entry, reorder (MUST NOT log LIST_ITEM_ADDED), update privacy -> syncs logs
      const { playlist } = await BorealisPlaylistsServ.createPlaylist(ALICE_ID, {
        name: 'Cozy Watchlist',
        isPrivate: false,
      })
      await flushAsync()

      await BorealisPlaylistsServ.addPlaylistEntry(ALICE_ID, playlist.id, {
        mediaType: 'ANIME',
        mediaId: 101,
      })
      await flushAsync()

      const addedEntry = mockDb.CustomListEntry[0]
      const countBeforeReorder = mockDb.ActivityLog.length
      await BorealisPlaylistsServ.reorderEntries(ALICE_ID, playlist.id, [
        addedEntry.id,
      ])
      await flushAsync()
      expect(mockDb.ActivityLog.length).toBe(countBeforeReorder) // No bogus reorder log!

      // Toggle playlist privacy to true -> existing list logs become private
      await BorealisPlaylistsServ.updatePlaylist(ALICE_ID, playlist.id, {
        isPrivate: true,
      })
      await flushAsync()
      const listLogs = mockDb.ActivityLog.filter(
        (l) => l.metadata?.customListId === playlist.id
      )
      expect(listLogs.length).toBeGreaterThanOrEqual(2)
      expect(listLogs.every((l) => l.isPrivate === true)).toBe(true)

      // Scope test on GET /borealis/playlists/:playlistId/activity
      const strangerLogs = createRow('ActivityLog', {
        userId: CHARLIE_ID,
        type: 'LIST_ITEM_ADDED',
        metadata: { customListId: playlist.id },
      })
      expect(strangerLogs.id).toBeTruthy()

      await BorealisPlaylistsServ.addCollaborator(ALICE_ID, playlist.id, {
        username: 'bob',
        role: 'EDITOR',
      })

      const bobPlaylistActivity = await app.handle(
        new Request(`http://localhost/borealis/playlists/${playlist.id}/activity`, {
          headers: await authHeaders(BOB_ID),
        })
      )
      expect(bobPlaylistActivity.status).toBe(200)
      const bobPlJson: any = await bobPlaylistActivity.json()
      expect(bobPlJson.activity.every((a: any) => a.userId !== CHARLIE_ID)).toBe(true)

      // Friend privacy sync
      createRow('Friend', {
        id: 'fr-1',
        userId: ALICE_ID,
        friendId: BOB_ID,
        isPrivate: false,
      })
      createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'FRIEND_ADDED',
        isPrivate: false,
        metadata: { friendId: BOB_ID },
      })

      await CarinaFriendsServ.updateFriend(ALICE_ID, BOB_ID, { isPrivate: true })
      await flushAsync(40)
      const syncedFriendLog = mockDb.ActivityLog.find(
        (l) => l.type === 'FRIEND_ADDED'
      )
      expect(syncedFriendLog.isPrivate).toBe(true)
    })

    it('purges all activity types older than 30 days while retaining recent rows', async () => {
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

      createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'STATUS_POST',
        content: 'Old status',
        createdAt: oldDate,
      })
      createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'USER_MILESTONE',
        title: 'Old milestone',
        createdAt: oldDate,
      })
      const recentPost = createRow('ActivityLog', {
        userId: ALICE_ID,
        type: 'STATUS_POST',
        content: 'Fresh status',
        createdAt: recentDate,
      })

      const deletedCount = await ActivityServ.purgeOldActivities(30)
      expect(deletedCount).toBe(2)
      expect(mockDb.ActivityLog).toHaveLength(1)
      expect(mockDb.ActivityLog[0].id).toBe(recentPost.id)
    })
  })
})

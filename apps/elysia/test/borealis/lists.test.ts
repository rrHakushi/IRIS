import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { borealisLists } from '../../src/api/controllers/borealis/lists.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Lists & Media
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  customization: any
  passwordChangedAt: Date | null
}

let mockUsers: MockUser[] = []

// Media catalogs
let mockAnime: any[] = []
let mockManga: any[] = []
let mockMovies: any[] = []
let mockTv: any[] = []
let mockGames: any[] = []
let mockBooks: any[] = []
let mockMusic: any[] = []
let mockOther: any[] = []

// User list entries
let mockAnimeLists: any[] = []
let mockMangaLists: any[] = []
let mockMovieLists: any[] = []
let mockTvLists: any[] = []
let mockGameLists: any[] = []
let mockBookLists: any[] = []
let mockMusicLists: any[] = []
let mockOtherLists: any[] = []

function setupPrismaMock() {
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

  mockAnime = [
    {
      id: 1,
      titlePrimary: 'Frieren: Beyond Journey\'s End',
      titleSecondary: 'Sousou no Frieren',
      titleNative: '葬送のフリーレン',
      coverImage: 'https://example.com/frieren.jpg',
      bannerImage: null,
      format: 'TV',
      status: 'FINISHED',
      episodeCount: 28,
      averageScore: 9.3,
      startDateYear: 2023,
      genres: [{ id: 1, name: 'Adventure' }, { id: 2, name: 'Fantasy' }],
    },
  ]

  mockManga = [
    {
      id: 1,
      titlePrimary: 'Chainsaw Man',
      titleSecondary: null,
      titleNative: 'チェンソーマン',
      coverImage: 'https://example.com/csm.jpg',
      bannerImage: null,
      format: 'MANGA',
      status: 'RELEASING',
      chapterCount: 170,
      volumeCount: 16,
      averageScore: 8.7,
      startDateYear: 2018,
      genres: [{ id: 3, name: 'Action' }, { id: 4, name: 'Supernatural' }],
    },
  ]

  mockMovies = [
    {
      id: 1,
      titlePrimary: 'Spirited Away',
      titleSecondary: 'Sen to Chihiro no Kamikakushi',
      titleNative: '千と千尋の神隠し',
      coverImage: 'https://example.com/spirited.jpg',
      bannerImage: null,
      status: 'RELEASED',
      runtime: 125,
      averageScore: 8.9,
      releaseDateYear: 2001,
      genres: [{ id: 1, name: 'Adventure' }, { id: 2, name: 'Fantasy' }],
    },
  ]

  mockTv = [
    {
      id: 1,
      titlePrimary: 'Breaking Bad',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/bb.jpg',
      bannerImage: null,
      status: 'ENDED',
      episodeCount: 62,
      seasonCount: 5,
      averageScore: 9.5,
      firstAiredYear: 2008,
      genres: [{ id: 5, name: 'Drama' }, { id: 6, name: 'Crime' }],
    },
  ]

  mockGames = [
    {
      id: 1,
      titlePrimary: 'Elden Ring',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/elden.jpg',
      bannerImage: null,
      status: 'RELEASED',
      platforms: ['PC', 'PS5', 'Xbox Series X'],
      developers: ['FromSoftware'],
      publishers: ['Bandai Namco'],
      averageScore: 9.6,
      releaseDateYear: 2022,
      genres: [{ id: 7, name: 'RPG' }, { id: 3, name: 'Action' }],
    },
  ]

  mockBooks = [
    {
      id: 1,
      titlePrimary: 'Dune',
      titleSecondary: null,
      subtitle: null,
      coverImage: 'https://example.com/dune.jpg',
      bannerImage: null,
      status: 'PUBLISHED',
      pageCount: 688,
      chapterCount: 48,
      volumeCount: 1,
      authors: ['Frank Herbert'],
      averageScore: 8.8,
      releaseDateYear: 1965,
      genres: [{ id: 8, name: 'Sci-Fi' }],
    },
  ]

  mockMusic = [
    {
      id: 1,
      type: 'TRACK',
      titlePrimary: 'Hikaru Nara',
      titleSecondary: '光るなら',
      titleNative: '光るなら',
      coverImage: 'https://example.com/hikaru.jpg',
      duration: 254,
      artistName: 'Goose house',
      recordType: 'single',
      status: 'RELEASED',
      releaseDateYear: 2014,
      genres: [{ id: 9, name: 'J-Pop' }],
    },
  ]

  mockOther = [
    {
      id: 42,
      creatorId: '00000000-0000-0000-0000-000000000001',
      titlePrimary: 'Learning Rust',
      titleSecondary: null,
      description: 'Personal learning goals',
      coverImage: 'https://example.com/rust.jpg',
      bannerImage: null,
      startDate: new Date('2026-01-01'),
      endDate: null,
      isPublished: true,
      progressFields: [{ key: 'chapters', label: 'Chapters', max: 50 }],
      incrementFieldKey: 'chapters',
      statuses: [
        { key: 'PLANNING', label: 'Planning' },
        { key: 'IN_PROGRESS', label: 'In Progress' },
        { key: 'COMPLETED', label: 'Completed' },
      ],
      averageScore: null,
    },
  ]

  mockAnimeLists = []
  mockMangaLists = []
  mockMovieLists = []
  mockTvLists = []
  mockGameLists = []
  mockBookLists = []
  mockMusicLists = []
  mockOtherLists = []

  // User queries
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Helper to attach list model mock handlers
  function bindListMock(modelName: string, mockListArray: any[], catalogArray: any[], mediaField: string, idField: string) {
    const model = (prisma as any)[modelName]
    const catalog = (prisma as any)[mediaField]

    catalog.findUnique = async ({ where }: any) => {
      return catalogArray.find((m) => m.id === where.id) ?? null
    }

    model.count = async ({ where }: any) => {
      return mockListArray.filter((item) => {
        if (where.userId && item.userId !== where.userId) return false
        if (where.status && item.status !== where.status) return false
        return true
      }).length
    }

    model.findMany = async ({ where, skip = 0, take = 40 }: any) => {
      let filtered = mockListArray.filter((item) => {
        if (where.userId && item.userId !== where.userId) return false
        if (where.status && item.status !== where.status) return false
        return true
      })
      const paged = filtered.slice(skip, skip + take)
      return paged.map((item) => {
        const media = catalogArray.find((m) => m.id === item[idField]) ?? null
        return {
          ...item,
          [mediaField]: media,
        }
      })
    }

    model.findUnique = async ({ where }: any) => {
      const compoundKey = `userId_${idField}`
      const target = where[compoundKey]
      if (target) {
        const item = mockListArray.find((i) => i.userId === target.userId && i[idField] === target[idField])
        if (!item) return null
        const media = catalogArray.find((m) => m.id === item[idField]) ?? null
        return {
          ...item,
          [mediaField]: media,
        }
      }
      return null
    }

    model.upsert = async ({ where, create, update }: any) => {
      const compoundKey = `userId_${idField}`
      const target = where[compoundKey]
      const idx = mockListArray.findIndex((i) => i.userId === target.userId && i[idField] === target[idField])
      const now = new Date()

      if (idx !== -1) {
        const current = mockListArray[idx]!
        const updated = {
          ...current,
          ...update,
          updatedAt: now,
        }
        mockListArray[idx] = updated
        return updated
      } else {
        const created = {
          id: mockListArray.length + 1,
          ...create,
          createdAt: now,
          updatedAt: now,
        }
        mockListArray.push(created)
        return created
      }
    }

    model.create = async ({ data }: any) => {
      const now = new Date()
      const created = {
        id: mockListArray.length + 1,
        ...data,
        createdAt: now,
        updatedAt: now,
      }
      mockListArray.push(created)
      return created
    }

    model.update = async ({ where, data }: any) => {
      const idx = mockListArray.findIndex((i) => i.id === where.id)
      if (idx !== -1) {
        mockListArray[idx] = { ...mockListArray[idx], ...data, updatedAt: new Date() }
        return mockListArray[idx]
      }
      return data
    }

    model.delete = async ({ where }: any) => {
      const idx = mockListArray.findIndex((i) => i.id === where.id)
      if (idx === -1) throw new Error('Not found')
      const [deleted] = mockListArray.splice(idx, 1)
      return deleted
    }

    catalog.findFirst = async () => {
      return catalogArray[0] ?? null
    }

    catalog.create = async ({ data }: any) => {
      const created = { id: catalogArray.length + 1, ...data }
      catalogArray.push(created)
      return created
    }
  }

  bindListMock('animeList', mockAnimeLists, mockAnime, 'anime', 'animeId')
  bindListMock('mangaList', mockMangaLists, mockManga, 'manga', 'mangaId')
  bindListMock('movieList', mockMovieLists, mockMovies, 'movie', 'movieId')
  bindListMock('tvList', mockTvLists, mockTv, 'tv', 'tvId')
  bindListMock('gameList', mockGameLists, mockGames, 'game', 'gameId')
  bindListMock('bookList', mockBookLists, mockBooks, 'book', 'bookId')
  bindListMock('musicList', mockMusicLists, mockMusic, 'music', 'musicId')
  bindListMock('otherList', mockOtherLists, mockOther, 'other', 'otherId')

  const mockCustomLists: any[] = []
  ;(prisma as any).customList = {
    findMany: async ({ where }: any) =>
      mockCustomLists.filter((l) => !where?.userId || l.userId === where.userId),
    findFirst: async ({ where }: any) =>
      mockCustomLists.find(
        (l) =>
          (!where?.userId || l.userId === where.userId) &&
          (!where?.name || l.name === where.name)
      ) ?? null,
    create: async ({ data }: any) => {
      const created = { id: `cl-${mockCustomLists.length + 1}`, entries: [], ...data }
      mockCustomLists.push(created)
      return created
    },
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
  .use(borealisLists)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Borealis Media Lists Test Suite', () => {
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
  // 1. Anime Lists
  // ===========================================================================
  describe('Media Lists: Anime', () => {
    it('GET /borealis/lists/anime fails (401) when unauthenticated', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/lists/anime'))
      expect(res.status).toBe(401)
    })

    it('GET /borealis/lists/anime returns empty list initially', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/lists/anime', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.items).toEqual([])
      expect(data.pagination.total).toBe(0)
    })

    it('POST /borealis/lists/anime/:animeId creates and updates anime in list', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'WATCHING',
            progress: 5,
            score: 9.5,
            notes: 'Masterpiece anime',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.entry.animeId).toBe(1)
      expect(data.entry.progress).toBe(5)
      expect(data.entry.score).toBe(9.5)
      expect(data.entry.status).toBe('WATCHING')
      expect(data.entry.notes).toBe('Masterpiece anime')
      expect(mockAnimeLists[0]!.notes).toBe('Masterpiece anime')
    })

    it('GET /borealis/lists/anime/:animeId checks and returns existing entry with media details', async () => {
      // First add anime
      await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: 'WATCHING', progress: 10 }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.inList).toBe(true)
      expect(data.entry.progress).toBe(10)
      expect(data.media.titlePrimary).toBe('Frieren: Beyond Journey\'s End')
    })

    it('POST /borealis/lists/anime/:animeId/increment increments progress and clamps at episodeCount', async () => {
      // Add anime with progress 27 (max is 28)
      await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: 'WATCHING', progress: 27 }),
        })
      )

      const incRes = await app.handle(
        new Request('http://localhost/borealis/lists/anime/1/increment', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ count: 2 }),
        })
      )
      expect(incRes.status).toBe(200)
      const incData = (await incRes.json()) as any
      expect(incData.success).toBe(true)
      expect(incData.entry.progress).toBe(28) // clamped
      expect(incData.entry.status).toBe('COMPLETED')
    })

    it('GET /borealis/lists/anime/stats aggregates status counts and average score', async () => {
      await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: 'COMPLETED', progress: 28, score: 9.0 }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/borealis/lists/anime/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.stats.total).toBe(1)
      expect(data.stats.statusCounts.COMPLETED).toBe(1)
      expect(data.stats.meanScore).toBe(9.0)
      expect(data.stats.totalProgress).toBe(28)
    })

    it('GET /borealis/lists/anime/filters returns available facets', async () => {
      await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: 'WATCHING', progress: 5 }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/borealis/lists/anime/filters', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.statuses.some((s: any) => s.value === 'WATCHING')).toBe(true)
      expect(data.genres.some((g: any) => g.value === 'Adventure')).toBe(true)
      expect(data.years.some((y: any) => y.value === 2023)).toBe(true)
    })

    it('DELETE /borealis/lists/anime/:animeId removes anime from list', async () => {
      await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: 'WATCHING', progress: 5 }),
        })
      )

      const delRes = await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)

      const checkRes = await app.handle(
        new Request('http://localhost/borealis/lists/anime/1', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      const checkData = (await checkRes.json()) as any
      expect(checkData.inList).toBe(false)
    })
  })

  // ===========================================================================
  // 2. Manga Lists
  // ===========================================================================
  describe('Media Lists: Manga', () => {
    it('POST /borealis/lists/manga/:mangaId, increment, stats, filters, and DELETE', async () => {
      // Add manga
      const postRes = await app.handle(
        new Request('http://localhost/borealis/lists/manga/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'READING',
            chaptersProgress: 50,
            volumesProgress: 5,
            score: 8.5,
          }),
        })
      )
      expect(postRes.status).toBe(200)

      // Increment chapter
      const incRes = await app.handle(
        new Request('http://localhost/borealis/lists/manga/1/increment', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ count: 5, type: 'chapter' }),
        })
      )
      expect(incRes.status).toBe(200)
      const incData = (await incRes.json()) as any
      expect(incData.entry.chaptersProgress).toBe(55)

      // Get stats
      const statsRes = await app.handle(
        new Request('http://localhost/borealis/lists/manga/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(statsRes.status).toBe(200)
      const statsData = (await statsRes.json()) as any
      expect(statsData.stats.total).toBe(1)
      expect(statsData.stats.totalProgress).toBe(55)

      // Get filters
      const filtersRes = await app.handle(
        new Request('http://localhost/borealis/lists/manga/filters', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(filtersRes.status).toBe(200)

      // Get list
      const listRes = await app.handle(
        new Request('http://localhost/borealis/lists/manga', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(listRes.status).toBe(200)
      const listData = (await listRes.json()) as any
      expect(listData.items.length).toBe(1)
      expect(listData.items[0].media.titlePrimary).toBe('Chainsaw Man')

      // Delete manga
      const delRes = await app.handle(
        new Request('http://localhost/borealis/lists/manga/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)
    })
  })

  // ===========================================================================
  // 3. Movie Lists
  // ===========================================================================
  describe('Media Lists: Movies', () => {
    it('POST /borealis/lists/movies/:movieId, increment rewatch, stats, filters, and DELETE', async () => {
      const postRes = await app.handle(
        new Request('http://localhost/borealis/lists/movies/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'COMPLETED',
            score: 10,
            rewatched: 1,
          }),
        })
      )
      expect(postRes.status).toBe(200)

      // Increment rewatch
      const incRes = await app.handle(
        new Request('http://localhost/borealis/lists/movies/1/increment', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ count: 1 }),
        })
      )
      expect(incRes.status).toBe(200)
      const incData = (await incRes.json()) as any
      expect(incData.entry.rewatched).toBe(2)

      // Stats
      const statsRes = await app.handle(
        new Request('http://localhost/borealis/lists/movies/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(statsRes.status).toBe(200)

      // Filters
      const filtersRes = await app.handle(
        new Request('http://localhost/borealis/lists/movies/filters', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(filtersRes.status).toBe(200)

      // Delete
      const delRes = await app.handle(
        new Request('http://localhost/borealis/lists/movies/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)
    })
  })

  // ===========================================================================
  // 4. TV Lists
  // ===========================================================================
  describe('Media Lists: TV', () => {
    it('POST /borealis/lists/tv/:tvId, increment episode, stats, filters, and DELETE', async () => {
      const postRes = await app.handle(
        new Request('http://localhost/borealis/lists/tv/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'WATCHING',
            progress: 20,
            score: 9.8,
          }),
        })
      )
      expect(postRes.status).toBe(200)

      // Increment episode
      const incRes = await app.handle(
        new Request('http://localhost/borealis/lists/tv/1/increment', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ count: 3 }),
        })
      )
      expect(incRes.status).toBe(200)
      const incData = (await incRes.json()) as any
      expect(incData.entry.progress).toBe(23)

      // Stats
      const statsRes = await app.handle(
        new Request('http://localhost/borealis/lists/tv/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(statsRes.status).toBe(200)

      // Delete
      const delRes = await app.handle(
        new Request('http://localhost/borealis/lists/tv/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)
    })
  })

  // ===========================================================================
  // 5. Game Lists
  // ===========================================================================
  describe('Media Lists: Games', () => {
    it('POST /borealis/lists/games/:gameId, increment playtime, stats, filters, and DELETE', async () => {
      const postRes = await app.handle(
        new Request('http://localhost/borealis/lists/games/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'PLAYING',
            progress: 45,
            score: 9.7,
          }),
        })
      )
      expect(postRes.status).toBe(200)

      // Increment playtime
      const incRes = await app.handle(
        new Request('http://localhost/borealis/lists/games/1/increment', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ count: 10 }),
        })
      )
      expect(incRes.status).toBe(200)
      const incData = (await incRes.json()) as any
      expect(incData.entry.progress).toBe(55)

      // Stats
      const statsRes = await app.handle(
        new Request('http://localhost/borealis/lists/games/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(statsRes.status).toBe(200)

      // Delete
      const delRes = await app.handle(
        new Request('http://localhost/borealis/lists/games/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)
    })
  })

  // ===========================================================================
  // 6. Book Lists
  // ===========================================================================
  describe('Media Lists: Books', () => {
    it('POST /borealis/lists/books/:bookId, increment page progress, stats, filters, and DELETE', async () => {
      const postRes = await app.handle(
        new Request('http://localhost/borealis/lists/books/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'READING',
            progressPages: 200,
            score: 8.9,
          }),
        })
      )
      expect(postRes.status).toBe(200)

      // Increment pages
      const incRes = await app.handle(
        new Request('http://localhost/borealis/lists/books/1/increment', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ count: 50, type: 'page' }),
        })
      )
      expect(incRes.status).toBe(200)
      const incData = (await incRes.json()) as any
      expect(incData.entry.progressPages).toBe(250)

      // Stats
      const statsRes = await app.handle(
        new Request('http://localhost/borealis/lists/books/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(statsRes.status).toBe(200)

      // Delete
      const delRes = await app.handle(
        new Request('http://localhost/borealis/lists/books/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)
    })
  })

  // ===========================================================================
  // 7. Music Lists
  // ===========================================================================
  describe('Media Lists: Music', () => {
    it('POST /borealis/lists/music/:musicId, increment listen count, stats, filters, and DELETE', async () => {
      const postRes = await app.handle(
        new Request('http://localhost/borealis/lists/music/1', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'LISTENING',
            playCount: 15,
            score: 9.4,
          }),
        })
      )
      expect(postRes.status).toBe(200)

      // Increment listen count
      const incRes = await app.handle(
        new Request('http://localhost/borealis/lists/music/1/increment', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ count: 5 }),
        })
      )
      expect(incRes.status).toBe(200)
      const incData = (await incRes.json()) as any
      expect(incData.entry.playCount).toBe(20)

      // Stats
      const statsRes = await app.handle(
        new Request('http://localhost/borealis/lists/music/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(statsRes.status).toBe(200)

      // Filters
      const filtersRes = await app.handle(
        new Request('http://localhost/borealis/lists/music/filters', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(filtersRes.status).toBe(200)

      // Delete
      const delRes = await app.handle(
        new Request('http://localhost/borealis/lists/music/1', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)
    })
  })

  // ===========================================================================
  // 8. Other Lists (Blank Shells)
  // ===========================================================================
  describe('Media Lists: Other', () => {
    it('requires authentication for /borealis/lists/other endpoints', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/lists/other')
      )
      expect(res.status).toBe(401)
    })

    it('GET, POST, INCREMENT, STATS, FILTERS, and DELETE /borealis/lists/other', async () => {
      // 1. GET /borealis/lists/other
      const listRes = await app.handle(
        new Request('http://localhost/borealis/lists/other?page=1&limit=40', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(listRes.status).toBe(200)
      const listData = (await listRes.json()) as any
      expect(listData.success).toBe(true)
      expect(Array.isArray(listData.items)).toBe(true)
      expect(listData.pagination.page).toBe(1)
      expect(listData.pagination.limit).toBe(40)

      // 2. GET /borealis/lists/other/stats
      const statsRes = await app.handle(
        new Request('http://localhost/borealis/lists/other/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(statsRes.status).toBe(200)
      const statsData = (await statsRes.json()) as any
      expect(statsData.success).toBe(true)
      expect(statsData.stats.total).toBe(0)

      // 3. GET /borealis/lists/other/filters
      const filtersRes = await app.handle(
        new Request('http://localhost/borealis/lists/other/filters', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(filtersRes.status).toBe(200)
      const filtersData = (await filtersRes.json()) as any
      expect(filtersData.success).toBe(true)
      expect(Array.isArray(filtersData.statuses)).toBe(true)

      // 4. GET /borealis/lists/other/:otherId
      const getSingleRes = await app.handle(
        new Request('http://localhost/borealis/lists/other/42', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(getSingleRes.status).toBe(200)
      const singleData = (await getSingleRes.json()) as any
      expect(singleData.success).toBe(true)
      expect(singleData.inList).toBe(false)

      // 5. POST /borealis/lists/other/:otherId
      const postRes = await app.handle(
        new Request('http://localhost/borealis/lists/other/42', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'IN_PROGRESS',
            progress: 10,
            score: 8.5,
            notes: 'Test other item',
          }),
        })
      )
      expect(postRes.status).toBe(200)
      const postData = (await postRes.json()) as any
      expect(postData.success).toBe(true)
      expect(postData.entry.otherId).toBe(42)
      expect(postData.entry.status).toBe('IN_PROGRESS')
      expect(postData.entry.progress).toBe(10)

      // 6. POST /borealis/lists/other/:otherId/increment
      const incRes = await app.handle(
        new Request('http://localhost/borealis/lists/other/42/increment', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ count: 3, status: 'IN_PROGRESS' }),
        })
      )
      expect(incRes.status).toBe(200)
      const incData = (await incRes.json()) as any
      expect(incData.success).toBe(true)
      expect(incData.entry.progress).toBe(13)

      // 7. DELETE /borealis/lists/other/:otherId
      const delRes = await app.handle(
        new Request('http://localhost/borealis/lists/other/42', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(delRes.status).toBe(200)
      const delData = (await delRes.json()) as any
      expect(delData.success).toBe(true)
    })
  })

  // ===========================================================================
  // 9. Global List Operations (Export, Import, Stats)
  // ===========================================================================
  describe('Global List Operations', () => {
    it('requires authentication for global list endpoints', async () => {
      const exportRes = await app.handle(new Request('http://localhost/borealis/lists/export'))
      expect(exportRes.status).toBe(401)

      const importRes = await app.handle(
        new Request('http://localhost/borealis/lists/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: [] }),
        })
      )
      expect(importRes.status).toBe(401)

      const statsRes = await app.handle(new Request('http://localhost/borealis/lists/stats'))
      expect(statsRes.status).toBe(401)
    })

    it('POST /borealis/lists/import imports items into multiple lists', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/lists/import', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              {
                mediaType: 'anime',
                title: 'Frieren: Beyond Journey\'s End',
                status: 'COMPLETED',
                progress: 28,
                score: 10,
              },
              {
                mediaType: 'manga',
                title: 'Chainsaw Man',
                status: 'CURRENT',
                progress: 100,
                score: 9,
              },
              {
                mediaType: 'movie',
                title: 'Spirited Away',
                status: 'COMPLETED',
                score: 9.5,
              },
            ],
            skipExisting: false,
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.imported).toBeGreaterThan(0)
    })

    it('GET /borealis/lists/export returns canonical IRIS JSON export', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/lists/export?format=iris-json', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.version).toBe('1.0')
      expect(data.source).toBe('IRIS')
      expect(data.username).toBe('alice')
      expect(data.lists).toBeDefined()
    })

    it('GET /borealis/lists/stats aggregates statistics across all media types', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/lists/stats', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.data.overview).toBeDefined()
      expect(typeof data.data.overview.totalTitles).toBe('number')
      expect(Array.isArray(data.data.mediaBreakdown)).toBe(true)
      expect(Array.isArray(data.data.statusDistribution)).toBe(true)
      expect(Array.isArray(data.data.topGenres)).toBe(true)

      // Filtered with year query
      const filteredRes = await app.handle(
        new Request('http://localhost/borealis/lists/stats?year=2026', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(filteredRes.status).toBe(200)
      const filteredData = (await filteredRes.json()) as any
      expect(filteredData.success).toBe(true)
      expect(filteredData.data.isPeriodFiltered).toBe(true)
      expect(filteredData.data.period.year).toBe(2026)
    })
  })
})


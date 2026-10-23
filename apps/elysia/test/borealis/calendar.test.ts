import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { borealisCalendar } from '../../src/api/controllers/borealis/calendar.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { cache } from '../../src/utils/cache'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// Test App Setup
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
  .use(borealisCalendar)

// -----------------------------------------------------------------------------
// Mock Data & Fixtures
// -----------------------------------------------------------------------------

const ALICE_ID = '00000000-0000-0000-0000-000000000001'
const BOB_ID = '00000000-0000-0000-0000-000000000002'

let mockUsers: any[] = []
let mockAnimeSchedules: any[] = []
let mockManga: any[] = []
let mockGames: any[] = []
let mockBooks: any[] = []
let mockMovies: any[] = []
let mockTvEpisodes: any[] = []
let mockMusic: any[] = []

function setupPrismaMock() {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1 // 1-12

  mockUsers = [
    {
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
      permissions: [],
      passwordChangedAt: null,
    },
    {
      id: BOB_ID,
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      passwordChangedAt: null,
    },
  ]

  mockAnimeSchedules = [
    {
      id: 101,
      episodeNumber: 12,
      airingAt: new Date(Date.UTC(year, month - 1, 15, 14, 30)),
      anime: {
        id: 1,
        titlePrimary: 'Frieren: Beyond Journey\'s End',
        titleSecondary: 'Sousou no Frieren',
        titleNative: '葬送のフリーレン',
        coverImage: 'https://example.com/frieren.jpg',
        bannerImage: 'https://example.com/frieren-banner.jpg',
        format: 'TV',
        status: 'RELEASING',
        userLists: [{ id: 1, userId: ALICE_ID }],
      },
    },
    {
      id: 102,
      episodeNumber: 5,
      airingAt: new Date('2024-01-10T12:00:00Z'),
      anime: {
        id: 2,
        titlePrimary: 'Solo Leveling',
        titleSecondary: 'Na Honjaman Rebeleb',
        titleNative: '나 혼자만 레벨업',
        coverImage: 'https://example.com/sololeveling.jpg',
        bannerImage: null,
        format: 'TV',
        status: 'RELEASING',
        userLists: [],
      },
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
      startDateYear: year,
      startDateMonth: month,
      startDateDay: 10,
      endDateYear: null,
      endDateMonth: null,
      endDateDay: null,
      chapterCount: 160,
      volumeCount: 15,
      userLists: [{ id: 2, userId: ALICE_ID }],
    },
    {
      id: 2,
      titlePrimary: 'Attack on Titan',
      titleSecondary: 'Shingeki no Kyojin',
      titleNative: '進撃の巨人',
      coverImage: 'https://example.com/aot.jpg',
      bannerImage: null,
      format: 'MANGA',
      status: 'FINISHED',
      startDateYear: 2009,
      startDateMonth: 9,
      startDateDay: 9,
      endDateYear: year,
      endDateMonth: month,
      endDateDay: 25,
      chapterCount: 139,
      volumeCount: 34,
      userLists: [],
    },
  ]

  mockGames = [
    {
      id: 1,
      titlePrimary: 'Elden Ring: Shadow of the Erdtree',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/er.jpg',
      bannerImage: 'https://example.com/er-banner.jpg',
      releaseDate: new Date(Date.UTC(year, month - 1, 21, 0, 0)),
      releaseDateYear: year,
      releaseDateMonth: month,
      releaseDateDay: 21,
      platforms: ['PC', 'PS5', 'Xbox Series X'],
      status: 'RELEASED',
      userLists: [{ id: 3, userId: ALICE_ID }],
    },
  ]

  mockBooks = [
    {
      id: 1,
      titlePrimary: 'The Way of Kings',
      titleSecondary: null,
      coverImage: 'https://example.com/kings.jpg',
      bannerImage: null,
      releaseDate: null,
      releaseDateYear: year,
      releaseDateMonth: month,
      releaseDateDay: 18,
      authors: ['Brandon Sanderson'],
      series: 'The Stormlight Archive',
      format: 'Hardcover',
      userLists: [],
    },
  ]

  mockMovies = [
    {
      id: 1,
      titlePrimary: 'Oppenheimer',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/oppenheimer.jpg',
      bannerImage: null,
      releaseDateYear: year,
      releaseDateMonth: month,
      releaseDateDay: 20,
      runtime: 180,
      status: 'RELEASED',
      userLists: [{ id: 4, userId: ALICE_ID }],
    },
    {
      id: 2,
      titlePrimary: 'Dune: Part Two',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/dune2.jpg',
      bannerImage: null,
      releaseDateYear: 2024,
      releaseDateMonth: 3,
      releaseDateDay: 1,
      runtime: 166,
      status: 'RELEASED',
      userLists: [],
    },
  ]

  mockTvEpisodes = [
    {
      id: 501,
      tvId: 10,
      seasonNumber: 2,
      episodeNumber: 4,
      airDate: new Date(Date.UTC(year, month - 1, 8, 20, 0)),
      titlePrimary: 'The Bear',
      thumbnail: 'https://example.com/bear-s2e4.jpg',
      tv: {
        id: 10,
        titlePrimary: 'The Bear',
        titleSecondary: null,
        titleNative: null,
        coverImage: 'https://example.com/bear.jpg',
        bannerImage: null,
        status: 'RELEASING',
        userLists: [{ id: 5, userId: ALICE_ID }],
      },
      season: {
        seasonNumber: 2,
        titlePrimary: 'Season 2',
      },
    },
  ]

  mockMusic = [
    {
      id: 1,
      titlePrimary: 'Hit Me Hard and Soft',
      titleSecondary: null,
      coverImage: 'https://example.com/billie.jpg',
      releaseDate: new Date(Date.UTC(year, month - 1, 17, 0, 0)),
      releaseDateYear: year,
      releaseDateMonth: month,
      releaseDateDay: 17,
      type: 'ALBUM',
      artistName: 'Billie Eilish',
      recordType: 'Studio Album',
      userLists: [{ id: 6, userId: ALICE_ID }],
    },
  ]

  // Mock User resolution
  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  const getNestedUserLists = (itemUserLists: any[], selectOrInclude: any) => {
    if (!selectOrInclude?.userLists) return []
    const targetUserId = selectOrInclude.userLists.where?.userId
    if (!targetUserId) return []
    return (itemUserLists || []).filter((l: any) => l.userId === targetUserId)
  }

  // Mock AnimeAiringSchedule
  ;((prisma as any).animeAiringSchedule.findMany as any) = async ({ where, include }: any) => {
    return mockAnimeSchedules
      .filter((sched) => {
        if (where.airingAt?.gte && sched.airingAt < where.airingAt.gte) return false
        if (where.airingAt?.lte && sched.airingAt > where.airingAt.lte) return false
        if (where.anime?.userLists?.some?.userId) {
          const hasList = sched.anime.userLists.some(
            (l: any) => l.userId === where.anime.userLists.some.userId
          )
          if (!hasList) return false
        }
        return true
      })
      .map((sched) => ({
        ...sched,
        anime: {
          ...sched.anime,
          userLists: getNestedUserLists(sched.anime.userLists, include?.anime?.select),
        },
      }))
  }

  // Mock Manga
  ;((prisma as any).manga.findMany as any) = async ({ where, select }: any) => {
    return mockManga
      .filter((m) => {
        if (where.userLists?.some?.userId) {
          const hasList = m.userLists.some(
            (l: any) => l.userId === where.userLists.some.userId
          )
          if (!hasList) return false
        }
        return true
      })
      .map((m) => ({
        ...m,
        userLists: getNestedUserLists(m.userLists, select),
      }))
  }

  // Mock Game
  ;((prisma as any).game.findMany as any) = async ({ where, select }: any) => {
    return mockGames
      .filter((g) => {
        if (where.userLists?.some?.userId) {
          const hasList = g.userLists.some(
            (l: any) => l.userId === where.userLists.some.userId
          )
          if (!hasList) return false
        }
        return true
      })
      .map((g) => ({
        ...g,
        userLists: getNestedUserLists(g.userLists, select),
      }))
  }

  // Mock Book
  ;((prisma as any).book.findMany as any) = async ({ where, select }: any) => {
    return mockBooks
      .filter((b) => {
        if (where.userLists?.some?.userId) {
          const hasList = b.userLists.some(
            (l: any) => l.userId === where.userLists.some.userId
          )
          if (!hasList) return false
        }
        return true
      })
      .map((b) => ({
        ...b,
        userLists: getNestedUserLists(b.userLists, select),
      }))
  }

  // Mock Movie
  ;((prisma as any).movie.findMany as any) = async ({ where, select }: any) => {
    return mockMovies
      .filter((m) => {
        if (where.userLists?.some?.userId) {
          const hasList = m.userLists.some(
            (l: any) => l.userId === where.userLists.some.userId
          )
          if (!hasList) return false
        }
        return true
      })
      .map((m) => ({
        ...m,
        userLists: getNestedUserLists(m.userLists, select),
      }))
  }

  // Mock TvEpisode
  ;((prisma as any).tvEpisode.findMany as any) = async ({ where, include }: any) => {
    return mockTvEpisodes
      .filter((ep) => {
        if (where.airDate?.gte && ep.airDate < where.airDate.gte) return false
        if (where.airDate?.lte && ep.airDate > where.airDate.lte) return false
        if (where.tv?.userLists?.some?.userId) {
          const hasList = ep.tv.userLists.some(
            (l: any) => l.userId === where.tv.userLists.some.userId
          )
          if (!hasList) return false
        }
        return true
      })
      .map((ep) => ({
        ...ep,
        tv: {
          ...ep.tv,
          userLists: getNestedUserLists(ep.tv.userLists, include?.tv?.select),
        },
      }))
  }

  // Mock Music
  ;((prisma as any).music.findMany as any) = async ({ where, select }: any) => {
    return mockMusic
      .filter((m) => {
        if (where.userLists?.some?.userId) {
          const hasList = m.userLists.some(
            (l: any) => l.userId === where.userLists.some.userId
          )
          if (!hasList) return false
        }
        return true
      })
      .map((m) => ({
        ...m,
        userLists: getNestedUserLists(m.userLists, select),
      }))
  }
}

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Borealis Calendar Controller & Service Test Suite', () => {
  let aliceToken: string
  let bobToken: string

  beforeEach(async () => {
    Bun.env.JWT_SECRET = 'iris-default-secret-key-32-chars!!'
    await cache.clear()
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
  // 1. Default Calendar Query
  // ===========================================================================
  describe('Default Calendar Query', () => {
    it('GET /borealis/calendar returns items across media categories for current month', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/calendar'))
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.items)).toBe(true)
      expect(body.items.length).toBeGreaterThan(0)
      expect(body.meta).toBeDefined()
      expect(body.meta.total).toBe(body.items.length)
      expect(body.meta.counts).toBeDefined()

      // Counts per media type
      expect(body.meta.counts.anime).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.manga).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.movie).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.tv).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.game).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.book).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.music).toBeGreaterThanOrEqual(1)

      // Items are sorted chronologically
      for (let i = 0; i < body.items.length - 1; i++) {
        const current = new Date(body.items[i].releaseDate).getTime()
        const next = new Date(body.items[i + 1].releaseDate).getTime()
        expect(current).toBeLessThanOrEqual(next)
      }
    })

    it('returns valid metadata with start and end timestamps', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/calendar'))
      const body = await res.json()

      expect(new Date(body.meta.start).getTime()).not.toBeNaN()
      expect(new Date(body.meta.end).getTime()).not.toBeNaN()
      expect(new Date(body.meta.start).getTime()).toBeLessThan(
        new Date(body.meta.end).getTime()
      )
    })
  })

  // ===========================================================================
  // 2. Date Range Boundaries & Fallbacks
  // ===========================================================================
  describe('Date Range Filtering', () => {
    it('filters releases within custom start and end dates', async () => {
      const res = await app.handle(
        new Request(
          'http://localhost/borealis/calendar?start=2024-01-01&end=2024-01-31'
        )
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.meta.start).toBe('2024-01-01T00:00:00.000Z')
      expect(body.meta.end).toBe('2024-01-31T00:00:00.000Z')

      // Only the Solo Leveling anime schedule is in Jan 2024
      const animeEvents = body.items.filter((i: any) => i.mediaType === 'anime')
      expect(animeEvents.some((i: any) => i.mediaId === 2)).toBe(true)
    })

    it('falls back gracefully to current month when invalid date strings are provided', async () => {
      const res = await app.handle(
        new Request(
          'http://localhost/borealis/calendar?start=invalid-date&end=not-a-date'
        )
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(new Date(body.meta.start).getTime()).not.toBeNaN()
      expect(new Date(body.meta.end).getTime()).not.toBeNaN()
    })
  })

  // ===========================================================================
  // 3. Media Type Filtering & Aliases
  // ===========================================================================
  describe('Media Type Filtering', () => {
    it('returns only anime releases when types=anime', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=anime')
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.items.every((i: any) => i.mediaType === 'anime')).toBe(true)
      expect(body.meta.counts.anime).toBe(body.items.length)
      expect(body.meta.counts.movie).toBe(0)
      expect(body.meta.counts.game).toBe(0)
    })

    it('normalizes type alias "movies" to "movie"', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=movies')
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.items.length).toBeGreaterThan(0)
      expect(body.items.every((i: any) => i.mediaType === 'movie')).toBe(true)
      expect(body.meta.counts.movie).toBe(body.items.length)
    })

    it('normalizes type aliases "games,books" to "game,book"', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=games,books')
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(
        body.items.every(
          (i: any) => i.mediaType === 'game' || i.mediaType === 'book'
        )
      ).toBe(true)
      expect(body.meta.counts.game).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.book).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.anime).toBe(0)
    })

    it('supports multiple comma-separated media types e.g. tv,music', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=tv,music')
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(
        body.items.every(
          (i: any) => i.mediaType === 'tv' || i.mediaType === 'music'
        )
      ).toBe(true)
      expect(body.meta.counts.tv).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.music).toBeGreaterThanOrEqual(1)
      expect(body.meta.counts.manga).toBe(0)
    })
  })

  // ===========================================================================
  // 4. Item Detail & Content Verification
  // ===========================================================================
  describe('Item Detail Formatting', () => {
    it('verifies anime schedule contains episode details and numbers', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=anime')
      )
      const body = await res.json()
      const frieren = body.items.find((i: any) => i.mediaId === 1)

      expect(frieren).toBeDefined()
      expect(frieren.detail).toBe('Episode 12')
      expect(frieren.episodeNumber).toBe(12)
      expect(frieren.format).toBe('TV')
      expect(frieren.status).toBe('RELEASING')
    })

    it('verifies manga publishing events emit START and END kinds', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=manga')
      )
      const body = await res.json()

      const startEvent = body.items.find((i: any) => i.eventKind === 'START')
      const endEvent = body.items.find((i: any) => i.eventKind === 'END')

      expect(startEvent).toBeDefined()
      expect(startEvent.detail).toBe('Publishing Start')
      expect(endEvent).toBeDefined()
      expect(endEvent.detail).toBe('Publishing End')
    })

    it('verifies TV episodes contain Season and Episode details', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=tv')
      )
      const body = await res.json()
      const ep = body.items[0]

      expect(ep).toBeDefined()
      expect(ep.seasonNumber).toBe(2)
      expect(ep.episodeNumber).toBe(4)
      expect(ep.detail).toBe('Season 2 • Ep 4')
      expect(ep.coverImage).toBe('https://example.com/bear-s2e4.jpg')
    })

    it('verifies game releases format platforms correctly', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=game')
      )
      const body = await res.json()
      const game = body.items[0]

      expect(game).toBeDefined()
      expect(game.detail).toBe('PC, PS5')
      expect(game.mediaType).toBe('game')
    })

    it('verifies book releases format author details correctly', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=book')
      )
      const body = await res.json()
      const book = body.items[0]

      expect(book).toBeDefined()
      expect(book.detail).toBe('Brandon Sanderson')
      expect(book.format).toBe('Hardcover')
    })

    it('verifies music releases format artist and type correctly', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=music')
      )
      const body = await res.json()
      const album = body.items[0]

      expect(album).toBeDefined()
      expect(album.detail).toBe('Billie Eilish • Album')
      expect(album.format).toBe('Studio Album')
    })

    it('verifies movie releases format runtime correctly', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?types=movie')
      )
      const body = await res.json()
      const movie = body.items.find((i: any) => i.title === 'Oppenheimer')

      expect(movie).toBeDefined()
      expect(movie.detail).toBe('180m')
    })
  })

  // ===========================================================================
  // 5. User Lists Filtering & Authentication
  // ===========================================================================
  describe('User Lists & Personal Calendar', () => {
    it('returns empty results when onlyInLists=true and unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?onlyInLists=true')
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.items).toEqual([])
      expect(body.meta.total).toBe(0)
      expect(body.meta.counts.anime).toBe(0)
      expect(body.meta.counts.movie).toBe(0)
    })

    it('filters calendar to user list items when authenticated and onlyInLists=true', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar?onlyInLists=true', {
          headers: {
            Authorization: `Bearer ${aliceToken}`,
          },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.items.length).toBeGreaterThan(0)
      // All items returned should have inUserList: true
      expect(body.items.every((i: any) => i.inUserList === true)).toBe(true)
      // Book had empty userLists, so book count should be 0
      expect(body.meta.counts.book).toBe(0)
    })

    it('marks inUserList correctly when authenticated without onlyInLists constraint', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar', {
          headers: {
            Authorization: `Bearer ${aliceToken}`,
          },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      const inList = body.items.find((i: any) => i.title === 'Oppenheimer')
      const notInList = body.items.find((i: any) => i.title === 'The Way of Kings')

      expect(inList?.inUserList).toBe(true)
      expect(notInList?.inUserList).toBe(false)
    })

    it('returns inUserList as false for user Bob who has no list entries', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/calendar', {
          headers: {
            Authorization: `Bearer ${bobToken}`,
          },
        })
      )
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.items.every((i: any) => i.inUserList === false)).toBe(true)
    })
  })
})

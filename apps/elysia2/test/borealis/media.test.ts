import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { borealisMedia } from '../../src/api/controllers/borealis/media.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { prisma } from '@IRIS/database'

// Mock Data
let mockAnime: any[] = []
let mockManga: any[] = []
let mockMovies: any[] = []
let mockTv: any[] = []
let mockBooks: any[] = []
let mockGames: any[] = []
let mockMusic: any[] = []
let mockGenres: any[] = []
let mockRelations: any[] = []

function setupPrismaMock() {
  mockGenres = [
    { id: 1, name: 'Adventure', _count: { anime: 2, manga: 1, movies: 1, tv: 0, books: 2, games: 0, music: 0 } },
    { id: 2, name: 'Fantasy', _count: { anime: 2, manga: 1, movies: 0, tv: 0, books: 2, games: 2, music: 0 } },
    { id: 3, name: 'Action', _count: { anime: 1, manga: 2, movies: 2, tv: 0, books: 0, games: 2, music: 0 } },
    { id: 4, name: 'Supernatural', _count: { anime: 0, manga: 1, movies: 0, tv: 0, books: 0, games: 0, music: 0 } },
    { id: 5, name: 'Sci-Fi', _count: { anime: 0, manga: 0, movies: 2, tv: 0, books: 0, games: 0, music: 0 } },
    { id: 6, name: 'Drama', _count: { anime: 0, manga: 0, movies: 0, tv: 2, books: 0, games: 0, music: 0 } },
    { id: 7, name: 'Rock', _count: { anime: 0, manga: 0, movies: 0, tv: 0, books: 0, games: 0, music: 2 } },
  ]

  mockAnime = [
    {
      id: 1,
      titlePrimary: "Frieren: Beyond Journey's End",
      titleSecondary: 'Sousou no Frieren',
      titleNative: '葬送のフリーレン',
      coverImage: 'https://example.com/frieren.jpg',
      bannerImage: 'https://example.com/frieren-banner.jpg',
      format: 'TV',
      status: 'FINISHED',
      seasonYear: 2023,
      seasonSeason: 'FALL',
      episodeCount: 28,
      averageScore: 9.3,
      popularity: 95000,
      favorites: 45000,
      anilistId: 154587,
      genres: [{ id: 1, name: 'Adventure' }, { id: 2, name: 'Fantasy' }],
      tags: [{ id: 101, name: 'Magic' }, { id: 102, name: 'Elves' }, { id: 103, name: 'Coming of Age' }],
      studios: [{ studioId: 10, studio: { id: 10, name: 'Madhouse' } }],
      characters: [{ characterId: 1 }, { characterId: 2 }],
      staff: [{ personId: 20, person: { id: 20, namePrimary: 'Keiichirou Saitou' } }],
      episodes: [{ id: 1, number: 1, title: "The Journey's End" }],
    },
    {
      id: 2,
      titlePrimary: 'Delicious in Dungeon',
      titleSecondary: 'Dungeon Meshi',
      titleNative: 'ダンジョン飯',
      coverImage: 'https://example.com/dunmeshi.jpg',
      bannerImage: null,
      format: 'TV',
      status: 'FINISHED',
      seasonYear: 2024,
      seasonSeason: 'WINTER',
      episodeCount: 24,
      averageScore: 8.8,
      popularity: 60000,
      favorites: 28000,
      anilistId: 153518,
      genres: [{ id: 1, name: 'Adventure' }, { id: 2, name: 'Fantasy' }],
      tags: [{ id: 101, name: 'Magic' }, { id: 102, name: 'Elves' }, { id: 104, name: 'Cooking' }],
      studios: [{ studioId: 11, studio: { id: 11, name: 'Trigger' } }],
      characters: [{ characterId: 3 }],
      staff: [],
      episodes: [],
    },
    {
      id: 3,
      titlePrimary: 'Attack on Titan',
      titleSecondary: 'Shingeki no Kyojin',
      titleNative: '進撃の巨人',
      coverImage: 'https://example.com/aot.jpg',
      bannerImage: null,
      format: 'TV',
      status: 'FINISHED',
      seasonYear: 2013,
      seasonSeason: 'SPRING',
      episodeCount: 25,
      averageScore: 9.0,
      popularity: 120000,
      favorites: 80000,
      anilistId: 16498,
      genres: [{ id: 3, name: 'Action' }],
      tags: [{ id: 105, name: 'Military' }],
      studios: [{ studioId: 12, studio: { id: 12, name: 'Wit Studio' } }],
      characters: [{ characterId: 4 }],
      staff: [],
      episodes: [],
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
      startDateYear: 2018,
      chapterCount: 170,
      volumeCount: 16,
      averageScore: 8.7,
      popularity: 90000,
      favorites: 40000,
      anilistId: 105778,
      genres: [{ id: 3, name: 'Action' }, { id: 4, name: 'Supernatural' }],
      tags: [{ id: 106, name: 'Demons' }, { id: 107, name: 'Dark Fantasy' }],
      characters: [{ characterId: 5 }],
      staff: [{ personId: 30, person: { id: 30, namePrimary: 'Tatsuki Fujimoto' } }],
    },
    {
      id: 2,
      titlePrimary: 'Fire Punch',
      titleSecondary: null,
      titleNative: 'ファイアパンチ',
      coverImage: 'https://example.com/firepunch.jpg',
      bannerImage: null,
      format: 'MANGA',
      status: 'FINISHED',
      startDateYear: 2016,
      chapterCount: 83,
      volumeCount: 8,
      averageScore: 8.2,
      popularity: 45000,
      favorites: 18000,
      anilistId: 87170,
      genres: [{ id: 3, name: 'Action' }, { id: 4, name: 'Supernatural' }],
      tags: [{ id: 107, name: 'Dark Fantasy' }, { id: 108, name: 'Post-Apocalyptic' }],
      characters: [{ characterId: 6 }],
      staff: [{ personId: 30, person: { id: 30, namePrimary: 'Tatsuki Fujimoto' } }],
    },
  ]

  mockMovies = [
    {
      id: 1,
      titlePrimary: 'Inception',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/inception.jpg',
      bannerImage: null,
      runtime: 148,
      status: 'RELEASED',
      releaseDateYear: 2010,
      averageScore: 8.8,
      popularity: 150000,
      favorites: 85000,
      genres: [{ id: 5, name: 'Sci-Fi' }, { id: 3, name: 'Action' }],
      tags: [{ id: 101, name: 'Dreams' }],
      studios: [{ studioId: 10, studio: { id: 10, name: 'Warner Bros' } }],
      staff: [{ personId: 20, person: { id: 20, namePrimary: 'Christopher Nolan' } }],
      characters: [{ characterId: 1 }],
    },
    {
      id: 2,
      titlePrimary: 'Interstellar',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/interstellar.jpg',
      bannerImage: null,
      runtime: 169,
      status: 'RELEASED',
      releaseDateYear: 2014,
      averageScore: 8.7,
      popularity: 140000,
      favorites: 82000,
      genres: [{ id: 5, name: 'Sci-Fi' }, { id: 1, name: 'Adventure' }],
      tags: [{ id: 102, name: 'Space' }],
      studios: [{ studioId: 10, studio: { id: 10, name: 'Warner Bros' } }],
      staff: [{ personId: 20, person: { id: 20, namePrimary: 'Christopher Nolan' } }],
      characters: [],
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
      showType: 'Scripted',
      status: 'ENDED',
      firstAiredYear: 2008,
      episodeCount: 62,
      averageScore: 9.5,
      popularity: 160000,
      favorites: 90000,
      genres: [{ id: 6, name: 'Drama' }],
      tags: [{ id: 103, name: 'Crime' }],
      studios: [{ studioId: 12, studio: { id: 12, name: 'AMC' } }],
      staff: [{ personId: 25, person: { id: 25, namePrimary: 'Vince Gilligan' } }],
      characters: [{ characterId: 10 }],
      seasons: [],
    },
    {
      id: 2,
      titlePrimary: 'Better Call Saul',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/bcs.jpg',
      bannerImage: null,
      showType: 'Scripted',
      status: 'ENDED',
      firstAiredYear: 2015,
      episodeCount: 63,
      averageScore: 9.0,
      popularity: 110000,
      favorites: 55000,
      genres: [{ id: 6, name: 'Drama' }],
      tags: [{ id: 103, name: 'Crime' }],
      studios: [{ studioId: 12, studio: { id: 12, name: 'AMC' } }],
      staff: [{ personId: 25, person: { id: 25, namePrimary: 'Vince Gilligan' } }],
      characters: [{ characterId: 10 }],
      seasons: [],
    },
  ]

  mockBooks = [
    {
      id: 1,
      titlePrimary: 'The Hobbit',
      titleSecondary: null,
      coverImage: 'https://example.com/hobbit.jpg',
      bannerImage: null,
      format: 'Hardcover',
      status: 'PUBLISHED',
      releaseDateYear: 1937,
      pageCount: 310,
      chapterCount: 19,
      averageScore: 8.9,
      popularity: 80000,
      favorites: 40000,
      authors: ['J.R.R. Tolkien'],
      genres: [{ id: 2, name: 'Fantasy' }, { id: 1, name: 'Adventure' }],
      tags: [{ id: 105, name: 'Middle-earth' }],
      characters: [{ characterId: 20 }],
      staff: [],
      studios: [],
    },
    {
      id: 2,
      titlePrimary: 'The Fellowship of the Ring',
      titleSecondary: null,
      coverImage: 'https://example.com/lotr1.jpg',
      bannerImage: null,
      format: 'Hardcover',
      status: 'PUBLISHED',
      releaseDateYear: 1954,
      pageCount: 423,
      chapterCount: 22,
      averageScore: 9.1,
      popularity: 95000,
      favorites: 50000,
      authors: ['J.R.R. Tolkien'],
      genres: [{ id: 2, name: 'Fantasy' }, { id: 1, name: 'Adventure' }],
      tags: [{ id: 105, name: 'Middle-earth' }],
      characters: [{ characterId: 20 }],
      staff: [],
      studios: [],
    },
  ]

  mockGames = [
    {
      id: 1,
      titlePrimary: 'Elden Ring',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/eldenring.jpg',
      bannerImage: null,
      backgroundImage: null,
      status: 'RELEASED',
      releaseDateYear: 2022,
      averageScore: 9.5,
      popularity: 180000,
      favorites: 95000,
      platforms: ['PC', 'PS5', 'Xbox Series X'],
      developers: ['FromSoftware'],
      publishers: ['Bandai Namco'],
      genres: [{ id: 3, name: 'Action' }, { id: 2, name: 'Fantasy' }],
      tags: [{ id: 106, name: 'Souls-like' }],
      studios: [{ studioId: 15, studio: { id: 15, name: 'FromSoftware' } }],
    },
    {
      id: 2,
      titlePrimary: 'Dark Souls III',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/ds3.jpg',
      bannerImage: null,
      backgroundImage: null,
      status: 'RELEASED',
      releaseDateYear: 2016,
      averageScore: 9.1,
      popularity: 120000,
      favorites: 65000,
      platforms: ['PC', 'PS4', 'Xbox One'],
      developers: ['FromSoftware'],
      publishers: ['Bandai Namco'],
      genres: [{ id: 3, name: 'Action' }, { id: 2, name: 'Fantasy' }],
      tags: [{ id: 106, name: 'Souls-like' }],
      studios: [{ studioId: 15, studio: { id: 15, name: 'FromSoftware' } }],
    },
  ]

  mockMusic = [
    {
      id: 1,
      titlePrimary: 'Bohemian Rhapsody',
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/bohemian.jpg',
      duration: 354,
      type: 'TRACK',
      status: 'RELEASED',
      releaseDateYear: 1975,
      popularity: 200000,
      favorites: 100000,
      artistName: 'Queen',
      artistId: 50,
      albumId: 10,
      genres: [{ id: 7, name: 'Rock' }],
      tags: [{ id: 107, name: 'Classic Rock' }],
      artist: { id: 50, namePrimary: 'Queen' },
      album: { id: 10, titlePrimary: 'A Night at the Opera', coverImage: '...' },
      tracks: [],
      staff: [],
    },
    {
      id: 2,
      titlePrimary: "Don't Stop Me Now",
      titleSecondary: null,
      titleNative: null,
      coverImage: 'https://example.com/dontstop.jpg',
      duration: 209,
      type: 'TRACK',
      status: 'RELEASED',
      releaseDateYear: 1978,
      popularity: 170000,
      favorites: 85000,
      artistName: 'Queen',
      artistId: 50,
      albumId: 11,
      genres: [{ id: 7, name: 'Rock' }],
      tags: [{ id: 107, name: 'Classic Rock' }],
      artist: { id: 50, namePrimary: 'Queen' },
      album: { id: 11, titlePrimary: 'Jazz', coverImage: '...' },
      tracks: [],
      staff: [],
    },
  ]

  mockRelations = [
    {
      id: 1,
      sourceType: 'ANIME',
      sourceId: 1,
      targetType: 'MANGA',
      targetId: 10,
      type: 'ADAPTATION',
    },
  ]

  // Mock Prisma methods
  ;(prisma.genre.findMany as any) = async () => mockGenres

  // Anime
  ;(prisma.anime.count as any) = async () => mockAnime.length
  ;(prisma.anime.findMany as any) = async ({ where, skip = 0, take = 40 }: any) => {
    let items = mockAnime
    if (where?.id?.not) items = items.filter((a) => a.id !== where.id.not)
    return items.slice(skip, skip + take)
  }
  ;(prisma.anime.findUnique as any) = async ({ where }: any) => mockAnime.find((a) => a.id === where.id) ?? null
  ;(prisma.anime.update as any) = async ({ where, data }: any) => {
    const idx = mockAnime.findIndex((a) => a.id === where.id)
    if (idx !== -1) {
      mockAnime[idx] = { ...mockAnime[idx], ...data }
      return mockAnime[idx]
    }
    return null
  }

  // Manga
  ;(prisma.manga.count as any) = async () => mockManga.length
  ;(prisma.manga.findMany as any) = async ({ where, skip = 0, take = 40 }: any) => {
    let items = mockManga
    if (where?.id?.not) items = items.filter((m) => m.id !== where.id.not)
    return items.slice(skip, skip + take)
  }
  ;(prisma.manga.findUnique as any) = async ({ where }: any) => mockManga.find((m) => m.id === where.id) ?? null
  ;(prisma.manga.update as any) = async ({ where, data }: any) => {
    const idx = mockManga.findIndex((m) => m.id === where.id)
    if (idx !== -1) {
      mockManga[idx] = { ...mockManga[idx], ...data }
      return mockManga[idx]
    }
    return null
  }

  // Movies
  ;(prisma.movie.count as any) = async () => mockMovies.length
  ;(prisma.movie.findMany as any) = async ({ where, skip = 0, take = 40 }: any) => {
    let items = mockMovies
    if (where?.id?.not) items = items.filter((m) => m.id !== where.id.not)
    return items.slice(skip, skip + take)
  }
  ;(prisma.movie.findUnique as any) = async ({ where }: any) => mockMovies.find((m) => m.id === where.id) ?? null
  ;(prisma.movie.update as any) = async ({ where, data }: any) => {
    const idx = mockMovies.findIndex((m) => m.id === where.id)
    if (idx !== -1) {
      mockMovies[idx] = { ...mockMovies[idx], ...data }
      return mockMovies[idx]
    }
    return null
  }

  // TV
  ;(prisma.tv.count as any) = async () => mockTv.length
  ;(prisma.tv.findMany as any) = async ({ where, skip = 0, take = 40 }: any) => {
    let items = mockTv
    if (where?.id?.not) items = items.filter((t) => t.id !== where.id.not)
    return items.slice(skip, skip + take)
  }
  ;(prisma.tv.findUnique as any) = async ({ where }: any) => mockTv.find((t) => t.id === where.id) ?? null
  ;(prisma.tv.update as any) = async ({ where, data }: any) => {
    const idx = mockTv.findIndex((t) => t.id === where.id)
    if (idx !== -1) {
      mockTv[idx] = { ...mockTv[idx], ...data }
      return mockTv[idx]
    }
    return null
  }

  // Books
  ;(prisma.book.count as any) = async () => mockBooks.length
  ;(prisma.book.findMany as any) = async ({ where, skip = 0, take = 40 }: any) => {
    let items = mockBooks
    if (where?.id?.not) items = items.filter((b) => b.id !== where.id.not)
    return items.slice(skip, skip + take)
  }
  ;(prisma.book.findUnique as any) = async ({ where }: any) => mockBooks.find((b) => b.id === where.id) ?? null
  ;(prisma.book.update as any) = async ({ where, data }: any) => {
    const idx = mockBooks.findIndex((b) => b.id === where.id)
    if (idx !== -1) {
      mockBooks[idx] = { ...mockBooks[idx], ...data }
      return mockBooks[idx]
    }
    return null
  }

  // Games
  ;(prisma.game.count as any) = async () => mockGames.length
  ;(prisma.game.findMany as any) = async ({ where, skip = 0, take = 40 }: any) => {
    let items = mockGames
    if (where?.id?.not) items = items.filter((g) => g.id !== where.id.not)
    return items.slice(skip, skip + take)
  }
  ;(prisma.game.findUnique as any) = async ({ where }: any) => mockGames.find((g) => g.id === where.id) ?? null
  ;(prisma.game.update as any) = async ({ where, data }: any) => {
    const idx = mockGames.findIndex((g) => g.id === where.id)
    if (idx !== -1) {
      mockGames[idx] = { ...mockGames[idx], ...data }
      return mockGames[idx]
    }
    return null
  }

  // Music
  ;(prisma.music.count as any) = async () => mockMusic.length
  ;(prisma.music.findMany as any) = async ({ where, skip = 0, take = 40 }: any) => {
    let items = mockMusic
    if (where?.id?.not) items = items.filter((m) => m.id !== where.id.not)
    return items.slice(skip, skip + take)
  }
  ;(prisma.music.findUnique as any) = async ({ where }: any) => mockMusic.find((m) => m.id === where.id) ?? null
  ;(prisma.music.update as any) = async ({ where, data }: any) => {
    const idx = mockMusic.findIndex((m) => m.id === where.id)
    if (idx !== -1) {
      mockMusic[idx] = { ...mockMusic[idx], ...data }
      return mockMusic[idx]
    }
    return null
  }

  // MediaRelation
  ;(prisma.mediaRelation.findMany as any) = async ({ where }: any) => {
    return mockRelations.filter((r) => r.sourceType === where.sourceType && r.sourceId === where.sourceId)
  }
}

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
    return {
      type: 'internal-error',
      title: 'Internal Server Error',
      status: 500,
      code: 'internal-error',
      detail: error instanceof Error ? error.message : String(error),
    }
  })
  .use(borealisMedia)

describe('Borealis Media Metadata Test Suite', () => {
  beforeEach(() => {
    setupPrismaMock()
  })

  // ===========================================================================
  // 1. Anime Metadata Tests
  // ===========================================================================
  describe('Media Metadata: Anime', () => {
    it('GET /borealis/media/anime returns paginated catalog (40 per page default)', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/anime?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(40)
      expect(data.items[0].mediaType).toBe('anime')
    })

    it('GET /borealis/media/anime/filters returns facet counts for statuses, formats, genres, years', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/anime/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
      expect(Array.isArray(data.formats)).toBe(true)
      expect(Array.isArray(data.genres)).toBe(true)
      expect(Array.isArray(data.years)).toBe(true)
    })

    it('GET /borealis/media/anime/:id returns detailed anime metadata with relations', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/anime/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.media.id).toBe(1)
      expect(data.media.titlePrimary).toBe("Frieren: Beyond Journey's End")
      expect(data.media.relations).toBeDefined()
    })

    it('GET /borealis/media/anime/:id fails (404) when anime does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/anime/999'))
      expect(res.status).toBe(404)
    })

    it('POST /borealis/media/anime/:id/refresh queues metadata refresh', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/media/anime/1/refresh', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toContain('Metadata refresh requested')
      expect(data.timestamp).toBeDefined()
    })

    it('GET /borealis/media/anime/:id/similar returns improved multi-factor recommendations with match reasons', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/anime/1/similar?limit=10'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.sourceId).toBe(1)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)

      const topMatch = data.items[0]
      expect(topMatch.id).toBe(2)
      expect(topMatch.titlePrimary).toBe('Delicious in Dungeon')
      expect(topMatch.similarityScore).toBeGreaterThan(0)
      expect(Array.isArray(topMatch.matchReasons)).toBe(true)
      expect(topMatch.matchReasons.some((r: string) => r.includes('Shared genres'))).toBe(true)
    })
  })

  // ===========================================================================
  // 2. Manga Metadata Tests
  // ===========================================================================
  describe('Media Metadata: Manga', () => {
    it('GET /borealis/media/manga returns paginated manga catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/manga?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items[0].mediaType).toBe('manga')
    })

    it('GET /borealis/media/manga/filters returns facet counts for manga', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/manga/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
      expect(Array.isArray(data.formats)).toBe(true)
      expect(Array.isArray(data.genres)).toBe(true)
      expect(Array.isArray(data.years)).toBe(true)
    })

    it('GET /borealis/media/manga/:id returns detailed manga metadata', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/manga/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.media.id).toBe(1)
      expect(data.media.titlePrimary).toBe('Chainsaw Man')
    })

    it('GET /borealis/media/manga/:id fails (404) when manga does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/manga/999'))
      expect(res.status).toBe(404)
    })

    it('POST /borealis/media/manga/:id/refresh queues metadata refresh', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/media/manga/1/refresh', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toContain('Metadata refresh requested')
    })

    it('GET /borealis/media/manga/:id/similar returns author and theme matched recommendations', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/manga/1/similar?limit=10'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.sourceId).toBe(1)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)

      const topMatch = data.items[0]
      expect(topMatch.id).toBe(2)
      expect(topMatch.titlePrimary).toBe('Fire Punch')
      expect(topMatch.similarityScore).toBeGreaterThan(0)
      expect(topMatch.matchReasons.some((r: string) => r.includes('Same author / artist'))).toBe(true)
    })
  })

  // ===========================================================================
  // 3. Movie Metadata Tests
  // ===========================================================================
  describe('Media Metadata: Movies', () => {
    it('GET /borealis/media/movies returns paginated movie catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/movies?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items[0].mediaType).toBe('movie')
      expect(data.items[0].format).toBe('MOVIE')
    })

    it('GET /borealis/media/movies/filters returns facet counts for movies', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/movies/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
      expect(Array.isArray(data.genres)).toBe(true)
      expect(Array.isArray(data.years)).toBe(true)
    })

    it('GET /borealis/media/movies/:id returns detailed movie metadata', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/movies/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.media.id).toBe(1)
      expect(data.media.titlePrimary).toBe('Inception')
    })

    it('GET /borealis/media/movies/:id fails (404) when movie does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/movies/999'))
      expect(res.status).toBe(404)
    })

    it('POST /borealis/media/movies/:id/refresh queues metadata refresh', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/media/movies/1/refresh', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toContain('Metadata refresh requested')
    })

    it('GET /borealis/media/movies/:id/similar returns director and studio matched recommendations', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/movies/1/similar?limit=10'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.sourceId).toBe(1)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)

      const topMatch = data.items[0]
      expect(topMatch.id).toBe(2)
      expect(topMatch.titlePrimary).toBe('Interstellar')
      expect(topMatch.similarityScore).toBeGreaterThan(0)
      expect(topMatch.matchReasons.some((r: string) => r.includes('Same director / crew'))).toBe(true)
    })
  })

  // ===========================================================================
  // 4. TV Metadata Tests
  // ===========================================================================
  describe('Media Metadata: TV', () => {
    it('GET /borealis/media/tv returns paginated TV catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/tv?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items[0].mediaType).toBe('tv')
    })

    it('GET /borealis/media/tv/filters returns facet counts for TV', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/tv/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
      expect(Array.isArray(data.formats)).toBe(true)
      expect(Array.isArray(data.genres)).toBe(true)
    })

    it('GET /borealis/media/tv/:id returns detailed TV metadata', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/tv/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.media.id).toBe(1)
      expect(data.media.titlePrimary).toBe('Breaking Bad')
    })

    it('GET /borealis/media/tv/:id fails (404) when TV series does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/tv/999'))
      expect(res.status).toBe(404)
    })

    it('POST /borealis/media/tv/:id/refresh queues metadata refresh', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/media/tv/1/refresh', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toContain('Metadata refresh requested')
    })

    it('GET /borealis/media/tv/:id/similar returns creator and network matched recommendations', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/tv/1/similar?limit=10'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.sourceId).toBe(1)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)

      const topMatch = data.items[0]
      expect(topMatch.id).toBe(2)
      expect(topMatch.titlePrimary).toBe('Better Call Saul')
      expect(topMatch.similarityScore).toBeGreaterThan(0)
      expect(topMatch.matchReasons.some((r: string) => r.includes('Same creator / crew'))).toBe(true)
    })
  })

  // ===========================================================================
  // 5. Books Metadata Tests
  // ===========================================================================
  describe('Media Metadata: Books', () => {
    it('GET /borealis/media/books returns paginated books catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/books?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items[0].mediaType).toBe('book')
    })

    it('GET /borealis/media/books/filters returns facet counts for books', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/books/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
      expect(Array.isArray(data.formats)).toBe(true)
      expect(Array.isArray(data.genres)).toBe(true)
    })

    it('GET /borealis/media/books/:id returns detailed book metadata', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/books/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.media.id).toBe(1)
      expect(data.media.titlePrimary).toBe('The Hobbit')
    })

    it('GET /borealis/media/books/:id fails (404) when book does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/books/999'))
      expect(res.status).toBe(404)
    })

    it('POST /borealis/media/books/:id/refresh queues metadata refresh', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/media/books/1/refresh', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toContain('Metadata refresh requested')
    })

    it('GET /borealis/media/books/:id/similar returns author matched recommendations', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/books/1/similar?limit=10'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.sourceId).toBe(1)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)

      const topMatch = data.items[0]
      expect(topMatch.id).toBe(2)
      expect(topMatch.titlePrimary).toBe('The Fellowship of the Ring')
      expect(topMatch.similarityScore).toBeGreaterThan(0)
      expect(topMatch.matchReasons.some((r: string) => r.includes('Same author'))).toBe(true)
    })
  })

  // ===========================================================================
  // 6. Games Metadata Tests
  // ===========================================================================
  describe('Media Metadata: Games', () => {
    it('GET /borealis/media/games returns paginated games catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/games?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items[0].mediaType).toBe('game')
    })

    it('GET /borealis/media/games/filters returns facet counts for games', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/games/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
      expect(Array.isArray(data.genres)).toBe(true)
    })

    it('GET /borealis/media/games/:id returns detailed game metadata', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/games/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.media.id).toBe(1)
      expect(data.media.titlePrimary).toBe('Elden Ring')
    })

    it('GET /borealis/media/games/:id fails (404) when game does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/games/999'))
      expect(res.status).toBe(404)
    })

    it('POST /borealis/media/games/:id/refresh queues metadata refresh', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/media/games/1/refresh', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toContain('Metadata refresh requested')
    })

    it('GET /borealis/media/games/:id/similar returns developer matched recommendations', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/games/1/similar?limit=10'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.sourceId).toBe(1)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)

      const topMatch = data.items[0]
      expect(topMatch.id).toBe(2)
      expect(topMatch.titlePrimary).toBe('Dark Souls III')
      expect(topMatch.similarityScore).toBeGreaterThan(0)
      expect(topMatch.matchReasons.some((r: string) => r.includes('Same developer'))).toBe(true)
    })
  })

  // ===========================================================================
  // 7. Music Metadata Tests
  // ===========================================================================
  describe('Media Metadata: Music', () => {
    it('GET /borealis/media/music returns paginated music catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/music?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items[0].mediaType).toBe('music')
    })

    it('GET /borealis/media/music/filters returns facet counts for music', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/music/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
      expect(Array.isArray(data.formats)).toBe(true)
      expect(Array.isArray(data.genres)).toBe(true)
    })

    it('GET /borealis/media/music/:id returns detailed music metadata', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/music/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.media.id).toBe(1)
      expect(data.media.titlePrimary).toBe('Bohemian Rhapsody')
    })

    it('GET /borealis/media/music/:id fails (404) when track does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/music/999'))
      expect(res.status).toBe(404)
    })

    it('POST /borealis/media/music/:id/refresh queues metadata refresh', async () => {
      const res = await app.handle(
        new Request('http://localhost/borealis/media/music/1/refresh', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.message).toContain('Metadata refresh requested')
    })

    it('GET /borealis/media/music/:id/similar returns artist matched recommendations', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/media/music/1/similar?limit=10'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.sourceId).toBe(1)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)

      const topMatch = data.items[0]
      expect(topMatch.id).toBe(2)
      expect(topMatch.titlePrimary).toBe("Don't Stop Me Now")
      expect(topMatch.similarityScore).toBeGreaterThan(0)
      expect(topMatch.matchReasons.some((r: string) => r.includes('Same artist'))).toBe(true)
    })
  })
})

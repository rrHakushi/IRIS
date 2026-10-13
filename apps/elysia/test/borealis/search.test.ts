import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { borealisSearch } from '../../src/api/controllers/borealis/search.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { prisma } from '@IRIS/database'

// Mock Catalogs
const mockAnime = [
  {
    id: 1,
    titlePrimary: 'Frieren: Beyond Journey\'s End',
    titleSecondary: 'Sousou no Frieren',
    titleNative: '葬送のフリーレン',
    coverImage: 'https://example.com/frieren.jpg',
    bannerImage: null,
    format: 'TV',
    status: 'FINISHED',
    seasonYear: 2023,
    seasonSeason: 'FALL',
    episodeCount: 28,
    averageScore: 9.3,
    genres: [{ id: 1, name: 'Adventure' }],
  },
]

const mockManga = [
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
    genres: [{ id: 2, name: 'Action' }],
  },
]

const mockMovies = [
  {
    id: 1,
    titlePrimary: 'Spirited Away',
    titleSecondary: 'Sen to Chihiro no Kamikakushi',
    titleNative: '千と千尋の神隠し',
    coverImage: 'https://example.com/spirited.jpg',
    bannerImage: null,
    duration: 125,
    releaseDateYear: 2001,
    averageScore: 8.9,
    genres: [{ id: 1, name: 'Adventure' }],
  },
]

const mockTv = [
  {
    id: 1,
    titlePrimary: 'Breaking Bad',
    titleSecondary: null,
    titleNative: null,
    coverImage: 'https://example.com/bb.jpg',
    bannerImage: null,
    episodeCount: 62,
    releaseDateYear: 2008,
    averageScore: 9.5,
    genres: [{ id: 3, name: 'Drama' }],
  },
]

const mockGames = [
  {
    id: 1,
    titlePrimary: 'Elden Ring',
    titleSecondary: null,
    coverImage: 'https://example.com/elden.jpg',
    averageScore: 9.6,
  },
]

const mockBooks = [
  {
    id: 1,
    titlePrimary: 'Dune',
    titleSecondary: null,
    authors: ['Frank Herbert'],
    coverImage: 'https://example.com/dune.jpg',
    pageCount: 688,
    releaseDateYear: 1965,
    averageScore: 8.8,
    genres: [{ id: 4, name: 'Sci-Fi' }],
  },
]

const mockMusic = [
  {
    id: 1,
    titlePrimary: 'Hikaru Nara',
    titleSecondary: '光るなら',
    artistName: 'Goose house',
    albumTitle: 'Hikaru Nara',
    coverImage: 'https://example.com/hikaru.jpg',
    type: 'TRACK',
    durationMs: 254000,
    releaseDateYear: 2014,
    genres: [{ id: 5, name: 'J-Pop' }],
  },
]

const mockCharacters = [
  {
    id: 1,
    namePrimary: 'Frieren',
    nameNative: 'フリーレン',
    image: 'https://example.com/frieren-char.jpg',
    gender: 'Female',
    age: '1000+',
    description: 'Elven mage',
  },
]

const mockPeople = [
  {
    id: 1,
    namePrimary: 'Hayao Miyazaki',
    nameNative: '宮崎 駿',
    image: 'https://example.com/miyazaki.jpg',
    language: 'Japanese',
    primaryOccupations: ['Director', 'Animator'],
    description: 'Studio Ghibli co-founder',
  },
]

const mockStudios = [
  {
    id: 1,
    name: 'Studio Ghibli',
    isAnimationStudio: true,
    siteUrl: 'https://www.ghibli.jp',
    favorites: 50000,
  },
]

function setupPrismaMock() {
  function bindSearchMock(modelName: string, items: any[]) {
    const model = (prisma as any)[modelName]
    model.count = async ({ where }: any) => {
      return items.length
    }
    model.findMany = async ({ where, skip = 0, take = 20 }: any) => {
      return items.slice(skip, skip + take)
    }
  }

  bindSearchMock('anime', mockAnime)
  bindSearchMock('manga', mockManga)
  bindSearchMock('movie', mockMovies)
  bindSearchMock('tv', mockTv)
  bindSearchMock('game', mockGames)
  bindSearchMock('book', mockBooks)
  bindSearchMock('music', mockMusic)
  bindSearchMock('character', mockCharacters)
  bindSearchMock('person', mockPeople)
  bindSearchMock('studio', mockStudios)
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
  .use(borealisSearch)

describe('Comprehensive Borealis Media Search Test Suite', () => {
  beforeEach(() => {
    setupPrismaMock()
  })

  it('GET /borealis/search fails (422) when query q is missing or empty', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search'))
    expect(res.status).toBe(422)

    const emptyRes = await app.handle(new Request('http://localhost/borealis/search?q='))
    expect(emptyRes.status).toBe(422)
  })

  it('GET /borealis/search defaults to media category and returns combined results', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=ring'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('media')
    expect(data.query).toBe('ring')
    expect(Array.isArray(data.results)).toBe(true)
    expect(data.pagination.page).toBe(1)
  })

  it('GET /borealis/search searches anime category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=frieren&category=anime'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('anime')
    expect(data.results.length).toBeGreaterThan(0)
    expect(data.results[0].mediaType).toBe('anime')
    expect(data.results[0].titlePrimary).toBe('Frieren: Beyond Journey\'s End')
  })

  it('GET /borealis/search searches manga category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=chainsaw&category=manga'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('manga')
    expect(data.results[0].mediaType).toBe('manga')
    expect(data.results[0].titlePrimary).toBe('Chainsaw Man')
  })

  it('GET /borealis/search searches movies category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=spirited&category=movies'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('movies')
    expect(data.results[0].mediaType).toBe('movie')
  })

  it('GET /borealis/search searches tv category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=breaking&category=tv'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('tv')
    expect(data.results[0].mediaType).toBe('tv')
  })

  it('GET /borealis/search searches music category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=hikaru&category=music'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('music')
    expect(data.results[0].mediaType).toBe('music')
  })

  it('GET /borealis/search searches books category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=dune&category=books'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('books')
    expect(data.results[0].mediaType).toBe('book')
  })

  it('GET /borealis/search searches characters category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=frieren&category=characters'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('characters')
    expect(data.results[0].namePrimary).toBe('Frieren')
  })

  it('GET /borealis/search searches people category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=miyazaki&category=people'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('people')
    expect(data.results[0].namePrimary).toBe('Hayao Miyazaki')
  })

  it('GET /borealis/search searches studios category', async () => {
    const res = await app.handle(new Request('http://localhost/borealis/search?q=ghibli&category=studios'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.category).toBe('studios')
    expect(data.results[0].name).toBe('Studio Ghibli')
  })
})

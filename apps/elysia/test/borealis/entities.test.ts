import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { borealisEntities } from '../../src/api/controllers/borealis/entities.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { prisma } from '@IRIS/database'

// Mock Data
let mockCharacters: any[] = []
let mockPeople: any[] = []
let mockStudios: any[] = []
let mockMediaStudios: any[] = []

function setupPrismaMock() {
  mockCharacters = [
    {
      id: 1,
      namePrimary: 'Frieren',
      nameNative: 'フリーレン',
      image: 'https://example.com/frieren-char.jpg',
      gender: 'Female',
      age: '1000+',
      favorites: 12000,
      mediaCharacters: [
        {
          id: 1,
          role: 'MAIN',
          order: 1,
          actor: { id: 10, namePrimary: 'Atsumi Tanezaki' },
          anime: {
            id: 1,
            titlePrimary: "Frieren: Beyond Journey's End",
            titleSecondary: 'Sousou no Frieren',
            titleNative: '葬送のフリーレン',
            coverImage: 'https://example.com/frieren.jpg',
            bannerImage: null,
            format: 'TV',
            seasonYear: 2023,
            averageScore: 9.3,
          },
        },
      ],
    },
    {
      id: 2,
      namePrimary: 'Fern',
      nameNative: 'フェルン',
      image: 'https://example.com/fern.jpg',
      gender: 'Female',
      age: '18',
      favorites: 8500,
      mediaCharacters: [],
    },
  ]

  mockPeople = [
    {
      id: 1,
      namePrimary: 'Atsumi Tanezaki',
      nameNative: '種﨑 敦美',
      givenName: 'Atsumi',
      familyName: 'Tanezaki',
      image: 'https://example.com/tanezaki.jpg',
      primaryOccupations: ['Voice Actor'],
      language: 'Japanese',
      gender: 'Female',
      favorites: 9500,
      voicedCharacters: [
        {
          id: 1,
          character: { id: 1, namePrimary: 'Frieren' },
          anime: {
            id: 1,
            titlePrimary: "Frieren: Beyond Journey's End",
            titleSecondary: null,
            coverImage: 'https://example.com/frieren.jpg',
            format: 'TV',
            seasonYear: 2023,
            averageScore: 9.3,
          },
        },
      ],
      mediaStaff: [],
      musicTracks: [],
    },
    {
      id: 2,
      namePrimary: 'Christopher Nolan',
      nameNative: null,
      givenName: 'Christopher',
      familyName: 'Nolan',
      image: 'https://example.com/nolan.jpg',
      primaryOccupations: ['Director', 'Producer', 'Screenwriter'],
      language: 'English',
      gender: 'Male',
      favorites: 25000,
      voicedCharacters: [],
      mediaStaff: [
        {
          id: 1,
          movie: {
            id: 1,
            titlePrimary: 'Inception',
            titleSecondary: null,
            coverImage: 'https://example.com/inception.jpg',
            releaseDateYear: 2010,
            averageScore: 8.8,
          },
        },
      ],
      musicTracks: [],
    },
  ]

  mockStudios = [
    {
      id: 1,
      name: 'Madhouse',
      isAnimationStudio: true,
      siteUrl: 'https://madhouse.co.jp',
      favorites: 35000,
    },
    {
      id: 2,
      name: 'Warner Bros. Pictures',
      isAnimationStudio: false,
      siteUrl: 'https://warnerbros.com',
      favorites: 42000,
    },
  ]

  mockMediaStudios = [
    {
      id: 1,
      studioId: 1,
      anime: {
        id: 1,
        titlePrimary: "Frieren: Beyond Journey's End",
        titleSecondary: null,
        titleNative: null,
        coverImage: 'https://example.com/frieren.jpg',
        bannerImage: null,
        format: 'TV',
        seasonYear: 2023,
        averageScore: 9.3,
        popularity: 95000,
        favorites: 45000,
        status: 'FINISHED',
      },
    },
  ]

  // Mock Prisma methods
  // Character
  ;(prisma.character.count as any) = async () => mockCharacters.length
  ;(prisma.character.findMany as any) = async ({ skip = 0, take = 40 }: any) => {
    return mockCharacters.slice(skip, skip + take)
  }
  ;(prisma.character.findUnique as any) = async ({ where }: any) => {
    return mockCharacters.find((c) => c.id === where.id) ?? null
  }

  // Person
  ;(prisma.person.count as any) = async () => mockPeople.length
  ;(prisma.person.findMany as any) = async ({ skip = 0, take = 40 }: any) => {
    return mockPeople.slice(skip, skip + take)
  }
  ;(prisma.person.findUnique as any) = async ({ where }: any) => {
    return mockPeople.find((p) => p.id === where.id) ?? null
  }

  // Studio
  ;(prisma.studio.count as any) = async (args?: any) => {
    if (args?.where?.isAnimationStudio !== undefined) {
      return mockStudios.filter((s) => s.isAnimationStudio === args.where.isAnimationStudio).length
    }
    return mockStudios.length
  }
  ;(prisma.studio.findMany as any) = async ({ skip = 0, take = 40 }: any) => {
    return mockStudios.slice(skip, skip + take)
  }
  ;(prisma.studio.findUnique as any) = async ({ where }: any) => {
    return mockStudios.find((s) => s.id === where.id) ?? null
  }

  // MediaStudio
  ;(prisma.mediaStudio.count as any) = async () => mockMediaStudios.length
  ;(prisma.mediaStudio.findMany as any) = async () => mockMediaStudios
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
  .use(borealisEntities)

describe('Borealis Characters, People & Studios Test Suite', () => {
  beforeEach(() => {
    setupPrismaMock()
  })

  // ===========================================================================
  // 1. Characters Tests
  // ===========================================================================
  describe('Characters', () => {
    it('GET /borealis/characters returns paginated character catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/characters?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)
      expect(data.pagination.page).toBe(1)
      expect(data.items[0].namePrimary).toBe('Frieren')
    })

    it('GET /borealis/characters/filters returns available gender facets', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/characters/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.genders)).toBe(true)
      expect(data.total).toBe(2)
    })

    it('GET /borealis/characters/:id returns character details with media appearances', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/characters/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.character.id).toBe(1)
      expect(data.character.namePrimary).toBe('Frieren')
      expect(Array.isArray(data.character.mediaCharacters)).toBe(true)
    })

    it('GET /borealis/characters/:id fails (404) when character does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/characters/999'))
      expect(res.status).toBe(404)
    })
  })

  // ===========================================================================
  // 2. People Tests
  // ===========================================================================
  describe('People', () => {
    it('GET /borealis/people returns paginated people catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/people?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)
      expect(data.items[0].namePrimary).toBe('Atsumi Tanezaki')
    })

    it('GET /borealis/people/filters returns occupation, language, and gender filters', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/people/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.occupations)).toBe(true)
      expect(Array.isArray(data.languages)).toBe(true)
      expect(Array.isArray(data.genders)).toBe(true)
    })

    it('GET /borealis/people/:id returns person details with voice roles and staff credits', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/people/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.person.id).toBe(1)
      expect(data.person.namePrimary).toBe('Atsumi Tanezaki')
      expect(Array.isArray(data.person.voicedCharacters)).toBe(true)
    })

    it('GET /borealis/people/:id fails (404) when person does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/people/999'))
      expect(res.status).toBe(404)
    })
  })

  // ===========================================================================
  // 3. Studios Tests
  // ===========================================================================
  describe('Studios', () => {
    it('GET /borealis/studios returns paginated studios catalog', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/studios?page=1&limit=40'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items.length).toBeGreaterThan(0)
      expect(data.items[0].name).toBe('Madhouse')
    })

    it('GET /borealis/studios/filters returns studio classifications', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/studios/filters'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(Array.isArray(data.types)).toBe(true)
      expect(data.total).toBe(2)
    })

    it('GET /borealis/studios/:id returns studio details with media creations', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/studios/1'))
      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.studio.id).toBe(1)
      expect(data.studio.name).toBe('Madhouse')
      expect(Array.isArray(data.studio.creations)).toBe(true)
    })

    it('GET /borealis/studios/:id fails (404) when studio does not exist', async () => {
      const res = await app.handle(new Request('http://localhost/borealis/studios/999'))
      expect(res.status).toBe(404)
    })
  })
})

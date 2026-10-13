import { prisma } from '@IRIS/database'
import { NotFound } from '../../lib/errors'

export interface CharacterCatalogQuery {
  page?: number
  limit?: number
  search?: string
  gender?: string
  sortBy?: 'popularity' | 'favorites' | 'name'
  sortOrder?: 'asc' | 'desc'
}

export interface PersonCatalogQuery {
  page?: number
  limit?: number
  search?: string
  occupation?: string
  language?: string
  gender?: string
  sortBy?: 'popularity' | 'favorites' | 'name'
  sortOrder?: 'asc' | 'desc'
}

export interface StudioCatalogQuery {
  page?: number
  limit?: number
  search?: string
  isAnimationStudio?: boolean
  sortBy?: 'popularity' | 'favorites' | 'name'
  sortOrder?: 'asc' | 'desc'
}

export class BorealisEntitiesServ {
  // ===========================================================================
  // 1. Characters
  // ===========================================================================

  public static async getCharacterCatalog(query?: CharacterCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const gender = query?.gender?.trim()
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'name' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { namePrimary: { contains: search, mode: 'insensitive' } },
              { nameNative: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(gender ? { gender: { equals: gender, mode: 'insensitive' } } : {}),
    }

    let orderBy: any = { favorites: sortOrder }
    if (sortBy === 'name') orderBy = { namePrimary: sortOrder }

    const [total, items] = await Promise.all([
      prisma.character.count({ where }),
      prisma.character.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          namePrimary: true,
          nameNative: true,
          image: true,
          gender: true,
          age: true,
          favorites: true,
        },
      }),
    ])

    return {
      success: true,
      items: items.map((c) => ({
        id: c.id,
        namePrimary: c.namePrimary,
        nameNative: c.nameNative,
        image: c.image,
        gender: c.gender,
        age: c.age,
        favorites: c.favorites,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + items.length < total,
      },
    }
  }

  public static async getCharacterFilters() {
    const [allCharacters, total] = await Promise.all([
      prisma.character.findMany({
        select: { gender: true },
      }),
      prisma.character.count(),
    ])

    const genderCounts: Record<string, number> = {}
    for (const c of allCharacters) {
      if (c.gender) {
        genderCounts[c.gender] = (genderCounts[c.gender] || 0) + 1
      }
    }

    return {
      success: true,
      genders: Object.entries(genderCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      total,
    }
  }

  public static async getCharacterById(id: number) {
    const character = await prisma.character.findUnique({
      where: { id },
      include: {
        mediaCharacters: {
          include: {
            actor: true,
            anime: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                titleNative: true,
                coverImage: true,
                bannerImage: true,
                format: true,
                seasonYear: true,
                averageScore: true,
              },
            },
            manga: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                titleNative: true,
                coverImage: true,
                bannerImage: true,
                format: true,
                startDateYear: true,
                averageScore: true,
              },
            },
            movie: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                titleNative: true,
                coverImage: true,
                bannerImage: true,
                releaseDateYear: true,
                averageScore: true,
              },
            },
            tv: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                titleNative: true,
                coverImage: true,
                bannerImage: true,
                showType: true,
                firstAiredYear: true,
                averageScore: true,
              },
            },
            book: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                bannerImage: true,
                format: true,
                releaseDateYear: true,
                averageScore: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    if (!character) {
      throw new NotFound(`Character with ID ${id} not found`)
    }

    return {
      success: true,
      character,
    }
  }

  // ===========================================================================
  // 2. People
  // ===========================================================================

  public static async getPeopleCatalog(query?: PersonCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const occupation = query?.occupation?.trim()
    const language = query?.language?.trim()
    const gender = query?.gender?.trim()
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'name' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { namePrimary: { contains: search, mode: 'insensitive' } },
              { nameNative: { contains: search, mode: 'insensitive' } },
              { givenName: { contains: search, mode: 'insensitive' } },
              { familyName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(occupation ? { primaryOccupations: { has: occupation } } : {}),
      ...(language ? { language: { equals: language, mode: 'insensitive' } } : {}),
      ...(gender ? { gender: { equals: gender, mode: 'insensitive' } } : {}),
    }

    let orderBy: any = { favorites: sortOrder }
    if (sortBy === 'name') orderBy = { namePrimary: sortOrder }

    const [total, items] = await Promise.all([
      prisma.person.count({ where }),
      prisma.person.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          namePrimary: true,
          nameNative: true,
          image: true,
          primaryOccupations: true,
          language: true,
          gender: true,
          favorites: true,
        },
      }),
    ])

    return {
      success: true,
      items: items.map((p) => ({
        id: p.id,
        namePrimary: p.namePrimary,
        nameNative: p.nameNative,
        image: p.image,
        primaryOccupations: p.primaryOccupations,
        language: p.language,
        gender: p.gender,
        favorites: p.favorites,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + items.length < total,
      },
    }
  }

  public static async getPeopleFilters() {
    const [allPeople, total] = await Promise.all([
      prisma.person.findMany({
        select: { primaryOccupations: true, language: true, gender: true },
      }),
      prisma.person.count(),
    ])

    const occupationCounts: Record<string, number> = {}
    const languageCounts: Record<string, number> = {}
    const genderCounts: Record<string, number> = {}

    for (const p of allPeople) {
      if (Array.isArray(p.primaryOccupations)) {
        for (const occ of p.primaryOccupations) {
          if (occ) occupationCounts[occ] = (occupationCounts[occ] || 0) + 1
        }
      }
      if (p.language) {
        languageCounts[p.language] = (languageCounts[p.language] || 0) + 1
      }
      if (p.gender) {
        genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1
      }
    }

    return {
      success: true,
      occupations: Object.entries(occupationCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      languages: Object.entries(languageCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      genders: Object.entries(genderCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      total,
    }
  }

  public static async getPersonById(id: number) {
    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        voicedCharacters: {
          include: {
            character: true,
            anime: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                format: true,
                seasonYear: true,
                averageScore: true,
              },
            },
            movie: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                releaseDateYear: true,
                averageScore: true,
              },
            },
            tv: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                firstAiredYear: true,
                averageScore: true,
              },
            },
            book: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                releaseDateYear: true,
                averageScore: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        mediaStaff: {
          include: {
            anime: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                format: true,
                seasonYear: true,
                averageScore: true,
              },
            },
            manga: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                format: true,
                startDateYear: true,
                averageScore: true,
              },
            },
            movie: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                releaseDateYear: true,
                averageScore: true,
              },
            },
            tv: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                firstAiredYear: true,
                averageScore: true,
              },
            },
            book: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                releaseDateYear: true,
                averageScore: true,
              },
            },
            music: {
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                coverImage: true,
                type: true,
                releaseDateYear: true,
                popularity: true,
              },
            },
          },
        },
        musicTracks: {
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            type: true,
            coverImage: true,
            duration: true,
            popularity: true,
            releaseDateYear: true,
            recordType: true,
            albumId: true,
            trackPosition: true,
            album: {
              select: {
                id: true,
                titlePrimary: true,
                coverImage: true,
              },
            },
          },
          take: 50,
          orderBy: { popularity: 'desc' },
        },
      },
    })

    if (!person) {
      throw new NotFound(`Person with ID ${id} not found`)
    }

    // Automatically aggregate artist music if present and not already linked
    let musicTracks = person.musicTracks
    if (musicTracks.length === 0 && person.namePrimary) {
      musicTracks = await prisma.music.findMany({
        where: {
          artistName: { equals: person.namePrimary, mode: 'insensitive' },
        },
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          type: true,
          coverImage: true,
          duration: true,
          popularity: true,
          releaseDateYear: true,
          recordType: true,
          albumId: true,
          trackPosition: true,
          album: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
            },
          },
        },
        take: 50,
        orderBy: { popularity: 'desc' },
      })
    }

    return {
      success: true,
      person: {
        ...person,
        musicTracks,
      },
    }
  }

  // ===========================================================================
  // 3. Studios
  // ===========================================================================

  public static async getStudioCatalog(query?: StudioCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const isAnimationStudio = query?.isAnimationStudio
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'name' ? 'asc' : 'desc')

    const where: any = {
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(typeof isAnimationStudio === 'boolean' ? { isAnimationStudio } : {}),
    }

    let orderBy: any = { favorites: sortOrder }
    if (sortBy === 'name') orderBy = { name: sortOrder }

    const [total, items] = await Promise.all([
      prisma.studio.count({ where }),
      prisma.studio.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          isAnimationStudio: true,
          siteUrl: true,
          favorites: true,
        },
      }),
    ])

    return {
      success: true,
      items: items.map((s) => ({
        id: s.id,
        name: s.name,
        isAnimationStudio: s.isAnimationStudio,
        siteUrl: s.siteUrl,
        favorites: s.favorites,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + items.length < total,
      },
    }
  }

  public static async getStudioFilters() {
    const [animationCount, total] = await Promise.all([
      prisma.studio.count({ where: { isAnimationStudio: true } }),
      prisma.studio.count(),
    ])

    const otherCount = Math.max(0, total - animationCount)

    return {
      success: true,
      types: [
        { value: 'Animation Studio', count: animationCount },
        { value: 'Other Studio / Producer', count: otherCount },
      ],
      total,
    }
  }

  public static async getStudioById(id: number) {
    const studio = await prisma.studio.findUnique({
      where: { id },
    })

    if (!studio) {
      throw new NotFound(`Studio with ID ${id} not found`)
    }

    const [mediaStudioRecords, totalCreations] = await Promise.all([
      prisma.mediaStudio.findMany({
        where: { studioId: id },
        include: {
          anime: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              seasonYear: true,
              startDateYear: true,
              averageScore: true,
              popularity: true,
              favorites: true,
              status: true,
            },
          },
          movie: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              releaseDateYear: true,
              averageScore: true,
              popularity: true,
              favorites: true,
              status: true,
            },
          },
          tv: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              firstAiredYear: true,
              averageScore: true,
              popularity: true,
              favorites: true,
              status: true,
            },
          },
          game: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              backgroundImage: true,
              releaseDateYear: true,
              averageScore: true,
              popularity: true,
              favorites: true,
              status: true,
            },
          },
          book: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              releaseDateYear: true,
              averageScore: true,
              popularity: true,
              favorites: true,
              status: true,
            },
          },
        },
        take: 50,
        orderBy: [{ id: 'desc' }],
      }),
      prisma.mediaStudio.count({ where: { studioId: id } }),
    ])

    const creations = mediaStudioRecords.map((record) => {
      if (record.anime) {
        return {
          id: record.id,
          mediaType: 'anime',
          mediaId: record.anime.id,
          titlePrimary: record.anime.titlePrimary,
          titleSecondary: record.anime.titleSecondary,
          titleNative: record.anime.titleNative,
          coverImage: record.anime.coverImage,
          bannerImage: record.anime.bannerImage,
          format: String(record.anime.format),
          year: record.anime.seasonYear ?? record.anime.startDateYear,
          averageScore: record.anime.averageScore,
          popularity: record.anime.popularity,
          status: String(record.anime.status),
        }
      }
      if (record.movie) {
        return {
          id: record.id,
          mediaType: 'movie',
          mediaId: record.movie.id,
          titlePrimary: record.movie.titlePrimary,
          titleSecondary: record.movie.titleSecondary,
          titleNative: record.movie.titleNative,
          coverImage: record.movie.coverImage,
          bannerImage: record.movie.bannerImage,
          format: 'MOVIE',
          year: record.movie.releaseDateYear,
          averageScore: record.movie.averageScore,
          popularity: record.movie.popularity,
          status: String(record.movie.status),
        }
      }
      if (record.tv) {
        return {
          id: record.id,
          mediaType: 'tv',
          mediaId: record.tv.id,
          titlePrimary: record.tv.titlePrimary,
          titleSecondary: record.tv.titleSecondary,
          titleNative: record.tv.titleNative,
          coverImage: record.tv.coverImage,
          bannerImage: record.tv.bannerImage,
          format: 'TV',
          year: record.tv.firstAiredYear,
          averageScore: record.tv.averageScore,
          popularity: record.tv.popularity,
          status: String(record.tv.status),
        }
      }
      if (record.game) {
        return {
          id: record.id,
          mediaType: 'game',
          mediaId: record.game.id,
          titlePrimary: record.game.titlePrimary,
          titleSecondary: record.game.titleSecondary,
          titleNative: record.game.titleNative,
          coverImage: record.game.coverImage,
          bannerImage: record.game.bannerImage || record.game.backgroundImage,
          format: 'GAME',
          year: record.game.releaseDateYear,
          averageScore: record.game.averageScore,
          popularity: record.game.popularity,
          status: String(record.game.status),
        }
      }
      if (record.book) {
        return {
          id: record.id,
          mediaType: 'book',
          mediaId: record.book.id,
          titlePrimary: record.book.titlePrimary,
          titleSecondary: record.book.titleSecondary,
          titleNative: null,
          coverImage: record.book.coverImage,
          bannerImage: record.book.bannerImage,
          format: 'BOOK',
          year: record.book.releaseDateYear,
          averageScore: record.book.averageScore,
          popularity: record.book.popularity,
          status: String(record.book.status),
        }
      }
      return null
    }).filter(Boolean)

    return {
      success: true,
      studio: {
        ...studio,
        creationsCount: totalCreations,
        creations,
      },
    }
  }
}

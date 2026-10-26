import { prisma, and, or, countOf } from '@Iris/db'
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

    let q = prisma.orm.public.Character
    if (search) {
      q = q.where((c) =>
        or(
          c.namePrimary.ilike(`%${search}%`),
          c.nameNative.ilike(`%${search}%`)
        )
      )
    }
    if (gender) {
      q = q.where((c) => c.gender.ilike(gender))
    }

    let itemsQ = q
    if (sortBy === 'name') {
      itemsQ = itemsQ.orderBy((c) =>
        sortOrder === 'desc' ? c.namePrimary.desc() : c.namePrimary.asc()
      )
    } else {
      itemsQ = itemsQ.orderBy((c) =>
        sortOrder === 'asc' ? c.favorites.asc() : c.favorites.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'namePrimary',
          'nameNative',
          'image',
          'gender',
          'age',
          'favorites'
        )
        .all(),
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
      prisma.orm.public.Character.select('gender').all(),
      countOf(prisma.orm.public.Character),
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
    const character = await prisma.orm.public.Character
      .where({ id })
      .include('mediaCharacters', (mc) =>
        mc
          .include('actor')
          .include('anime', (a) =>
            a.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'format',
              'seasonYear',
              'averageScore'
            )
          )
          .include('manga', (m) =>
            m.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'format',
              'startDateYear',
              'averageScore'
            )
          )
          .include('movie', (m) =>
            m.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'releaseDateYear',
              'averageScore'
            )
          )
          .include('tv', (t) =>
            t.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'showType',
              'firstAiredYear',
              'averageScore'
            )
          )
          .include('book', (b) =>
            b.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'bannerImage',
              'format',
              'releaseDateYear',
              'averageScore'
            )
          )
          .orderBy((m) => m.order.asc())
      )
      .first()

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

    let q = prisma.orm.public.Person
    if (search) {
      q = q.where((p) =>
        or(
          p.namePrimary.ilike(`%${search}%`),
          p.nameNative.ilike(`%${search}%`),
          p.givenName.ilike(`%${search}%`),
          p.familyName.ilike(`%${search}%`)
        )
      )
    }
    if (occupation) {
      q = q.where((p) => p.primaryOccupations.ilike(`%${occupation}%`))
    }
    if (language) {
      q = q.where((p) => p.language.ilike(language))
    }
    if (gender) {
      q = q.where((p) => p.gender.ilike(gender))
    }

    let itemsQ = q
    if (sortBy === 'name') {
      itemsQ = itemsQ.orderBy((p) =>
        sortOrder === 'desc' ? p.namePrimary.desc() : p.namePrimary.asc()
      )
    } else {
      itemsQ = itemsQ.orderBy((p) =>
        sortOrder === 'asc' ? p.favorites.asc() : p.favorites.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'namePrimary',
          'nameNative',
          'image',
          'primaryOccupations',
          'language',
          'gender',
          'favorites'
        )
        .all(),
    ])

    return {
      success: true,
      items: items.map((p) => ({
        id: p.id,
        namePrimary: p.namePrimary,
        nameNative: p.nameNative,
        image: p.image,
        primaryOccupations: [...p.primaryOccupations],
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
      prisma.orm.public.Person.select(
        'primaryOccupations',
        'language',
        'gender'
      ).all(),
      countOf(prisma.orm.public.Person),
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
    const person = await prisma.orm.public.Person
      .where({ id })
      .include('voicedCharacters', (vc) =>
        vc
          .include('character')
          .include('anime', (a) =>
            a.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'format',
              'seasonYear',
              'averageScore'
            )
          )
          .include('movie', (m) =>
            m.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'releaseDateYear',
              'averageScore'
            )
          )
          .include('tv', (t) =>
            t.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'firstAiredYear',
              'averageScore'
            )
          )
          .include('book', (b) =>
            b.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'releaseDateYear',
              'averageScore'
            )
          )
          .orderBy((v) => v.order.asc())
      )
      .include('mediaStaff', (ms) =>
        ms
          .include('anime', (a) =>
            a.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'format',
              'seasonYear',
              'averageScore'
            )
          )
          .include('manga', (m) =>
            m.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'format',
              'startDateYear',
              'averageScore'
            )
          )
          .include('movie', (m) =>
            m.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'releaseDateYear',
              'averageScore'
            )
          )
          .include('tv', (t) =>
            t.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'firstAiredYear',
              'averageScore'
            )
          )
          .include('book', (b) =>
            b.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'releaseDateYear',
              'averageScore'
            )
          )
          .include('music', (mu) =>
            mu.select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'coverImage',
              'type',
              'releaseDateYear',
              'popularity'
            )
          )
      )
      .include('musicTracks', (mt) =>
        mt
          .select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'type',
            'coverImage',
            'duration',
            'popularity',
            'releaseDateYear',
            'recordType',
            'albumId',
            'trackPosition'
          )
          .include('album', (al) =>
            al.select('id', 'titlePrimary', 'coverImage')
          )
          .orderBy((m) => m.popularity.desc())
          .limit(50)
      )
      .first()

    if (!person) {
      throw new NotFound(`Person with ID ${id} not found`)
    }

    // Automatically aggregate artist music if present and not already linked
    let musicTracks = person.musicTracks
    if (musicTracks.length === 0 && person.namePrimary) {
      musicTracks = await prisma.orm.public.Music
        .where((m) => m.artistName.ilike(person.namePrimary!))
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'type',
          'coverImage',
          'duration',
          'popularity',
          'releaseDateYear',
          'recordType',
          'albumId',
          'trackPosition'
        )
        .include('album', (al) =>
          al.select('id', 'titlePrimary', 'coverImage')
        )
        .orderBy((m) => m.popularity.desc())
        .limit(50)
        .all()
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

    let q = prisma.orm.public.Studio
    if (search) {
      q = q.where((s) => s.name.ilike(`%${search}%`))
    }
    if (typeof isAnimationStudio === 'boolean') {
      q = q.where({ isAnimationStudio })
    }

    let itemsQ = q
    if (sortBy === 'name') {
      itemsQ = itemsQ.orderBy((s) =>
        sortOrder === 'desc' ? s.name.desc() : s.name.asc()
      )
    } else {
      itemsQ = itemsQ.orderBy((s) =>
        sortOrder === 'asc' ? s.favorites.asc() : s.favorites.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select('id', 'name', 'isAnimationStudio', 'siteUrl', 'favorites')
        .all(),
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
      countOf(prisma.orm.public.Studio.where({ isAnimationStudio: true })),
      countOf(prisma.orm.public.Studio),
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
    const studio = await prisma.orm.public.Studio.where({ id }).first()

    if (!studio) {
      throw new NotFound(`Studio with ID ${id} not found`)
    }

    const [mediaStudioRecords, totalCreations] = await Promise.all([
      prisma.orm.public.MediaStudio
        .where({ studioId: id })
        .include('anime', (a) =>
          a.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'format',
            'seasonYear',
            'startDateYear',
            'averageScore',
            'popularity',
            'favorites',
            'status'
          )
        )
        .include('movie', (m) =>
          m.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'releaseDateYear',
            'averageScore',
            'popularity',
            'favorites',
            'status'
          )
        )
        .include('tv', (t) =>
          t.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'firstAiredYear',
            'averageScore',
            'popularity',
            'favorites',
            'status'
          )
        )
        .include('game', (g) =>
          g.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'backgroundImage',
            'releaseDateYear',
            'averageScore',
            'popularity',
            'favorites',
            'status'
          )
        )
        .include('book', (b) =>
          b.select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'coverImage',
            'bannerImage',
            'releaseDateYear',
            'averageScore',
            'popularity',
            'favorites',
            'status'
          )
        )
        .orderBy((ms) => ms.id.desc())
        .limit(50)
        .all(),
      countOf(prisma.orm.public.MediaStudio.where({ studioId: id })),
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

import { prisma, type MediaType } from '@IRIS/database'
import { NotFound } from '../../lib/errors'
import { MediaQueueManager } from './queue'
import { fetchMediaRelations } from './media-relations.helper'

export interface CatalogQuery {
  page?: number
  limit?: number
  search?: string
  genres?: string
  formats?: string
  statuses?: string
  years?: string
  season?: string
  sortBy?: 'popularity' | 'score' | 'title' | 'releaseDate' | 'trending'
  sortOrder?: 'asc' | 'desc'
}

export function parseList(val?: unknown): string[] {
  if (!val || typeof val !== 'string') return []
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function cleanBaseTitle(str: string): string {
  const base = str.split(/[:\-\–—;/]/)[0] ?? str
  return base
    .replace(
      /\b(season\s*\d+|\d+(st|nd|rd|th)\s*season|part\s*\d+|final\s*season|the\s*final\s*season|the\s*animation|the\s*movie|movie|\d+)\b/gi,
      ''
    )
    .toLowerCase()
    .trim()
}

export class BorealisMediaServ {
  // ===========================================================================
  // 1. Anime Catalog & Metadata
  // ===========================================================================

  public static async getAnimeCatalog(query?: CatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const formats = parseList(query?.formats)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const season = query?.season?.trim()
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { titlePrimary: { contains: search, mode: 'insensitive' } },
              { titleSecondary: { contains: search, mode: 'insensitive' } },
              { titleNative: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(genres.length > 0
        ? {
            genres: {
              some: {
                name: { in: genres, mode: 'insensitive' },
              },
            },
          }
        : {}),
      ...(formats.length > 0 ? { format: { in: formats as any } } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses as any } } : {}),
      ...(years.length > 0 ? { seasonYear: { in: years } } : {}),
      ...(season ? { seasonSeason: season as any } : {}),
    }

    let orderBy: any = { popularity: sortOrder }
    if (sortBy === 'score') orderBy = { averageScore: sortOrder }
    if (sortBy === 'title') orderBy = { titlePrimary: sortOrder }
    if (sortBy === 'releaseDate') orderBy = { seasonYear: sortOrder }
    if (sortBy === 'trending') orderBy = { favorites: sortOrder }

    const [total, items] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          format: true,
          status: true,
          seasonYear: true,
          seasonSeason: true,
          episodeCount: true,
          averageScore: true,
          genres: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      success: true,
      items: items.map((x) => ({
        id: x.id,
        mediaType: 'anime',
        titlePrimary: x.titlePrimary,
        titleSecondary: x.titleSecondary,
        titleNative: x.titleNative,
        coverImage: x.coverImage,
        bannerImage: x.bannerImage,
        format: String(x.format),
        status: String(x.status),
        year: x.seasonYear,
        season: x.seasonSeason ? String(x.seasonSeason) : null,
        unitsCount: x.episodeCount,
        averageScore: x.averageScore,
        genres: x.genres,
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

  public static async getAnimeFilters() {
    const [allAnime, allGenres] = await Promise.all([
      prisma.anime.findMany({
        select: {
          status: true,
          format: true,
          seasonYear: true,
          seasonSeason: true,
        },
      }),
      prisma.genre.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { anime: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}
    const seasonCounts: Record<string, number> = {}

    for (const a of allAnime) {
      if (a.status) statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
      if (a.format) formatCounts[a.format] = (formatCounts[a.format] || 0) + 1
      if (a.seasonYear) yearCounts[a.seasonYear] = (yearCounts[a.seasonYear] || 0) + 1
      if (a.seasonSeason) seasonCounts[a.seasonSeason] = (seasonCounts[a.seasonSeason] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: allGenres.map((g) => ({ value: g.name, count: g._count?.anime ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
      seasons: Object.entries(seasonCounts).map(([value, count]) => ({ value, count })),
    }
  }

  public static async getAnimeById(id: number) {
    const anime = await prisma.anime.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        characters: {
          include: {
            character: true,
            actor: true,
          },
        },
        staff: {
          include: {
            person: true,
          },
        },
        studios: {
          include: {
            studio: true,
          },
        },
        episodes: {
          orderBy: { number: 'asc' },
          take: 50,
        },
      },
    })

    if (!anime) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

    // Fetch relations
    const relations = await fetchMediaRelations('ANIME' as MediaType, id)

    return {
      success: true,
      media: {
        ...anime,
        relations,
      },
    }
  }

  public static async refreshAnime(id: number) {
    const anime = await prisma.anime.findUnique({
      where: { id },
      select: { id: true, anilistId: true, titlePrimary: true },
    })

    if (!anime) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

    // Mark as updated and queue refresh
    await prisma.anime.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    await MediaQueueManager.enqueueMediaUpdate('ANIME', id, {
      externalId: anime.anilistId,
      priority: 1,
      depth: 0,
      triggeredBy: 'manual',
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${anime.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarAnime(id: number, limit: number = 10) {
    const source = await prisma.anime.findUnique({
      where: { id },
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        studios: { include: { studio: { select: { id: true, name: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    if (!source) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

    const sourceGenreIds = new Set(source.genres.map((g) => g.id))
    const sourceTagIds = new Set(source.tags.map((t) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    // Query candidates that share at least 1 genre or tag or format
    const candidates = await prisma.anime.findMany({
      where: {
        id: { not: id },
        OR: [
          sourceGenreIds.size > 0
            ? {
                genres: {
                  some: { id: { in: Array.from(sourceGenreIds) } },
                },
              }
            : undefined,
          sourceTagIds.size > 0
            ? {
                tags: {
                  some: { id: { in: Array.from(sourceTagIds) } },
                },
              }
            : undefined,
          sourceStudioIds.size > 0
            ? {
                studios: {
                  some: { studioId: { in: Array.from(sourceStudioIds) } },
                },
              }
            : undefined,
          { format: source.format },
        ].filter(Boolean) as any,
      },
      take: 120,
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        studios: { include: { studio: { select: { id: true, name: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    // Score candidates with improved multi-factor weighting
    const scored = candidates.map((candidate) => {
      let similarityScore = 0
      const matchReasons: string[] = []

      // 1. Genre Jaccard Similarity (Max 40 points)
      const candGenreIds = new Set(candidate.genres.map((g) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        const jaccard = genreIntersection.length / genreUnion.size
        const points = Math.round(jaccard * 40)
        similarityScore += points
        const sharedNames = candidate.genres
          .filter((g) => sourceGenreIds.has(g.id))
          .map((g) => g.name)
        matchReasons.push(`Shared genres: ${sharedNames.join(', ')} (+${points} pts)`)
      }

      // 2. Tag / Theme Jaccard Similarity (Max 25 points)
      const candTagIds = new Set(candidate.tags.map((t) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        const jaccard = tagIntersection.length / tagUnion.size
        const points = Math.round(jaccard * 25)
        similarityScore += points
        const sharedTags = candidate.tags
          .filter((t) => sourceTagIds.has(t.id))
          .map((t) => t.name)
        matchReasons.push(`Shared themes: ${sharedTags.slice(0, 3).join(', ')} (+${points} pts)`)
      }

      // 3. Studio Overlap (Max 15 points)
      const candStudioIds = new Set(candidate.studios.map((s) => s.studioId))
      const studioIntersection = Array.from(sourceStudioIds).filter((sid) => candStudioIds.has(sid))
      if (studioIntersection.length > 0) {
        similarityScore += 15
        const studioName = candidate.studios[0]?.studio?.name || 'Same Studio'
        matchReasons.push(`Same animation studio (${studioName}) (+15 pts)`)
      }

      // 4. Franchise / Base Title Similarity (Max 15 points)
      const candBaseTitle = cleanBaseTitle(candidate.titlePrimary)
      if (sourceBaseTitle && candBaseTitle && (sourceBaseTitle.includes(candBaseTitle) || candBaseTitle.includes(sourceBaseTitle))) {
        similarityScore += 15
        matchReasons.push('Franchise / Shared title connection (+15 pts)')
      }

      // 5. Character Overlap (Shared Universe / Characters)
      const candCharIds = new Set(candidate.characters.map((c) => c.characterId))
      const charIntersection = Array.from(sourceCharacterIds).filter((cid) => candCharIds.has(cid))
      if (charIntersection.length > 0) {
        similarityScore += 10
        matchReasons.push(`Shared characters (${charIntersection.length}) (+10 pts)`)
      }

      // 6. Format Alignment
      if (candidate.format === source.format && candidate.format !== 'UNKNOWN') {
        similarityScore += 5
        matchReasons.push(`Same format (${candidate.format}) (+5 pts)`)
      }

      // 7. Quality Proximity
      if (source.averageScore && candidate.averageScore) {
        const diff = Math.abs(source.averageScore - candidate.averageScore)
        if (diff <= 1.0) {
          similarityScore += 5
          matchReasons.push(`Comparable rating score (${candidate.averageScore}) (+5 pts)`)
        }
      }

      const clampedScore = Math.min(100, similarityScore)
      return {
        id: candidate.id,
        mediaType: 'anime',
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary,
        titleNative: candidate.titleNative,
        coverImage: candidate.coverImage,
        bannerImage: candidate.bannerImage,
        format: String(candidate.format),
        status: String(candidate.status),
        year: candidate.seasonYear,
        averageScore: candidate.averageScore,
        similarityScore: clampedScore,
        matchReasons,
        genres: candidate.genres,
      }
    })

    // Sort by similarity score descending, take top limit
    const items = scored
      .filter((s) => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)

    return {
      success: true,
      sourceId: id,
      items,
    }
  }

  // ===========================================================================
  // 2. Manga Catalog & Metadata
  // ===========================================================================

  public static async getMangaCatalog(query?: CatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const formats = parseList(query?.formats)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { titlePrimary: { contains: search, mode: 'insensitive' } },
              { titleSecondary: { contains: search, mode: 'insensitive' } },
              { titleNative: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(genres.length > 0
        ? {
            genres: {
              some: {
                name: { in: genres, mode: 'insensitive' },
              },
            },
          }
        : {}),
      ...(formats.length > 0 ? { format: { in: formats as any } } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses as any } } : {}),
      ...(years.length > 0 ? { startDateYear: { in: years } } : {}),
    }

    let orderBy: any = { popularity: sortOrder }
    if (sortBy === 'score') orderBy = { averageScore: sortOrder }
    if (sortBy === 'title') orderBy = { titlePrimary: sortOrder }
    if (sortBy === 'releaseDate') orderBy = { startDateYear: sortOrder }
    if (sortBy === 'trending') orderBy = { favorites: sortOrder }

    const [total, items] = await Promise.all([
      prisma.manga.count({ where }),
      prisma.manga.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          format: true,
          status: true,
          startDateYear: true,
          chapterCount: true,
          volumeCount: true,
          averageScore: true,
          genres: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      success: true,
      items: items.map((x) => ({
        id: x.id,
        mediaType: 'manga',
        titlePrimary: x.titlePrimary,
        titleSecondary: x.titleSecondary,
        titleNative: x.titleNative,
        coverImage: x.coverImage,
        bannerImage: x.bannerImage,
        format: String(x.format),
        status: String(x.status),
        year: x.startDateYear,
        unitsCount: x.chapterCount,
        averageScore: x.averageScore,
        genres: x.genres,
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

  public static async getMangaFilters() {
    const [allManga, allGenres] = await Promise.all([
      prisma.manga.findMany({
        select: {
          status: true,
          format: true,
          startDateYear: true,
        },
      }),
      prisma.genre.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { manga: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const m of allManga) {
      if (m.status) statusCounts[m.status] = (statusCounts[m.status] || 0) + 1
      if (m.format) formatCounts[m.format] = (formatCounts[m.format] || 0) + 1
      if (m.startDateYear) yearCounts[m.startDateYear] = (yearCounts[m.startDateYear] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: allGenres.map((g) => ({ value: g.name, count: g._count?.manga ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getMangaById(id: number) {
    const manga = await prisma.manga.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        characters: {
          include: {
            character: true,
            actor: true,
          },
        },
        staff: {
          include: {
            person: true,
          },
        },
      },
    })

    if (!manga) {
      throw new NotFound(`Manga with ID ${id} not found`)
    }

    const relations = await fetchMediaRelations('MANGA' as MediaType, id)

    return {
      success: true,
      media: {
        ...manga,
        relations,
      },
    }
  }

  public static async refreshManga(id: number) {
    const manga = await prisma.manga.findUnique({
      where: { id },
      select: { id: true, anilistId: true, titlePrimary: true },
    })

    if (!manga) {
      throw new NotFound(`Manga with ID ${id} not found`)
    }

    await prisma.manga.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    await MediaQueueManager.enqueueMediaUpdate('MANGA', id, {
      externalId: manga.anilistId,
      priority: 1,
      depth: 0,
      triggeredBy: 'manual',
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${manga.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarManga(id: number, limit: number = 10) {
    const source = await prisma.manga.findUnique({
      where: { id },
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        staff: { include: { person: { select: { id: true, namePrimary: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    if (!source) {
      throw new NotFound(`Manga with ID ${id} not found`)
    }

    const sourceGenreIds = new Set(source.genres.map((g) => g.id))
    const sourceTagIds = new Set(source.tags.map((t) => t.id))
    const sourceStaffPersonIds = new Set(source.staff.map((s) => s.personId).filter(Boolean))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    const candidates = await prisma.manga.findMany({
      where: {
        id: { not: id },
        OR: [
          sourceGenreIds.size > 0
            ? {
                genres: {
                  some: { id: { in: Array.from(sourceGenreIds) } },
                },
              }
            : undefined,
          sourceTagIds.size > 0
            ? {
                tags: {
                  some: { id: { in: Array.from(sourceTagIds) } },
                },
              }
            : undefined,
          sourceStaffPersonIds.size > 0
            ? {
                staff: {
                  some: { personId: { in: Array.from(sourceStaffPersonIds) as any } },
                },
              }
            : undefined,
          { format: source.format },
        ].filter(Boolean) as any,
      },
      take: 120,
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        staff: { include: { person: { select: { id: true, namePrimary: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    const scored = candidates.map((candidate) => {
      let similarityScore = 0
      const matchReasons: string[] = []

      // 1. Genre Jaccard Similarity (Max 40 points)
      const candGenreIds = new Set(candidate.genres.map((g) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        const jaccard = genreIntersection.length / genreUnion.size
        const points = Math.round(jaccard * 40)
        similarityScore += points
        const sharedNames = candidate.genres
          .filter((g) => sourceGenreIds.has(g.id))
          .map((g) => g.name)
        matchReasons.push(`Shared genres: ${sharedNames.join(', ')} (+${points} pts)`)
      }

      // 2. Tag / Theme Jaccard Similarity (Max 25 points)
      const candTagIds = new Set(candidate.tags.map((t) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        const jaccard = tagIntersection.length / tagUnion.size
        const points = Math.round(jaccard * 25)
        similarityScore += points
        const sharedTags = candidate.tags
          .filter((t) => sourceTagIds.has(t.id))
          .map((t) => t.name)
        matchReasons.push(`Shared themes: ${sharedTags.slice(0, 3).join(', ')} (+${points} pts)`)
      }

      // 3. Author / Artist Overlap (Max 20 points)
      const candPersonIds = new Set(candidate.staff.map((s) => s.personId).filter(Boolean))
      const staffIntersection = Array.from(sourceStaffPersonIds).filter((pid) => candPersonIds.has(pid))
      if (staffIntersection.length > 0) {
        similarityScore += 20
        const authorName = candidate.staff[0]?.person?.namePrimary || 'Same Creator'
        matchReasons.push(`Same author / artist (${authorName}) (+20 pts)`)
      }

      // 4. Franchise / Base Title Similarity (Max 15 points)
      const candBaseTitle = cleanBaseTitle(candidate.titlePrimary)
      if (sourceBaseTitle && candBaseTitle && (sourceBaseTitle.includes(candBaseTitle) || candBaseTitle.includes(sourceBaseTitle))) {
        similarityScore += 15
        matchReasons.push('Franchise / Shared title connection (+15 pts)')
      }

      // 5. Character Overlap
      const candCharIds = new Set(candidate.characters.map((c) => c.characterId))
      const charIntersection = Array.from(sourceCharacterIds).filter((cid) => candCharIds.has(cid))
      if (charIntersection.length > 0) {
        similarityScore += 10
        matchReasons.push(`Shared characters (${charIntersection.length}) (+10 pts)`)
      }

      // 6. Format Alignment
      if (candidate.format === source.format && candidate.format !== 'UNKNOWN') {
        similarityScore += 5
        matchReasons.push(`Same format (${candidate.format}) (+5 pts)`)
      }

      // 7. Score Proximity
      if (source.averageScore && candidate.averageScore) {
        const diff = Math.abs(source.averageScore - candidate.averageScore)
        if (diff <= 1.0) {
          similarityScore += 5
          matchReasons.push(`Comparable rating score (${candidate.averageScore}) (+5 pts)`)
        }
      }

      const clampedScore = Math.min(100, similarityScore)
      return {
        id: candidate.id,
        mediaType: 'manga',
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary,
        titleNative: candidate.titleNative,
        coverImage: candidate.coverImage,
        bannerImage: candidate.bannerImage,
        format: String(candidate.format),
        status: String(candidate.status),
        year: candidate.startDateYear,
        averageScore: candidate.averageScore,
        similarityScore: clampedScore,
        matchReasons,
        genres: candidate.genres,
      }
    })

    const items = scored
      .filter((s) => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)

    return {
      success: true,
      sourceId: id,
      items,
    }
  }

  // ===========================================================================
  // 3. Movie Catalog & Metadata
  // ===========================================================================

  public static async getMovieCatalog(query?: CatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { titlePrimary: { contains: search, mode: 'insensitive' } },
              { titleSecondary: { contains: search, mode: 'insensitive' } },
              { titleNative: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(genres.length > 0
        ? {
            genres: {
              some: {
                name: { in: genres, mode: 'insensitive' },
              },
            },
          }
        : {}),
      ...(statuses.length > 0 ? { status: { in: statuses as any } } : {}),
      ...(years.length > 0 ? { releaseDateYear: { in: years } } : {}),
    }

    let orderBy: any = { popularity: sortOrder }
    if (sortBy === 'score') orderBy = { averageScore: sortOrder }
    if (sortBy === 'title') orderBy = { titlePrimary: sortOrder }
    if (sortBy === 'releaseDate') orderBy = { releaseDateYear: sortOrder }
    if (sortBy === 'trending') orderBy = { favorites: sortOrder }

    const [total, items] = await Promise.all([
      prisma.movie.count({ where }),
      prisma.movie.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          runtime: true,
          status: true,
          releaseDateYear: true,
          averageScore: true,
          genres: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      success: true,
      items: items.map((x) => ({
        id: x.id,
        mediaType: 'movie',
        titlePrimary: x.titlePrimary,
        titleSecondary: x.titleSecondary,
        titleNative: x.titleNative,
        coverImage: x.coverImage,
        bannerImage: x.bannerImage,
        format: 'MOVIE',
        status: String(x.status),
        year: x.releaseDateYear,
        unitsCount: x.runtime,
        averageScore: x.averageScore,
        genres: x.genres,
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

  public static async getMovieFilters() {
    const [allMovies, allGenres] = await Promise.all([
      prisma.movie.findMany({
        select: {
          status: true,
          releaseDateYear: true,
        },
      }),
      prisma.genre.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { movies: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const m of allMovies) {
      if (m.status) statusCounts[m.status] = (statusCounts[m.status] || 0) + 1
      if (m.releaseDateYear) yearCounts[m.releaseDateYear] = (yearCounts[m.releaseDateYear] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: [{ value: 'MOVIE', count: allMovies.length }],
      genres: allGenres.map((g) => ({ value: g.name, count: g._count?.movies ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getMovieById(id: number) {
    const movie = await prisma.movie.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        characters: {
          include: {
            character: true,
            actor: true,
          },
        },
        staff: {
          include: {
            person: true,
          },
        },
        studios: {
          include: {
            studio: true,
          },
        },
      },
    })

    if (!movie) {
      throw new NotFound(`Movie with ID ${id} not found`)
    }

    const relations = await fetchMediaRelations('MOVIE' as MediaType, id)

    return {
      success: true,
      media: {
        ...movie,
        relations,
      },
    }
  }

  public static async refreshMovie(id: number) {
    const movie = await prisma.movie.findUnique({
      where: { id },
      select: { id: true, titlePrimary: true },
    })

    if (!movie) {
      throw new NotFound(`Movie with ID ${id} not found`)
    }

    await prisma.movie.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    await MediaQueueManager.enqueueMediaUpdate('MOVIE', id, {
      externalId: (movie as any).tvDBId,
      priority: 1,
      depth: 0,
      triggeredBy: 'manual',
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${movie.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarMovies(id: number, limit: number = 10) {
    const source = await prisma.movie.findUnique({
      where: { id },
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        studios: { include: { studio: { select: { id: true, name: true } } } },
        staff: { include: { person: { select: { id: true, namePrimary: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    if (!source) {
      throw new NotFound(`Movie with ID ${id} not found`)
    }

    const sourceGenreIds = new Set(source.genres.map((g) => g.id))
    const sourceTagIds = new Set(source.tags.map((t) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))
    const sourcePersonIds = new Set(source.staff.map((s) => s.personId).filter(Boolean))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    const candidates = await prisma.movie.findMany({
      where: {
        id: { not: id },
        OR: [
          sourceGenreIds.size > 0
            ? {
                genres: {
                  some: { id: { in: Array.from(sourceGenreIds) } },
                },
              }
            : undefined,
          sourceTagIds.size > 0
            ? {
                tags: {
                  some: { id: { in: Array.from(sourceTagIds) } },
                },
              }
            : undefined,
          sourceStudioIds.size > 0
            ? {
                studios: {
                  some: { studioId: { in: Array.from(sourceStudioIds) } },
                },
              }
            : undefined,
          sourcePersonIds.size > 0
            ? {
                staff: {
                  some: { personId: { in: Array.from(sourcePersonIds) as any } },
                },
              }
            : undefined,
        ].filter(Boolean) as any,
      },
      take: 120,
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        studios: { include: { studio: { select: { id: true, name: true } } } },
        staff: { include: { person: { select: { id: true, namePrimary: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    const scored = candidates.map((candidate) => {
      let similarityScore = 0
      const matchReasons: string[] = []

      // 1. Genre Jaccard Similarity (Max 40 points)
      const candGenreIds = new Set(candidate.genres.map((g) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        const jaccard = genreIntersection.length / genreUnion.size
        const points = Math.round(jaccard * 40)
        similarityScore += points
        const sharedNames = candidate.genres
          .filter((g) => sourceGenreIds.has(g.id))
          .map((g) => g.name)
        matchReasons.push(`Shared genres: ${sharedNames.join(', ')} (+${points} pts)`)
      }

      // 2. Tag / Theme Jaccard Similarity (Max 25 points)
      const candTagIds = new Set(candidate.tags.map((t) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        const jaccard = tagIntersection.length / tagUnion.size
        const points = Math.round(jaccard * 25)
        similarityScore += points
        const sharedTags = candidate.tags
          .filter((t) => sourceTagIds.has(t.id))
          .map((t) => t.name)
        matchReasons.push(`Shared themes: ${sharedTags.slice(0, 3).join(', ')} (+${points} pts)`)
      }

      // 3. Studio Overlap (Max 15 points)
      const candStudioIds = new Set(candidate.studios.map((s) => s.studioId))
      const studioIntersection = Array.from(sourceStudioIds).filter((sid) => candStudioIds.has(sid))
      if (studioIntersection.length > 0) {
        similarityScore += 15
        const studioName = candidate.studios[0]?.studio?.name || 'Same Studio'
        matchReasons.push(`Same production studio (${studioName}) (+15 pts)`)
      }

      // 4. Staff / Director Overlap (Max 15 points)
      const candPersonIds = new Set(candidate.staff.map((s) => s.personId).filter(Boolean))
      const staffIntersection = Array.from(sourcePersonIds).filter((pid) => candPersonIds.has(pid))
      if (staffIntersection.length > 0) {
        similarityScore += 15
        const staffName = candidate.staff[0]?.person?.namePrimary || 'Same Director / Crew'
        matchReasons.push(`Same director / crew (${staffName}) (+15 pts)`)
      }

      // 5. Franchise / Base Title Similarity (Max 15 points)
      const candBaseTitle = cleanBaseTitle(candidate.titlePrimary)
      if (sourceBaseTitle && candBaseTitle && (sourceBaseTitle.includes(candBaseTitle) || candBaseTitle.includes(sourceBaseTitle))) {
        similarityScore += 15
        matchReasons.push('Franchise / Shared title connection (+15 pts)')
      }

      // 6. Character Overlap (Max 10 points)
      const candCharIds = new Set(candidate.characters.map((c) => c.characterId))
      const charIntersection = Array.from(sourceCharacterIds).filter((cid) => candCharIds.has(cid))
      if (charIntersection.length > 0) {
        similarityScore += 10
        matchReasons.push(`Shared characters (${charIntersection.length}) (+10 pts)`)
      }

      // 7. Score Proximity (Max 5 points)
      if (source.averageScore && candidate.averageScore) {
        const diff = Math.abs(source.averageScore - candidate.averageScore)
        if (diff <= 1.0) {
          similarityScore += 5
          matchReasons.push(`Comparable rating score (${candidate.averageScore}) (+5 pts)`)
        }
      }

      const clampedScore = Math.min(100, similarityScore)
      return {
        id: candidate.id,
        mediaType: 'movie',
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary,
        titleNative: candidate.titleNative,
        coverImage: candidate.coverImage,
        bannerImage: candidate.bannerImage,
        format: 'MOVIE',
        status: String(candidate.status),
        year: candidate.releaseDateYear,
        averageScore: candidate.averageScore,
        similarityScore: clampedScore,
        matchReasons,
        genres: candidate.genres,
      }
    })

    const items = scored
      .filter((s) => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)

    return {
      success: true,
      sourceId: id,
      items,
    }
  }

  // ===========================================================================
  // 4. TV Catalog & Metadata
  // ===========================================================================

  public static async getTvCatalog(query?: CatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const formats = parseList(query?.formats)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { titlePrimary: { contains: search, mode: 'insensitive' } },
              { titleSecondary: { contains: search, mode: 'insensitive' } },
              { titleNative: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(genres.length > 0
        ? {
            genres: {
              some: {
                name: { in: genres, mode: 'insensitive' },
              },
            },
          }
        : {}),
      ...(formats.length > 0 ? { showType: { in: formats } } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses as any } } : {}),
      ...(years.length > 0 ? { firstAiredYear: { in: years } } : {}),
    }

    let orderBy: any = { popularity: sortOrder }
    if (sortBy === 'score') orderBy = { averageScore: sortOrder }
    if (sortBy === 'title') orderBy = { titlePrimary: sortOrder }
    if (sortBy === 'releaseDate') orderBy = { firstAiredYear: sortOrder }
    if (sortBy === 'trending') orderBy = { favorites: sortOrder }

    const [total, items] = await Promise.all([
      prisma.tv.count({ where }),
      prisma.tv.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          showType: true,
          status: true,
          firstAiredYear: true,
          episodeCount: true,
          averageScore: true,
          genres: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      success: true,
      items: items.map((x) => ({
        id: x.id,
        mediaType: 'tv',
        titlePrimary: x.titlePrimary,
        titleSecondary: x.titleSecondary,
        titleNative: x.titleNative,
        coverImage: x.coverImage,
        bannerImage: x.bannerImage,
        format: x.showType || 'TV',
        status: String(x.status),
        year: x.firstAiredYear,
        unitsCount: x.episodeCount,
        averageScore: x.averageScore,
        genres: x.genres,
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

  public static async getTvFilters() {
    const [allTv, allGenres] = await Promise.all([
      prisma.tv.findMany({
        select: {
          status: true,
          showType: true,
          firstAiredYear: true,
        },
      }),
      prisma.genre.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { tv: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const t of allTv) {
      if (t.status) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
      const fmt = t.showType || 'TV'
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1
      if (t.firstAiredYear) yearCounts[t.firstAiredYear] = (yearCounts[t.firstAiredYear] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: allGenres.map((g) => ({ value: g.name, count: g._count?.tv ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getTvById(id: number) {
    const tv = await prisma.tv.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        characters: {
          include: {
            character: true,
            actor: true,
          },
        },
        staff: {
          include: {
            person: true,
          },
        },
        studios: {
          include: {
            studio: true,
          },
        },
        seasons: {
          orderBy: { seasonNumber: 'asc' },
          take: 20,
        },
      },
    })

    if (!tv) {
      throw new NotFound(`TV series with ID ${id} not found`)
    }

    const relations = await fetchMediaRelations('TV' as MediaType, id)

    return {
      success: true,
      media: {
        ...tv,
        relations,
      },
    }
  }

  public static async refreshTv(id: number) {
    const tv = await prisma.tv.findUnique({
      where: { id },
      select: { id: true, titlePrimary: true },
    })

    if (!tv) {
      throw new NotFound(`TV series with ID ${id} not found`)
    }

    await prisma.tv.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    await MediaQueueManager.enqueueMediaUpdate('TV', id, {
      externalId: (tv as any).tvDBId,
      priority: 1,
      depth: 0,
      triggeredBy: 'manual',
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${tv.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarTv(id: number, limit: number = 10) {
    const source = await prisma.tv.findUnique({
      where: { id },
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        studios: { include: { studio: { select: { id: true, name: true } } } },
        staff: { include: { person: { select: { id: true, namePrimary: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    if (!source) {
      throw new NotFound(`TV series with ID ${id} not found`)
    }

    const sourceGenreIds = new Set(source.genres.map((g) => g.id))
    const sourceTagIds = new Set(source.tags.map((t) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))
    const sourcePersonIds = new Set(source.staff.map((s) => s.personId).filter(Boolean))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    const candidates = await prisma.tv.findMany({
      where: {
        id: { not: id },
        OR: [
          sourceGenreIds.size > 0
            ? {
                genres: {
                  some: { id: { in: Array.from(sourceGenreIds) } },
                },
              }
            : undefined,
          sourceTagIds.size > 0
            ? {
                tags: {
                  some: { id: { in: Array.from(sourceTagIds) } },
                },
              }
            : undefined,
          sourceStudioIds.size > 0
            ? {
                studios: {
                  some: { studioId: { in: Array.from(sourceStudioIds) } },
                },
              }
            : undefined,
          sourcePersonIds.size > 0
            ? {
                staff: {
                  some: { personId: { in: Array.from(sourcePersonIds) as any } },
                },
              }
            : undefined,
        ].filter(Boolean) as any,
      },
      take: 120,
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        studios: { include: { studio: { select: { id: true, name: true } } } },
        staff: { include: { person: { select: { id: true, namePrimary: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    const scored = candidates.map((candidate) => {
      let similarityScore = 0
      const matchReasons: string[] = []

      // 1. Genre Jaccard Similarity (Max 40 points)
      const candGenreIds = new Set(candidate.genres.map((g) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        const jaccard = genreIntersection.length / genreUnion.size
        const points = Math.round(jaccard * 40)
        similarityScore += points
        const sharedNames = candidate.genres
          .filter((g) => sourceGenreIds.has(g.id))
          .map((g) => g.name)
        matchReasons.push(`Shared genres: ${sharedNames.join(', ')} (+${points} pts)`)
      }

      // 2. Tag / Theme Jaccard Similarity (Max 25 points)
      const candTagIds = new Set(candidate.tags.map((t) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        const jaccard = tagIntersection.length / tagUnion.size
        const points = Math.round(jaccard * 25)
        similarityScore += points
        const sharedTags = candidate.tags
          .filter((t) => sourceTagIds.has(t.id))
          .map((t) => t.name)
        matchReasons.push(`Shared themes: ${sharedTags.slice(0, 3).join(', ')} (+${points} pts)`)
      }

      // 3. Studio / Network Overlap (Max 15 points)
      const candStudioIds = new Set(candidate.studios.map((s) => s.studioId))
      const studioIntersection = Array.from(sourceStudioIds).filter((sid) => candStudioIds.has(sid))
      if (studioIntersection.length > 0) {
        similarityScore += 15
        const studioName = candidate.studios[0]?.studio?.name || 'Same Studio'
        matchReasons.push(`Same production studio (${studioName}) (+15 pts)`)
      }

      // 4. Staff / Creator Overlap (Max 15 points)
      const candPersonIds = new Set(candidate.staff.map((s) => s.personId).filter(Boolean))
      const staffIntersection = Array.from(sourcePersonIds).filter((pid) => candPersonIds.has(pid))
      if (staffIntersection.length > 0) {
        similarityScore += 15
        const staffName = candidate.staff[0]?.person?.namePrimary || 'Same Creator / Crew'
        matchReasons.push(`Same creator / crew (${staffName}) (+15 pts)`)
      }

      // 5. Franchise / Base Title Similarity (Max 15 points)
      const candBaseTitle = cleanBaseTitle(candidate.titlePrimary)
      if (sourceBaseTitle && candBaseTitle && (sourceBaseTitle.includes(candBaseTitle) || candBaseTitle.includes(sourceBaseTitle))) {
        similarityScore += 15
        matchReasons.push('Franchise / Shared title connection (+15 pts)')
      }

      // 6. Character Overlap (Max 10 points)
      const candCharIds = new Set(candidate.characters.map((c) => c.characterId))
      const charIntersection = Array.from(sourceCharacterIds).filter((cid) => candCharIds.has(cid))
      if (charIntersection.length > 0) {
        similarityScore += 10
        matchReasons.push(`Shared characters (${charIntersection.length}) (+10 pts)`)
      }

      // 7. Format Alignment (Max 5 points)
      if (candidate.showType && candidate.showType === source.showType) {
        similarityScore += 5
        matchReasons.push(`Same show type (${candidate.showType}) (+5 pts)`)
      }

      // 8. Score Proximity (Max 5 points)
      if (source.averageScore && candidate.averageScore) {
        const diff = Math.abs(source.averageScore - candidate.averageScore)
        if (diff <= 1.0) {
          similarityScore += 5
          matchReasons.push(`Comparable rating score (${candidate.averageScore}) (+5 pts)`)
        }
      }

      const clampedScore = Math.min(100, similarityScore)
      return {
        id: candidate.id,
        mediaType: 'tv',
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary,
        titleNative: candidate.titleNative,
        coverImage: candidate.coverImage,
        bannerImage: candidate.bannerImage,
        format: candidate.showType || 'TV',
        status: String(candidate.status),
        year: candidate.firstAiredYear,
        averageScore: candidate.averageScore,
        similarityScore: clampedScore,
        matchReasons,
        genres: candidate.genres,
      }
    })

    const items = scored
      .filter((s) => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)

    return {
      success: true,
      sourceId: id,
      items,
    }
  }

  // ===========================================================================
  // 5. Books Catalog & Metadata
  // ===========================================================================

  public static async getBookCatalog(query?: CatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const formats = parseList(query?.formats)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { titlePrimary: { contains: search, mode: 'insensitive' } },
              { titleSecondary: { contains: search, mode: 'insensitive' } },
              { authors: { has: search } },
            ],
          }
        : {}),
      ...(genres.length > 0
        ? {
            genres: {
              some: {
                name: { in: genres, mode: 'insensitive' },
              },
            },
          }
        : {}),
      ...(formats.length > 0 ? { format: { in: formats } } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses as any } } : {}),
      ...(years.length > 0 ? { releaseDateYear: { in: years } } : {}),
    }

    let orderBy: any = { popularity: sortOrder }
    if (sortBy === 'score') orderBy = { averageScore: sortOrder }
    if (sortBy === 'title') orderBy = { titlePrimary: sortOrder }
    if (sortBy === 'releaseDate') orderBy = { releaseDateYear: sortOrder }
    if (sortBy === 'trending') orderBy = { favorites: sortOrder }

    const [total, items] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          coverImage: true,
          bannerImage: true,
          format: true,
          status: true,
          releaseDateYear: true,
          pageCount: true,
          chapterCount: true,
          averageScore: true,
          genres: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      success: true,
      items: items.map((x) => ({
        id: x.id,
        mediaType: 'book',
        titlePrimary: x.titlePrimary,
        titleSecondary: x.titleSecondary,
        titleNative: null,
        coverImage: x.coverImage,
        bannerImage: x.bannerImage,
        format: x.format || 'BOOK',
        status: String(x.status),
        year: x.releaseDateYear,
        unitsCount: x.pageCount ?? x.chapterCount,
        averageScore: x.averageScore,
        genres: x.genres,
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

  public static async getBookFilters() {
    const [allBooks, allGenres] = await Promise.all([
      prisma.book.findMany({
        select: {
          status: true,
          format: true,
          releaseDateYear: true,
        },
      }),
      prisma.genre.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { books: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const b of allBooks) {
      if (b.status) statusCounts[b.status] = (statusCounts[b.status] || 0) + 1
      const fmt = b.format || 'BOOK'
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1
      if (b.releaseDateYear) yearCounts[b.releaseDateYear] = (yearCounts[b.releaseDateYear] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: allGenres.map((g) => ({ value: g.name, count: g._count?.books ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getBookById(id: number) {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        characters: {
          include: {
            character: true,
          },
        },
        staff: {
          include: {
            person: true,
          },
        },
        studios: {
          include: {
            studio: true,
          },
        },
      },
    })

    if (!book) {
      throw new NotFound(`Book with ID ${id} not found`)
    }

    const relations = await fetchMediaRelations('BOOK' as MediaType, id)

    return {
      success: true,
      media: {
        ...book,
        relations,
      },
    }
  }

  public static async refreshBook(id: number) {
    const book = await prisma.book.findUnique({
      where: { id },
      select: { id: true, titlePrimary: true },
    })

    if (!book) {
      throw new NotFound(`Book with ID ${id} not found`)
    }

    await prisma.book.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    await MediaQueueManager.enqueueMediaUpdate('BOOK', id, {
      externalId: (book as any).googleBookId,
      priority: 1,
      depth: 0,
      triggeredBy: 'manual',
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${book.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarBooks(id: number, limit: number = 10) {
    const source = await prisma.book.findUnique({
      where: { id },
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        staff: { include: { person: { select: { id: true, namePrimary: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    if (!source) {
      throw new NotFound(`Book with ID ${id} not found`)
    }

    const sourceGenreIds = new Set(source.genres.map((g) => g.id))
    const sourceTagIds = new Set(source.tags.map((t) => t.id))
    const sourceAuthors = new Set((source.authors || []).map((a) => a.toLowerCase().trim()))
    const sourceStaffPersonIds = new Set(source.staff.map((s) => s.personId).filter(Boolean))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    const candidates = await prisma.book.findMany({
      where: {
        id: { not: id },
        OR: [
          sourceGenreIds.size > 0
            ? {
                genres: {
                  some: { id: { in: Array.from(sourceGenreIds) } },
                },
              }
            : undefined,
          sourceTagIds.size > 0
            ? {
                tags: {
                  some: { id: { in: Array.from(sourceTagIds) } },
                },
              }
            : undefined,
          sourceAuthors.size > 0
            ? {
                authors: {
                  hasSome: Array.from(sourceAuthors),
                },
              }
            : undefined,
          sourceStaffPersonIds.size > 0
            ? {
                staff: {
                  some: { personId: { in: Array.from(sourceStaffPersonIds) as any } },
                },
              }
            : undefined,
        ].filter(Boolean) as any,
      },
      take: 120,
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        staff: { include: { person: { select: { id: true, namePrimary: true } } } },
        characters: { select: { characterId: true } },
      },
    })

    const scored = candidates.map((candidate) => {
      let similarityScore = 0
      const matchReasons: string[] = []

      // 1. Genre Jaccard Similarity (Max 40 points)
      const candGenreIds = new Set(candidate.genres.map((g) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        const jaccard = genreIntersection.length / genreUnion.size
        const points = Math.round(jaccard * 40)
        similarityScore += points
        const sharedNames = candidate.genres
          .filter((g) => sourceGenreIds.has(g.id))
          .map((g) => g.name)
        matchReasons.push(`Shared genres: ${sharedNames.join(', ')} (+${points} pts)`)
      }

      // 2. Tag / Subject Jaccard Similarity (Max 25 points)
      const candTagIds = new Set(candidate.tags.map((t) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        const jaccard = tagIntersection.length / tagUnion.size
        const points = Math.round(jaccard * 25)
        similarityScore += points
        const sharedTags = candidate.tags
          .filter((t) => sourceTagIds.has(t.id))
          .map((t) => t.name)
        matchReasons.push(`Shared subjects: ${sharedTags.slice(0, 3).join(', ')} (+${points} pts)`)
      }

      // 3. Author Overlap (Max 20 points)
      const candAuthors = (candidate.authors || []).map((a) => a.toLowerCase().trim())
      const sharedAuthors = candAuthors.filter((a) => sourceAuthors.has(a))
      if (sharedAuthors.length > 0) {
        similarityScore += 20
        matchReasons.push(`Same author (${sharedAuthors.join(', ')}) (+20 pts)`)
      }

      // 4. Franchise / Series / Title Similarity (Max 15 points)
      const candBaseTitle = cleanBaseTitle(candidate.titlePrimary)
      if (sourceBaseTitle && candBaseTitle && (sourceBaseTitle.includes(candBaseTitle) || candBaseTitle.includes(sourceBaseTitle))) {
        similarityScore += 15
        matchReasons.push('Series / Title connection (+15 pts)')
      }

      // 5. Shared Characters (Max 10 points)
      const candCharIds = new Set(candidate.characters.map((c) => c.characterId))
      const charIntersection = Array.from(sourceCharacterIds).filter((cid) => candCharIds.has(cid))
      if (charIntersection.length > 0) {
        similarityScore += 10
        matchReasons.push(`Shared characters (${charIntersection.length}) (+10 pts)`)
      }

      // 6. Format Alignment (Max 5 points)
      if (candidate.format && candidate.format === source.format) {
        similarityScore += 5
        matchReasons.push(`Same book format (${candidate.format}) (+5 pts)`)
      }

      // 7. Score Proximity (Max 5 points)
      if (source.averageScore && candidate.averageScore) {
        const diff = Math.abs(source.averageScore - candidate.averageScore)
        if (diff <= 1.0) {
          similarityScore += 5
          matchReasons.push(`Comparable rating score (${candidate.averageScore}) (+5 pts)`)
        }
      }

      const clampedScore = Math.min(100, similarityScore)
      return {
        id: candidate.id,
        mediaType: 'book',
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary,
        titleNative: null,
        coverImage: candidate.coverImage,
        bannerImage: candidate.bannerImage,
        format: candidate.format || 'BOOK',
        status: String(candidate.status),
        year: candidate.releaseDateYear,
        averageScore: candidate.averageScore,
        similarityScore: clampedScore,
        matchReasons,
        genres: candidate.genres,
      }
    })

    const items = scored
      .filter((s) => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)

    return {
      success: true,
      sourceId: id,
      items,
    }
  }

  // ===========================================================================
  // 6. Games Catalog & Metadata
  // ===========================================================================

  public static async getGameCatalog(query?: CatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { titlePrimary: { contains: search, mode: 'insensitive' } },
              { titleSecondary: { contains: search, mode: 'insensitive' } },
              { titleNative: { contains: search, mode: 'insensitive' } },
              { developers: { has: search } },
              { publishers: { has: search } },
            ],
          }
        : {}),
      ...(genres.length > 0
        ? {
            genres: {
              some: {
                name: { in: genres, mode: 'insensitive' },
              },
            },
          }
        : {}),
      ...(statuses.length > 0 ? { status: { in: statuses as any } } : {}),
      ...(years.length > 0 ? { releaseDateYear: { in: years } } : {}),
    }

    let orderBy: any = { popularity: sortOrder }
    if (sortBy === 'score') orderBy = { averageScore: sortOrder }
    if (sortBy === 'title') orderBy = { titlePrimary: sortOrder }
    if (sortBy === 'releaseDate') orderBy = { releaseDateYear: sortOrder }
    if (sortBy === 'trending') orderBy = { favorites: sortOrder }

    const [total, items] = await Promise.all([
      prisma.game.count({ where }),
      prisma.game.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          backgroundImage: true,
          status: true,
          releaseDateYear: true,
          averageScore: true,
          genres: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      success: true,
      items: items.map((x) => ({
        id: x.id,
        mediaType: 'game',
        titlePrimary: x.titlePrimary,
        titleSecondary: x.titleSecondary,
        titleNative: x.titleNative,
        coverImage: x.coverImage,
        bannerImage: x.bannerImage || x.backgroundImage,
        format: 'GAME',
        status: String(x.status),
        year: x.releaseDateYear,
        unitsCount: null,
        averageScore: x.averageScore,
        genres: x.genres,
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

  public static async getGameFilters() {
    const [allGames, allGenres] = await Promise.all([
      prisma.game.findMany({
        select: {
          status: true,
          releaseDateYear: true,
        },
      }),
      prisma.genre.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { games: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const g of allGames) {
      if (g.status) statusCounts[g.status] = (statusCounts[g.status] || 0) + 1
      if (g.releaseDateYear) yearCounts[g.releaseDateYear] = (yearCounts[g.releaseDateYear] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: [{ value: 'GAME', count: allGames.length }],
      genres: allGenres.map((g) => ({ value: g.name, count: g._count?.games ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getGameById(id: number) {
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        studios: {
          include: {
            studio: true,
          },
        },
      },
    })

    if (!game) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    const relations = await fetchMediaRelations('GAME' as MediaType, id)

    return {
      success: true,
      media: {
        ...game,
        relations,
      },
    }
  }

  public static async refreshGame(id: number) {
    const game = await prisma.game.findUnique({
      where: { id },
      select: { id: true, titlePrimary: true },
    })

    if (!game) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    await prisma.game.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    await MediaQueueManager.enqueueMediaUpdate('GAME', id, {
      externalId: (game as any).igdbId,
      priority: 1,
      depth: 0,
      triggeredBy: 'manual',
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${game.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarGames(id: number, limit: number = 10) {
    const source = await prisma.game.findUnique({
      where: { id },
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        studios: { include: { studio: { select: { id: true, name: true } } } },
      },
    })

    if (!source) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    const sourceGenreIds = new Set(source.genres.map((g) => g.id))
    const sourceTagIds = new Set(source.tags.map((t) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))
    const sourceDevelopers = new Set((source.developers || []).map((d) => d.toLowerCase().trim()))
    const sourcePlatforms = new Set((source.platforms || []).map((p) => p.toLowerCase().trim()))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    const candidates = await prisma.game.findMany({
      where: {
        id: { not: id },
        OR: [
          sourceGenreIds.size > 0
            ? {
                genres: {
                  some: { id: { in: Array.from(sourceGenreIds) } },
                },
              }
            : undefined,
          sourceTagIds.size > 0
            ? {
                tags: {
                  some: { id: { in: Array.from(sourceTagIds) } },
                },
              }
            : undefined,
          sourceStudioIds.size > 0
            ? {
                studios: {
                  some: { studioId: { in: Array.from(sourceStudioIds) } },
                },
              }
            : undefined,
          sourceDevelopers.size > 0
            ? {
                developers: {
                  hasSome: Array.from(sourceDevelopers),
                },
              }
            : undefined,
        ].filter(Boolean) as any,
      },
      take: 120,
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        studios: { include: { studio: { select: { id: true, name: true } } } },
      },
    })

    const scored = candidates.map((candidate) => {
      let similarityScore = 0
      const matchReasons: string[] = []

      // 1. Genre Jaccard Similarity (Max 40 points)
      const candGenreIds = new Set(candidate.genres.map((g) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        const jaccard = genreIntersection.length / genreUnion.size
        const points = Math.round(jaccard * 40)
        similarityScore += points
        const sharedNames = candidate.genres
          .filter((g) => sourceGenreIds.has(g.id))
          .map((g) => g.name)
        matchReasons.push(`Shared genres: ${sharedNames.join(', ')} (+${points} pts)`)
      }

      // 2. Tag / Theme Jaccard Similarity (Max 25 points)
      const candTagIds = new Set(candidate.tags.map((t) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        const jaccard = tagIntersection.length / tagUnion.size
        const points = Math.round(jaccard * 25)
        similarityScore += points
        const sharedTags = candidate.tags
          .filter((t) => sourceTagIds.has(t.id))
          .map((t) => t.name)
        matchReasons.push(`Shared gameplay themes: ${sharedTags.slice(0, 3).join(', ')} (+${points} pts)`)
      }

      // 3. Developer / Studio Overlap (Max 20 points)
      const candDevs = (candidate.developers || []).map((d) => d.toLowerCase().trim())
      const sharedDevs = candDevs.filter((d) => sourceDevelopers.has(d))
      if (sharedDevs.length > 0) {
        similarityScore += 20
        matchReasons.push(`Same developer (${sharedDevs.join(', ')}) (+20 pts)`)
      }

      // 4. Franchise / Base Title Similarity (Max 15 points)
      const candBaseTitle = cleanBaseTitle(candidate.titlePrimary)
      if (sourceBaseTitle && candBaseTitle && (sourceBaseTitle.includes(candBaseTitle) || candBaseTitle.includes(sourceBaseTitle))) {
        similarityScore += 15
        matchReasons.push('Franchise / Shared title connection (+15 pts)')
      }

      // 5. Platform Overlap (Max 10 points)
      const candPlatforms = (candidate.platforms || []).map((p) => p.toLowerCase().trim())
      const sharedPlatforms = candPlatforms.filter((p) => sourcePlatforms.has(p))
      if (sharedPlatforms.length > 0) {
        similarityScore += 10
        matchReasons.push(`Shared platforms (${sharedPlatforms.slice(0, 3).join(', ')}) (+10 pts)`)
      }

      // 6. Score Proximity (Max 5 points)
      if (source.averageScore && candidate.averageScore) {
        const diff = Math.abs(source.averageScore - candidate.averageScore)
        if (diff <= 1.0) {
          similarityScore += 5
          matchReasons.push(`Comparable rating score (${candidate.averageScore}) (+5 pts)`)
        }
      }

      const clampedScore = Math.min(100, similarityScore)
      return {
        id: candidate.id,
        mediaType: 'game',
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary,
        titleNative: candidate.titleNative,
        coverImage: candidate.coverImage,
        bannerImage: candidate.bannerImage || candidate.backgroundImage,
        format: 'GAME',
        status: String(candidate.status),
        year: candidate.releaseDateYear,
        averageScore: candidate.averageScore,
        similarityScore: clampedScore,
        matchReasons,
        genres: candidate.genres,
      }
    })

    const items = scored
      .filter((s) => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)

    return {
      success: true,
      sourceId: id,
      items,
    }
  }

  // ===========================================================================
  // 7. Music Catalog & Metadata
  // ===========================================================================

  public static async getMusicCatalog(query?: CatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const formats = parseList(query?.formats)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    const where: any = {
      ...(search
        ? {
            OR: [
              { titlePrimary: { contains: search, mode: 'insensitive' } },
              { titleSecondary: { contains: search, mode: 'insensitive' } },
              { artistName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(genres.length > 0
        ? {
            genres: {
              some: {
                name: { in: genres, mode: 'insensitive' },
              },
            },
          }
        : {}),
      ...(formats.length > 0 ? { type: { in: formats as any } } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses as any } } : {}),
      ...(years.length > 0 ? { releaseDateYear: { in: years } } : {}),
    }

    let orderBy: any = { popularity: sortOrder }
    if (sortBy === 'score') orderBy = { popularity: sortOrder }
    if (sortBy === 'title') orderBy = { titlePrimary: sortOrder }
    if (sortBy === 'releaseDate') orderBy = { releaseDateYear: sortOrder }
    if (sortBy === 'trending') orderBy = { favorites: sortOrder }

    const [total, items] = await Promise.all([
      prisma.music.count({ where }),
      prisma.music.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          type: true,
          status: true,
          releaseDateYear: true,
          duration: true,
          genres: { select: { id: true, name: true } },
        },
      }),
    ])

    return {
      success: true,
      items: items.map((x) => ({
        id: x.id,
        mediaType: 'music',
        titlePrimary: x.titlePrimary,
        titleSecondary: x.titleSecondary,
        titleNative: x.titleNative,
        coverImage: x.coverImage,
        bannerImage: null,
        format: String(x.type),
        status: String(x.status),
        year: x.releaseDateYear,
        unitsCount: x.duration,
        averageScore: null,
        genres: x.genres,
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

  public static async getMusicFilters() {
    const [allMusic, allGenres] = await Promise.all([
      prisma.music.findMany({
        select: {
          status: true,
          type: true,
          releaseDateYear: true,
        },
      }),
      prisma.genre.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { music: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const m of allMusic) {
      if (m.status) statusCounts[m.status] = (statusCounts[m.status] || 0) + 1
      if (m.type) formatCounts[m.type] = (formatCounts[m.type] || 0) + 1
      if (m.releaseDateYear) yearCounts[m.releaseDateYear] = (yearCounts[m.releaseDateYear] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: allGenres.map((g) => ({ value: g.name, count: g._count?.music ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getMusicById(id: number) {
    const music = await prisma.music.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        artist: true,
        album: {
          select: {
            id: true,
            titlePrimary: true,
            coverImage: true,
          },
        },
        tracks: {
          select: {
            id: true,
            titlePrimary: true,
            duration: true,
            trackPosition: true,
          },
          orderBy: { trackPosition: 'asc' },
          take: 50,
        },
        staff: {
          include: {
            person: true,
          },
        },
      },
    })

    if (!music) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    const relations = await fetchMediaRelations('MUSIC' as MediaType, id)

    return {
      success: true,
      media: {
        ...music,
        relations,
      },
    }
  }

  public static async refreshMusic(id: number) {
    const music = await prisma.music.findUnique({
      where: { id },
      select: { id: true, titlePrimary: true },
    })

    if (!music) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    await prisma.music.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    await MediaQueueManager.enqueueMediaUpdate('MUSIC', id, {
      priority: 1,
      depth: 0,
      triggeredBy: 'manual',
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${music.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarMusic(id: number, limit: number = 10) {
    const source = await prisma.music.findUnique({
      where: { id },
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        artist: { select: { id: true, namePrimary: true } },
      },
    })

    if (!source) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    const sourceGenreIds = new Set(source.genres.map((g) => g.id))
    const sourceTagIds = new Set(source.tags.map((t) => t.id))
    const sourceArtistId = source.artistId
    const sourceArtistName = source.artistName?.toLowerCase().trim()
    const sourceAlbumId = source.albumId
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    const candidates = await prisma.music.findMany({
      where: {
        id: { not: id },
        OR: [
          sourceArtistId ? { artistId: sourceArtistId } : undefined,
          sourceArtistName ? { artistName: { equals: source.artistName, mode: 'insensitive' } } : undefined,
          sourceAlbumId ? { albumId: sourceAlbumId } : undefined,
          sourceGenreIds.size > 0
            ? {
                genres: {
                  some: { id: { in: Array.from(sourceGenreIds) } },
                },
              }
            : undefined,
          sourceTagIds.size > 0
            ? {
                tags: {
                  some: { id: { in: Array.from(sourceTagIds) } },
                },
              }
            : undefined,
        ].filter(Boolean) as any,
      },
      take: 120,
      include: {
        genres: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
        artist: { select: { id: true, namePrimary: true } },
      },
    })

    const scored = candidates.map((candidate) => {
      let similarityScore = 0
      const matchReasons: string[] = []

      // 1. Same Artist (Max 35 points)
      if (
        (sourceArtistId && candidate.artistId === sourceArtistId) ||
        (sourceArtistName && candidate.artistName?.toLowerCase().trim() === sourceArtistName)
      ) {
        similarityScore += 35
        const artist = candidate.artist?.namePrimary || candidate.artistName || 'Same Artist'
        matchReasons.push(`Same artist (${artist}) (+35 pts)`)
      }

      // 2. Genre Jaccard Similarity (Max 30 points)
      const candGenreIds = new Set(candidate.genres.map((g) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        const jaccard = genreIntersection.length / genreUnion.size
        const points = Math.round(jaccard * 30)
        similarityScore += points
        const sharedNames = candidate.genres
          .filter((g) => sourceGenreIds.has(g.id))
          .map((g) => g.name)
        matchReasons.push(`Shared genres: ${sharedNames.join(', ')} (+${points} pts)`)
      }

      // 3. Tag / Theme Jaccard Similarity (Max 20 points)
      const candTagIds = new Set(candidate.tags.map((t) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        const jaccard = tagIntersection.length / tagUnion.size
        const points = Math.round(jaccard * 20)
        similarityScore += points
        const sharedTags = candidate.tags
          .filter((t) => sourceTagIds.has(t.id))
          .map((t) => t.name)
        matchReasons.push(`Shared mood / tags: ${sharedTags.slice(0, 3).join(', ')} (+${points} pts)`)
      }

      // 4. Same Album (Max 15 points)
      if (sourceAlbumId && candidate.albumId === sourceAlbumId) {
        similarityScore += 15
        matchReasons.push('Same album release (+15 pts)')
      }

      // 5. Type / Format Alignment (Max 10 points)
      if (candidate.type === source.type) {
        similarityScore += 10
        matchReasons.push(`Same release type (${candidate.type}) (+10 pts)`)
      }

      // 6. Year Proximity (Max 5 points)
      if (source.releaseDateYear && candidate.releaseDateYear) {
        const diff = Math.abs(source.releaseDateYear - candidate.releaseDateYear)
        if (diff <= 2) {
          similarityScore += 5
          matchReasons.push(`Similar era (${candidate.releaseDateYear}) (+5 pts)`)
        }
      }

      const clampedScore = Math.min(100, similarityScore)
      return {
        id: candidate.id,
        mediaType: 'music',
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary,
        titleNative: candidate.titleNative,
        coverImage: candidate.coverImage,
        bannerImage: null,
        format: String(candidate.type),
        status: String(candidate.status),
        year: candidate.releaseDateYear,
        averageScore: null,
        similarityScore: clampedScore,
        matchReasons,
        genres: candidate.genres,
      }
    })

    const items = scored
      .filter((s) => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)

    return {
      success: true,
      sourceId: id,
      items,
    }
  }
}

import { prisma, countOf, or, type MediaType } from '@Iris/db'
import { NotFound } from '../../lib/errors'
import { MediaQueueManager } from './queue'
import { fetchMediaRelations } from './media-relations.helper'
import { MediaEntitySyncer } from './syncer/media-entity.syncer'

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

    let q = prisma.orm.public.Anime
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`),
          m.titleNative.ilike(`%${search}%`)
        )
      )
    }
    if (genres.length > 0) {
      q = q.where((m) =>
        m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))
      )
    }
    if (formats.length > 0) {
      q = q.where((m) => m.format.in(formats as any))
    }
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.seasonYear.in(years))
    }
    if (season) {
      q = q.where({ seasonSeason: season as any })
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.averageScore.asc() : x.averageScore.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.seasonYear.asc() : x.seasonYear.desc()
      )
    } else if (sortBy === 'trending') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'bannerImage',
          'format',
          'status',
          'seasonYear',
          'seasonSeason',
          'episodeCount',
          'averageScore'
        )
        .include('genres', (g) =>
          g.include('genre', (ge) => ge.select('id', 'name'))
        )
        .all(),
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
        genres: (x.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
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
      prisma.orm.public.Anime.select(
        'status',
        'format',
        'seasonYear',
        'seasonSeason'
      ).all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('anime', (a) => a.count())
        .orderBy((g) => g.name.asc())
        .all(),
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
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.anime ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
      seasons: Object.entries(seasonCounts).map(([value, count]) => ({ value, count })),
    }
  }

  public static async getAnimeById(id: number) {
    const anime = await prisma.orm.public.Anime.where({ id })
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .include('characters', (c) =>
        c.include('character').include('actor')
      )
      .include('staff', (s) => s.include('person'))
      .include('studios', (st) => st.include('studio'))
      .include('episodes', (e) =>
        e.orderBy((ep) => ep.number.asc()).limit(50)
      )
      .first()

    if (!anime) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

    if (anime.alUpdatedAt == null && anime.anilistId) {
      await MediaEntitySyncer.syncAnime(id, anime.anilistId).catch(() => {})
      const updated = await prisma.orm.public.Anime.where({ id })
        .include('genres', (g) => g.include('genre'))
        .include('tags', (t) => t.include('tag'))
        .include('characters', (c) =>
          c.include('character').include('actor')
        )
        .include('staff', (s) => s.include('person'))
        .include('studios', (st) => st.include('studio'))
        .include('episodes', (e) =>
          e.orderBy((ep) => ep.number.asc()).limit(50)
        )
        .first()
      if (updated) {
        const relations = await fetchMediaRelations('ANIME' as MediaType, id)
        return {
          success: true,
          media: {
            ...updated,
            genres: (updated.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
            tags: (updated.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
            relations,
          },
        }
      }
    }

    // Fetch relations
    const relations = await fetchMediaRelations('ANIME' as MediaType, id)

    return {
      success: true,
      media: {
        ...anime,
        genres: (anime.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
        tags: (anime.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
        relations,
      },
    }
  }

  public static async refreshAnime(id: number) {
    const anime = await prisma.orm.public.Anime.where({ id }).select('id', 'anilistId', 'titlePrimary').first()

    if (!anime) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

    // Mark as updated and queue refresh
    await prisma.orm.public.Anime.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('ANIME', id, {
      externalId: anime.anilistId,
      priority: 1,
      depth: 0,
      maxDepth: 0,
      triggeredBy: 'manual',
      forceRefresh: true,
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${anime.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarAnime(id: number, limit: number = 10) {
    const source = await prisma.orm.public.Anime.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .include('characters', (c) => c.select('characterId'))
      .first()

    if (!source) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    // Query candidates that share at least 1 genre or tag or format
    let candidatesQ = prisma.orm.public.Anime.where((a) => a.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((a: any) => a.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((a: any) => a.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))
    if (sourceStudioIds.size > 0) conds.push((a: any) => a.studios.some((s: any) => s.studioId.in(Array.from(sourceStudioIds))))
    if (source.format) conds.push((a: any) => a.format.eq(source.format))
    if (conds.length > 0) {
      candidatesQ = candidatesQ.where((a) => or(...conds.map((c) => c(a))))
    }

    const rawCandidates = await candidatesQ
      .limit(120)
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .include('characters', (c) => c.select('characterId'))
      .all()

    const candidates = rawCandidates.map((candidate: any) => ({
      ...candidate,
      genres: (candidate.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
      tags: (candidate.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
    }))

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

    let q = prisma.orm.public.Manga
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`),
          m.titleNative.ilike(`%${search}%`)
        )
      )
    }
    if (genres.length > 0) {
      q = q.where((m) =>
        m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))
      )
    }
    if (formats.length > 0) {
      q = q.where((m) => m.format.in(formats as any))
    }
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.startDateYear.in(years))
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.averageScore.asc() : x.averageScore.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.startDateYear.asc() : x.startDateYear.desc()
      )
    } else if (sortBy === 'trending') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'bannerImage',
          'format',
          'status',
          'startDateYear',
          'chapterCount',
          'volumeCount',
          'averageScore'
        )
        .include('genres', (g) =>
          g.include('genre', (ge) => ge.select('id', 'name'))
        )
        .all(),
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
        genres: (x.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
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
      prisma.orm.public.Manga.select(
        'status',
        'format',
        'startDateYear'
      ).all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('manga', (m) => m.count())
        .orderBy((g) => g.name.asc())
        .all(),
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
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.manga ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getMangaById(id: number) {
    const manga = await prisma.orm.public.Manga.where({ id })
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .include('characters', (c) =>
        c.include('character').include('actor')
      )
      .include('staff', (s) => s.include('person'))
      .first()

    if (!manga) {
      throw new NotFound(`Manga with ID ${id} not found`)
    }

    if (manga.alUpdatedAt == null && manga.anilistId) {
      await MediaEntitySyncer.syncManga(id, manga.anilistId).catch(() => {})
      const updated = await prisma.orm.public.Manga.where({ id })
        .include('genres', (g) => g.include('genre'))
        .include('tags', (t) => t.include('tag'))
        .include('characters', (c) =>
          c.include('character').include('actor')
        )
        .include('staff', (s) => s.include('person'))
        .first()
      if (updated) {
        const relations = await fetchMediaRelations('MANGA' as MediaType, id)
        return {
          success: true,
          media: {
            ...updated,
            genres: (updated.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
            tags: (updated.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
            relations,
          },
        }
      }
    }

    const relations = await fetchMediaRelations('MANGA' as MediaType, id)

    return {
      success: true,
      media: {
        ...manga,
        genres: (manga.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
        tags: (manga.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
        relations,
      },
    }
  }

  public static async refreshManga(id: number) {
    const manga = await prisma.orm.public.Manga.where({ id }).select('id', 'anilistId', 'titlePrimary').first()

    if (!manga) {
      throw new NotFound(`Manga with ID ${id} not found`)
    }

    await prisma.orm.public.Manga.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('MANGA', id, {
      externalId: manga.anilistId,
      priority: 1,
      depth: 0,
      maxDepth: 0,
      triggeredBy: 'manual',
      forceRefresh: true,
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${manga.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarManga(id: number, limit: number = 10) {
    const source = await prisma.orm.public.Manga.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('staff', (s) => s.include('person', (p) => p.select('id', 'namePrimary')))
      .include('characters', (c) => c.select('characterId'))
      .first()

    if (!source) {
      throw new NotFound(`Manga with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))
    const sourceStaffPersonIds = new Set(source.staff.map((s) => s.personId).filter(Boolean))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    let candidatesQ = prisma.orm.public.Manga.where((m) => m.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((m: any) => m.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((m: any) => m.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))
    if (sourceStaffPersonIds.size > 0) conds.push((m: any) => m.staff.some((s: any) => s.personId.in(Array.from(sourceStaffPersonIds) as any)))
    if (source.format) conds.push((m: any) => m.format.eq(source.format))
    if (conds.length > 0) {
      candidatesQ = candidatesQ.where((m) => or(...conds.map((c) => c(m))))
    }

    const rawCandidates = await candidatesQ
      .limit(120)
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('staff', (s) => s.include('person', (p) => p.select('id', 'namePrimary')))
      .include('characters', (c) => c.select('characterId'))
      .all()

    const candidates = rawCandidates.map((candidate: any) => ({
      ...candidate,
      genres: (candidate.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
      tags: (candidate.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
    }))

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

    let q = prisma.orm.public.Movie
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`),
          m.titleNative.ilike(`%${search}%`)
        )
      )
    }
    if (genres.length > 0) {
      q = q.where((m) =>
        m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))
      )
    }
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.releaseDateYear.in(years))
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.averageScore.asc() : x.averageScore.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.releaseDateYear.asc() : x.releaseDateYear.desc()
      )
    } else if (sortBy === 'trending') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'bannerImage',
          'runtime',
          'releaseDateYear',
          'averageScore',
          'status'
        )
        .include('genres', (g) =>
          g.include('genre', (ge) => ge.select('id', 'name'))
        )
        .all(),
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
        genres: (x.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
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
      prisma.orm.public.Movie.select(
        'status',
        'releaseDateYear'
      ).all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('movies', (m) => m.count())
        .orderBy((g) => g.name.asc())
        .all(),
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
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.movies ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getMovieById(id: number) {
    const movie = await prisma.orm.public.Movie.where({ id })
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .include('characters', (c) =>
        c.include('character').include('actor')
      )
      .include('staff', (s) => s.include('person'))
      .include('studios', (st) => st.include('studio'))
      .first()

    if (!movie) {
      throw new NotFound(`Movie with ID ${id} not found`)
    }

    if (movie.tvdbUpdatedAt == null && movie.tvDBId) {
      await MediaEntitySyncer.syncMovie(id, movie.tvDBId).catch(() => {})
      const updated = await prisma.orm.public.Movie.where({ id })
        .include('genres', (g) => g.include('genre'))
        .include('tags', (t) => t.include('tag'))
        .include('characters', (c) =>
          c.include('character').include('actor')
        )
        .include('staff', (s) => s.include('person'))
        .include('studios', (st) => st.include('studio'))
        .first()
      if (updated) {
        const relations = await fetchMediaRelations('MOVIE' as MediaType, id)
        return {
          success: true,
          media: {
            ...updated,
            genres: (updated.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
            tags: (updated.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
            budget: updated.budget != null ? Number(updated.budget) : null,
            revenue: updated.revenue != null ? Number(updated.revenue) : null,
            relations,
          },
        }
      }
    }

    const relations = await fetchMediaRelations('MOVIE' as MediaType, id)

    return {
      success: true,
      media: {
        ...movie,
        genres: (movie.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
        tags: (movie.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
        budget: movie.budget != null ? Number(movie.budget) : null,
        revenue: movie.revenue != null ? Number(movie.revenue) : null,
        relations,
      },
    }
  }

  public static async refreshMovie(id: number) {
    const movie = await prisma.orm.public.Movie.where({ id }).select('id', 'titlePrimary', 'tvDBId').first()

    if (!movie) {
      throw new NotFound(`Movie with ID ${id} not found`)
    }

    await prisma.orm.public.Movie.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('MOVIE', id, {
      externalId: (movie as any).tvDBId,
      priority: 1,
      depth: 0,
      maxDepth: 0,
      triggeredBy: 'manual',
      forceRefresh: true,
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${movie.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarMovies(id: number, limit: number = 10) {
    const source = await prisma.orm.public.Movie.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .include('staff', (s) => s.include('person', (p) => p.select('id', 'namePrimary')))
      .include('characters', (c) => c.select('characterId'))
      .first()

    if (!source) {
      throw new NotFound(`Movie with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))
    const sourcePersonIds = new Set(source.staff.map((s) => s.personId).filter(Boolean))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    let candidatesQ = prisma.orm.public.Movie.where((m) => m.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((m: any) => m.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((m: any) => m.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))
    if (sourceStudioIds.size > 0) conds.push((m: any) => m.studios.some((s: any) => s.studioId.in(Array.from(sourceStudioIds))))
    if (sourcePersonIds.size > 0) conds.push((m: any) => m.staff.some((s: any) => s.personId.in(Array.from(sourcePersonIds) as any)))
    if (conds.length > 0) {
      candidatesQ = candidatesQ.where((m) => or(...conds.map((c) => c(m))))
    }

    const rawCandidates = await candidatesQ
      .limit(120)
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .include('staff', (s) => s.include('person', (p) => p.select('id', 'namePrimary')))
      .include('characters', (c) => c.select('characterId'))
      .all()

    const candidates = rawCandidates.map((candidate: any) => ({
      ...candidate,
      genres: (candidate.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
      tags: (candidate.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
    }))

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

    let q = prisma.orm.public.Tv
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`),
          m.titleNative.ilike(`%${search}%`)
        )
      )
    }
    if (genres.length > 0) {
      q = q.where((m) =>
        m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))
      )
    }
    if (formats.length > 0) {
      q = q.where((m) => m.showType.in(formats as any))
    }
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.firstAiredYear.in(years))
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.averageScore.asc() : x.averageScore.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.firstAiredYear.asc() : x.firstAiredYear.desc()
      )
    } else if (sortBy === 'trending') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'bannerImage',
          'episodeCount',
          'firstAiredYear',
          'averageScore',
          'showType',
          'status'
        )
        .include('genres', (g) =>
          g.include('genre', (ge) => ge.select('id', 'name'))
        )
        .all(),
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
        genres: (x.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
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
      prisma.orm.public.Tv.select(
        'status',
        'showType',
        'firstAiredYear'
      ).all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('tv', (t) => t.count())
        .orderBy((g) => g.name.asc())
        .all(),
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
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.tv ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getTvById(id: number) {
    const tv = await prisma.orm.public.Tv.where({ id })
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .include('characters', (c) =>
        c.include('character').include('actor')
      )
      .include('staff', (s) => s.include('person'))
      .include('studios', (st) => st.include('studio'))
      .include('seasons', (s) => s.orderBy((sn) => sn.seasonNumber.asc()))
      .include('episodes', (e) => e.orderBy([(ep) => ep.seasonNumber.asc(), (ep) => ep.episodeNumber.asc()]))
      .first()

    if (!tv) {
      throw new NotFound(`TV series with ID ${id} not found`)
    }

    if (tv.tvdbUpdatedAt == null && tv.tvDBId) {
      await MediaEntitySyncer.syncTv(id, tv.tvDBId).catch(() => {})
      const updated = await prisma.orm.public.Tv.where({ id })
        .include('genres', (g) => g.include('genre'))
        .include('tags', (t) => t.include('tag'))
        .include('characters', (c) =>
          c.include('character').include('actor')
        )
        .include('staff', (s) => s.include('person'))
        .include('studios', (st) => st.include('studio'))
        .include('seasons', (s) => s.orderBy((sn) => sn.seasonNumber.asc()))
        .include('episodes', (e) => e.orderBy([(ep) => ep.seasonNumber.asc(), (ep) => ep.episodeNumber.asc()]))
        .first()
      if (updated) {
        const relations = await fetchMediaRelations('TV' as MediaType, id)
        return {
          success: true,
          media: {
            ...updated,
            genres: (updated.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
            tags: (updated.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
            relations,
          },
        }
      }
    }

    const relations = await fetchMediaRelations('TV' as MediaType, id)

    return {
      success: true,
      media: {
        ...tv,
        genres: (tv.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
        tags: (tv.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
        relations,
      },
    }
  }

  public static async refreshTv(id: number) {
    const tv = await prisma.orm.public.Tv.where({ id }).select('id', 'titlePrimary', 'tvDBId').first()

    if (!tv) {
      throw new NotFound(`TV series with ID ${id} not found`)
    }

    await prisma.orm.public.Tv.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('TV', id, {
      externalId: (tv as any).tvDBId,
      priority: 1,
      depth: 0,
      maxDepth: 0,
      triggeredBy: 'manual',
      forceRefresh: true,
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${tv.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarTv(id: number, limit: number = 10) {
    const source = await prisma.orm.public.Tv.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .include('staff', (s) => s.include('person', (p) => p.select('id', 'namePrimary')))
      .include('characters', (c) => c.select('characterId'))
      .first()

    if (!source) {
      throw new NotFound(`TV series with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))
    const sourcePersonIds = new Set(source.staff.map((s) => s.personId).filter(Boolean))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    let candidatesQ = prisma.orm.public.Tv.where((t) => t.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((t: any) => t.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((t: any) => t.tags.some((tg: any) => tg.tagId.in(Array.from(sourceTagIds))))
    if (sourceStudioIds.size > 0) conds.push((t: any) => t.studios.some((s: any) => s.studioId.in(Array.from(sourceStudioIds))))
    if (sourcePersonIds.size > 0) conds.push((t: any) => t.staff.some((s: any) => s.personId.in(Array.from(sourcePersonIds) as any)))
    if (conds.length > 0) {
      candidatesQ = candidatesQ.where((t) => or(...conds.map((c) => c(t))))
    }

    const rawCandidates = await candidatesQ
      .limit(120)
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .include('staff', (s) => s.include('person', (p) => p.select('id', 'namePrimary')))
      .include('characters', (c) => c.select('characterId'))
      .all()

    const candidates = rawCandidates.map((candidate: any) => ({
      ...candidate,
      genres: (candidate.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
      tags: (candidate.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
    }))

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

    let q = prisma.orm.public.Book
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`)
        )
      )
    }
    if (genres.length > 0) {
      q = q.where((m) =>
        m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))
      )
    }
    if (formats.length > 0) {
      q = q.where((m) => m.format.in(formats as any))
    }
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.releaseDateYear.in(years))
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.averageScore.asc() : x.averageScore.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.releaseDateYear.asc() : x.releaseDateYear.desc()
      )
    } else if (sortBy === 'trending') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'coverImage',
          'bannerImage',
          'pageCount',
          'releaseDateYear',
          'averageScore',
          'format',
          'status'
        )
        .include('genres', (g) =>
          g.include('genre', (ge) => ge.select('id', 'name'))
        )
        .all(),
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
        unitsCount: x.pageCount,
        averageScore: x.averageScore,
        genres: (x.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
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
      prisma.orm.public.Book.select(
        'status',
        'format',
        'releaseDateYear'
      ).all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('books', (b) => b.count())
        .orderBy((g) => g.name.asc())
        .all(),
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
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.books ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getBookById(id: number) {
    const book = await prisma.orm.public.Book.where({ id })
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .include('characters', (c) =>
        c.include('character')
      )
      .include('staff', (s) => s.include('person'))
      .include('studios', (st) => st.include('studio'))
      .first()

    if (!book) {
      throw new NotFound(`Book with ID ${id} not found`)
    }

    if (book.googleBooksUpdatedAt == null && book.googleBookId) {
      await MediaEntitySyncer.syncBook(id, book.googleBookId).catch(() => {})
      const updated = await prisma.orm.public.Book.where({ id })
        .include('genres', (g) => g.include('genre'))
        .include('tags', (t) => t.include('tag'))
        .include('characters', (c) =>
          c.include('character')
        )
        .include('staff', (s) => s.include('person'))
        .include('studios', (st) => st.include('studio'))
        .first()
      if (updated) {
        const relations = await fetchMediaRelations('BOOK' as MediaType, id)
        return {
          success: true,
          media: {
            ...updated,
            genres: (updated.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
            tags: (updated.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
            relations,
          },
        }
      }
    }

    const relations = await fetchMediaRelations('BOOK' as MediaType, id)

    return {
      success: true,
      media: {
        ...book,
        genres: (book.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
        tags: (book.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
        relations,
      },
    }
  }

  public static async refreshBook(id: number) {
    const book = await prisma.orm.public.Book.where({ id }).select('id', 'titlePrimary').first()

    if (!book) {
      throw new NotFound(`Book with ID ${id} not found`)
    }

    await prisma.orm.public.Book.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('BOOK', id, {
      externalId: (book as any).googleBookId,
      priority: 1,
      depth: 0,
      maxDepth: 0,
      triggeredBy: 'manual',
      forceRefresh: true,
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${book.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarBooks(id: number, limit: number = 10) {
    const source = await prisma.orm.public.Book.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('staff', (s) => s.include('person', (p) => p.select('id', 'namePrimary')))
      .include('characters', (c) => c.select('characterId'))
      .first()

    if (!source) {
      throw new NotFound(`Book with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))
    const sourceAuthors = new Set(((source as any).authors || []).map((a: string) => a.toLowerCase().trim()))
    const sourceStaffPersonIds = new Set(source.staff.map((s) => s.personId).filter(Boolean))
    const sourceCharacterIds = new Set(source.characters.map((c) => c.characterId))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    let candidatesQ = prisma.orm.public.Book.where((b) => b.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((b: any) => b.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((b: any) => b.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))
    if (sourceStaffPersonIds.size > 0) conds.push((b: any) => b.staff.some((s: any) => s.personId.in(Array.from(sourceStaffPersonIds) as any)))
    if (conds.length > 0) {
      candidatesQ = candidatesQ.where((b) => or(...conds.map((c) => c(b))))
    }

    const rawCandidates = await candidatesQ
      .limit(120)
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('staff', (s) => s.include('person', (p) => p.select('id', 'namePrimary')))
      .include('characters', (c) => c.select('characterId'))
      .all()

    const candidates = rawCandidates.map((candidate: any) => ({
      ...candidate,
      genres: (candidate.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
      tags: (candidate.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
    }))

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

    let q = prisma.orm.public.Game
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`)
        )
      )
    }
    if (genres.length > 0) {
      q = q.where((m) =>
        m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))
      )
    }
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.releaseDateYear.in(years))
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.averageScore.asc() : x.averageScore.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.releaseDateYear.asc() : x.releaseDateYear.desc()
      )
    } else if (sortBy === 'trending') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'coverImage',
          'bannerImage',
          'releaseDateYear',
          'averageScore',
          'status'
        )
        .include('genres', (g) =>
          g.include('genre', (ge) => ge.select('id', 'name'))
        )
        .all(),
    ])

    return {
      success: true,
      items: items.map((x) => ({
        id: x.id,
        mediaType: 'game',
        titlePrimary: x.titlePrimary,
        titleSecondary: x.titleSecondary,
        titleNative: null,
        coverImage: x.coverImage,
        bannerImage: x.bannerImage,
        format: 'GAME',
        status: String(x.status),
        year: x.releaseDateYear,
        unitsCount: null,
        averageScore: x.averageScore,
        genres: (x.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
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
      prisma.orm.public.Game.select(
        'status',
        'releaseDateYear'
      ).all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('games', (g) => g.count())
        .orderBy((g) => g.name.asc())
        .all(),
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
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.games ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getGameById(id: number) {
    const game = await prisma.orm.public.Game.where({ id })
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .include('studios', (st) => st.include('studio'))
      .first()

    if (!game) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    if (game.igdbUpdatedAt == null && game.igdbId) {
      await MediaEntitySyncer.syncGame(id, game.igdbId).catch(() => {})
      const updated = await prisma.orm.public.Game.where({ id })
        .include('genres', (g) => g.include('genre'))
        .include('tags', (t) => t.include('tag'))
        .include('studios', (st) => st.include('studio'))
        .first()
      if (updated) {
        const relations = await fetchMediaRelations('GAME' as MediaType, id)
        return {
          success: true,
          media: {
            ...updated,
            genres: (updated.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
            tags: (updated.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
            relations,
          },
        }
      }
    }

    const relations = await fetchMediaRelations('GAME' as MediaType, id)

    return {
      success: true,
      media: {
        ...game,
        genres: (game.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
        tags: (game.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
        relations,
      },
    }
  }

  public static async refreshGame(id: number) {
    const game = await prisma.orm.public.Game.where({ id }).select('id', 'titlePrimary').first()

    if (!game) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    await prisma.orm.public.Game.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('GAME', id, {
      externalId: (game as any).igdbId,
      priority: 1,
      depth: 0,
      maxDepth: 0,
      triggeredBy: 'manual',
      forceRefresh: true,
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${game.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarGames(id: number, limit: number = 10) {
    const source = await prisma.orm.public.Game.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .first()

    if (!source) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))
    const sourceDevelopers = new Set(((source as any).developers || []).map((d: string) => d.toLowerCase().trim()))
    const sourcePlatforms = new Set(((source as any).platforms || []).map((p: string) => p.toLowerCase().trim()))
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    let candidatesQ = prisma.orm.public.Game.where((g) => g.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((g: any) => g.genres.some((ge: any) => ge.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((g: any) => g.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))
    if (sourceStudioIds.size > 0) conds.push((g: any) => g.studios.some((s: any) => s.studioId.in(Array.from(sourceStudioIds))))
    if (conds.length > 0) {
      candidatesQ = candidatesQ.where((g) => or(...conds.map((c) => c(g))))
    }

    const rawCandidates = await candidatesQ
      .limit(120)
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .all()

    const candidates = rawCandidates.map((candidate: any) => ({
      ...candidate,
      genres: (candidate.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
      tags: (candidate.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
    }))

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
        const sharedTags = (candidate.tags || [])
          .filter((t: any) => sourceTagIds.has(t.id))
          .map((t: any) => t.name)
        matchReasons.push(`Shared gameplay themes: ${sharedTags.slice(0, 3).join(', ')} (+${points} pts)`)
      }

      // 3. Developer / Studio Overlap (Max 20 points)
      const candDevs = (candidate.developers || []).map((d: any) => String(d).toLowerCase().trim())
      const sharedDevs = candDevs.filter((d: any) => sourceDevelopers.has(d))
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
      const candPlatforms = (candidate.platforms || []).map((p: any) => String(p).toLowerCase().trim())
      const sharedPlatforms = candPlatforms.filter((p: any) => sourcePlatforms.has(p))
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

    let q = prisma.orm.public.Music
    if (search) {
      q = q.where((m) =>
        or(
          m.titlePrimary.ilike(`%${search}%`),
          m.titleSecondary.ilike(`%${search}%`),
          m.artistName.ilike(`%${search}%`)
        )
      )
    }
    if (genres.length > 0) {
      q = q.where((m) =>
        m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))
      )
    }
    if (formats.length > 0) {
      q = q.where((m) => m.type.in(formats as any))
    }
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.releaseDateYear.in(years))
    }

    let itemsQ = q
    if (sortBy === 'score') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else if (sortBy === 'title') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.titlePrimary.asc() : x.titlePrimary.desc()
      )
    } else if (sortBy === 'releaseDate') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.releaseDateYear.asc() : x.releaseDateYear.desc()
      )
    } else if (sortBy === 'trending') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, items] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .select(
          'id',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'artistName',
          'coverImage',
          'type',
          'duration',
          'releaseDateYear',
          'status'
        )
        .include('genres', (g) =>
          g.include('genre', (ge) => ge.select('id', 'name'))
        )
        .all(),
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
        genres: (x.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
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
      prisma.orm.public.Music.select(
        'status',
        'type',
        'releaseDateYear'
      ).all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('music', (m) => m.count())
        .orderBy((g) => g.name.asc())
        .all(),
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
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.music ?? 0 })),
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getMusicById(id: number) {
    const music = await prisma.orm.public.Music.where({ id })
      .include('genres', (g) => g.include('genre'))
      .include('tags', (t) => t.include('tag'))
      .include('artist')
      .include('album', (al) => al.select('id', 'titlePrimary', 'coverImage'))
      .include('tracks', (tr) =>
        tr
          .select('id', 'titlePrimary', 'duration', 'trackPosition')
          .orderBy((tp) => tp.trackPosition.asc())
          .limit(50)
      )
      .include('staff', (s) => s.include('person'))
      .first()

    if (!music) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    if (music.deezerUpdatedAt == null && music.deezerId) {
      await MediaEntitySyncer.syncMusic(id, music.deezerId).catch(() => {})
      const updated = await prisma.orm.public.Music.where({ id })
        .include('genres', (g) => g.include('genre'))
        .include('tags', (t) => t.include('tag'))
        .include('artist')
        .include('album', (al) => al.select('id', 'titlePrimary', 'coverImage'))
        .include('tracks', (tr) =>
          tr
            .select('id', 'titlePrimary', 'duration', 'trackPosition')
            .orderBy((tp) => tp.trackPosition.asc())
            .limit(50)
        )
        .include('staff', (s) => s.include('person'))
        .first()
      if (updated) {
        const relations = await fetchMediaRelations('MUSIC' as MediaType, id)
        return {
          success: true,
          media: {
            ...updated,
            genres: (updated.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
            tags: (updated.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
            relations,
          },
        }
      }
    }

    const relations = await fetchMediaRelations('MUSIC' as MediaType, id)

    return {
      success: true,
      media: {
        ...music,
        genres: (music.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
        tags: (music.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
        relations,
      },
    }
  }

  public static async refreshMusic(id: number) {
    const music = await prisma.orm.public.Music.where({ id }).select('id', 'titlePrimary').first()

    if (!music) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    await prisma.orm.public.Music.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('MUSIC', id, {
      priority: 1,
      depth: 0,
      maxDepth: 0,
      triggeredBy: 'manual',
      forceRefresh: true,
    }).catch(() => {})

    return {
      success: true,
      message: `Metadata refresh requested for "${music.titlePrimary}"`,
      timestamp: new Date().toISOString(),
    }
  }

  public static async getSimilarMusic(id: number, limit: number = 10) {
    const source = await prisma.orm.public.Music.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('artist', (a) => a.select('id', 'namePrimary'))
      .first()

    if (!source) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))
    const sourceArtistId = source.artistId
    const sourceArtistName = source.artistName?.toLowerCase().trim()
    const sourceAlbumId = source.albumId
    const sourceBaseTitle = cleanBaseTitle(source.titlePrimary)

    let candidatesQ = prisma.orm.public.Music.where((m) => m.id.neq(id))
    const conds: any[] = []
    if (sourceArtistId) conds.push((m: any) => m.artistId.eq(sourceArtistId))
    if (sourceArtistName && source.artistName) conds.push((m: any) => m.artistName.ilike(source.artistName!))
    if (sourceAlbumId) conds.push((m: any) => m.albumId.eq(sourceAlbumId))
    if (sourceGenreIds.size > 0) conds.push((m: any) => m.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((m: any) => m.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))

    if (conds.length > 0) {
      candidatesQ = candidatesQ.where((m) => or(...conds.map((c) => c(m))))
    }

    const rawCandidates = await candidatesQ
      .limit(120)
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('artist', (a) => a.select('id', 'namePrimary'))
      .all()

    const candidates = rawCandidates.map((candidate: any) => ({
      ...candidate,
      genres: (candidate.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
      tags: (candidate.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
    }))

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
      const candGenreIds = new Set((candidate.genres || []).map((g: any) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        const jaccard = genreIntersection.length / genreUnion.size
        const points = Math.round(jaccard * 30)
        similarityScore += points
        const sharedNames = (candidate.genres || [])
          .filter((g: any) => sourceGenreIds.has(g.id))
          .map((g: any) => g.name)
        matchReasons.push(`Shared genres: ${sharedNames.join(', ')} (+${points} pts)`)
      }

      // 3. Tag / Theme Jaccard Similarity (Max 20 points)
      const candTagIds = new Set((candidate.tags || []).map((t: any) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        const jaccard = tagIntersection.length / tagUnion.size
        const points = Math.round(jaccard * 20)
        similarityScore += points
        const sharedTags = (candidate.tags || [])
          .filter((t: any) => sourceTagIds.has(t.id))
          .map((t: any) => t.name)
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

import { prisma, countOf, or, and, toDate, type MediaType } from '@NamelessLiberty/db'
import { NotFound } from '../../lib/errors'
import { getProfileCustomization } from '@NamelessLiberty/shared'
import { MediaQueueManager } from './queue'
import { fetchMediaRelations } from './media-relations.helper'
import { MediaEntitySyncer } from './syncer/media-entity.syncer'
import { imageSource, fetchTopCharacters } from './media-overview.helper'

export interface AnimeCatalogQuery {
  cursor?: number
  page?: number
  limit?: number
  search?: string
  genres?: string
  tags?: string
  formats?: string
  statuses?: string
  years?: string
  season?: string
  country?: string
  sortBy?:
    | 'popularity'
    | 'score'
    | 'title'
    | 'releaseDate'
    | 'trending'
    | 'favorites'
    | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

function parseList(val?: unknown): string[] {
  if (!val || typeof val !== 'string') return []
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export class BorealisAnimeServ {
  public static async getCatalog(query?: AnimeCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 50)))
    const skip = query?.cursor ? 0 : (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const tags = parseList(query?.tags)
    const formats = parseList(query?.formats)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const season = query?.season?.trim()
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

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
    if (tags.length > 0) {
      q = q.where((m) =>
        m.tags.some((t) => t.tag.some((te) => te.name.in(tags)))
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
    if (query?.cursor) {
      q = q.where((m) =>
        sortOrder === 'asc' ? m.id.gt(query.cursor!) : m.id.lt(query.cursor!)
      )
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
    } else if (sortBy === 'trending' || sortBy === 'favorites') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.favorites.asc() : x.favorites.desc()
      )
    } else if (sortBy === 'updatedAt') {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.updatedAt.asc() : x.updatedAt.desc()
      )
    } else {
      itemsQ = itemsQ.orderBy((x) =>
        sortOrder === 'asc' ? x.popularity.asc() : x.popularity.desc()
      )
    }

    const [total, rawItems] = await Promise.all([
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
          'description',
          'source',
          'format',
          'status',
          'seasonYear',
          'seasonSeason',
          'episodeCount',
          'averageScore',
          'popularity',
          'favorites',
          'startDateYear'
        )
        .include('genres', (g) =>
          g.include('genre', (ge) => ge.select('id', 'name'))
        )
        .include('tags', (t) =>
          t.include('tag', (te) => te.select('id', 'name'))
        )
        .include('studios', (st) =>
          st.include('studio', (s) => s.select('id', 'name'))
        )
        .all(),
    ])

    const items = rawItems.map((x) => ({
      id: x.id,
      titlePrimary: x.titlePrimary,
      titleSecondary: x.titleSecondary ?? null,
      titleNative: x.titleNative ?? null,
      coverImage: x.coverImage ?? null,
      bannerImage: x.bannerImage ?? null,
      averageScore: x.averageScore ?? null,
      format: x.format ? String(x.format) : null,
      status: x.status ? String(x.status) : null,
      startDateYear: x.startDateYear ?? x.seasonYear ?? null,
      description: x.description ?? null,
      genres: (x.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
      tags: (x.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => ({ id: t.tag!.id, name: t.tag!.name })),
    }))

    const hasMore = skip + items.length < total

    return {
      success: true,
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      hasMore,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore,
      },
    }
  }

  public static async getFilters() {
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
      tags: [],
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
      seasons: Object.entries(seasonCounts).map(([value, count]) => ({ value, count })),
    }
  }

  public static async getById(id: number) {
    const load = () =>
      prisma.orm.public.Anime.where({ id })
        .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
        .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
        .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name', 'isAnimationStudio')))
        .first()

    let anime = await load()
    if (!anime) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

    if (anime.alUpdatedAt == null && anime.anilistId) {
      await MediaEntitySyncer.syncAnime(id, anime.anilistId).catch(() => {})
      anime = (await load()) ?? anime
    }

    const characters = await fetchTopCharacters('ANIME', id, 16)

    const a: any = anime
    return {
      success: true,
      media: {
        id: a.id,
        anilistId: a.anilistId ?? null,
        malId: a.malId ?? null,
        aniDBId: a.aniDBId ?? null,
        tvDBId: a.tvDBId ?? null,
        bangumiId: a.bangumiId ?? null,
        kitsuId: a.kitsuId ?? null,
        titlePrimary: a.titlePrimary,
        titleSecondary: a.titleSecondary ?? null,
        titleNative: a.titleNative ?? null,
        coverImage: a.coverImage ?? null,
        bannerImage: a.bannerImage ?? null,
        description: a.description ?? null,
        hashtag: a.hashtag ?? null,
        countryOfOrigin: a.countryOfOrigin ?? null,
        episodeCount: a.episodeCount ?? null,
        episodeDuration: a.episodeDuration ?? null,
        startDateYear: a.startDateYear ?? null,
        startDateMonth: a.startDateMonth ?? null,
        startDateDay: a.startDateDay ?? null,
        endDateYear: a.endDateYear ?? null,
        endDateMonth: a.endDateMonth ?? null,
        endDateDay: a.endDateDay ?? null,
        genres: (a.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
        tags: (a.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
        source: a.source,
        format: a.format,
        status: a.status,
        seasonSeason: a.seasonSeason,
        seasonYear: a.seasonYear ?? null,
        averageScore: a.averageScore ?? null,
        favorites: a.favorites,
        popularity: a.popularity,
        isAdult: a.isAdult,
        synonyms: a.synonyms ?? [],
        themeSongs: a.themeSongs ?? null,
        ageRating: a.ageRating ?? null,
        ageRatingGuide: a.ageRatingGuide ?? null,
        nextAiringEpisodeNumber: a.nextAiringEpisodeNumber ?? null,
        nextAiringAt: a.nextAiringAt ?? null,
        updatedAt: a.updatedAt,
        studios: (a.studios || [])
          .filter((s: any) => Boolean(s.studio))
          .map((s: any) => ({
            id: s.id ?? s.studio!.id,
            isMain: Boolean(s.isMain),
            studio: s.studio!,
          })),
        trailers: a.trailers ?? null,
        externalLinks: a.externalLinks ?? null,
        sources: a.sources ?? null,
        characters,
      },
    }
  }

  public static async refresh(id: number) {
    const anime = await prisma.orm.public.Anime.where({ id }).select('id', 'anilistId', 'titlePrimary').first()
    if (!anime) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

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

  public static async getSimilar(id: number, limit: number = 24) {
    const source = await prisma.orm.public.Anime.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
      .first()

    if (!source) {
      throw new NotFound(`Anime with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))
    const sourceStudioIds = new Set(source.studios.map((s) => s.studioId))

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
      .all()

    const candidates = rawCandidates.map((candidate: any) => ({
      ...candidate,
      genres: (candidate.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!),
      tags: (candidate.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!),
    }))

    const scored = candidates.map((candidate) => {
      let similarityScore = 0
      const candGenreIds = new Set(candidate.genres.map((g) => g.id))
      const genreIntersection = Array.from(sourceGenreIds).filter((gid) => candGenreIds.has(gid))
      const genreUnion = new Set([...sourceGenreIds, ...candGenreIds])
      if (genreUnion.size > 0 && genreIntersection.length > 0) {
        similarityScore += Math.round((genreIntersection.length / genreUnion.size) * 40)
      }
      const candTagIds = new Set(candidate.tags.map((t) => t.id))
      const tagIntersection = Array.from(sourceTagIds).filter((tid) => candTagIds.has(tid))
      const tagUnion = new Set([...sourceTagIds, ...candTagIds])
      if (tagUnion.size > 0 && tagIntersection.length > 0) {
        similarityScore += Math.round((tagIntersection.length / tagUnion.size) * 25)
      }
      if (candidate.format && source.format && candidate.format === source.format) {
        similarityScore += 15
      }

      return {
        id: candidate.id,
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary ?? null,
        titleNative: candidate.titleNative ?? null,
        coverImage: candidate.coverImage ?? null,
        bannerImage: candidate.bannerImage ?? null,
        averageScore: candidate.averageScore ?? null,
        format: candidate.format ? String(candidate.format) : null,
        status: candidate.status ? String(candidate.status) : null,
        startDateYear: candidate.startDateYear ?? candidate.seasonYear ?? null,
        description: candidate.description ?? null,
        genres: candidate.genres,
        tags: candidate.tags,
        similarityScore,
      }
    })

    const items = scored
      .filter((s) => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)
      .map((s: any) => ({
        id: s.id,
        titlePrimary: s.titlePrimary,
        titleSecondary: s.titleSecondary ?? null,
        titleNative: s.titleNative ?? null,
        coverImage: s.coverImage ?? null,
        bannerImage: s.bannerImage ?? null,
        averageScore: s.averageScore ?? null,
        format: s.format ? String(s.format) : null,
        status: s.status ? String(s.status) : null,
        startDateYear: s.startDateYear ?? null,
        description: s.description ?? null,
        genres: s.genres,
        tags: s.tags,
      }))

    return {
      success: true,
      sourceId: id,
      items,
    }
  }

  public static async getRelations(id: number) {
    const hydrated = await fetchMediaRelations('ANIME' as MediaType, id)
    return {
      success: true,
      relations: hydrated.map((r) => ({
        id: r.id,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        targetType: r.targetType,
        targetId: r.targetId,
        type: r.type,
        data: r.target,
        target: r.target,
      })),
    }
  }

  public static async getCharacters(id: number) {
    const raw = await prisma.orm.public.MediaCharacter
      .where((mc) => and(mc.mediaType.eq('ANIME' as MediaType), mc.mediaId.eq(id)))
      .include('character')
      .include('actor')
      .all()

    return {
      success: true,
      characters: raw.map((c: any) => ({
        id: c.id,
        mediaId: c.mediaId,
        mediaType: c.mediaType,
        characterId: c.characterId,
        actorId: c.actorId ?? null,
        role: c.role,
        characterData: {
          id: c.character.id,
          namePrimary: c.character.namePrimary,
          nameNative: c.character.nameNative ?? null,
          age: c.character.age ?? null,
          gender: c.character.gender ?? null,
          dateOfBirthDay: c.character.dateOfBirthDay ?? null,
          dateOfBirthMonth: c.character.dateOfBirthMonth ?? null,
          dateOfBirthYear: c.character.dateOfBirthYear ?? null,
          description: c.character.description ?? null,
          image: c.character.image ?? null,
        },
        actorData: c.actor
          ? {
              id: c.actor.id,
              namePrimary: c.actor.namePrimary,
              nameNative: c.actor.nameNative ?? null,
              language: c.actor.language ?? null,
              image: c.actor.image ?? null,
              description: c.actor.description ?? null,
            }
          : null,
      })),
    }
  }

  public static async getStaff(id: number) {
    const raw = await prisma.orm.public.MediaStaff
      .where((ms) => and(ms.mediaType.eq('ANIME' as MediaType), ms.mediaId.eq(id)))
      .include('person')
      .all()

    return {
      success: true,
      staff: raw.map((s: any) => ({
        id: s.id,
        mediaId: s.mediaId,
        mediaType: s.mediaType,
        personId: s.personId,
        role: s.role,
        customRole: s.customRole ?? null,
        personData: {
          id: s.person.id,
          namePrimary: s.person.namePrimary,
          nameNative: s.person.nameNative ?? null,
          nameAlternative: s.person.nameAlternative ?? [],
          image: s.person.image ?? null,
          gender: s.person.gender ?? null,
          language: s.person.language ?? null,
          description: s.person.description ?? null,
        },
      })),
    }
  }

  public static async getEpisodes(id: number) {
    const episodes = await prisma.orm.public.AnimeEpisode
      .where({ animeId: id })
      .orderBy((ep) => ep.number.asc())
      .all()
    return { success: true, episodes }
  }

  public static async getImages(id: number) {
    const anime = await prisma.orm.public.Anime.where({ id })
      .select('images')
      .first()
    if (!anime) throw new NotFound(`Anime with ID ${id} not found`)
    return {
      success: true,
      images: {
        mal: imageSource(anime.images, 'mal'),
        anilist: imageSource(anime.images, 'anilist'),
        thetvdb: imageSource(anime.images, 'thetvdb'),
      },
    }
  }

  public static async getStats(id: number) {
    const anime: any = await prisma.orm.public.Anime.where({ id })
      .select('averageScore', 'alAverageScore', 'alPopularity', 'alFavorites', 'malPopularity', 'malFavorites', 'malAverageScore', 'scoreDistribution', 'statusDistribution', 'favorites')
      .first()
    if (!anime) throw new NotFound(`Anime with ID ${id} not found`)
    return {
      success: true,
      stats: {
        averageScore: anime.averageScore ?? null,
        alAverageScore: anime.alAverageScore ?? null,
        alPopularity: anime.alPopularity ?? null,
        alFavorites: anime.alFavorites ?? null,
        malPopularity: anime.malPopularity ?? null,
        malFavorites: anime.malFavorites ?? null,
        malAverageScore: anime.malAverageScore ?? null,
        scoreDistribution: anime.scoreDistribution ?? {},
        statusDistribution: anime.statusDistribution ?? {},
        favorites: anime.favorites ?? 0,
      },
    }
  }
  public static async getFriends(id: number, currentUserId?: string) {
    if (!currentUserId) return { success: true, friends: [] }

    const userFriends = await prisma.orm.public.Friend
      .where({ userId: currentUserId })
      .select('friendId')
      .all()

    const friendIds = userFriends.map((f) => f.friendId)
    if (friendIds.length === 0) return { success: true, friends: [] }

    const rawEntries = await prisma.orm.public.AnimeList
      .where((l) => and(l.animeId.eq(id), l.private.eq(false), l.userId.in(friendIds)))
      .include('user', (u: any) => u.select('id', 'username', 'customization'))
      .all()

    const friends = rawEntries.map((raw: any) => {
      const profile = getProfileCustomization(raw.user?.customization)
      return {
        id: raw.id,
        userId: raw.userId,
        status: raw.status,
        score: raw.score,
        primaryProgress: raw.progress,
        secondaryProgress: null,
        progress: raw.progress,
        volumesProgress: null,
        updatedAt: toDate(raw.updatedAt).toISOString(),
        user: {
          id: raw.user?.id || raw.userId,
          username: raw.user?.username || 'Unknown',
          customization: raw.user?.customization || null,
          displayName: profile.displayName || raw.user?.username || 'Unknown',
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          displayNameStyle: profile.displayNameStyle || null,
        },
      }
    })

    return { success: true, friends }
  }

  public static async getPeople(id: number, query?: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const filterStatus = query?.status?.toUpperCase()?.trim()

    let q = prisma.orm.public.AnimeList.where({ animeId: id, private: false })
    if (filterStatus) q = q.where({ status: filterStatus as any })

    const [total, rawEntries] = await Promise.all([
      countOf(q),
      q
        .orderBy((item: any) => item.updatedAt.desc())
        .offset(skip)
        .limit(limit)
        .include('user', (u: any) => u.select('id', 'username', 'customization'))
        .all(),
    ])

    const people = rawEntries.map((raw: any) => {
      const profile = getProfileCustomization(raw.user?.customization)
      return {
        id: raw.id,
        userId: raw.userId,
        status: raw.status,
        score: raw.score,
        primaryProgress: raw.progress,
        secondaryProgress: null,
        progress: raw.progress,
        volumesProgress: null,
        updatedAt: toDate(raw.updatedAt).toISOString(),
        user: {
          id: raw.user?.id || raw.userId,
          username: raw.user?.username || 'Unknown',
          customization: raw.user?.customization || null,
          displayName: profile.displayName || raw.user?.username || 'Unknown',
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          displayNameStyle: profile.displayNameStyle || null,
        },
      }
    })

    return {
      success: true,
      mediaType: 'anime',
      mediaId: id,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      hasMore: page * limit < total,
      people,
    }
  }

  public static async getRecommendations(id: number) {
    const recs = await prisma.orm.public.MediaRecommendation
      .where((r) => and(r.sourceType.eq('ANIME' as MediaType), r.sourceId.eq(id)))
      .include('user', (u: any) => u.select('id', 'username', 'customization'))
      .orderBy((r) => r.score.desc())
      .all()

    return {
      success: true,
      recommendations: recs.map((r: any) => {
        const profile = getProfileCustomization(r.user?.customization)
        return {
          id: r.id,
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          targetType: r.targetType,
          targetId: r.targetId,
          body: r.body,
          upvotes: r.upvotes,
          downvotes: r.downvotes,
          score: r.score,
          createdAt: toDate(r.createdAt).toISOString(),
          user: {
            id: r.user?.id || r.userId,
            username: r.user?.username || 'Unknown',
            displayName: profile.displayName || r.user?.username || 'Unknown',
            avatarUrl: profile.avatarUrl || null,
          },
        }
      }),
    }
  }
}

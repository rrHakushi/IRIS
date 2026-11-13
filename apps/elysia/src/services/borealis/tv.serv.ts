import { prisma, countOf, or, and, toDate, type MediaType } from '@NamelessLiberty/db'
import { NotFound } from '../../lib/errors'
import { getProfileCustomization } from '@NamelessLiberty/shared'
import { MediaQueueManager } from './queue'
import { fetchMediaRelations } from './media-relations.helper'
import { MediaEntitySyncer } from './syncer/media-entity.syncer'
import { fetchTopCharacters, pick, flattenGenres, flattenTags, imageSource } from './media-overview.helper'

export interface TvCatalogQuery {
  cursor?: number
  page?: number
  limit?: number
  search?: string
  genres?: string
  tags?: string
  formats?: string
  statuses?: string
  years?: string
  country?: string
  networks?: string
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

export class BorealisTvServ {
  public static async getCatalog(query?: TvCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 50)))
    const skip = query?.cursor ? 0 : (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const tags = parseList(query?.tags)
    const formats = parseList(query?.formats)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const networks = parseList(query?.networks)
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

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
    if (tags.length > 0) {
      q = q.where((m) =>
        m.tags.some((t) => t.tag.some((te) => te.name.in(tags)))
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
    if (networks.length > 0) {
      q = q.where((m) =>
        m.studios.some((s) => s.studio.some((st) => st.name.in(networks)))
      )
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
        sortOrder === 'asc' ? x.firstAiredYear.asc() : x.firstAiredYear.desc()
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
          'showType',
          'status',
          'firstAiredYear',
          'episodeCount',
          'seasonCount',
          'averageScore',
          'popularity',
          'favorites'
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
      format: x.showType ? String(x.showType) : null,
      status: x.status ? String(x.status) : null,
      startDateYear: x.firstAiredYear ?? null,
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
    const [allTv, allGenres] = await Promise.all([
      prisma.orm.public.Tv.select('status', 'showType', 'firstAiredYear').all(),
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
      if (t.showType) formatCounts[t.showType] = (formatCounts[t.showType] || 0) + 1
      if (t.firstAiredYear) yearCounts[t.firstAiredYear] = (yearCounts[t.firstAiredYear] || 0) + 1
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.tv ?? 0 })),
      tags: [],
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getById(id: number) {
    const load = () =>
      prisma.orm.public.Tv.where({ id })
        .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
        .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
        .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
        .first()

    let tv = await load()
    if (!tv) {
      throw new NotFound(`TV show with ID ${id} not found`)
    }

    if (tv.tvdbUpdatedAt == null && tv.tvDBId) {
      await MediaEntitySyncer.syncTv(id, tv.tvDBId).catch(() => {})
      tv = (await load()) ?? tv
    }

    const characters = await fetchTopCharacters('TV', id)
    const t: any = tv
    return {
      success: true,
      media: {
        ...pick(t, [
          'id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage', 'bannerImage',
          'description', 'originalLanguage', 'countryOfOrigin', 'episodeCount', 'seasonCount',
          'broadcastTime', 'status', 'averageScore', 'favorites', 'popularity', 'isAdult',
          'ageRating', 'ageRatingGuide', 'updatedAt',
          'tvDBId', 'tmdbId', 'imdbId', 'simklId', 'tvmazeId', 'trailers',
        ]),
        episodeDuration: t.averageRuntime ?? null,
        startDateYear: t.firstAiredYear ?? null,
        startDateMonth: t.firstAiredMonth ?? null,
        startDateDay: t.firstAiredDay ?? null,
        endDateYear: t.lastAiredYear ?? null,
        endDateMonth: t.lastAiredMonth ?? null,
        endDateDay: t.lastAiredDay ?? null,
        broadcastDays: t.broadcastDays ?? [],
        format: t.showType ?? null,
        networks: t.networks ?? [],
        synonyms: t.synonyms ?? [],
        nextAiringEpisodeNumber: null,
        nextAiringAt: null,
        externalLinks: t.sources ?? null,
        sources: t.sources ?? null,
        genres: flattenGenres(t.genres),
        tags: flattenTags(t.tags),
        studios: (t.studios || []).filter((s: any) => Boolean(s.studio)).map((s: any) => s.studio!),
        characters,
      },
    }
  }
  public static async refresh(id: number) {
    const tv = await prisma.orm.public.Tv.where({ id }).select('id', 'tvDBId', 'titlePrimary').first()
    if (!tv) {
      throw new NotFound(`TV show with ID ${id} not found`)
    }

    await prisma.orm.public.Tv.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('TV', id, {
      externalId: tv.tvDBId,
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

  public static async getSimilar(id: number, limit: number = 24) {
    const source = await prisma.orm.public.Tv.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .first()

    if (!source) {
      throw new NotFound(`TV show with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))

    let candidatesQ = prisma.orm.public.Tv.where((m) => m.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((m: any) => m.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((m: any) => m.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))
    if (source.showType) conds.push((m: any) => m.showType.eq(source.showType))
    if (conds.length > 0) {
      candidatesQ = candidatesQ.where((m) => or(...conds.map((c) => c(m))))
    }

    const rawCandidates = await candidatesQ
      .limit(120)
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
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
      if (candidate.showType && source.showType && candidate.showType === source.showType) {
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
        format: candidate.showType ? String(candidate.showType) : null,
        status: candidate.status ? String(candidate.status) : null,
        startDateYear: candidate.firstAiredYear ?? null,
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
      .map(({ similarityScore, ...rest }) => rest)

    return {
      success: true,
      sourceId: id,
      items,
    }
  }

  public static async getRelations(id: number) {
    const hydrated = await fetchMediaRelations('TV' as MediaType, id)
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
      .where((mc) => and(mc.mediaType.eq('TV' as MediaType), mc.mediaId.eq(id)))
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
      .where((ms) => and(ms.mediaType.eq('TV' as MediaType), ms.mediaId.eq(id)))
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

  public static async getSeasons(tvId: number) {
    const seasons = await prisma.orm.public.TvSeason
      .where({ tvId })
      .orderBy((s) => s.seasonNumber.asc())
      .all()
    return {
      success: true,
      seasons: seasons.map((s: any) => pick(s, [
        'id', 'tvId', 'seasonNumber', 'titlePrimary', 'titleSecondary', 'description', 'posterImage',
        'airDateYear', 'airDateMonth', 'airDateDay', 'episodeCount', 'trailers',
      ])),
    }
  }

  public static async getEpisodes(tvId: number) {
    const episodes = await prisma.orm.public.TvEpisode
      .where({ tvId })
      .orderBy((ep) => ep.seasonNumber.asc())
      .all()
    return {
      success: true,
      episodes: [...episodes].sort((a: any, b: any) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber).map((e: any) => ({
        ...pick(e, [
          'id', 'tvId', 'seasonId', 'seasonNumber', 'episodeNumber', 'titlePrimary', 'titleSecondary', 'titleNative',
          'description', 'duration', 'airDate', 'rating', 'thumbnail',
          'opStart', 'opEnd', 'edStart', 'edEnd', 'recapStart', 'recapEnd', 'skipTimestamps',
        ]),
        isFiller: e.isFiller ?? false,
        isRecap: e.isRecap ?? false,
        type: e.episodeType ?? null,
        streamLinks: e.streamingLinks ?? null,
      })),
    }
  }

  public static async getImages(id: number) {
    const tv = await prisma.orm.public.Tv.where({ id })
      .select('images')
      .first()
    if (!tv) throw new NotFound(`TV show with ID ${id} not found`)
    return {
      success: true,
      images: {
        thetvdb: imageSource(tv.images, 'thetvdb'),
        tmdb: imageSource(tv.images, 'tmdb'),
        imdb: imageSource(tv.images, 'imdb'),
      },
    }
  }

  public static async getStats(id: number) {
    const tv: any = await prisma.orm.public.Tv.where({ id })
      .select('averageScore', 'favorites', 'popularity', 'scoreDistribution', 'statusDistribution', 'imdbRating', 'imdbVotes', 'tvmazeRating', 'rottenTomatoesScore')
      .first()
    if (!tv) throw new NotFound(`TV show with ID ${id} not found`)
    return {
      success: true,
      stats: {
        averageScore: tv.averageScore ?? null,
        favorites: tv.favorites ?? 0,
        popularity: tv.popularity ?? 0,
        scoreDistribution: tv.scoreDistribution ?? {},
        statusDistribution: tv.statusDistribution ?? {},
        ...pick(tv, ['imdbRating', 'imdbVotes', 'tvmazeRating', 'rottenTomatoesScore']),
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

    const rawEntries = await prisma.orm.public.TvList
      .where((l) => and(l.tvId.eq(id), l.private.eq(false), l.userId.in(friendIds)))
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

    let q = prisma.orm.public.TvList.where({ tvId: id, private: false })
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
      mediaType: 'tv',
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
      .where((r) => and(r.sourceType.eq('TV' as MediaType), r.sourceId.eq(id)))
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

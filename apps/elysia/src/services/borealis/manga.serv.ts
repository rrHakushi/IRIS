import { prisma, countOf, or, and, toDate, type MediaType } from '@Iris/db'
import { NotFound } from '../../lib/errors'
import { getProfileCustomization } from '@IRIS/shared'
import { MediaQueueManager } from './queue'
import { fetchMediaRelations } from './media-relations.helper'
import { MediaEntitySyncer } from './syncer/media-entity.syncer'
import { fetchTopCharacters, pick, flattenGenres, flattenTags, imageSource } from './media-overview.helper'

export interface MangaCatalogQuery {
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

export class BorealisMangaServ {
  public static async getCatalog(query?: MangaCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 50)))
    const skip = query?.cursor ? 0 : (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const tags = parseList(query?.tags)
    const formats = parseList(query?.formats)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

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
      q = q.where((m) => m.startDateYear.in(years))
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
        sortOrder === 'asc' ? x.startDateYear.asc() : x.startDateYear.desc()
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
          'startDateYear',
          'chapterCount',
          'volumeCount',
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
      startDateYear: x.startDateYear ?? null,
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
    const [allManga, allGenres] = await Promise.all([
      prisma.orm.public.Manga.select('status', 'format', 'startDateYear').all(),
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
      tags: [],
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getById(id: number) {
    const load = () =>
      prisma.orm.public.Manga.where({ id })
        .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
        .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
        .first()

    let manga = await load()
    if (!manga) {
      throw new NotFound(`Manga with ID ${id} not found`)
    }

    if (manga.alUpdatedAt == null && manga.anilistId) {
      await MediaEntitySyncer.syncManga(id, manga.anilistId).catch(() => {})
      manga = (await load()) ?? manga
    }

    const characters = await fetchTopCharacters('MANGA', id)
    const m: any = manga
    return {
      success: true,
      media: {
        ...pick(m, [
          'id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage', 'bannerImage',
          'description', 'countryOfOrigin', 'chapterCount', 'volumeCount',
          'startDateYear', 'startDateMonth', 'startDateDay', 'endDateYear', 'endDateMonth', 'endDateDay',
          'source', 'format', 'status', 'averageScore', 'favorites', 'popularity', 'isAdult',
          'ageRating', 'ageRatingGuide', 'updatedAt',
          'anilistId', 'bangumiId', 'kitsuId', 'malId', 'mangaUpdatesId', 'externalLinks', 'sources',
        ]),
        synonyms: m.synonyms ?? [],
        genres: flattenGenres(m.genres),
        tags: flattenTags(m.tags),
        characters,
      },
    }
  }
  public static async refresh(id: number) {
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

  public static async getSimilar(id: number, limit: number = 24) {
    const source = await prisma.orm.public.Manga.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .first()

    if (!source) {
      throw new NotFound(`Manga with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))

    let candidatesQ = prisma.orm.public.Manga.where((m) => m.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((m: any) => m.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((m: any) => m.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))
    if (source.format) conds.push((m: any) => m.format.eq(source.format))
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
        startDateYear: candidate.startDateYear ?? null,
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
    const hydrated = await fetchMediaRelations('MANGA' as MediaType, id)
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
      .where((mc) => and(mc.mediaType.eq('MANGA' as MediaType), mc.mediaId.eq(id)))
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
      .where((ms) => and(ms.mediaType.eq('MANGA' as MediaType), ms.mediaId.eq(id)))
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

  public static async getImages(id: number) {
    const manga = await prisma.orm.public.Manga.where({ id })
      .select('images')
      .first()
    if (!manga) throw new NotFound(`Manga with ID ${id} not found`)
    return {
      success: true,
      images: {
        mal: imageSource(manga.images, 'mal'),
        anilist: imageSource(manga.images, 'anilist'),
      },
    }
  }

  public static async getStats(id: number) {
    const manga: any = await prisma.orm.public.Manga.where({ id })
      .select('averageScore', 'alAverageScore', 'alPopularity', 'alFavorites', 'malPopularity', 'malFavorites', 'malAverageScore', 'scoreDistribution', 'statusDistribution', 'favorites')
      .first()
    if (!manga) throw new NotFound(`Manga with ID ${id} not found`)
    return {
      success: true,
      stats: {
        ...pick(manga, ['averageScore', 'alAverageScore', 'alPopularity', 'alFavorites', 'malPopularity', 'malFavorites', 'malAverageScore']),
        scoreDistribution: manga.scoreDistribution ?? {},
        statusDistribution: manga.statusDistribution ?? {},
        favorites: manga.favorites ?? 0,
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

    const rawEntries = await prisma.orm.public.MangaList
      .where((l) => and(l.mangaId.eq(id), l.private.eq(false), l.userId.in(friendIds)))
      .include('user', (u: any) => u.select('id', 'username', 'customization'))
      .all()

    const friends = rawEntries.map((raw: any) => {
      const profile = getProfileCustomization(raw.user?.customization)
      return {
        id: raw.id,
        userId: raw.userId,
        status: raw.status,
        score: raw.score,
        primaryProgress: raw.chaptersProgress,
        secondaryProgress: raw.volumesProgress,
        progress: raw.chaptersProgress,
        volumesProgress: raw.volumesProgress,
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

    let q = prisma.orm.public.MangaList.where({ mangaId: id, private: false })
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
        primaryProgress: raw.chaptersProgress,
        secondaryProgress: raw.volumesProgress,
        progress: raw.chaptersProgress,
        volumesProgress: raw.volumesProgress,
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
      mediaType: 'manga',
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
      .where((r) => and(r.sourceType.eq('MANGA' as MediaType), r.sourceId.eq(id)))
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


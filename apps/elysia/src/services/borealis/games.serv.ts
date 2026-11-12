import { prisma, countOf, or, and, toDate, type MediaType } from '@Iris/db'
import { NotFound } from '../../lib/errors'
import { getProfileCustomization } from '@IRIS/shared'
import { MediaQueueManager } from './queue'
import { fetchMediaRelations } from './media-relations.helper'
import { MediaEntitySyncer } from './syncer/media-entity.syncer'
import { fetchTopCharacters, pick, flattenGenres, flattenTags, imageSource } from './media-overview.helper'

export interface GameCatalogQuery {
  cursor?: number
  page?: number
  limit?: number
  search?: string
  genres?: string
  tags?: string
  formats?: string
  statuses?: string
  years?: string
  platforms?: string
  developers?: string
  publishers?: string
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

export class BorealisGamesServ {
  public static async getCatalog(query?: GameCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 50)))
    const skip = query?.cursor ? 0 : (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const tags = parseList(query?.tags)
    const statuses = parseList(query?.statuses)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const platforms = parseList(query?.platforms)
    const developers = parseList(query?.developers)
    const publishers = parseList(query?.publishers)
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    let q = prisma.orm.public.Game
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
    if (statuses.length > 0) {
      q = q.where((m) => m.status.in(statuses as any))
    }
    if (years.length > 0) {
      q = q.where((m) => m.releaseDateYear.in(years))
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
        sortOrder === 'asc' ? x.releaseDateYear.asc() : x.releaseDateYear.desc()
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
          'status',
          'releaseDateYear',
          'averageScore',
          'popularity',
          'favorites',
          'platforms'
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
      format: (x.platforms && x.platforms.length > 0) ? x.platforms[0] : 'GAME',
      status: x.status ? String(x.status) : null,
      startDateYear: x.releaseDateYear ?? null,
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
    const [allGames, allGenres] = await Promise.all([
      prisma.orm.public.Game.select('status', 'releaseDateYear', 'platforms').all(),
      prisma.orm.public.Genre.select('id', 'name')
        .include('games', (g) => g.count())
        .orderBy((g) => g.name.asc())
        .all(),
    ])

    const statusCounts: Record<string, number> = {}
    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const g of allGames) {
      if (g.status) statusCounts[g.status] = (statusCounts[g.status] || 0) + 1
      if (g.releaseDateYear) yearCounts[g.releaseDateYear] = (yearCounts[g.releaseDateYear] || 0) + 1
      for (const p of g.platforms || []) {
        formatCounts[p] = (formatCounts[p] || 0) + 1
      }
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: allGenres.map((g: any) => ({ value: g.name, count: g.games ?? 0 })),
      tags: [],
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getById(id: number) {
    const load = () =>
      prisma.orm.public.Game.where({ id })
        .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
        .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
        .include('studios', (st) => st.include('studio', (s) => s.select('id', 'name')))
        .first()

    let game = await load()
    if (!game) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    if (game.igdbId) {
      await MediaEntitySyncer.syncGame(id, game.igdbId).catch(() => {})
      game = (await load()) ?? game
    }

    const characters = await fetchTopCharacters('GAME', id)
    const g: any = game
    return {
      success: true,
      media: {
        ...pick(g, [
          'id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage', 'bannerImage',
          'description', 'franchise', 'status', 'averageScore', 'favorites', 'popularity', 'isAdult',
          'ageRating', 'ageRatingGuide', 'averagePlaytime', 'requirements', 'controllerSupport',
          'steamDeckStatus', 'updatedAt',
          'igdbId', 'steamAppId', 'rawgId', 'giantbombId', 'vndbId', 'trailers',
        ]),
        platforms: g.platforms ?? [],
        developers: g.developers ?? [],
        publishers: g.publishers ?? [],
        gameModes: g.gameModes ?? [],
        playerPerspectives: g.playerPerspectives ?? [],
        languages: g.languages ?? [],
        synonyms: g.synonyms ?? [],
        startDateYear: g.releaseDateYear ?? null,
        startDateMonth: g.releaseDateMonth ?? null,
        startDateDay: g.releaseDateDay ?? null,
        format: g.platforms && g.platforms.length > 0 ? g.platforms[0] : 'GAME',
        externalLinks: g.sources ?? null,
        sources: g.sources ?? null,
        genres: flattenGenres(g.genres),
        tags: flattenTags(g.tags),
        studios: (g.studios || []).filter((s: any) => Boolean(s.studio)).map((s: any) => s.studio!),
        characters,
      },
    }
  }
  public static async refresh(id: number) {
    const game = await prisma.orm.public.Game.where({ id }).select('id', 'igdbId', 'titlePrimary').first()
    if (!game) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    await prisma.orm.public.Game.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('GAME', id, {
      externalId: game.igdbId,
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

  public static async getSimilar(id: number, limit: number = 24) {
    const source = await prisma.orm.public.Game.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .first()

    if (!source) {
      throw new NotFound(`Game with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))

    let candidatesQ = prisma.orm.public.Game.where((m) => m.id.neq(id))
    const conds: any[] = []
    if (sourceGenreIds.size > 0) conds.push((m: any) => m.genres.some((g: any) => g.genreId.in(Array.from(sourceGenreIds))))
    if (sourceTagIds.size > 0) conds.push((m: any) => m.tags.some((t: any) => t.tagId.in(Array.from(sourceTagIds))))
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

      return {
        id: candidate.id,
        titlePrimary: candidate.titlePrimary,
        titleSecondary: candidate.titleSecondary ?? null,
        titleNative: candidate.titleNative ?? null,
        coverImage: candidate.coverImage ?? null,
        bannerImage: candidate.bannerImage ?? null,
        averageScore: candidate.averageScore ?? null,
        format: (candidate.platforms && candidate.platforms.length > 0) ? candidate.platforms[0] : 'GAME',
        status: candidate.status ? String(candidate.status) : null,
        startDateYear: candidate.releaseDateYear ?? null,
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
    const hydrated = await fetchMediaRelations('GAME' as MediaType, id)
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
      .where((mc) => and(mc.mediaType.eq('GAME' as MediaType), mc.mediaId.eq(id)))
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
      .where((ms) => and(ms.mediaType.eq('GAME' as MediaType), ms.mediaId.eq(id)))
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
    const game = await prisma.orm.public.Game.where({ id })
      .select('images')
      .first()
    if (!game) throw new NotFound(`Game with ID ${id} not found`)
    return {
      success: true,
      images: {
        igdb: imageSource(game.images, 'igdb'),
        steam: imageSource(game.images, 'steam'),
        rawg: imageSource(game.images, 'rawg'),
      },
    }
  }

  public static async getStats(id: number) {
    const game: any = await prisma.orm.public.Game.where({ id })
      .select('averageScore', 'favorites', 'popularity', 'scoreDistribution', 'statusDistribution', 'igdbRating', 'igdbRatingCount', 'averagePlaytime')
      .first()
    if (!game) throw new NotFound(`Game with ID ${id} not found`)
    return {
      success: true,
      stats: {
        averageScore: game.averageScore ?? null,
        favorites: game.favorites ?? 0,
        popularity: game.popularity ?? 0,
        scoreDistribution: game.scoreDistribution ?? {},
        statusDistribution: game.statusDistribution ?? {},
        igdbRating: game.igdbRating ?? null,
        igdbRatingCount: game.igdbRatingCount ?? null,
        averagePlaytime: game.averagePlaytime ?? null,
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

    const rawEntries = await prisma.orm.public.GameList
      .where((l) => and(l.gameId.eq(id), l.private.eq(false), l.userId.in(friendIds)))
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

    let q = prisma.orm.public.GameList.where({ gameId: id, private: false })
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
      .where((r) => and(r.sourceType.eq('GAME' as MediaType), r.sourceId.eq(id)))
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

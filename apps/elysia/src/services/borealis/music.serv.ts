import { prisma, countOf, or, and, toDate, type MediaType } from '@NamelessLiberty/db'
import { NotFound } from '../../lib/errors'
import { getProfileCustomization } from '@NamelessLiberty/shared'
import { MediaQueueManager } from './queue'
import { fetchMediaRelations } from './media-relations.helper'
import { pick, flattenGenres, flattenTags, imageSource } from './media-overview.helper'

export interface MusicCatalogQuery {
  cursor?: number
  page?: number
  limit?: number
  search?: string
  genres?: string
  tags?: string
  formats?: string
  statuses?: string
  years?: string
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

export class BorealisMusicServ {
  public static async getCatalog(query?: MusicCatalogQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(100, Number(query?.limit ?? 50)))
    const skip = query?.cursor ? 0 : (page - 1) * limit

    const search = query?.search?.trim()
    const genres = parseList(query?.genres)
    const tags = parseList(query?.tags)
    const formats = parseList(query?.formats)
    const years = parseList(query?.years).map((y) => Number(y)).filter((y) => !isNaN(y))
    const sortBy = query?.sortBy ?? 'popularity'
    const sortOrder = query?.sortOrder ?? (sortBy === 'title' ? 'asc' : 'desc')

    let q = prisma.orm.public.Music
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
      q = q.where((m) => m.type.in(formats as any))
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
    if (sortBy === 'title') {
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
          'type',
          'titlePrimary',
          'titleSecondary',
          'titleNative',
          'coverImage',
          'description',
          'status',
          'releaseDateYear',
          'duration',
          'popularity',
          'favorites',
          'artistName'
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
      bannerImage: null,
      averageScore: null,
      format: String(x.type),
      status: String(x.status),
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
    const [allMusic, allGenres] = await Promise.all([
      prisma.orm.public.Music.select('status', 'type', 'releaseDateYear').all(),
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
      tags: [],
      years: Object.entries(yearCounts)
        .map(([value, count]) => ({ value: Number(value), count }))
        .sort((a, b) => b.value - a.value),
    }
  }

  public static async getById(id: number) {
    const music: any = await prisma.orm.public.Music.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .include('artist', (a) => a.select('id', 'namePrimary', 'nameNative', 'image', 'description'))
      .first()

    if (!music) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    const artist = Array.isArray(music.artist) ? music.artist[0] : music.artist
    return {
      success: true,
      media: {
        ...pick(music, [
          'id', 'type', 'titlePrimary', 'titleSecondary', 'titleNative', 'titleVersion',
          'coverImage', 'description', 'duration', 'trackPosition', 'diskNumber',
          'status', 'label', 'nbTracks', 'audioPreviewUrl', 'bpm',
          'artistId', 'artistName', 'albumId',
          'favorites', 'popularity', 'listeners', 'playCount', 'updatedAt',
          'deezerId', 'isrc', 'upc',
        ]),
        bannerImage: null,
        averageScore: null,
        format: music.type ? String(music.type) : null,
        explicitLyrics: music.explicitLyrics ?? false,
        isAdult: false,
        startDateYear: music.releaseDateYear ?? null,
        startDateMonth: music.releaseDateMonth ?? null,
        startDateDay: music.releaseDateDay ?? null,
        artist: artist
          ? {
              id: artist.id,
              namePrimary: artist.namePrimary,
              nameNative: artist.nameNative ?? null,
              image: artist.image ?? null,
              description: artist.description ?? null,
            }
          : null,
        spotifyId: (music.sources as any)?.spotify?.id ?? null,
        externalLinks: music.sources ?? null,
        sources: music.sources ?? null,
        genres: flattenGenres(music.genres),
        tags: flattenTags(music.tags),
      },
    }
  }
  public static async refresh(id: number) {
    const music = await prisma.orm.public.Music.where({ id }).select('id', 'deezerId', 'titlePrimary').first()
    if (!music) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    await prisma.orm.public.Music.where({ id }).update({ updatedAt: new Date() })

    await MediaQueueManager.enqueueMediaUpdate('MUSIC', id, {
      externalId: music.deezerId,
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

  public static async getSimilar(id: number, limit: number = 24) {
    const source = await prisma.orm.public.Music.where({ id })
      .include('genres', (g) => g.include('genre', (ge) => ge.select('id', 'name')))
      .include('tags', (t) => t.include('tag', (te) => te.select('id', 'name')))
      .first()

    if (!source) {
      throw new NotFound(`Music with ID ${id} not found`)
    }

    const sourceGenres = (source.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => g.genre!)
    const sourceTags = (source.tags || []).filter((t: any) => Boolean(t.tag)).map((t: any) => t.tag!)
    const sourceGenreIds = new Set(sourceGenres.map((g: any) => g.id))
    const sourceTagIds = new Set(sourceTags.map((t: any) => t.id))

    let candidatesQ = prisma.orm.public.Music.where((m) => m.id.neq(id))
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
        bannerImage: null,
        averageScore: null,
        format: String(candidate.type),
        status: String(candidate.status),
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
    const hydrated = await fetchMediaRelations('MUSIC' as MediaType, id)
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

  public static async getTracks(musicId: number) {
    const tracks = await prisma.orm.public.Music
      .where({ albumId: musicId })
      .orderBy((t) => t.trackPosition.asc())
      .all()
    return {
      success: true,
      tracks: tracks.map((t: any) => ({
        ...pick(t, ['id', 'trackPosition', 'diskNumber', 'titlePrimary', 'titleSecondary', 'duration', 'audioPreviewUrl', 'artistName']),
        explicitLyrics: t.explicitLyrics ?? false,
      })),
    }
  }
  public static async getLyrics(musicId: number) {
    const music = await prisma.orm.public.Music
      .where({ id: musicId })
      .select('id', 'lyrics', 'syncedLyrics', 'lyricsSource')
      .first()
    if (!music) {
      throw new NotFound(`Music with ID ${musicId} not found`)
    }
    return {
      success: true,
      id: music.id,
      lyrics: music.lyrics ?? null,
      syncedLyrics: music.syncedLyrics ?? null,
      lyricsSource: music.lyricsSource ?? null,
    }
  }

  public static async getStaff(id: number) {
    const raw = await prisma.orm.public.MediaStaff
      .where((ms) => and(ms.mediaType.eq('MUSIC' as MediaType), ms.mediaId.eq(id)))
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
    const music = await prisma.orm.public.Music.where({ id })
      .select('images')
      .first()
    if (!music) throw new NotFound(`Music with ID ${id} not found`)
    return {
      success: true,
      images: {
        deezer: imageSource(music.images, 'deezer'),
        spotify: imageSource(music.images, 'spotify'),
      },
    }
  }

  public static async getStats(id: number) {
    const music = await prisma.orm.public.Music.where({ id })
      .select('favorites', 'popularity', 'playCount', 'listeners')
      .first()
    if (!music) throw new NotFound(`Music with ID ${id} not found`)
    return {
      success: true,
      stats: {
        averageScore: null,
        favorites: music.favorites ?? 0,
        popularity: music.popularity ?? 0,
        scoreDistribution: {},
        statusDistribution: {},
        playCount: music.playCount ?? 0,
        listeners: music.listeners ?? 0,
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

    const rawEntries = await prisma.orm.public.MusicList
      .where((l) => and(l.musicId.eq(id), l.private.eq(false), l.userId.in(friendIds)))
      .include('user', (u: any) => u.select('id', 'username', 'customization'))
      .all()

    const friends = rawEntries.map((raw: any) => {
      const profile = getProfileCustomization(raw.user?.customization)
      return {
        id: raw.id,
        userId: raw.userId,
        status: raw.status,
        score: raw.score,
        primaryProgress: raw.playCount,
        secondaryProgress: null,
        progress: raw.playCount,
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

    let q = prisma.orm.public.MusicList.where({ musicId: id, private: false })
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
        primaryProgress: raw.playCount,
        secondaryProgress: null,
        progress: raw.playCount,
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
      mediaType: 'music',
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
      .where((r) => and(r.sourceType.eq('MUSIC' as MediaType), r.sourceId.eq(id)))
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


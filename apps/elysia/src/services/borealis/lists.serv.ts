import { prisma, countOf, toDate, and, or, normalizeListStatus, type MediaType, type ListStatus } from '@Iris/db'
import { NotFound, BadRequest } from '../../lib/errors'
import { hashPassword } from '../../utils/auth-crypto'
import { ConnectionSyncQueueManager } from '../carina/connection-sync.queue'
import { ActivityServ, type MediaListAction } from '../carina/activity.serv'
import { MediaStatsServ } from './media-stats.serv'
import { mediaStatsService } from './user-stats.serv'

export interface ListQuery {
  page?: number
  limit?: number
  status?: string
  format?: string
  mediaFormat?: string
  genre?: string
  year?: string
  mediaStatus?: string
  sortBy?: string
  order?: 'asc' | 'desc'
  q?: string
}

function encryptNotes(notes: string | null | undefined, _userId?: string): string | null {
  if (notes === null || notes === undefined) return null
  const trimmed = notes.trim()
  return trimmed || null
}

function decryptNotes(notes: string | null | undefined, _userId?: string | null): string | null {
  return notes ?? null
}

function formatEntry(entry: any) {
  if (!entry) return null
  const notes = entry.notes !== undefined
    ? decryptNotes(entry.notes, entry.userId)
    : undefined
  return {
    ...entry,
    ...(notes !== undefined ? { notes } : {}),
    startedAt: entry.startedAt ? (entry.startedAt instanceof Date ? entry.startedAt.toISOString() : String(entry.startedAt)) : null,
    completedAt: entry.completedAt ? (entry.completedAt instanceof Date ? entry.completedAt.toISOString() : String(entry.completedAt)) : null,
    createdAt: entry.createdAt ? (entry.createdAt instanceof Date ? entry.createdAt.toISOString() : String(entry.createdAt)) : new Date().toISOString(),
    updatedAt: entry.updatedAt ? (entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : String(entry.updatedAt)) : new Date().toISOString(),
  }
}

function emitListActivity(params: {
  userId: string
  mediaType: 'ANIME' | 'MANGA' | 'MOVIE' | 'TV' | 'GAME' | 'BOOK' | 'MUSIC' | 'OTHER'
  mediaId: number
  existing?: any | null
  incoming?: any | null
  media?: {
    titlePrimary?: string | null
    titleSecondary?: string | null
    titleNative?: string | null
    coverImage?: string | null
    bannerImage?: string | null
    format?: string | null
  } | null
  isDeleted?: boolean
}) {
  const { userId, mediaType, mediaId, existing, incoming, media, isDeleted } = params
  const title = media?.titlePrimary || media?.titleSecondary || media?.titleNative || `${mediaType} #${mediaId}`
  const coverImage = media?.coverImage || null
  const bannerImage = media?.bannerImage || null
  const format = media?.format || null

  if (isDeleted) {
    ActivityServ.recordMediaListActivity({
      userId,
      mediaType,
      mediaId,
      action: 'REMOVED',
      title,
      coverImage,
      bannerImage,
      format,
      status: existing?.status || null,
      progress: existing?.progress ?? existing?.chaptersProgress ?? null,
      progressVolumes: existing?.volumesProgress ?? null,
      score: existing?.score ?? null,
      isPrivate: existing?.private ?? false,
    })
    return
  }

  const inc = incoming || {}

  const currentProgress = inc.progress !== undefined
    ? Number(inc.progress)
    : inc.chaptersProgress !== undefined
      ? Number(inc.chaptersProgress)
      : inc.progressPages !== undefined
        ? Number(inc.progressPages)
        : inc.progressChapters !== undefined
          ? Number(inc.progressChapters)
          : (existing ? (existing.progress ?? existing.chaptersProgress ?? existing.progressPages ?? existing.progressChapters ?? 0) : 0)

  const currentVolumes = inc.volumesProgress !== undefined
    ? Number(inc.volumesProgress)
    : inc.progressVolumes !== undefined
      ? Number(inc.progressVolumes)
      : (existing ? (existing.volumesProgress ?? existing.progressVolumes ?? 0) : 0)

  const currentStatus = inc.status ?? (existing ? existing.status : 'PLANNED')
  const currentScore = inc.score !== undefined ? inc.score : (existing ? existing.score : null)
  const isPrivate = inc.private !== undefined ? Boolean(inc.private) : (existing ? Boolean(existing.private) : false)

  if (!existing) {
    ActivityServ.recordMediaListActivity({
      userId,
      mediaType,
      mediaId,
      action: 'ADDED',
      title,
      coverImage,
      bannerImage,
      format,
      status: currentStatus,
      progress: currentProgress,
      progressVolumes: currentVolumes,
      score: currentScore,
      isPrivate,
    })
    return
  }

  const oldProgress = existing.progress ?? existing.chaptersProgress ?? existing.progressPages ?? existing.progressChapters ?? 0
  const oldVolumes = existing.volumesProgress ?? existing.progressVolumes ?? 0
  const oldStatus = existing.status
  const oldScore = existing.score
  const oldRewatched = existing.rewatched ?? existing.reread ?? existing.replayed ?? existing.playCount ?? 0
  const currentRewatched = inc.rewatched ?? inc.reread ?? inc.replayed ?? inc.playCount ?? oldRewatched

  const statusChanged = Boolean(inc.status && inc.status !== oldStatus)
  const progressChanged = Boolean(
    (inc.progress !== undefined && inc.progress !== oldProgress) ||
    (inc.chaptersProgress !== undefined && inc.chaptersProgress !== oldProgress) ||
    (inc.progressPages !== undefined && inc.progressPages !== oldProgress) ||
    (inc.progressChapters !== undefined && inc.progressChapters !== oldProgress) ||
    (inc.volumesProgress !== undefined && inc.volumesProgress !== oldVolumes) ||
    (inc.progressVolumes !== undefined && inc.progressVolumes !== oldVolumes)
  )
  const scoreChanged = Boolean(inc.score !== undefined && inc.score !== oldScore)
  const rewatchedChanged = Boolean(currentRewatched > oldRewatched)

  let action: MediaListAction | null = null

  if (statusChanged && currentStatus === 'COMPLETED') {
    action = 'COMPLETED'
  } else if (rewatchedChanged) {
    action = 'REWATCH_STARTED'
  } else if (statusChanged) {
    action = 'STATUS_CHANGED'
  } else if (progressChanged) {
    action = 'PROGRESS_CHANGED'
  } else if (scoreChanged) {
    action = 'SCORE_CHANGED'
  }

  if (action) {
    ActivityServ.recordMediaListActivity({
      userId,
      mediaType,
      mediaId,
      action,
      title,
      coverImage,
      bannerImage,
      format,
      status: currentStatus,
      progress: currentProgress,
      progressVolumes: currentVolumes,
      score: currentScore,
      prevStatus: oldStatus,
      prevProgress: oldProgress,
      prevScore: oldScore,
      isPrivate,
    })
  }
}

function computeStats(items: any[], progressField: string) {
  const total = items.length
  const statusCounts: Record<string, number> = {}
  let totalScore = 0
  let scoredCount = 0
  let totalProgress = 0
  const scoreBuckets: Record<number, number> = {}

  for (let i = 1; i <= 10; i++) {
    scoreBuckets[i] = 0
  }

  for (const item of items) {
    if (item.status) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1
    }
    if (item.score !== null && item.score !== undefined && item.score > 0) {
      totalScore += item.score
      scoredCount++
      const rounded = Math.min(10, Math.max(1, Math.round(item.score)))
      scoreBuckets[rounded] = (scoreBuckets[rounded] || 0) + 1
    }
    const prog = item[progressField] ?? 0
    totalProgress += Number(prog) || 0
  }

  const meanScore = scoredCount > 0 ? Number((totalScore / scoredCount).toFixed(2)) : 0
  const scoreDistribution = Object.entries(scoreBuckets).map(([score, count]) => ({
    score: Number(score),
    count,
  }))

  return {
    total,
    statusCounts,
    meanScore,
    totalProgress,
    scoreDistribution,
  }
}

function computeFilters(items: any[], mediaKey: string, yearKey: string = 'startDateYear') {
  const statusCounts: Record<string, number> = {}
  const formatCounts: Record<string, number> = {}
  const mediaStatusCounts: Record<string, number> = {}
  const genreCounts: Record<string, number> = {}
  const yearCounts: Record<number, number> = {}

  for (const item of items) {
    if (item.status) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1
    }
    const media = item[mediaKey]
    if (media) {
      const format = media.format || media.type
      if (format) {
        formatCounts[format] = (formatCounts[format] || 0) + 1
      }
      if (media.status) {
        mediaStatusCounts[media.status] = (mediaStatusCounts[media.status] || 0) + 1
      }
      const yr = media[yearKey]
      if (yr) {
        yearCounts[yr] = (yearCounts[yr] || 0) + 1
      }
      if (Array.isArray(media.genres)) {
        for (const g of media.genres) {
          const name = g.name ?? g
          if (name) {
            genreCounts[name] = (genreCounts[name] || 0) + 1
          }
        }
      }
    }
  }

  return {
    statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
    formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
    mediaStatuses: Object.entries(mediaStatusCounts).map(([value, count]) => ({ value, count })),
    genres: Object.entries(genreCounts).map(([value, count]) => ({ value, count })),
    years: Object.entries(yearCounts).map(([value, count]) => ({ value: Number(value), count })),
  }
}

function applyListMediaFilters(
  whereMedia: any = {},
  query?: ListQuery,
  options: {
    yearKey?: string
    formatField?: string
    isDateStringYear?: boolean
    formatTransform?: (f: string) => string
  } = {}
) {
  const result = { ...whereMedia }
  const yearKey = options.yearKey ?? 'startDateYear'
  const formatField = options.formatField ?? 'format'

  const formatStr = query?.format || query?.mediaFormat
  if (formatStr && formatField) {
    const rawFormats = formatStr.split(',').map((f) => f.trim()).filter(Boolean)
    const formats = options.formatTransform
      ? rawFormats.map(options.formatTransform)
      : rawFormats.map((f) => f.toUpperCase())
    if (formats.length > 0) {
      result[formatField] = { in: formats }
    }
  }

  if (query?.mediaStatus) {
    const statuses = query.mediaStatus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    if (statuses.length > 0) {
      result.status = { in: statuses }
    }
  }

  if (query?.genre) {
    const genres = query.genre.split(',').map((g) => g.trim()).filter(Boolean)
    if (genres.length > 0) {
      result.genres = { some: { name: { in: genres, mode: 'insensitive' } } }
    }
  }

  if (query?.year) {
    const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
    if (years.length > 0) {
      if (options.isDateStringYear) {
        result.OR = years.map((y) => ({
          startDate: {
            gte: new Date(y, 0, 1),
            lte: new Date(y, 11, 31, 23, 59, 59, 999),
          },
        }))
      } else {
        result[yearKey] = { in: years }
      }
    }
  }

  return result
}

export class BorealisListsServ {
  // ===========================================================================
  // 1. Anime Lists
  // ===========================================================================

  public static async getAnimeList(userId: string, query?: ListQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(250, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const order = query?.order === 'asc' ? 'asc' : 'desc'

    let q = prisma.orm.public.AnimeList.where({ userId })
    if (query?.status) {
      q = q.where({ status: query.status.trim().toUpperCase() as any })
    }
    if (query?.q) {
      const qPattern = `%${query.q.trim()}%`
      q = q.where((al) => al.anime.some((a) => or(a.titlePrimary.ilike(qPattern), a.titleSecondary.ilike(qPattern))))
    }
    const formatStr = query?.format || query?.mediaFormat
    if (formatStr) {
      const formats = formatStr.split(',').map((f) => f.trim().toUpperCase()).filter(Boolean)
      if (formats.length > 0) {
        q = q.where((al) => al.anime.some((a) => a.format.in(formats as any)))
      }
    }
    if (query?.mediaStatus) {
      const statuses = query.mediaStatus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      if (statuses.length > 0) {
        q = q.where((al) => al.anime.some((a) => a.status.in(statuses as any)))
      }
    }
    if (query?.genre) {
      const genres = query.genre.split(',').map((g) => g.trim()).filter(Boolean)
      if (genres.length > 0) {
        q = q.where((al) => al.anime.some((a) => a.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))))
      }
    }
    if (query?.year) {
      const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
      if (years.length > 0) {
        q = q.where((al) => al.anime.some((a) => a.startDateYear.in(years)))
      }
    }

    let itemsQ = q
    if (query?.sortBy === 'title') {
      itemsQ = itemsQ.orderBy((al) => (order === 'asc' ? al.anime.titlePrimary.asc() : al.anime.titlePrimary.desc()))
    } else if (query?.sortBy === 'score') {
      itemsQ = itemsQ.orderBy((al) => (order === 'asc' ? al.score.asc() : al.score.desc()))
    } else if (query?.sortBy === 'progress') {
      itemsQ = itemsQ.orderBy((al) => (order === 'asc' ? al.progress.asc() : al.progress.desc()))
    } else if (query?.sortBy === 'createdAt') {
      itemsQ = itemsQ.orderBy((al) => (order === 'asc' ? al.createdAt.asc() : al.createdAt.desc()))
    } else {
      itemsQ = itemsQ.orderBy((al) => (order === 'asc' ? al.updatedAt.asc() : al.updatedAt.desc()))
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('anime', (a) =>
          a
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'format',
              'status',
              'episodeCount',
              'averageScore',
              'startDateYear'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
        )
        .all(),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { anime, ...entryData } = e
        const formattedMedia = anime
          ? {
              ...anime,
              genres: (anime.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
            }
          : null
        return {
          entry: formatEntry(entryData),
          media: formattedMedia,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  public static async getAnimeEntry(userId: string, animeId: number) {
    const entry = await prisma.orm.public.AnimeList.where({ userId, animeId })
      .include('anime', (a) =>
        a
          .select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'format',
            'status',
            'episodeCount',
            'averageScore',
            'startDateYear'
          )
          .include('genres', (g) =>
            g.include('genre', (ge) => ge.select('id', 'name'))
          )
      )
      .first()

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { anime, ...entryData } = entry
    const formattedMedia = anime
      ? {
          ...anime,
          genres: (anime.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
        }
      : null
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: formattedMedia,
    }
  }

  public static async upsertAnimeEntry(userId: string, animeId: number, body: any) {
    const anime = await prisma.orm.public.Anime.where({ id: animeId })
      .select(
        'id',
        'episodeCount',
        'status',
        'titlePrimary',
        'titleSecondary',
        'coverImage',
        'bannerImage',
        'format'
      )
      .first()
    if (!anime) {
      throw new NotFound(`Anime with ID ${animeId} does not exist`)
    }

    const existing = await prisma.orm.public.AnimeList.where({ userId, animeId }).first()

    let progress = body.progress !== undefined ? Number(body.progress) : undefined
    if (progress !== undefined && anime.episodeCount && anime.episodeCount > 0) {
      progress = Math.min(progress, anime.episodeCount)
    }

    const startedAt = body.startedAt !== undefined ? (body.startedAt ? new Date(body.startedAt) : null) : undefined
    const completedAt = body.completedAt !== undefined ? (body.completedAt ? new Date(body.completedAt) : null) : undefined

    const updateData: any = {
      ...(body.status ? { status: body.status } : {}),
      ...(progress !== undefined ? { progress } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.notes !== undefined ? { notes: encryptNotes(body.notes, userId) } : {}),
      ...(body.rewatched !== undefined ? { rewatched: Number(body.rewatched) } : {}),
      ...(body.private !== undefined ? { private: Boolean(body.private) } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(body.rewatchHistory !== undefined ? { rewatchHistory: body.rewatchHistory } : {}),
      ...(body.connections !== undefined ? { connections: body.connections } : {}),
    }

    const entry = existing
      ? await prisma.orm.public.AnimeList.where({ id: existing.id }).update(updateData)
      : await prisma.orm.public.AnimeList.create({
          userId,
          animeId,
          status: body.status ?? 'PLANNED',
          progress: progress ?? 0,
          score: body.score ?? null,
          notes: encryptNotes(body.notes, userId),
          rewatched: body.rewatched ?? 0,
          private: body.private ?? false,
          startedAt: startedAt ?? null,
          completedAt: completedAt ?? null,
          rewatchHistory: body.rewatchHistory ?? null,
          connections: body.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to update anime list entry')
    }

    await MediaStatsServ.recalculateMediaStats('ANIME', animeId)

    emitListActivity({
      userId,
      mediaType: 'ANIME',
      mediaId: animeId,
      existing,
      incoming: body,
      media: anime,
    })

    const connectionsToSync = body.connections ?? entry.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'ANIME',
        mediaId: animeId,
        mediaTitle: anime.titlePrimary || anime.titleSecondary || 'Anime',
        entry: {
          status: entry.status,
          progress: entry.progress,
          score: entry.score,
          notes: decryptNotes(entry.notes, userId),
          rewatched: entry.rewatched,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: 'Anime list entry updated successfully',
      entry: formatEntry(entry),
    }
  }

  public static async deleteAnimeEntry(userId: string, animeId: number) {
    const existing = await prisma.orm.public.AnimeList.where({ userId, animeId }).first()
    if (!existing) {
      throw new NotFound(`Anime with ID ${animeId} is not in user list`)
    }

    const anime = await prisma.orm.public.Anime.where({ id: animeId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage', 'format')
      .first()

    await prisma.orm.public.AnimeList.where({ id: existing.id }).delete()

    await MediaStatsServ.recalculateMediaStats('ANIME', animeId)

    if (anime) {
      emitListActivity({
        userId,
        mediaType: 'ANIME',
        mediaId: animeId,
        existing,
        incoming: {},
        media: anime,
        isDeleted: true,
      })
    }

    return {
      success: true,
      message: 'Anime removed from list successfully',
    }
  }

  public static async incrementAnime(userId: string, animeId: number, body?: { count?: number; status?: string; connections?: any } | null) {
    const anime = await prisma.orm.public.Anime.where({ id: animeId })
      .select(
        'id',
        'episodeCount',
        'status',
        'titlePrimary',
        'titleSecondary',
        'coverImage',
        'bannerImage',
        'format'
      )
      .first()
    if (!anime) {
      throw new NotFound(`Anime with ID ${animeId} does not exist`)
    }

    const existing = await prisma.orm.public.AnimeList.where({ userId, animeId }).first()

    const count = Math.max(1, body?.count ?? 1)
    const currentProgress = existing?.progress ?? 0
    let newProgress = currentProgress + count
    let newStatus = body?.status ?? existing?.status ?? 'IN_PROGRESS'
    let completedAt = existing?.completedAt ?? null

    if (newStatus !== 'IN_PROGRESS') {
      newStatus = 'IN_PROGRESS'
    }

    if (anime.episodeCount && anime.episodeCount > 0 && newProgress >= anime.episodeCount) {
      newProgress = anime.episodeCount
      newStatus = 'COMPLETED'
      if (!completedAt) {
        completedAt = new Date()
      }
    } else {
      completedAt = null
    }

    const entry = existing
      ? await prisma.orm.public.AnimeList.where({ id: existing.id }).update({
          status: newStatus as any,
          progress: newProgress,
          completedAt,
          ...(existing?.status === 'PLANNED' || !existing?.startedAt ? { startedAt: existing?.startedAt ?? new Date() } : {}),
          ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
        })
      : await prisma.orm.public.AnimeList.create({
          userId,
          animeId,
          status: newStatus as any,
          progress: newProgress,
          startedAt: new Date(),
          completedAt,
          connections: (body as any)?.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to increment anime list entry')
    }

    await MediaStatsServ.recalculateMediaStats('ANIME', animeId)

    emitListActivity({
      userId,
      mediaType: 'ANIME',
      mediaId: animeId,
      existing,
      incoming: { progress: newProgress, status: newStatus },
      media: anime,
    })

    const connectionsToSync = (body as any)?.connections ?? entry.connections ?? existing?.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'ANIME',
        mediaId: animeId,
        mediaTitle: anime.titlePrimary || anime.titleSecondary || 'Anime',
        entry: {
          status: entry.status,
          progress: entry.progress,
          score: existing?.score ?? null,
          notes: decryptNotes(existing?.notes, userId),
          rewatched: existing?.rewatched ?? 0,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: `Episode progress incremented to ${entry.progress}`,
      entry: formatEntry(entry),
    }
  }

  public static async getAnimeStats(userId: string, query?: any, isOwner: boolean = true) {
    let q = prisma.orm.public.AnimeList.where({ userId })
    if (!isOwner) {
      q = q.where({ private: false })
    }
    const items = await q.select('status', 'progress', 'score', 'rewatched').all()
    const data = await mediaStatsService.getAnimeStats(userId, isOwner, {
      year: query?.year ? Number(query.year) : undefined,
      quarter: query?.quarter ? Number(query.quarter) : undefined,
      month: query?.month ? Number(query.month) : undefined,
    })
    return {
      success: true,
      data,
      stats: computeStats(items, 'progress'),
    }
  }

  public static async getAnimeFilters(userId: string) {
    const rawItems = await prisma.orm.public.AnimeList.where({ userId })
      .select('status')
      .include('anime', (a) =>
        a
          .select('format', 'status', 'startDateYear')
          .include('genres', (g) =>
            g.include('genre', (ge) => ge.select('name'))
          )
      )
      .all()
    const items = rawItems.map((item) => ({
      status: item.status,
      anime: item.anime
        ? {
            ...item.anime,
            genres: (item.anime.genres || [])
              .filter((g: any) => Boolean(g.genre))
              .map((g: any) => ({ name: g.genre!.name })),
          }
        : null,
    }))
    return {
      success: true,
      ...computeFilters(items, 'anime', 'startDateYear'),
    }
  }

  // ===========================================================================
  // 2. Manga Lists
  // ===========================================================================

  public static async getMangaList(userId: string, query?: ListQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(250, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const order = query?.order === 'asc' ? 'asc' : 'desc'

    let q = prisma.orm.public.MangaList.where({ userId })
    if (query?.status) {
      q = q.where({ status: query.status.trim().toUpperCase() as any })
    }
    if (query?.q) {
      const qPattern = `%${query.q.trim()}%`
      q = q.where((ml) => ml.manga.some((m) => or(m.titlePrimary.ilike(qPattern), m.titleSecondary.ilike(qPattern))))
    }
    const formatStr = query?.format || query?.mediaFormat
    if (formatStr) {
      const formats = formatStr.split(',').map((f) => f.trim().toUpperCase()).filter(Boolean)
      if (formats.length > 0) {
        q = q.where((ml) => ml.manga.some((m) => m.format.in(formats as any)))
      }
    }
    if (query?.mediaStatus) {
      const statuses = query.mediaStatus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      if (statuses.length > 0) {
        q = q.where((ml) => ml.manga.some((m) => m.status.in(statuses as any)))
      }
    }
    if (query?.genre) {
      const genres = query.genre.split(',').map((g) => g.trim()).filter(Boolean)
      if (genres.length > 0) {
        q = q.where((ml) => ml.manga.some((m) => m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))))
      }
    }
    if (query?.year) {
      const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
      if (years.length > 0) {
        q = q.where((ml) => ml.manga.some((m) => m.startDateYear.in(years)))
      }
    }

    let itemsQ = q
    if (query?.sortBy === 'title') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.manga.titlePrimary.asc() : ml.manga.titlePrimary.desc()))
    } else if (query?.sortBy === 'score') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.score.asc() : ml.score.desc()))
    } else if (query?.sortBy === 'progress') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.chaptersProgress.asc() : ml.chaptersProgress.desc()))
    } else if (query?.sortBy === 'createdAt') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.createdAt.asc() : ml.createdAt.desc()))
    } else {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.updatedAt.asc() : ml.updatedAt.desc()))
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('manga', (m) =>
          m
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'format',
              'status',
              'chapterCount',
              'volumeCount',
              'averageScore',
              'startDateYear'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
        )
        .all(),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { manga, ...entryData } = e
        const formattedMedia = manga
          ? {
              ...manga,
              genres: (manga.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
            }
          : null
        return {
          entry: formatEntry(entryData),
          media: formattedMedia,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  public static async getMangaEntry(userId: string, mangaId: number) {
    const entry = await prisma.orm.public.MangaList.where({ userId, mangaId })
      .include('manga', (m) =>
        m
          .select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'format',
            'status',
            'chapterCount',
            'volumeCount',
            'averageScore',
            'startDateYear'
          )
          .include('genres', (g) =>
            g.include('genre', (ge) => ge.select('id', 'name'))
          )
      )
      .first()

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { manga, ...entryData } = entry
    const formattedMedia = manga
      ? {
          ...manga,
          genres: (manga.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
        }
      : null
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: formattedMedia,
    }
  }

  public static async upsertMangaEntry(userId: string, mangaId: number, body: any) {
    const manga = await prisma.orm.public.Manga.where({ id: mangaId })
      .select(
        'id',
        'chapterCount',
        'volumeCount',
        'titlePrimary',
        'titleSecondary',
        'coverImage',
        'bannerImage',
        'format'
      )
      .first()
    if (!manga) {
      throw new NotFound(`Manga with ID ${mangaId} does not exist`)
    }

    const existing = await prisma.orm.public.MangaList.where({ userId, mangaId }).first()

    let chaptersProgress = body.chaptersProgress !== undefined ? Number(body.chaptersProgress) : undefined
    if (chaptersProgress !== undefined && manga.chapterCount && manga.chapterCount > 0) {
      chaptersProgress = Math.min(chaptersProgress, manga.chapterCount)
    }

    const volumesProgress = body.volumesProgress !== undefined ? Number(body.volumesProgress) : undefined
    const startedAt = body.startedAt !== undefined ? (body.startedAt ? new Date(body.startedAt) : null) : undefined
    const completedAt = body.completedAt !== undefined ? (body.completedAt ? new Date(body.completedAt) : null) : undefined

    const updateData: any = {
      ...(body.status ? { status: body.status } : {}),
      ...(chaptersProgress !== undefined ? { chaptersProgress } : {}),
      ...(volumesProgress !== undefined ? { volumesProgress } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.notes !== undefined ? { notes: encryptNotes(body.notes, userId) } : {}),
      ...(body.reread !== undefined ? { reread: Number(body.reread) } : {}),
      ...(body.private !== undefined ? { private: Boolean(body.private) } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(body.rereadHistory !== undefined ? { rereadHistory: body.rereadHistory } : {}),
      ...(body.connections !== undefined ? { connections: body.connections } : {}),
    }

    const entry = existing
      ? await prisma.orm.public.MangaList.where({ id: existing.id }).update(updateData)
      : await prisma.orm.public.MangaList.create({
          userId,
          mangaId,
          status: body.status ?? 'PLANNED',
          chaptersProgress: chaptersProgress ?? 0,
          volumesProgress: volumesProgress ?? 0,
          score: body.score ?? null,
          notes: encryptNotes(body.notes, userId),
          reread: body.reread ?? 0,
          private: body.private ?? false,
          startedAt: startedAt ?? null,
          completedAt: completedAt ?? null,
          rereadHistory: body.rereadHistory ?? null,
          connections: body.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to update manga list entry')
    }

    await MediaStatsServ.recalculateMediaStats('MANGA', mangaId)

    emitListActivity({
      userId,
      mediaType: 'MANGA',
      mediaId: mangaId,
      existing,
      incoming: body,
      media: manga,
    })

    const connectionsToSync = body.connections ?? entry.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'MANGA',
        mediaId: mangaId,
        mediaTitle: manga.titlePrimary || manga.titleSecondary || 'Manga',
        entry: {
          status: entry.status,
          progress: entry.chaptersProgress,
          score: entry.score,
          notes: decryptNotes(entry.notes, userId),
          rewatched: entry.reread,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: 'Manga list entry updated successfully',
      entry: formatEntry(entry),
    }
  }

  public static async deleteMangaEntry(userId: string, mangaId: number) {
    const existing = await prisma.orm.public.MangaList.where({ userId, mangaId }).first()
    if (!existing) {
      throw new NotFound(`Manga with ID ${mangaId} is not in user list`)
    }

    const manga = await prisma.orm.public.Manga.where({ id: mangaId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage', 'format')
      .first()

    await prisma.orm.public.MangaList.where({ id: existing.id }).delete()

    await MediaStatsServ.recalculateMediaStats('MANGA', mangaId)

    if (manga) {
      emitListActivity({
        userId,
        mediaType: 'MANGA',
        mediaId: mangaId,
        existing,
        incoming: {},
        media: manga,
        isDeleted: true,
      })
    }

    return {
      success: true,
      message: 'Manga removed from list successfully',
    }
  }

  public static async incrementManga(
    userId: string,
    mangaId: number,
    body?: { count?: number; type?: 'chapter' | 'volume'; status?: string; connections?: any } | null
  ) {
    const manga = await prisma.orm.public.Manga.where({ id: mangaId })
      .select(
        'id',
        'chapterCount',
        'volumeCount',
        'titlePrimary',
        'titleSecondary',
        'coverImage',
        'bannerImage',
        'format'
      )
      .first()
    if (!manga) {
      throw new NotFound(`Manga with ID ${mangaId} does not exist`)
    }

    const existing = await prisma.orm.public.MangaList.where({ userId, mangaId }).first()

    const count = Math.max(1, body?.count ?? 1)
    const isVolume = body?.type === 'volume'
    let chaptersProgress = existing?.chaptersProgress ?? 0
    let volumesProgress = existing?.volumesProgress ?? 0
    let newStatus = body?.status ?? existing?.status ?? 'IN_PROGRESS'
    let completedAt = existing?.completedAt ?? null

    if (newStatus !== 'IN_PROGRESS') {
      newStatus = 'IN_PROGRESS'
    }

    if (isVolume) {
      volumesProgress += count
      if (manga.volumeCount && manga.volumeCount > 0 && volumesProgress >= manga.volumeCount) {
        volumesProgress = manga.volumeCount
        newStatus = 'COMPLETED'
        if (!completedAt) {
          completedAt = new Date()
        }
      } else {
        completedAt = null
      }
    } else {
      chaptersProgress += count
      if (manga.chapterCount && manga.chapterCount > 0 && chaptersProgress >= manga.chapterCount) {
        chaptersProgress = manga.chapterCount
        newStatus = 'COMPLETED'
        if (!completedAt) {
          completedAt = new Date()
        }
      } else {
        completedAt = null
      }
    }

    const entry = existing
      ? await prisma.orm.public.MangaList.where({ id: existing.id }).update({
          status: newStatus as any,
          chaptersProgress,
          volumesProgress,
          completedAt,
          ...(existing?.status === 'PLANNED' || !existing?.startedAt ? { startedAt: existing?.startedAt ?? new Date() } : {}),
          ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
        })
      : await prisma.orm.public.MangaList.create({
          userId,
          mangaId,
          status: newStatus as any,
          chaptersProgress,
          volumesProgress,
          startedAt: new Date(),
          completedAt,
          connections: (body as any)?.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to increment manga list entry')
    }

    await MediaStatsServ.recalculateMediaStats('MANGA', mangaId)

    emitListActivity({
      userId,
      mediaType: 'MANGA',
      mediaId: mangaId,
      existing,
      incoming: { chaptersProgress, volumesProgress, status: newStatus },
      media: manga,
    })

    const connectionsToSync = (body as any)?.connections ?? entry.connections ?? existing?.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'MANGA',
        mediaId: mangaId,
        mediaTitle: manga.titlePrimary || manga.titleSecondary || 'Manga',
        entry: {
          status: entry.status,
          progress: entry.chaptersProgress,
          score: existing?.score ?? null,
          notes: decryptNotes(existing?.notes, userId),
          rewatched: existing?.reread ?? 0,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: `Progress incremented to ${isVolume ? `${volumesProgress} volumes` : `${chaptersProgress} chapters`}`,
      entry: formatEntry(entry),
    }
  }

  public static async getMangaStats(userId: string, query?: any, isOwner: boolean = true) {
    let q = prisma.orm.public.MangaList.where({ userId })
    if (!isOwner) {
      q = q.where({ private: false })
    }
    const items = await q.select('status', 'chaptersProgress', 'volumesProgress', 'score', 'reread').all()
    const data = await mediaStatsService.getMangaStats(userId, isOwner, {
      year: query?.year ? Number(query.year) : undefined,
      quarter: query?.quarter ? Number(query.quarter) : undefined,
      month: query?.month ? Number(query.month) : undefined,
    })
    return {
      success: true,
      data,
      stats: computeStats(items, 'chaptersProgress'),
    }
  }

  public static async getMangaFilters(userId: string) {
    const rawItems = await prisma.orm.public.MangaList.where({ userId })
      .select('status')
      .include('manga', (m) =>
        m
          .select('format', 'status', 'startDateYear')
          .include('genres', (g) =>
            g.include('genre', (ge) => ge.select('name'))
          )
      )
      .all()
    const items = rawItems.map((item) => ({
      status: item.status,
      manga: item.manga
        ? {
            ...item.manga,
            genres: (item.manga.genres || [])
              .filter((g: any) => Boolean(g.genre))
              .map((g: any) => ({ name: g.genre!.name })),
          }
        : null,
    }))
    return {
      success: true,
      ...computeFilters(items, 'manga', 'startDateYear'),
    }
  }

  // ===========================================================================
  // 3. Movie Lists
  // ===========================================================================

  public static async getMovieList(userId: string, query?: ListQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(250, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const order = query?.order === 'asc' ? 'asc' : 'desc'

    let q = prisma.orm.public.MovieList.where({ userId })
    if (query?.status) {
      q = q.where({ status: query.status.trim().toUpperCase() as any })
    }
    if (query?.q) {
      const qPattern = `%${query.q.trim()}%`
      q = q.where((ml) => ml.movie.some((m) => or(m.titlePrimary.ilike(qPattern), m.titleSecondary.ilike(qPattern))))
    }
    if (query?.mediaStatus) {
      const statuses = query.mediaStatus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      if (statuses.length > 0) {
        q = q.where((ml) => ml.movie.some((m) => m.status.in(statuses as any)))
      }
    }
    if (query?.genre) {
      const genres = query.genre.split(',').map((g) => g.trim()).filter(Boolean)
      if (genres.length > 0) {
        q = q.where((ml) => ml.movie.some((m) => m.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))))
      }
    }
    if (query?.year) {
      const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
      if (years.length > 0) {
        q = q.where((ml) => ml.movie.some((m) => m.releaseDateYear.in(years)))
      }
    }

    let itemsQ = q
    if (query?.sortBy === 'title') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.movie.titlePrimary.asc() : ml.movie.titlePrimary.desc()))
    } else if (query?.sortBy === 'score') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.score.asc() : ml.score.desc()))
    } else if (query?.sortBy === 'createdAt') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.createdAt.asc() : ml.createdAt.desc()))
    } else {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.updatedAt.asc() : ml.updatedAt.desc()))
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('movie', (m) =>
          m
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'status',
              'runtime',
              'averageScore',
              'releaseDateYear'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
        )
        .all(),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { movie, ...entryData } = e
        const formattedMedia = movie
          ? {
              ...movie,
              genres: (movie.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
            }
          : null
        return {
          entry: formatEntry(entryData),
          media: formattedMedia,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  public static async getMovieEntry(userId: string, movieId: number) {
    const entry = await prisma.orm.public.MovieList.where({ userId, movieId })
      .include('movie', (m) =>
        m
          .select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'status',
            'runtime',
            'averageScore',
            'releaseDateYear'
          )
          .include('genres', (g) =>
            g.include('genre', (ge) => ge.select('id', 'name'))
          )
      )
      .first()

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { movie, ...entryData } = entry
    const formattedMedia = movie
      ? {
          ...movie,
          genres: (movie.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
        }
      : null
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: formattedMedia,
    }
  }

  public static async upsertMovieEntry(userId: string, movieId: number, body: any) {
    const movie = await prisma.orm.public.Movie.where({ id: movieId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()
    if (!movie) {
      throw new NotFound(`Movie with ID ${movieId} does not exist`)
    }

    const existing = await prisma.orm.public.MovieList.where({ userId, movieId }).first()

    const startedAt = body.startedAt !== undefined ? (body.startedAt ? new Date(body.startedAt) : null) : undefined
    const completedAt = body.completedAt !== undefined ? (body.completedAt ? new Date(body.completedAt) : null) : undefined

    const updateData: any = {
      ...(body.status ? { status: body.status } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.notes !== undefined ? { notes: encryptNotes(body.notes, userId) } : {}),
      ...(body.rewatched !== undefined ? { rewatched: Number(body.rewatched) } : {}),
      ...(body.private !== undefined ? { private: Boolean(body.private) } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(body.rewatchHistory !== undefined ? { rewatchHistory: body.rewatchHistory } : {}),
      ...(body.connections !== undefined ? { connections: body.connections } : {}),
    }

    const entry = existing
      ? await prisma.orm.public.MovieList.where({ id: existing.id }).update(updateData)
      : await prisma.orm.public.MovieList.create({
          userId,
          movieId,
          status: body.status ?? 'PLANNED',
          score: body.score ?? null,
          notes: encryptNotes(body.notes, userId),
          rewatched: body.rewatched ?? 0,
          private: body.private ?? false,
          startedAt: startedAt ?? null,
          completedAt: completedAt ?? null,
          rewatchHistory: body.rewatchHistory ?? null,
          connections: body.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to update movie list entry')
    }

    await MediaStatsServ.recalculateMediaStats('MOVIE', movieId)

    emitListActivity({
      userId,
      mediaType: 'MOVIE',
      mediaId: movieId,
      existing,
      incoming: body,
      media: movie,
    })

    const connectionsToSync = body.connections ?? entry.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'MOVIE',
        mediaId: movieId,
        mediaTitle: movie.titlePrimary || movie.titleSecondary || 'Movie',
        entry: {
          status: entry.status,
          progress: entry.status === 'COMPLETED' ? 1 : 0,
          score: entry.score,
          notes: decryptNotes(entry.notes, userId),
          rewatched: entry.rewatched,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: 'Movie list entry updated successfully',
      entry: formatEntry(entry),
    }
  }

  public static async deleteMovieEntry(userId: string, movieId: number) {
    const existing = await prisma.orm.public.MovieList.where({ userId, movieId }).first()
    if (!existing) {
      throw new NotFound(`Movie with ID ${movieId} is not in user list`)
    }

    const movie = await prisma.orm.public.Movie.where({ id: movieId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()

    await prisma.orm.public.MovieList.where({ id: existing.id }).delete()

    await MediaStatsServ.recalculateMediaStats('MOVIE', movieId)

    if (movie) {
      emitListActivity({
        userId,
        mediaType: 'MOVIE',
        mediaId: movieId,
        existing,
        incoming: {},
        media: movie,
        isDeleted: true,
      })
    }

    return {
      success: true,
      message: 'Movie removed from list successfully',
    }
  }

  public static async incrementMovie(userId: string, movieId: number, body?: { count?: number; connections?: any } | null) {
    const movie = await prisma.orm.public.Movie.where({ id: movieId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()
    if (!movie) {
      throw new NotFound(`Movie with ID ${movieId} does not exist`)
    }

    const existing = await prisma.orm.public.MovieList.where({ userId, movieId }).first()

    const count = Math.max(1, body?.count ?? 1)
    const newRewatched = (existing?.rewatched ?? 0) + count

    const entry = existing
      ? await prisma.orm.public.MovieList.where({ id: existing.id }).update({
          status: 'COMPLETED',
          rewatched: newRewatched,
          completedAt: existing?.completedAt ?? new Date(),
          ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
        })
      : await prisma.orm.public.MovieList.create({
          userId,
          movieId,
          status: 'COMPLETED',
          rewatched: newRewatched,
          completedAt: new Date(),
          connections: (body as any)?.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to increment movie list entry')
    }

    await MediaStatsServ.recalculateMediaStats('MOVIE', movieId)

    emitListActivity({
      userId,
      mediaType: 'MOVIE',
      mediaId: movieId,
      existing,
      incoming: { status: 'COMPLETED', rewatched: newRewatched },
      media: movie,
    })

    const connectionsToSync = (body as any)?.connections ?? entry.connections ?? existing?.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'MOVIE',
        mediaId: movieId,
        mediaTitle: movie.titlePrimary || movie.titleSecondary || 'Movie',
        entry: {
          status: entry.status,
          progress: 1,
          score: existing?.score ?? null,
          notes: decryptNotes(existing?.notes, userId),
          rewatched: entry.rewatched,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: `Rewatch count incremented to ${entry.rewatched}`,
      entry: formatEntry(entry),
    }
  }

  public static async getMovieStats(userId: string, query?: any, isOwner: boolean = true) {
    let q = prisma.orm.public.MovieList.where({ userId })
    if (!isOwner) {
      q = q.where({ private: false })
    }
    const items = await q.select('status', 'score', 'rewatched').all()
    const data = await mediaStatsService.getMovieStats(userId, isOwner, {
      year: query?.year ? Number(query.year) : undefined,
      quarter: query?.quarter ? Number(query.quarter) : undefined,
      month: query?.month ? Number(query.month) : undefined,
    })
    return {
      success: true,
      data,
      stats: computeStats(items, 'rewatched'),
    }
  }

  public static async getMovieFilters(userId: string) {
    const rawItems = await prisma.orm.public.MovieList.where({ userId })
      .select('status')
      .include('movie', (m) =>
        m
          .select('status', 'releaseDateYear')
          .include('genres', (g) =>
            g.include('genre', (ge) => ge.select('name'))
          )
      )
      .all()
    const items = rawItems.map((item) => ({
      status: item.status,
      movie: item.movie
        ? {
            ...item.movie,
            genres: (item.movie.genres || [])
              .filter((g: any) => Boolean(g.genre))
              .map((g: any) => ({ name: g.genre!.name })),
          }
        : null,
    }))
    return {
      success: true,
      ...computeFilters(items, 'movie', 'releaseDateYear'),
    }
  }

  // ===========================================================================
  // 4. TV Lists
  // ===========================================================================

  public static async getTvList(userId: string, query?: ListQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(250, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const order = query?.order === 'asc' ? 'asc' : 'desc'

    let q = prisma.orm.public.TvList.where({ userId })
    if (query?.status) {
      q = q.where({ status: query.status.trim().toUpperCase() as any })
    }
    if (query?.q) {
      const qPattern = `%${query.q.trim()}%`
      q = q.where((tl) => tl.tv.some((t) => or(t.titlePrimary.ilike(qPattern), t.titleSecondary.ilike(qPattern))))
    }
    if (query?.mediaStatus) {
      const statuses = query.mediaStatus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      if (statuses.length > 0) {
        q = q.where((tl) => tl.tv.some((t) => t.status.in(statuses as any)))
      }
    }
    if (query?.genre) {
      const genres = query.genre.split(',').map((g) => g.trim()).filter(Boolean)
      if (genres.length > 0) {
        q = q.where((tl) => tl.tv.some((t) => t.genres.some((g) => g.genre.some((ge) => ge.name.in(genres)))))
      }
    }
    if (query?.year) {
      const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
      if (years.length > 0) {
        q = q.where((tl) => tl.tv.some((t) => t.firstAiredYear.in(years)))
      }
    }

    let itemsQ = q
    if (query?.sortBy === 'title') {
      itemsQ = itemsQ.orderBy((tl) => (order === 'asc' ? tl.tv.titlePrimary.asc() : tl.tv.titlePrimary.desc()))
    } else if (query?.sortBy === 'score') {
      itemsQ = itemsQ.orderBy((tl) => (order === 'asc' ? tl.score.asc() : tl.score.desc()))
    } else if (query?.sortBy === 'progress') {
      itemsQ = itemsQ.orderBy((tl) => (order === 'asc' ? tl.progress.asc() : tl.progress.desc()))
    } else if (query?.sortBy === 'createdAt') {
      itemsQ = itemsQ.orderBy((tl) => (order === 'asc' ? tl.createdAt.asc() : tl.createdAt.desc()))
    } else {
      itemsQ = itemsQ.orderBy((tl) => (order === 'asc' ? tl.updatedAt.asc() : tl.updatedAt.desc()))
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('tv', (t) =>
          t
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'status',
              'episodeCount',
              'seasonCount',
              'averageScore',
              'firstAiredYear'
            )
            .include('genres', (g) =>
              g.include('genre', (ge) => ge.select('id', 'name'))
            )
            .include('seasons', (s) =>
              s
                .select(
                  'id',
                  'seasonNumber',
                  'titlePrimary',
                  'titleSecondary',
                  'episodeCount'
                )
                .orderBy((sn) => sn.seasonNumber.asc())
            )
        )
        .all(),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { tv, ...entryData } = e
        const formattedMedia = tv
          ? {
              ...tv,
              genres: (tv.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
            }
          : null
        return {
          entry: formatEntry(entryData),
          media: formattedMedia,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  public static async getTvEntry(userId: string, tvId: number) {
    const entry = await prisma.orm.public.TvList.where({ userId, tvId })
      .include('tv', (t) =>
        t
          .select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'status',
            'episodeCount',
            'seasonCount',
            'averageScore',
            'firstAiredYear'
          )
          .include('genres', (g) =>
            g.include('genre', (ge) => ge.select('id', 'name'))
          )
          .include('seasons', (s) =>
            s
              .select(
                'id',
                'seasonNumber',
                'titlePrimary',
                'titleSecondary',
                'episodeCount'
              )
              .orderBy((sn) => sn.seasonNumber.asc())
          )
      )
      .first()

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { tv, ...entryData } = entry
    const formattedMedia = tv
      ? {
          ...tv,
          genres: (tv.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
        }
      : null
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: formattedMedia,
    }
  }

  public static async upsertTvEntry(userId: string, tvId: number, body: any) {
    const tv = await prisma.orm.public.Tv.where({ id: tvId })
      .select('id', 'episodeCount', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()
    if (!tv) {
      throw new NotFound(`TV series with ID ${tvId} does not exist`)
    }

    const existing = await prisma.orm.public.TvList.where({ userId, tvId }).first()

    let progress = body.progress !== undefined ? Number(body.progress) : undefined
    if (progress !== undefined && tv.episodeCount && tv.episodeCount > 0) {
      progress = Math.min(progress, tv.episodeCount)
    }

    const startedAt = body.startedAt !== undefined ? (body.startedAt ? new Date(body.startedAt) : null) : undefined
    const completedAt = body.completedAt !== undefined ? (body.completedAt ? new Date(body.completedAt) : null) : undefined

    const updateData: any = {
      ...(body.status ? { status: body.status } : {}),
      ...(progress !== undefined ? { progress } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.notes !== undefined ? { notes: encryptNotes(body.notes, userId) } : {}),
      ...(body.rewatched !== undefined ? { rewatched: Number(body.rewatched) } : {}),
      ...(body.private !== undefined ? { private: Boolean(body.private) } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(body.rewatchHistory !== undefined ? { rewatchHistory: body.rewatchHistory } : {}),
      ...(body.connections !== undefined ? { connections: body.connections } : {}),
    }

    const entry = existing
      ? await prisma.orm.public.TvList.where({ id: existing.id }).update(updateData)
      : await prisma.orm.public.TvList.create({
          userId,
          tvId,
          status: body.status ?? 'PLANNED',
          progress: progress ?? 0,
          score: body.score ?? null,
          notes: encryptNotes(body.notes, userId),
          rewatched: body.rewatched ?? 0,
          private: body.private ?? false,
          startedAt: startedAt ?? null,
          completedAt: completedAt ?? null,
          rewatchHistory: body.rewatchHistory ?? null,
          connections: body.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to update TV list entry')
    }

    await MediaStatsServ.recalculateMediaStats('TV', tvId)

    emitListActivity({
      userId,
      mediaType: 'TV',
      mediaId: tvId,
      existing,
      incoming: body,
      media: tv,
    })

    const connectionsToSync = body.connections ?? entry.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'TV',
        mediaId: tvId,
        mediaTitle: tv.titlePrimary || (tv as any).titleSecondary || 'TV',
        entry: {
          status: entry.status,
          progress: entry.progress,
          score: entry.score,
          notes: decryptNotes(entry.notes, userId),
          rewatched: entry.rewatched,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: 'TV list entry updated successfully',
      entry: formatEntry(entry),
    }
  }

  public static async deleteTvEntry(userId: string, tvId: number) {
    const existing = await prisma.orm.public.TvList.where({ userId, tvId }).first()
    if (!existing) {
      throw new NotFound(`TV show with ID ${tvId} is not in user list`)
    }

    const tv = await prisma.orm.public.Tv.where({ id: tvId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()

    await prisma.orm.public.TvList.where({ id: existing.id }).delete()

    await MediaStatsServ.recalculateMediaStats('TV', tvId)

    if (tv) {
      emitListActivity({
        userId,
        mediaType: 'TV',
        mediaId: tvId,
        existing,
        incoming: {},
        media: tv,
        isDeleted: true,
      })
    }

    return {
      success: true,
      message: 'TV show removed from list successfully',
    }
  }

  public static async incrementTv(userId: string, tvId: number, body?: { count?: number; status?: string; connections?: any } | null) {
    const tv = await prisma.orm.public.Tv.where({ id: tvId })
      .select('id', 'episodeCount', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()
    if (!tv) {
      throw new NotFound(`TV series with ID ${tvId} does not exist`)
    }

    const existing = await prisma.orm.public.TvList.where({ userId, tvId }).first()

    const count = Math.max(1, body?.count ?? 1)
    const currentProgress = existing?.progress ?? 0
    let newProgress = currentProgress + count
    let newStatus = body?.status ?? existing?.status ?? 'IN_PROGRESS'
    let completedAt = existing?.completedAt ?? null

    if (newStatus !== 'IN_PROGRESS') {
      newStatus = 'IN_PROGRESS'
    }

    if (tv.episodeCount && tv.episodeCount > 0 && newProgress >= tv.episodeCount) {
      newProgress = tv.episodeCount
      newStatus = 'COMPLETED'
      if (!completedAt) {
        completedAt = new Date()
      }
    } else {
      completedAt = null
    }

    const entry = existing
      ? await prisma.orm.public.TvList.where({ id: existing.id }).update({
          status: newStatus as any,
          progress: newProgress,
          completedAt,
          ...(existing?.status === 'PLANNED' || !existing?.startedAt ? { startedAt: existing?.startedAt ?? new Date() } : {}),
          ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
        })
      : await prisma.orm.public.TvList.create({
          userId,
          tvId,
          status: newStatus as any,
          progress: newProgress,
          startedAt: new Date(),
          completedAt,
          connections: (body as any)?.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to increment TV list entry')
    }

    await MediaStatsServ.recalculateMediaStats('TV', tvId)

    emitListActivity({
      userId,
      mediaType: 'TV',
      mediaId: tvId,
      existing,
      incoming: { progress: newProgress, status: newStatus },
      media: tv,
    })

    const connectionsToSync = (body as any)?.connections ?? entry.connections ?? existing?.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'TV',
        mediaId: tvId,
        mediaTitle: tv.titlePrimary || (tv as any).titleSecondary || 'TV',
        entry: {
          status: entry.status,
          progress: entry.progress,
          score: existing?.score ?? null,
          notes: decryptNotes(existing?.notes, userId),
          rewatched: existing?.rewatched ?? 0,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: `Episode progress incremented to ${entry.progress}`,
      entry: formatEntry(entry),
    }
  }

  public static async getTvStats(userId: string, query?: any, isOwner: boolean = true) {
    let q = prisma.orm.public.TvList.where({ userId })
    if (!isOwner) {
      q = q.where({ private: false })
    }
    const items = await q.select('status', 'progress', 'score', 'rewatched').all()
    const data = await mediaStatsService.getTvStats(userId, isOwner, {
      year: query?.year ? Number(query.year) : undefined,
      quarter: query?.quarter ? Number(query.quarter) : undefined,
      month: query?.month ? Number(query.month) : undefined,
    })
    return {
      success: true,
      data,
      stats: computeStats(items, 'progress'),
    }
  }

  public static async getTvFilters(userId: string) {
    const rawItems = await prisma.orm.public.TvList.where({ userId })
      .select('status')
      .include('tv', (t) =>
        t
          .select('status', 'firstAiredYear')
          .include('genres', (g) =>
            g.include('genre', (ge) => ge.select('name'))
          )
      )
      .all()
    const items = rawItems.map((item) => ({
      status: item.status,
      tv: item.tv
        ? {
            ...item.tv,
            genres: (item.tv.genres || [])
              .filter((g: any) => Boolean(g.genre))
              .map((g: any) => ({ name: g.genre!.name })),
          }
        : null,
    }))
    return {
      success: true,
      ...computeFilters(items, 'tv', 'firstAiredYear'),
    }
  }

  // ===========================================================================
  // 5. Game Lists
  // ===========================================================================

  public static async getGameList(userId: string, query?: ListQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(250, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const order = query?.order === 'asc' ? 'asc' : 'desc'

    let q = prisma.orm.public.GameList.where({ userId })
    if (query?.status) {
      q = q.where({ status: query.status.trim().toUpperCase() as any })
    }
    if (query?.q) {
      const qPattern = `%${query.q.trim()}%`
      q = q.where((gl) => gl.game.some((g) => or(g.titlePrimary.ilike(qPattern), g.titleSecondary.ilike(qPattern))))
    }
    if (query?.mediaStatus) {
      const statuses = query.mediaStatus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      if (statuses.length > 0) {
        q = q.where((gl) => gl.game.some((g) => g.status.in(statuses as any)))
      }
    }
    if (query?.genre) {
      const genres = query.genre.split(',').map((g) => g.trim()).filter(Boolean)
      if (genres.length > 0) {
        q = q.where((gl) => gl.game.some((g) => g.genres.some((ge) => ge.genre.some((gn) => gn.name.in(genres)))))
      }
    }
    if (query?.year) {
      const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
      if (years.length > 0) {
        q = q.where((gl) => gl.game.some((g) => g.releaseDateYear.in(years)))
      }
    }

    let itemsQ = q
    if (query?.sortBy === 'title') {
      itemsQ = itemsQ.orderBy((gl) => (order === 'asc' ? gl.game.titlePrimary.asc() : gl.game.titlePrimary.desc()))
    } else if (query?.sortBy === 'score') {
      itemsQ = itemsQ.orderBy((gl) => (order === 'asc' ? gl.score.asc() : gl.score.desc()))
    } else if (query?.sortBy === 'progress') {
      itemsQ = itemsQ.orderBy((gl) => (order === 'asc' ? gl.progress.asc() : gl.progress.desc()))
    } else if (query?.sortBy === 'createdAt') {
      itemsQ = itemsQ.orderBy((gl) => (order === 'asc' ? gl.createdAt.asc() : gl.createdAt.desc()))
    } else {
      itemsQ = itemsQ.orderBy((gl) => (order === 'asc' ? gl.updatedAt.asc() : gl.updatedAt.desc()))
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('game', (g) =>
          g
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'bannerImage',
              'status',
              'platforms',
              'developers',
              'publishers',
              'averageScore',
              'releaseDateYear'
            )
            .include('genres', (ge) =>
              ge.include('genre', (gn) => gn.select('id', 'name'))
            )
        )
        .all(),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { game, ...entryData } = e
        const formattedMedia = game
          ? {
              ...game,
              genres: (game.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
            }
          : null
        return {
          entry: formatEntry(entryData),
          media: formattedMedia,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  public static async getGameEntry(userId: string, gameId: number) {
    const entry = await prisma.orm.public.GameList.where({ userId, gameId })
      .include('game', (g) =>
        g
          .select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'bannerImage',
            'status',
            'platforms',
            'developers',
            'publishers',
            'averageScore',
            'releaseDateYear'
          )
          .include('genres', (ge) =>
            ge.include('genre', (gn) => gn.select('id', 'name'))
          )
      )
      .first()

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { game, ...entryData } = entry
    const formattedMedia = game
      ? {
          ...game,
          genres: (game.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
        }
      : null
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: formattedMedia,
    }
  }

  public static async upsertGameEntry(userId: string, gameId: number, body: any) {
    const game = await prisma.orm.public.Game.where({ id: gameId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()
    if (!game) {
      throw new NotFound(`Game with ID ${gameId} does not exist`)
    }

    const existing = await prisma.orm.public.GameList.where({ userId, gameId }).first()

    const progress = body.progress !== undefined ? Number(body.progress) : undefined
    const startedAt = body.startedAt !== undefined ? (body.startedAt ? new Date(body.startedAt) : null) : undefined
    const completedAt = body.completedAt !== undefined ? (body.completedAt ? new Date(body.completedAt) : null) : undefined

    const updateData: any = {
      ...(body.status ? { status: body.status } : {}),
      ...(progress !== undefined ? { progress } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.notes !== undefined ? { notes: encryptNotes(body.notes, userId) } : {}),
      ...(body.replayed !== undefined ? { replayed: Number(body.replayed) } : {}),
      ...(body.private !== undefined ? { private: Boolean(body.private) } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(body.replayHistory !== undefined ? { replayHistory: body.replayHistory } : {}),
      ...(body.connections !== undefined ? { connections: body.connections } : {}),
    }

    const entry = existing
      ? await prisma.orm.public.GameList.where({ id: existing.id }).update(updateData)
      : await prisma.orm.public.GameList.create({
          userId,
          gameId,
          status: body.status ?? 'PLANNED',
          progress: progress ?? 0,
          score: body.score ?? null,
          notes: encryptNotes(body.notes, userId),
          replayed: body.replayed ?? 0,
          private: body.private ?? false,
          startedAt: startedAt ?? null,
          completedAt: completedAt ?? null,
          replayHistory: body.replayHistory ?? null,
          connections: body.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to update game list entry')
    }

    await MediaStatsServ.recalculateMediaStats('GAME', gameId)

    emitListActivity({
      userId,
      mediaType: 'GAME',
      mediaId: gameId,
      existing,
      incoming: body,
      media: game,
    })

    const connectionsToSync = body.connections ?? entry.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'GAME',
        mediaId: gameId,
        mediaTitle: game.titlePrimary || game.titleSecondary || 'Game',
        entry: {
          status: entry.status,
          progress: entry.progress,
          score: entry.score,
          notes: decryptNotes(entry.notes, userId),
          rewatched: entry.replayed,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: 'Game list entry updated successfully',
      entry: formatEntry(entry),
    }
  }

  public static async deleteGameEntry(userId: string, gameId: number) {
    const existing = await prisma.orm.public.GameList.where({ userId, gameId }).first()
    if (!existing) {
      throw new NotFound(`Game with ID ${gameId} is not in user list`)
    }

    const game = await prisma.orm.public.Game.where({ id: gameId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()

    await prisma.orm.public.GameList.where({ id: existing.id }).delete()

    await MediaStatsServ.recalculateMediaStats('GAME', gameId)

    if (game) {
      emitListActivity({
        userId,
        mediaType: 'GAME',
        mediaId: gameId,
        existing,
        incoming: {},
        media: game,
        isDeleted: true,
      })
    }

    return {
      success: true,
      message: 'Game removed from list successfully',
    }
  }

  public static async incrementGame(userId: string, gameId: number, body?: { count?: number; status?: string; connections?: any } | null) {
    const game = await prisma.orm.public.Game.where({ id: gameId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()
    if (!game) {
      throw new NotFound(`Game with ID ${gameId} does not exist`)
    }

    const existing = await prisma.orm.public.GameList.where({ userId, gameId }).first()

    const count = Math.max(1, body?.count ?? 1)
    const currentProgress = existing?.progress ?? 0
    const newProgress = currentProgress + count
    let newStatus = body?.status ?? existing?.status ?? 'IN_PROGRESS'

    if (newStatus !== 'IN_PROGRESS') {
      newStatus = 'IN_PROGRESS'
    }

    const entry = existing
      ? await prisma.orm.public.GameList.where({ id: existing.id }).update({
          status: newStatus as any,
          progress: newProgress,
          ...(existing?.status === 'PLANNED' || !existing?.startedAt ? { startedAt: existing?.startedAt ?? new Date() } : {}),
          ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
        })
      : await prisma.orm.public.GameList.create({
          userId,
          gameId,
          status: newStatus as any,
          progress: newProgress,
          startedAt: new Date(),
          connections: (body as any)?.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to increment game list entry')
    }

    await MediaStatsServ.recalculateMediaStats('GAME', gameId)

    emitListActivity({
      userId,
      mediaType: 'GAME',
      mediaId: gameId,
      existing,
      incoming: { progress: newProgress, status: newStatus },
      media: game,
    })

    const connectionsToSync = (body as any)?.connections ?? entry.connections ?? existing?.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'GAME',
        mediaId: gameId,
        mediaTitle: game.titlePrimary || game.titleSecondary || 'Game',
        entry: {
          status: entry.status,
          progress: entry.progress,
          score: existing?.score ?? null,
          notes: decryptNotes(existing?.notes, userId),
          rewatched: existing?.replayed ?? 0,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: `Playtime progress incremented to ${entry.progress} hours`,
      entry: formatEntry(entry),
    }
  }

  public static async getGameStats(userId: string, query?: any, isOwner: boolean = true) {
    let q = prisma.orm.public.GameList.where({ userId })
    if (!isOwner) {
      q = q.where({ private: false })
    }
    const items = await q.select('status', 'progress', 'score', 'replayed').all()
    const data = await mediaStatsService.getGameStats(userId, isOwner, {
      year: query?.year ? Number(query.year) : undefined,
      quarter: query?.quarter ? Number(query.quarter) : undefined,
      month: query?.month ? Number(query.month) : undefined,
    })
    return {
      success: true,
      data,
      stats: computeStats(items, 'progress'),
    }
  }

  public static async getGameFilters(userId: string) {
    const rawItems = await prisma.orm.public.GameList.where({ userId })
      .select('status')
      .include('game', (g) =>
        g
          .select('status', 'releaseDateYear')
          .include('genres', (ge) =>
            ge.include('genre', (gn) => gn.select('name'))
          )
      )
      .all()
    const items = rawItems.map((item) => ({
      status: item.status,
      game: item.game
        ? {
            ...item.game,
            genres: (item.game.genres || [])
              .filter((g: any) => Boolean(g.genre))
              .map((g: any) => ({ name: g.genre!.name })),
          }
        : null,
    }))
    return {
      success: true,
      ...computeFilters(items, 'game', 'releaseDateYear'),
    }
  }

  // ===========================================================================
  // 6. Book Lists
  // ===========================================================================

  public static async getBookList(userId: string, query?: ListQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(250, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const order = query?.order === 'asc' ? 'asc' : 'desc'

    let q = prisma.orm.public.BookList.where({ userId })
    if (query?.status) {
      q = q.where({ status: query.status.trim().toUpperCase() as any })
    }
    if (query?.q) {
      const qPattern = `%${query.q.trim()}%`
      q = q.where((bl) => bl.book.some((b) => or(b.titlePrimary.ilike(qPattern), b.titleSecondary.ilike(qPattern))))
    }
    const formatStr = query?.format || query?.mediaFormat
    if (formatStr) {
      const formats = formatStr.split(',').map((f) => f.trim()).filter(Boolean)
      if (formats.length > 0) {
        q = q.where((bl) => bl.book.some((b) => b.format.in(formats as any)))
      }
    }
    if (query?.mediaStatus) {
      const statuses = query.mediaStatus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      if (statuses.length > 0) {
        q = q.where((bl) => bl.book.some((b) => b.status.in(statuses as any)))
      }
    }
    if (query?.genre) {
      const genres = query.genre.split(',').map((g) => g.trim()).filter(Boolean)
      if (genres.length > 0) {
        q = q.where((bl) => bl.book.some((b) => b.genres.some((ge) => ge.genre.some((gn) => gn.name.in(genres)))))
      }
    }
    if (query?.year) {
      const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
      if (years.length > 0) {
        q = q.where((bl) => bl.book.some((b) => b.releaseDateYear.in(years)))
      }
    }

    let itemsQ = q
    if (query?.sortBy === 'title') {
      itemsQ = itemsQ.orderBy((bl) => (order === 'asc' ? bl.book.titlePrimary.asc() : bl.book.titlePrimary.desc()))
    } else if (query?.sortBy === 'score') {
      itemsQ = itemsQ.orderBy((bl) => (order === 'asc' ? bl.score.asc() : bl.score.desc()))
    } else if (query?.sortBy === 'progress') {
      itemsQ = itemsQ.orderBy((bl) => (order === 'asc' ? bl.progressPages.asc() : bl.progressPages.desc()))
    } else if (query?.sortBy === 'createdAt') {
      itemsQ = itemsQ.orderBy((bl) => (order === 'asc' ? bl.createdAt.asc() : bl.createdAt.desc()))
    } else {
      itemsQ = itemsQ.orderBy((bl) => (order === 'asc' ? bl.updatedAt.asc() : bl.updatedAt.desc()))
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('book', (b) =>
          b
            .select(
              'id',
              'titlePrimary',
              'titleSecondary',
              'subtitle',
              'coverImage',
              'bannerImage',
              'format',
              'status',
              'pageCount',
              'chapterCount',
              'volumeCount',
              'authors',
              'averageScore',
              'releaseDateYear'
            )
            .include('genres', (ge) =>
              ge.include('genre', (gn) => gn.select('id', 'name'))
            )
        )
        .all(),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { book, ...entryData } = e
        const formattedMedia = book
          ? {
              ...book,
              genres: (book.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
            }
          : null
        return {
          entry: formatEntry(entryData),
          media: formattedMedia,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  public static async getBookEntry(userId: string, bookId: number) {
    const entry = await prisma.orm.public.BookList.where({ userId, bookId })
      .include('book', (b) =>
        b
          .select(
            'id',
            'titlePrimary',
            'titleSecondary',
            'subtitle',
            'coverImage',
            'bannerImage',
            'format',
            'status',
            'pageCount',
            'chapterCount',
            'volumeCount',
            'authors',
            'averageScore',
            'releaseDateYear'
          )
          .include('genres', (ge) =>
            ge.include('genre', (gn) => gn.select('id', 'name'))
          )
      )
      .first()

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { book, ...entryData } = entry
    const formattedMedia = book
      ? {
          ...book,
          genres: (book.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
        }
      : null
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: formattedMedia,
    }
  }

  public static async upsertBookEntry(userId: string, bookId: number, body: any) {
    const book = await prisma.orm.public.Book.where({ id: bookId })
      .select('id', 'pageCount', 'chapterCount', 'volumeCount', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage')
      .first()
    if (!book) {
      throw new NotFound(`Book with ID ${bookId} does not exist`)
    }

    const existing = await prisma.orm.public.BookList.where({ userId, bookId }).first()

    let progressPages = body.progressPages !== undefined ? Number(body.progressPages) : undefined
    if (progressPages !== undefined && book.pageCount && book.pageCount > 0) {
      progressPages = Math.min(progressPages, book.pageCount)
    }

    const progressChapters = body.progressChapters !== undefined ? Number(body.progressChapters) : undefined
    const progressVolumes = body.progressVolumes !== undefined ? Number(body.progressVolumes) : undefined
    const startedAt = body.startedAt !== undefined ? (body.startedAt ? new Date(body.startedAt) : null) : undefined
    const completedAt = body.completedAt !== undefined ? (body.completedAt ? new Date(body.completedAt) : null) : undefined

    const updateData: any = {
      ...(body.status ? { status: body.status } : {}),
      ...(progressPages !== undefined ? { progressPages } : {}),
      ...(progressChapters !== undefined ? { progressChapters } : {}),
      ...(progressVolumes !== undefined ? { progressVolumes } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.notes !== undefined ? { notes: encryptNotes(body.notes, userId) } : {}),
      ...(body.reread !== undefined ? { reread: Number(body.reread) } : {}),
      ...(body.private !== undefined ? { private: Boolean(body.private) } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(body.rereadHistory !== undefined ? { rereadHistory: body.rereadHistory } : {}),
      ...(body.connections !== undefined ? { connections: body.connections } : {}),
    }

    const entry = existing
      ? await prisma.orm.public.BookList.where({ id: existing.id }).update(updateData)
      : await prisma.orm.public.BookList.create({
          userId,
          bookId,
          status: body.status ?? 'PLANNED',
          progressPages: progressPages ?? 0,
          progressChapters: progressChapters ?? 0,
          progressVolumes: progressVolumes ?? 0,
          score: body.score ?? null,
          notes: encryptNotes(body.notes, userId),
          reread: body.reread ?? 0,
          private: body.private ?? false,
          startedAt: startedAt ?? null,
          completedAt: completedAt ?? null,
          rereadHistory: body.rereadHistory ?? null,
          connections: body.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to update book list entry')
    }

    await MediaStatsServ.recalculateMediaStats('BOOK', bookId)

    emitListActivity({
      userId,
      mediaType: 'BOOK',
      mediaId: bookId,
      existing,
      incoming: body,
      media: book,
    })

    const connectionsToSync = body.connections ?? entry.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'BOOK',
        mediaId: bookId,
        mediaTitle: book.titlePrimary || book.titleSecondary || 'Book',
        entry: {
          status: entry.status,
          progress: entry.progressChapters || entry.progressPages || entry.progressVolumes || 0,
          score: entry.score,
          notes: decryptNotes(entry.notes, userId),
          rewatched: entry.reread,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: 'Book list entry updated successfully',
      entry: formatEntry(entry),
    }
  }

  public static async deleteBookEntry(userId: string, bookId: number) {
    const existing = await prisma.orm.public.BookList.where({ userId, bookId }).first()
    if (!existing) {
      throw new NotFound(`Book with ID ${bookId} is not in user list`)
    }

    const book = await prisma.orm.public.Book.where({ id: bookId })
      .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage', 'format')
      .first()

    await prisma.orm.public.BookList.where({ id: existing.id }).delete()

    await MediaStatsServ.recalculateMediaStats('BOOK', bookId)

    emitListActivity({
      userId,
      mediaType: 'BOOK',
      mediaId: bookId,
      existing,
      media: book,
      isDeleted: true,
    })

    return {
      success: true,
      message: 'Book removed from list successfully',
    }
  }

  public static async incrementBook(
    userId: string,
    bookId: number,
    body?: { count?: number; type?: 'page' | 'chapter' | 'volume'; status?: string; connections?: any } | null
  ) {
    const book = await prisma.orm.public.Book.where({ id: bookId })
      .select('id', 'pageCount', 'chapterCount', 'volumeCount', 'titlePrimary', 'titleSecondary', 'coverImage', 'bannerImage', 'format')
      .first()
    if (!book) {
      throw new NotFound(`Book with ID ${bookId} does not exist`)
    }

    const existing = await prisma.orm.public.BookList.where({ userId, bookId }).first()

    const count = Math.max(1, body?.count ?? 1)
    const type = body?.type ?? 'page'
    let progressPages = existing?.progressPages ?? 0
    let progressChapters = existing?.progressChapters ?? 0
    let progressVolumes = existing?.progressVolumes ?? 0
    let newStatus = body?.status ?? existing?.status ?? 'IN_PROGRESS'
    let completedAt = existing?.completedAt ?? null

    if (newStatus !== 'IN_PROGRESS') {
      newStatus = 'IN_PROGRESS'
    }

    if (type === 'chapter') {
      progressChapters += count
      if (book.chapterCount && book.chapterCount > 0 && progressChapters >= book.chapterCount) {
        progressChapters = book.chapterCount
        newStatus = 'COMPLETED'
        if (!completedAt) {
          completedAt = new Date()
        }
      } else {
        completedAt = null
      }
    } else if (type === 'volume') {
      progressVolumes += count
      if (book.volumeCount && book.volumeCount > 0 && progressVolumes >= book.volumeCount) {
        progressVolumes = book.volumeCount
        newStatus = 'COMPLETED'
        if (!completedAt) {
          completedAt = new Date()
        }
      } else {
        completedAt = null
      }
    } else {
      progressPages += count
      if (book.pageCount && book.pageCount > 0 && progressPages >= book.pageCount) {
        progressPages = book.pageCount
        newStatus = 'COMPLETED'
        if (!completedAt) {
          completedAt = new Date()
        }
      } else {
        completedAt = null
      }
    }

    const entry = existing
      ? await prisma.orm.public.BookList.where({ id: existing.id }).update({
          status: newStatus as any,
          progressPages,
          progressChapters,
          progressVolumes,
          completedAt,
          ...(existing?.status === 'PLANNED' || !existing?.startedAt ? { startedAt: existing?.startedAt ?? new Date() } : {}),
          ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
        })
      : await prisma.orm.public.BookList.create({
          userId,
          bookId,
          status: newStatus as any,
          progressPages,
          progressChapters,
          progressVolumes,
          startedAt: new Date(),
          completedAt,
          connections: (body as any)?.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to increment book list entry')
    }

    await MediaStatsServ.recalculateMediaStats('BOOK', bookId)

    emitListActivity({
      userId,
      mediaType: 'BOOK',
      mediaId: bookId,
      existing,
      incoming: {
        status: entry.status,
        progressPages: entry.progressPages,
        progressChapters: entry.progressChapters,
        progressVolumes: entry.progressVolumes,
      },
      media: book,
    })

    const connectionsToSync = (body as any)?.connections ?? entry.connections ?? existing?.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'BOOK',
        mediaId: bookId,
        mediaTitle: book.titlePrimary || book.titleSecondary || 'Book',
        entry: {
          status: entry.status,
          progress: entry.progressChapters || entry.progressPages || entry.progressVolumes || 0,
          score: existing?.score ?? null,
          notes: decryptNotes(existing?.notes, userId),
          rewatched: existing?.reread ?? 0,
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: `Progress incremented to ${type === 'chapter' ? `${progressChapters} chapters` : type === 'volume' ? `${progressVolumes} volumes` : `${progressPages} pages`}`,
      entry: formatEntry(entry),
    }
  }

  public static async getBookStats(userId: string, query?: any, isOwner: boolean = true) {
    let q = prisma.orm.public.BookList.where({ userId })
    if (!isOwner) {
      q = q.where({ private: false })
    }
    const items = await q.select('status', 'progressPages', 'progressChapters', 'progressVolumes', 'score', 'reread').all()
    const data = await mediaStatsService.getBookStats(userId, isOwner, {
      year: query?.year ? Number(query.year) : undefined,
      quarter: query?.quarter ? Number(query.quarter) : undefined,
      month: query?.month ? Number(query.month) : undefined,
    })
    return {
      success: true,
      data,
      stats: computeStats(items, 'progressPages'),
    }
  }

  public static async getBookFilters(userId: string) {
    const rawItems = await prisma.orm.public.BookList.where({ userId })
      .select('status')
      .include('book', (b) =>
        b
          .select('format', 'status', 'releaseDateYear')
          .include('genres', (ge) =>
            ge.include('genre', (gn) => gn.select('name'))
          )
      )
      .all()
    const items = rawItems.map((item) => ({
      status: item.status,
      book: item.book
        ? {
            ...item.book,
            genres: (item.book.genres || [])
              .filter((g: any) => Boolean(g.genre))
              .map((g: any) => ({ name: g.genre!.name })),
          }
        : null,
    }))
    return {
      success: true,
      ...computeFilters(items, 'book', 'releaseDateYear'),
    }
  }

  // ===========================================================================
  // 7. Music Lists
  // ===========================================================================

  public static async getMusicList(userId: string, query?: ListQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(250, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit
    const order = query?.order === 'asc' ? 'asc' : 'desc'

    let q = prisma.orm.public.MusicList.where({ userId })
    if (query?.status) {
      q = q.where({ status: query.status.trim().toUpperCase() as any })
    }
    if (query?.q) {
      const qPattern = `%${query.q.trim()}%`
      q = q.where((ml) => ml.music.some((m) => or(m.titlePrimary.ilike(qPattern), m.titleSecondary.ilike(qPattern), m.artistName.ilike(qPattern))))
    }
    const formatStr = query?.format || query?.mediaFormat
    if (formatStr) {
      const formats = formatStr.split(',').map((f) => f.trim().toUpperCase()).filter(Boolean)
      if (formats.length > 0) {
        q = q.where((ml) => ml.music.some((m) => m.type.in(formats as any)))
      }
    }
    if (query?.mediaStatus) {
      const statuses = query.mediaStatus.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      if (statuses.length > 0) {
        q = q.where((ml) => ml.music.some((m) => m.status.in(statuses as any)))
      }
    }
    if (query?.genre) {
      const genres = query.genre.split(',').map((g) => g.trim()).filter(Boolean)
      if (genres.length > 0) {
        q = q.where((ml) => ml.music.some((m) => m.genres.some((ge) => ge.genre.some((gn) => gn.name.in(genres)))))
      }
    }
    if (query?.year) {
      const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
      if (years.length > 0) {
        q = q.where((ml) => ml.music.some((m) => m.releaseDateYear.in(years)))
      }
    }

    let itemsQ = q
    if (query?.sortBy === 'title') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.music.titlePrimary.asc() : ml.music.titlePrimary.desc()))
    } else if (query?.sortBy === 'score') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.score.asc() : ml.score.desc()))
    } else if (query?.sortBy === 'progress' || query?.sortBy === 'playCount') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.playCount.asc() : ml.playCount.desc()))
    } else if (query?.sortBy === 'createdAt') {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.createdAt.asc() : ml.createdAt.desc()))
    } else {
      itemsQ = itemsQ.orderBy((ml) => (order === 'asc' ? ml.updatedAt.asc() : ml.updatedAt.desc()))
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('music', (m) =>
          m
            .select(
              'id',
              'type',
              'titlePrimary',
              'titleSecondary',
              'titleNative',
              'coverImage',
              'duration',
              'artistName',
              'recordType',
              'status',
              'releaseDateYear'
            )
            .include('genres', (ge) =>
              ge.include('genre', (gn) => gn.select('id', 'name'))
            )
        )
        .all(),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { music, ...entryData } = e
        const formattedMedia = music
          ? {
              ...music,
              genres: (music.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
            }
          : null
        return {
          entry: formatEntry(entryData),
          media: formattedMedia,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    }
  }

  public static async getMusicEntry(userId: string, musicId: number) {
    const entry = await prisma.orm.public.MusicList.where({ userId, musicId })
      .include('music', (m) =>
        m
          .select(
            'id',
            'type',
            'titlePrimary',
            'titleSecondary',
            'titleNative',
            'coverImage',
            'duration',
            'artistName',
            'recordType',
            'status',
            'releaseDateYear'
          )
          .include('genres', (ge) =>
            ge.include('genre', (gn) => gn.select('id', 'name'))
          )
      )
      .first()

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { music, ...entryData } = entry
    const formattedMedia = music
      ? {
          ...music,
          genres: (music.genres || []).filter((g: any) => Boolean(g.genre)).map((g: any) => ({ id: g.genre!.id, name: g.genre!.name })),
        }
      : null
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: formattedMedia,
    }
  }

  public static async upsertMusicEntry(userId: string, musicId: number, body: any) {
    const music = await prisma.orm.public.Music.where({ id: musicId })
      .select('id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage', 'type')
      .first()
    if (!music) {
      throw new NotFound(`Music with ID ${musicId} does not exist`)
    }

    const existing = await prisma.orm.public.MusicList.where({ userId, musicId }).first()

    const startedAt = body.startedAt !== undefined ? (body.startedAt ? new Date(body.startedAt) : null) : undefined
    const completedAt = body.completedAt !== undefined ? (body.completedAt ? new Date(body.completedAt) : null) : undefined

    const updateData: any = {
      ...(body.status ? { status: body.status } : {}),
      ...(body.score !== undefined ? { score: body.score } : {}),
      ...(body.playCount !== undefined ? { playCount: Number(body.playCount) } : {}),
      ...(body.notes !== undefined ? { notes: encryptNotes(body.notes, userId) } : {}),
      ...(body.private !== undefined ? { private: Boolean(body.private) } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(body.connections !== undefined ? { connections: body.connections } : {}),
    }

    const entry = existing
      ? await prisma.orm.public.MusicList.where({ id: existing.id }).update(updateData)
      : await prisma.orm.public.MusicList.create({
          userId,
          musicId,
          status: body.status ?? 'PLANNED',
          score: body.score ?? null,
          playCount: body.playCount !== undefined ? Number(body.playCount) : 0,
          notes: encryptNotes(body.notes, userId),
          private: body.private ?? false,
          startedAt: startedAt ?? null,
          completedAt: completedAt ?? null,
          connections: body.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to update music list entry')
    }

    await MediaStatsServ.recalculateMediaStats('MUSIC', musicId)

    emitListActivity({
      userId,
      mediaType: 'MUSIC',
      mediaId: musicId,
      existing: existing ? { ...existing, progress: existing.playCount } : null,
      incoming: {
        ...body,
        progress: body.playCount !== undefined ? Number(body.playCount) : undefined,
      },
      media: {
        titlePrimary: music.titlePrimary,
        titleSecondary: music.titleSecondary,
        titleNative: music.titleNative,
        coverImage: music.coverImage,
        format: music.type,
      },
    })

    const connectionsToSync = body.connections ?? entry.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'MUSIC',
        mediaId: musicId,
        mediaTitle: music.titlePrimary || music.titleSecondary || 'Music',
        entry: {
          status: entry.status,
          progress: entry.playCount,
          score: entry.score,
          notes: decryptNotes(entry.notes, userId),
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: 'Music list entry updated successfully',
      entry: formatEntry(entry),
    }
  }

  public static async deleteMusicEntry(userId: string, musicId: number) {
    const existing = await prisma.orm.public.MusicList.where({ userId, musicId }).first()
    if (!existing) {
      throw new NotFound(`Music with ID ${musicId} is not in user list`)
    }

    const music = await prisma.orm.public.Music.where({ id: musicId })
      .select('id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage', 'type')
      .first()

    await prisma.orm.public.MusicList.where({ id: existing.id }).delete()

    await MediaStatsServ.recalculateMediaStats('MUSIC', musicId)

    emitListActivity({
      userId,
      mediaType: 'MUSIC',
      mediaId: musicId,
      existing: { ...existing, progress: existing.playCount },
      media: {
        titlePrimary: music?.titlePrimary,
        titleSecondary: music?.titleSecondary,
        titleNative: music?.titleNative,
        coverImage: music?.coverImage,
        format: music?.type,
      },
      isDeleted: true,
    })

    return {
      success: true,
      message: 'Music removed from list successfully',
    }
  }

  public static async incrementMusic(userId: string, musicId: number, body?: { count?: number; connections?: any } | null) {
    const music = await prisma.orm.public.Music.where({ id: musicId })
      .select('id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage', 'type')
      .first()
    if (!music) {
      throw new NotFound(`Music with ID ${musicId} does not exist`)
    }

    const existing = await prisma.orm.public.MusicList.where({ userId, musicId }).first()

    const count = Math.max(1, body?.count ?? 1)
    const newPlayCount = (existing?.playCount ?? 0) + count
    let newStatus = existing?.status ?? 'IN_PROGRESS'
    if (newStatus !== 'IN_PROGRESS') {
      newStatus = 'IN_PROGRESS'
    }

    const entry = existing
      ? await prisma.orm.public.MusicList.where({ id: existing.id }).update({
          status: newStatus as any,
          playCount: newPlayCount,
          ...(existing?.status === 'PLANNED' || !existing?.startedAt ? { startedAt: existing?.startedAt ?? new Date() } : {}),
          ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
        })
      : await prisma.orm.public.MusicList.create({
          userId,
          musicId,
          status: newStatus as any,
          playCount: newPlayCount,
          startedAt: new Date(),
          connections: (body as any)?.connections ?? null,
        })

    if (!entry) {
      throw new Error('Failed to increment music list entry')
    }

    await MediaStatsServ.recalculateMediaStats('MUSIC', musicId)

    emitListActivity({
      userId,
      mediaType: 'MUSIC',
      mediaId: musicId,
      existing: existing ? { ...existing, progress: existing.playCount } : null,
      incoming: {
        status: entry.status,
        progress: entry.playCount,
      },
      media: {
        titlePrimary: music.titlePrimary,
        titleSecondary: music.titleSecondary,
        titleNative: music.titleNative,
        coverImage: music.coverImage,
        format: music.type,
      },
    })

    const connectionsToSync = (body as any)?.connections ?? entry.connections ?? existing?.connections
    if (connectionsToSync) {
      ConnectionSyncQueueManager.enqueueSyncJobs({
        userId,
        mediaType: 'MUSIC',
        mediaId: musicId,
        mediaTitle: music.titlePrimary || music.titleSecondary || 'Music',
        entry: {
          status: entry.status,
          progress: entry.playCount,
          score: existing?.score ?? null,
          notes: decryptNotes(existing?.notes, userId),
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
        },
        connections: connectionsToSync,
      }).catch(() => {})
    }

    return {
      success: true,
      message: `Listen count incremented to ${entry.playCount}`,
      entry: formatEntry(entry),
    }
  }

  public static async getMusicStats(userId: string, query?: any, isOwner: boolean = true) {
    let q = prisma.orm.public.MusicList.where({ userId })
    if (!isOwner) {
      q = q.where({ private: false })
    }
    const items = await q.select('status', 'playCount', 'score').all()
    const data = await mediaStatsService.getMusicStats(userId, isOwner, {
      year: query?.year ? Number(query.year) : undefined,
      quarter: query?.quarter ? Number(query.quarter) : undefined,
      month: query?.month ? Number(query.month) : undefined,
    })
    return {
      success: true,
      data,
      stats: computeStats(items, 'playCount'),
    }
  }

  public static async getMusicFilters(userId: string) {
    const rawItems = await prisma.orm.public.MusicList.where({ userId })
      .select('status')
      .include('music', (m) =>
        m
          .select('type', 'status', 'releaseDateYear')
          .include('genres', (ge) =>
            ge.include('genre', (gn) => gn.select('name'))
          )
      )
      .all()
    const items = rawItems.map((item) => ({
      status: item.status,
      music: item.music
        ? {
            ...item.music,
            genres: (item.music.genres || [])
              .filter((g: any) => Boolean(g.genre))
              .map((g: any) => ({ name: g.genre!.name })),
          }
        : null,
    }))
    return {
      success: true,
      ...computeFilters(items, 'music', 'releaseDateYear'),
    }
  }

  // ===========================================================================
  // 8. Other Lists
  // ===========================================================================

  public static async getOtherList(userId: string, query?: ListQuery) {
    const page = Math.max(1, Number(query?.page ?? 1))
    const limit = Math.max(1, Math.min(250, Number(query?.limit ?? 40)))
    const skip = (page - 1) * limit

    let q = prisma.orm.public.OtherList.where({ userId })
    if (query?.status && query.status !== 'ALL') {
      q = q.where({ status: query.status as ListStatus })
    }
    if (query?.q) {
      const qPattern = `%${query.q.trim()}%`
      q = q.where((ol) => ol.other.some((o) => o.titlePrimary.ilike(qPattern)))
    }
    const formatStr = query?.format || query?.mediaFormat
    if (formatStr) {
      const formats = formatStr.split(',').map((f) => f.trim().toLowerCase()).filter(Boolean)
      if (formats.length > 0) {
        q = q.where((ol) => ol.other.some((o) => o.format.in(formats as any)))
      }
    }
    if (query?.year) {
      const years = query.year.split(',').map((y) => Number(y.trim())).filter((n) => !isNaN(n))
      if (years.length > 0) {
        q = q.where((ol) =>
          ol.other.some((o) =>
            or(
              ...years.map((y) =>
                and(o.startDate.gte(new Date(y, 0, 1)), o.startDate.lte(new Date(y, 11, 31, 23, 59, 59, 999)))
              )
            )
          )
        )
      }
    }

    let itemsQ = q
    const sortField = query?.sortBy ?? 'updatedAt'
    const sortOrder = query?.order ?? 'desc'
    if (sortField === 'score') {
      itemsQ = itemsQ.orderBy((ol) => (sortOrder === 'asc' ? ol.score.asc() : ol.score.desc()))
    } else if (sortField === 'createdAt') {
      itemsQ = itemsQ.orderBy((ol) => (sortOrder === 'asc' ? ol.createdAt.asc() : ol.createdAt.desc()))
    } else if (sortField === 'title') {
      itemsQ = itemsQ.orderBy((ol) => (sortOrder === 'asc' ? ol.other.titlePrimary.asc() : ol.other.titlePrimary.desc()))
    } else {
      itemsQ = itemsQ.orderBy((ol) => (sortOrder === 'asc' ? ol.updatedAt.asc() : ol.updatedAt.desc()))
    }

    const [total, entries] = await Promise.all([
      countOf(q),
      itemsQ
        .offset(skip)
        .limit(limit)
        .include('other')
        .all(),
    ])

    const totalPages = Math.ceil(total / limit) || 1
    const items = entries.map((e) => {
      const incKey = e.other?.incrementFieldKey
      const prog =
        incKey && (e.progressValues as any)?.[incKey] !== undefined
          ? Number((e.progressValues as any)[incKey])
          : 0
      return {
        entry: {
          ...e,
          progress: prog,
        },
        media: e.other,
      }
    })

    return {
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    }
  }

  public static async getOtherEntry(userId: string, otherId: number) {
    const existing = await prisma.orm.public.OtherList.where({ userId, otherId })
      .include('other')
      .first()

    if (existing) {
      const incKey = existing.other?.incrementFieldKey
      const prog =
        incKey && (existing.progressValues as any)?.[incKey] !== undefined
          ? Number((existing.progressValues as any)[incKey])
          : 0
      return {
        success: true,
        inList: true,
        entry: {
          ...existing,
          progress: prog,
        },
        media: existing.other,
      }
    }

    const item = await prisma.orm.public.Other.where({ id: otherId }).first()

    return {
      success: true,
      inList: false,
      entry: null,
      media: item,
    }
  }

  public static async upsertOtherEntry(userId: string, otherId: number, body: any) {
    const item = await prisma.orm.public.Other.where({ id: otherId }).first()
    if (!item) {
      throw new NotFound(`Custom item with ID ${otherId} does not exist`)
    }

    const existing = await prisma.orm.public.OtherList.where({ userId, otherId }).first()

    const status = body?.status ?? existing?.status ?? 'PLANNED'
    const incKey = item.incrementFieldKey || 'progress'

    let progressValues: any =
      body?.progressValues !== undefined
        ? body.progressValues
        : (existing?.progressValues as any) || {}

    if (body?.progress !== undefined) {
      progressValues = {
        ...progressValues,
        [incKey]: Number(body.progress),
      }
    }

    const startedAt =
      body?.startedAt !== undefined
        ? body.startedAt
          ? new Date(body.startedAt)
          : null
        : status === 'IN_PROGRESS' && !existing?.startedAt
          ? new Date()
          : existing?.startedAt ?? null

    const completedAt =
      body?.completedAt !== undefined
        ? body.completedAt
          ? new Date(body.completedAt)
          : null
        : status === 'COMPLETED' && !existing?.completedAt
          ? new Date()
          : existing?.completedAt ?? null

    const entry = existing
      ? await prisma.orm.public.OtherList.where({ id: existing.id }).update({
          status,
          progressValues,
          score: body?.score !== undefined ? body.score : undefined,
          notes: body?.notes !== undefined ? body.notes : undefined,
          private: body?.private !== undefined ? Boolean(body.private) : undefined,
          startedAt,
          completedAt,
        })
      : await prisma.orm.public.OtherList.create({
          userId,
          otherId,
          status,
          progressValues,
          score: body?.score !== undefined ? body.score : null,
          notes: body?.notes !== undefined ? body.notes : null,
          private: body?.private !== undefined ? Boolean(body.private) : false,
          startedAt,
          completedAt,
        })

    if (!entry) {
      throw new Error('Failed to update other list entry')
    }

    await MediaStatsServ.recalculateMediaStats('OTHER', otherId)

    const prog = (entry.progressValues as any)?.[incKey] ?? 0

    emitListActivity({
      userId,
      mediaType: 'OTHER',
      mediaId: otherId,
      existing: existing
        ? {
            ...existing,
            progress: (existing.progressValues as any)?.[incKey] ?? 0,
          }
        : null,
      incoming: {
        status,
        progress: prog,
        score: body?.score !== undefined ? body.score : undefined,
        private: body?.private !== undefined ? Boolean(body.private) : undefined,
      },
      media: {
        titlePrimary: item.titlePrimary,
        titleSecondary: item.titleSecondary,
        coverImage: item.coverImage,
        bannerImage: item.bannerImage,
        format: item.format,
      },
    })

    return {
      success: true,
      message: 'Other list entry updated successfully',
      entry: {
        ...entry,
        progress: Number(prog),
      },
    }
  }

  public static async deleteOtherEntry(userId: string, otherId: number) {
    const existing = await prisma.orm.public.OtherList.where({ userId, otherId })
      .include('other')
      .first()

    await prisma.orm.public.OtherList.where({ userId, otherId }).deleteAll()

    await MediaStatsServ.recalculateMediaStats('OTHER', otherId)

    if (existing) {
      const incKey = existing.other?.incrementFieldKey || 'progress'
      emitListActivity({
        userId,
        mediaType: 'OTHER',
        mediaId: otherId,
        existing: {
          ...existing,
          progress: (existing.progressValues as any)?.[incKey] ?? 0,
        },
        media: {
          titlePrimary: existing.other?.titlePrimary,
          titleSecondary: existing.other?.titleSecondary,
          coverImage: existing.other?.coverImage,
          bannerImage: existing.other?.bannerImage,
          format: existing.other?.format,
        },
        isDeleted: true,
      })
    }

    return {
      success: true,
      message: 'Item removed from other list successfully',
    }
  }

  public static async incrementOther(
    userId: string,
    otherId: number,
    body?: { count?: number; status?: string } | null
  ) {
    const item = await prisma.orm.public.Other.where({ id: otherId }).first()
    if (!item) {
      throw new NotFound(`Custom item with ID ${otherId} does not exist`)
    }

    const existing = await prisma.orm.public.OtherList.where({ userId, otherId }).first()

    const incKey =
      item.incrementFieldKey || (item.progressFields as any[])?.[0]?.key || 'progress'
    const fieldSpec = ((item.progressFields as any[]) || []).find(
      (f: any) => f.key === incKey
    )
    const maxVal = fieldSpec?.max ?? null

    const count = Math.max(1, body?.count ?? 1)
    const currentProgValues = (existing?.progressValues as Record<string, number>) || {}
    const currentVal = Number(currentProgValues[incKey] || 0)
    let newVal = currentVal + count
    let newStatus = (body?.status ?? existing?.status ?? 'IN_PROGRESS') as ListStatus
    let completedAt = existing?.completedAt ?? null

    if (newStatus !== 'IN_PROGRESS') {
      newStatus = 'IN_PROGRESS'
    }

    if (maxVal && maxVal > 0 && newVal >= maxVal) {
      newVal = maxVal
      newStatus = 'COMPLETED'
      if (!completedAt) {
        completedAt = new Date()
      }
    } else {
      completedAt = null
    }

    const updatedProgValues = {
      ...currentProgValues,
      [incKey]: newVal,
    }

    const entry = existing
      ? await prisma.orm.public.OtherList.where({ id: existing.id }).update({
          status: newStatus,
          progressValues: updatedProgValues,
          completedAt,
          ...(existing?.status === 'PLANNED' || !existing?.startedAt ? { startedAt: existing?.startedAt ?? new Date() } : {}),
        })
      : await prisma.orm.public.OtherList.create({
          userId,
          otherId,
          status: newStatus,
          progressValues: updatedProgValues,
          startedAt: new Date(),
          completedAt,
        })

    if (!entry) {
      throw new Error('Failed to increment other list entry')
    }

    await MediaStatsServ.recalculateMediaStats('OTHER', otherId)

    emitListActivity({
      userId,
      mediaType: 'OTHER',
      mediaId: otherId,
      existing: existing
        ? {
            ...existing,
            progress: currentVal,
          }
        : null,
      incoming: {
        status: newStatus,
        progress: newVal,
      },
      media: {
        titlePrimary: item.titlePrimary,
        titleSecondary: item.titleSecondary,
        coverImage: item.coverImage,
        bannerImage: item.bannerImage,
        format: item.format,
      },
    })

    return {
      success: true,
      message: `Custom progress incremented by ${count}`,
      entry: {
        ...entry,
        progress: newVal,
      },
    }
  }

  public static async getOtherStats(userId: string) {
    const entries = await prisma.orm.public.OtherList.where({ userId })
      .include('other')
      .all()

    const total = entries.length
    const statusCounts: Record<string, number> = {}
    let totalScore = 0
    let scoredCount = 0
    let totalProgress = 0
    const scoreBuckets: Record<number, number> = {}

    for (let i = 1; i <= 10; i++) {
      scoreBuckets[i] = 0
    }

    for (const e of entries) {
      if (e.status) {
        statusCounts[e.status] = (statusCounts[e.status] || 0) + 1
      }
      if (e.score !== null && e.score !== undefined && e.score > 0) {
        totalScore += e.score
        scoredCount++
        const rounded = Math.min(10, Math.max(1, Math.round(e.score)))
        scoreBuckets[rounded] = (scoreBuckets[rounded] || 0) + 1
      }
      const incKey = e.other?.incrementFieldKey
      const val =
        incKey && (e.progressValues as any)?.[incKey]
          ? Number((e.progressValues as any)[incKey])
          : 0
      totalProgress += val
    }

    const meanScore =
      scoredCount > 0 ? Number((totalScore / scoredCount).toFixed(2)) : 0
    const scoreDistribution = Object.entries(scoreBuckets).map(([score, count]) => ({
      score: Number(score),
      count,
    }))

    return {
      success: true,
      stats: {
        total,
        statusCounts,
        meanScore,
        totalProgress,
        scoreDistribution,
      },
    }
  }

  public static async getOtherFilters(userId: string) {
    const entries = await prisma.orm.public.OtherList.where({ userId })
      .select('status')
      .include('other', (o) =>
        o.select('startDate', 'format')
      )
      .all()

    const statusCounts: Record<string, number> = {}
    const formatCounts: Record<string, number> = {}
    const yearCounts: Record<number, number> = {}

    for (const item of entries) {
      if (item.status) {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1
      }
      if (item.other?.format) {
        const fmt = item.other.format.trim().toLowerCase()
        formatCounts[fmt] = (formatCounts[fmt] || 0) + 1
      }
      if (item.other?.startDate) {
        const yr = new Date(item.other.startDate).getFullYear()
        yearCounts[yr] = (yearCounts[yr] || 0) + 1
      }
    }

    return {
      success: true,
      statuses: Object.entries(statusCounts).map(([value, count]) => ({ value, count })),
      formats: Object.entries(formatCounts).map(([value, count]) => ({ value, count })),
      genres: [],
      years: Object.entries(yearCounts).map(([value, count]) => ({
        value: Number(value),
        count,
      })),
    }
  }

  // ===========================================================================
  // 9. Global List Operations (Export, Import, Combined Stats)
  // ===========================================================================

  public static async exportUserLists(userId: string, query?: { format?: string; types?: string }) {
    const user = await prisma.orm.public.User.where({ id: userId })
      .select('username')
      .first()

    if (!user) {
      throw new NotFound('User not found')
    }

    const requestedTypes = query?.types
      ? query.types
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [
          'anime',
          'manga',
          'tv',
          'movie',
          'game',
          'book',
          'music',
          'custom_lists',
        ]

    const exportData: any = {
      success: true,
      version: '1.0',
      exportedAt: new Date().toISOString(),
      source: 'IRIS',
      username: user.username,
      lists: {},
    }

    // 1. Anime
    if (requestedTypes.includes('anime')) {
      const items = await prisma.orm.public.AnimeList.where({ userId })
        .include('anime')
        .orderBy((al) => al.updatedAt.desc())
        .all()
      exportData.lists.anime = items.map((item: any) => ({
        externalIds: {
          anilistId: item.anime?.anilistId,
          malId: item.anime?.malId,
          aniDBId: item.anime?.aniDBId,
          tvDBId: item.anime?.tvDBId,
          bangumiId: item.anime?.bangumiId,
          kitsuId: item.anime?.kitsuId,
        },
        title: item.anime?.titlePrimary,
        status: item.status,
        progress: item.progress,
        score: item.score,
        notes: decryptNotes(item.notes, userId),
        rewatched: item.rewatched,
        private: item.private,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        rewatchHistory: item.rewatchHistory,
        connections: item.connections,
      }))
    }

    // 2. Manga
    if (requestedTypes.includes('manga')) {
      const items = await prisma.orm.public.MangaList.where({ userId })
        .include('manga')
        .orderBy((ml) => ml.updatedAt.desc())
        .all()
      exportData.lists.manga = items.map((item: any) => ({
        externalIds: {
          anilistId: item.manga?.anilistId,
          malId: item.manga?.malId,
          mangaUpdatesId: item.manga?.mangaUpdatesId,
          bangumiId: item.manga?.bangumiId,
          kitsuId: item.manga?.kitsuId,
        },
        title: item.manga?.titlePrimary,
        status: item.status,
        progress: item.chaptersProgress,
        progressVolumes: item.volumesProgress,
        score: item.score,
        notes: decryptNotes(item.notes, userId),
        reread: item.reread,
        private: item.private,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        rereadHistory: item.rereadHistory,
        connections: item.connections,
      }))
    }

    // 3. TV
    if (requestedTypes.includes('tv')) {
      const items = await prisma.orm.public.TvList.where({ userId })
        .include('tv')
        .orderBy((tl) => tl.updatedAt.desc())
        .all()
      exportData.lists.tv = items.map((item: any) => ({
        externalIds: {
          tvDBId: item.tv?.tvDBId,
          tmdbId: item.tv?.tmdbId,
          imdbId: item.tv?.imdbId,
          simklId: item.tv?.simklId,
          tvmazeId: item.tv?.tvmazeId,
        },
        title: item.tv?.titlePrimary,
        status: item.status,
        progress: item.progress,
        score: item.score,
        notes: decryptNotes(item.notes, userId),
        rewatched: item.rewatched,
        private: item.private,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        rewatchHistory: item.rewatchHistory,
        connections: item.connections,
      }))
    }

    // 4. Movie
    if (requestedTypes.includes('movie')) {
      const items = await prisma.orm.public.MovieList.where({ userId })
        .include('movie')
        .orderBy((ml) => ml.updatedAt.desc())
        .all()
      exportData.lists.movie = items.map((item: any) => ({
        externalIds: {
          tvDBId: item.movie?.tvDBId,
          tmdbId: item.movie?.tmdbId,
          imdbId: item.movie?.imdbId,
          simklId: item.movie?.simklId,
        },
        title: item.movie?.titlePrimary,
        status: item.status,
        progress: item.status === 'COMPLETED' ? 1 : 0,
        score: item.score,
        notes: decryptNotes(item.notes, userId),
        rewatched: item.rewatched,
        private: item.private,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        rewatchHistory: item.rewatchHistory,
        connections: item.connections,
      }))
    }

    // 5. Game
    if (requestedTypes.includes('game')) {
      const items = await prisma.orm.public.GameList.where({ userId })
        .include('game')
        .orderBy((gl) => gl.updatedAt.desc())
        .all()
      exportData.lists.game = items.map((item: any) => ({
        externalIds: {
          igdbId: item.game?.igdbId,
          steamAppId: item.game?.steamAppId,
          rawgId: item.game?.rawgId,
          giantbombId: item.game?.giantbombId,
          vndbId: item.game?.vndbId,
        },
        title: item.game?.titlePrimary,
        status: item.status,
        progress: item.progress,
        score: item.score,
        notes: decryptNotes(item.notes, userId),
        replayed: item.replayed,
        private: item.private,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        replayHistory: item.replayHistory,
        connections: item.connections,
      }))
    }

    // 6. Book
    if (requestedTypes.includes('book')) {
      const items = await prisma.orm.public.BookList.where({ userId })
        .include('book')
        .orderBy((bl) => bl.updatedAt.desc())
        .all()
      exportData.lists.book = items.map((item: any) => ({
        externalIds: {
          googleBookId: item.book?.googleBookId,
          isbn10: item.book?.isbn10,
          isbn13: item.book?.isbn13,
          openLibraryId: item.book?.openLibraryId,
        },
        title: item.book?.titlePrimary,
        status: item.status,
        progress: item.progressChapters,
        progressPages: item.progressPages,
        progressChapters: item.progressChapters,
        progressVolumes: item.progressVolumes,
        score: item.score,
        notes: decryptNotes(item.notes, userId),
        reread: item.reread,
        private: item.private,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        rereadHistory: item.rereadHistory,
        connections: item.connections,
      }))
    }

    // 7. Music
    if (requestedTypes.includes('music')) {
      const items = await prisma.orm.public.MusicList.where({ userId })
        .include('music')
        .orderBy((ml) => ml.updatedAt.desc())
        .all()
      exportData.lists.music = items.map((item: any) => ({
        externalIds: {
          deezerId: item.music?.deezerId,
          isrc: item.music?.isrc,
          upc: item.music?.upc,
          deezerArtistId: item.music?.deezerArtistId,
        },
        title: item.music?.titlePrimary,
        status: item.status,
        progress: item.playCount,
        playCount: item.playCount,
        score: item.score,
        notes: decryptNotes(item.notes, userId),
        private: item.private,
        startedAt: item.startedAt ? item.startedAt.toISOString() : null,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        connections: item.connections,
      }))
    }

    // 8. Custom Lists / Playlists
    if (requestedTypes.includes('custom_lists') || requestedTypes.includes('customlists')) {
      const customLists = await prisma.orm.public.CustomList.where({ userId })
        .include('entries', (e) =>
          e.orderBy((en) => en.order.asc())
        )
        .orderBy((cl) => cl.order.asc())
        .all()
      exportData.lists.customLists = customLists.map((list: any) => ({
        id: list.id,
        name: list.name,
        description: list.description,
        isPrivate: list.isPrivate,
        coverImage: list.coverImage,
        order: list.order,
        entries: list.entries.map((entry: any) => ({
          mediaType: entry.mediaType,
          mediaId: entry.mediaId,
          order: entry.order,
          customNotes: decryptNotes(entry.customNotes, userId),
          addedAt: entry.addedAt ? entry.addedAt.toISOString() : null,
        })),
      }))
    }

    return exportData
  }

  public static async importUserLists(userId: string, body: any) {
    let items: any[] = []

    if (Array.isArray(body?.items)) {
      items = [...body.items]
    }

    if (body?.lists && typeof body.lists === 'object') {
      const lists = body.lists
      if (Array.isArray(lists.anime)) {
        items.push(...lists.anime.map((x: any) => ({ ...x, mediaType: 'anime' })))
      }
      if (Array.isArray(lists.manga)) {
        items.push(...lists.manga.map((x: any) => ({ ...x, mediaType: 'manga' })))
      }
      if (Array.isArray(lists.tv)) {
        items.push(...lists.tv.map((x: any) => ({ ...x, mediaType: 'tv' })))
      }
      if (Array.isArray(lists.movie)) {
        items.push(...lists.movie.map((x: any) => ({ ...x, mediaType: 'movie' })))
      }
      if (Array.isArray(lists.game)) {
        items.push(...lists.game.map((x: any) => ({ ...x, mediaType: 'game' })))
      }
      if (Array.isArray(lists.book)) {
        items.push(...lists.book.map((x: any) => ({ ...x, mediaType: 'book' })))
      }
      if (Array.isArray(lists.music)) {
        items.push(...lists.music.map((x: any) => ({ ...x, mediaType: 'music' })))
      }
      if (Array.isArray(lists.customLists)) {
        items.push(...lists.customLists.map((x: any) => ({ ...x, mediaType: 'custom_lists' })))
      }
    }

    const skipExisting = Boolean(body?.skipExisting)
    const touchedMedia = new Map<string, { type: string; id: number }>()
    let imported = 0
    let updated = 0
    let skipped = 0
    let queued = 0

    for (const item of items) {
      const mediaType = (item.mediaType || '').toLowerCase()
      const title = item.title || 'Untitled'
      const status = normalizeListStatus(item.status)
      const rawScore = item.score !== undefined && item.score !== null ? Number(item.score) : null
      let score: number | null = null
      if (rawScore !== null && !isNaN(rawScore)) {
        let s = rawScore
        if (s > 10) s = s / 10
        if (s < 0) s = 0
        if (s > 10) s = 10
        score = Math.round(s * 10) / 10
      }
      const notes = item.notes ? encryptNotes(item.notes, userId) : null
      const isPrivate = Boolean(item.private)
      const startedAt = item.startedAt ? new Date(item.startedAt) : null
      const completedAt = item.completedAt ? new Date(item.completedAt) : null

      try {
        switch (mediaType) {
          case 'anime': {
            const anilistId = item.externalIds?.anilistId ? Number(item.externalIds.anilistId) : null
            const malId = item.externalIds?.malId ? Number(item.externalIds.malId) : null
            const matchers: any[] = []
            if (anilistId) matchers.push((a: any) => a.anilistId.eq(anilistId))
            if (malId) matchers.push((a: any) => a.malId.eq(malId))
            matchers.push((a: any) => a.titlePrimary.ilike(title))

            let anime = await prisma.orm.public.Anime.where((a) => or(...matchers.map((m) => m(a)))).first()

            if (!anime) {
              anime = await prisma.orm.public.Anime.create({
                titlePrimary: title,
                anilistId,
                malId,
                synonyms: [],
              })
            }
            if (!anime) {
              skipped++
              break
            }
            const existing = await prisma.orm.public.AnimeList.where({ userId, animeId: anime.id }).first()
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.orm.public.AnimeList.where({ id: existing.id }).update({
                  status,
                  progress: item.progress ?? existing.progress,
                  score: score ?? existing.score,
                  notes: notes ?? existing.notes,
                  private: isPrivate,
                  startedAt: startedAt ?? existing.startedAt,
                  completedAt: completedAt ?? existing.completedAt,
                })
                updated++
                touchedMedia.set(`anime:${anime.id}`, { type: 'ANIME', id: anime.id })
              }
            } else {
              await prisma.orm.public.AnimeList.create({
                userId,
                animeId: anime.id,
                status,
                progress: item.progress ?? 0,
                score,
                notes,
                private: isPrivate,
                startedAt,
                completedAt,
              })
              imported++
              touchedMedia.set(`anime:${anime.id}`, { type: 'ANIME', id: anime.id })
            }
            break
          }
          case 'manga': {
            const anilistId = item.externalIds?.anilistId ? Number(item.externalIds.anilistId) : null
            const malId = item.externalIds?.malId ? Number(item.externalIds.malId) : null
            const matchers: any[] = []
            if (anilistId) matchers.push((m: any) => m.anilistId.eq(anilistId))
            if (malId) matchers.push((m: any) => m.malId.eq(malId))
            matchers.push((m: any) => m.titlePrimary.ilike(title))

            let manga = await prisma.orm.public.Manga.where((m) => or(...matchers.map((fn) => fn(m)))).first()

            if (!manga) {
              manga = await prisma.orm.public.Manga.create({
                titlePrimary: title,
                anilistId,
                malId,
                synonyms: [],
              })
            }
            if (!manga) {
              skipped++
              break
            }
            const existing = await prisma.orm.public.MangaList.where({ userId, mangaId: manga.id }).first()
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.orm.public.MangaList.where({ id: existing.id }).update({
                  status,
                  chaptersProgress: item.progress ?? item.progressChapters ?? existing.chaptersProgress,
                  volumesProgress: item.progressVolumes ?? existing.volumesProgress,
                  score: score ?? existing.score,
                  notes: notes ?? existing.notes,
                  private: isPrivate,
                })
                updated++
                touchedMedia.set(`manga:${manga.id}`, { type: 'MANGA', id: manga.id })
              }
            } else {
              await prisma.orm.public.MangaList.create({
                userId,
                mangaId: manga.id,
                status,
                chaptersProgress: item.progress ?? item.progressChapters ?? 0,
                volumesProgress: item.progressVolumes ?? 0,
                score,
                notes,
                private: isPrivate,
                startedAt,
                completedAt,
              })
              imported++
              touchedMedia.set(`manga:${manga.id}`, { type: 'MANGA', id: manga.id })
            }
            break
          }
          case 'movie': {
            const tmdbId = item.externalIds?.tmdbId ? Number(item.externalIds.tmdbId) : null
            const imdbId = item.externalIds?.imdbId ? String(item.externalIds.imdbId) : null
            const matchers: any[] = []
            if (tmdbId) matchers.push((m: any) => m.tmdbId.eq(tmdbId))
            if (imdbId) matchers.push((m: any) => m.imdbId.eq(imdbId))
            matchers.push((m: any) => m.titlePrimary.ilike(title))

            let movie = await prisma.orm.public.Movie.where((m) => or(...matchers.map((fn) => fn(m)))).first()

            if (!movie) {
              movie = await prisma.orm.public.Movie.create({
                titlePrimary: title,
                tmdbId,
                imdbId,
                synonyms: [],
              })
            }
            if (!movie) {
              skipped++
              break
            }
            const existing = await prisma.orm.public.MovieList.where({ userId, movieId: movie.id }).first()
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.orm.public.MovieList.where({ id: existing.id }).update({
                  status,
                  score: score ?? existing.score,
                  notes: notes ?? existing.notes,
                })
                updated++
                touchedMedia.set(`movie:${movie.id}`, { type: 'MOVIE', id: movie.id })
              }
            } else {
              await prisma.orm.public.MovieList.create({
                userId,
                movieId: movie.id,
                status,
                score,
                notes,
                private: isPrivate,
                startedAt,
                completedAt,
              })
              imported++
              touchedMedia.set(`movie:${movie.id}`, { type: 'MOVIE', id: movie.id })
            }
            break
          }
          case 'tv': {
            const tmdbId = item.externalIds?.tmdbId ? Number(item.externalIds.tmdbId) : null
            const tvDBId = item.externalIds?.tvDBId ? Number(item.externalIds.tvDBId) : null
            const matchers: any[] = []
            if (tmdbId) matchers.push((t: any) => t.tmdbId.eq(tmdbId))
            if (tvDBId) matchers.push((t: any) => t.tvDBId.eq(tvDBId))
            matchers.push((t: any) => t.titlePrimary.ilike(title))

            let tv = await prisma.orm.public.Tv.where((t) => or(...matchers.map((fn) => fn(t)))).first()

            if (!tv) {
              tv = await prisma.orm.public.Tv.create({
                titlePrimary: title,
                tmdbId,
                tvDBId,
                broadcastDays: [],
                networks: [],
                synonyms: [],
              })
            }
            if (!tv) {
              skipped++
              break
            }
            const existing = await prisma.orm.public.TvList.where({ userId, tvId: tv.id }).first()
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.orm.public.TvList.where({ id: existing.id }).update({
                  status,
                  progress: item.progress ?? existing.progress,
                  score: score ?? existing.score,
                })
                updated++
                touchedMedia.set(`tv:${tv.id}`, { type: 'TV', id: tv.id })
              }
            } else {
              await prisma.orm.public.TvList.create({
                userId,
                tvId: tv.id,
                status,
                progress: item.progress ?? 0,
                score,
                notes,
                private: isPrivate,
                startedAt,
                completedAt,
              })
              imported++
              touchedMedia.set(`tv:${tv.id}`, { type: 'TV', id: tv.id })
            }
            break
          }
          case 'game': {
            const igdbId = item.externalIds?.igdbId ? Number(item.externalIds.igdbId) : null
            const steamAppId = item.externalIds?.steamAppId ? Number(item.externalIds.steamAppId) : null
            const matchers: any[] = []
            if (igdbId) matchers.push((g: any) => g.igdbId.eq(igdbId))
            if (steamAppId) matchers.push((g: any) => g.steamAppId.eq(steamAppId))
            matchers.push((g: any) => g.titlePrimary.ilike(title))

            let game = await prisma.orm.public.Game.where((g) => or(...matchers.map((fn) => fn(g)))).first()

            if (!game) {
              game = await prisma.orm.public.Game.create({
                titlePrimary: title,
                igdbId,
                developers: [],
                gameModes: [],
                languages: [],
                platforms: [],
                playerPerspectives: [],
                publishers: [],
                synonyms: [],
              })
            }
            if (!game) {
              skipped++
              break
            }
            const existing = await prisma.orm.public.GameList.where({ userId, gameId: game.id }).first()
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.orm.public.GameList.where({ id: existing.id }).update({
                  status,
                  progress: item.progress ?? existing.progress,
                  score: score ?? existing.score,
                })
                updated++
                touchedMedia.set(`game:${game.id}`, { type: 'GAME', id: game.id })
              }
            } else {
              await prisma.orm.public.GameList.create({
                userId,
                gameId: game.id,
                status,
                progress: item.progress ?? 0,
                score,
                notes,
                private: isPrivate,
                startedAt,
                completedAt,
              })
              imported++
              touchedMedia.set(`game:${game.id}`, { type: 'GAME', id: game.id })
            }
            break
          }
          case 'book': {
            const googleBookId = item.externalIds?.googleBookId ? String(item.externalIds.googleBookId) : null
            const isbn13 = item.externalIds?.isbn13 ? String(item.externalIds.isbn13) : null
            const matchers: any[] = []
            if (googleBookId) matchers.push((b: any) => b.googleBookId.eq(googleBookId))
            if (isbn13) matchers.push((b: any) => b.isbn13.eq(isbn13))
            matchers.push((b: any) => b.titlePrimary.ilike(title))

            let book = await prisma.orm.public.Book.where((b) => or(...matchers.map((fn) => fn(b)))).first()

            if (!book) {
              book = await prisma.orm.public.Book.create({
                titlePrimary: title,
                googleBookId,
                subjects: [],
                publishers: [],
                authors: [],
                synonyms: [],
              })
            }
            if (!book) {
              skipped++
              break
            }
            const existing = await prisma.orm.public.BookList.where({ userId, bookId: book.id }).first()
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.orm.public.BookList.where({ id: existing.id }).update({
                  status,
                  progressPages: item.progressPages ?? existing.progressPages,
                  score: score ?? existing.score,
                })
                updated++
                touchedMedia.set(`book:${book.id}`, { type: 'BOOK', id: book.id })
              }
            } else {
              await prisma.orm.public.BookList.create({
                userId,
                bookId: book.id,
                status,
                progressPages: item.progressPages ?? 0,
                score,
                notes,
                private: isPrivate,
                startedAt,
                completedAt,
              })
              imported++
              touchedMedia.set(`book:${book.id}`, { type: 'BOOK', id: book.id })
            }
            break
          }
          case 'music': {
            const deezerId = item.externalIds?.deezerId ? String(item.externalIds.deezerId) : null
            const matchers: any[] = []
            if (deezerId) matchers.push((m: any) => m.deezerId.eq(deezerId))
            matchers.push((m: any) => m.titlePrimary.ilike(title))

            let music = await prisma.orm.public.Music.where((m) => or(...matchers.map((fn) => fn(m)))).first()

            if (!music) {
              music = await prisma.orm.public.Music.create({
                titlePrimary: title,
                artistName: item.artistName || 'Unknown Artist',
                deezerId,
              })
            }
            if (!music) {
              skipped++
              break
            }
            const existing = await prisma.orm.public.MusicList.where({ userId, musicId: music.id }).first()
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.orm.public.MusicList.where({ id: existing.id }).update({
                  status,
                  playCount: item.playCount ?? existing.playCount,
                  score: score ?? existing.score,
                })
                updated++
                touchedMedia.set(`music:${music.id}`, { type: 'MUSIC', id: music.id })
              }
            } else {
              await prisma.orm.public.MusicList.create({
                userId,
                musicId: music.id,
                status,
                playCount: item.playCount ?? 0,
                score,
                notes,
                private: isPrivate,
                startedAt,
                completedAt,
              })
              imported++
              touchedMedia.set(`music:${music.id}`, { type: 'MUSIC', id: music.id })
            }
            break
          }
          case 'custom_lists': {
            const listName = item.customListName || item.name || title
            let cList = await prisma.orm.public.CustomList.where({ userId, name: listName }).first()
            if (!cList) {
              cList = await prisma.orm.public.CustomList.create({
                userId,
                name: listName,
                description: item.description ?? null,
                isPrivate,
              })
            }
            imported++
            break
          }
          default:
            skipped++
        }
      } catch {
        skipped++
      }
    }

    for (const item of touchedMedia.values()) {
      await MediaStatsServ.recalculateMediaStats(item.type, item.id)
    }

    return {
      success: true,
      imported,
      updated,
      skipped,
      queued,
      total: items.length,
    }
  }

  public static async fetchRemoteExport(rawUrl: string, password?: string) {
    let targetUrl = rawUrl.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`
    }

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ password: password || '' }),
      })

      if (!res.ok) {
        const text = await res.text()
        let errMessage = 'Failed to fetch from remote URL'
        try {
          const json = JSON.parse(text)
          if (json.message) errMessage = json.message
        } catch {}
        throw new BadRequest(errMessage)
      }

      const json = await res.json()
      return {
        success: true,
        data: json.data || json,
      }
    } catch (err: any) {
      if (err instanceof BadRequest) throw err
      throw new BadRequest(err.message || 'Network error fetching remote export')
    }
  }

  public static async getGlobalListStats(
    userId: string,
    query?: { year?: number; quarter?: number; month?: number }
  ) {
    const isPeriodFiltered = Boolean(query?.year || query?.quarter || query?.month)
    const currentYear = new Date().getUTCFullYear()
    const filterYear = query?.year ? Number(query.year) : (isPeriodFiltered ? currentYear : undefined)
    const filterQuarter = query?.quarter ? Number(query.quarter) : undefined
    const filterMonth = query?.month ? Number(query.month) : undefined

    let startDate: Date | null = null
    let endDate: Date | null = null

    if (filterYear) {
      if (filterMonth) {
        startDate = new Date(Date.UTC(filterYear, filterMonth - 1, 1))
        endDate = new Date(Date.UTC(filterYear, filterMonth, 1))
      } else if (filterQuarter) {
        const startM = (filterQuarter - 1) * 3
        startDate = new Date(Date.UTC(filterYear, startM, 1))
        endDate = new Date(Date.UTC(filterYear, startM + 3, 1))
      } else {
        startDate = new Date(Date.UTC(filterYear, 0, 1))
        endDate = new Date(Date.UTC(filterYear + 1, 0, 1))
      }
    }

    const inRange = (d: Date | null) => {
      if (!startDate && !endDate) return true
      if (!d) return false
      const t = d.getTime()
      if (startDate && t < startDate.getTime()) return false
      if (endDate && t >= endDate.getTime()) return false
      return true
    }

    const [animeRaw, mangaRaw, tvRaw, movieRaw, gameRaw, bookRaw, musicRaw] = await Promise.all([
      prisma.orm.public.AnimeList.where({ userId })
        .include('anime', (a) =>
          a.select('averageScore').include('genres', (ge) => ge.include('genre', (gn) => gn.select('name')))
        )
        .all(),
      prisma.orm.public.MangaList.where({ userId })
        .include('manga', (m) =>
          m.select('averageScore').include('genres', (ge) => ge.include('genre', (gn) => gn.select('name')))
        )
        .all(),
      prisma.orm.public.TvList.where({ userId })
        .include('tv', (t) =>
          t.select('averageScore').include('genres', (ge) => ge.include('genre', (gn) => gn.select('name')))
        )
        .all(),
      prisma.orm.public.MovieList.where({ userId })
        .include('movie', (m) =>
          m.select('runtime', 'averageScore').include('genres', (ge) => ge.include('genre', (gn) => gn.select('name')))
        )
        .all(),
      prisma.orm.public.GameList.where({ userId })
        .include('game', (g) =>
          g.select('averageScore').include('genres', (ge) => ge.include('genre', (gn) => gn.select('name')))
        )
        .all(),
      prisma.orm.public.BookList.where({ userId })
        .include('book', (b) =>
          b.select('averageScore').include('genres', (ge) => ge.include('genre', (gn) => gn.select('name')))
        )
        .all(),
      prisma.orm.public.MusicList.where({ userId })
        .include('music', (m) =>
          m.select('duration').include('genres', (ge) => ge.include('genre', (gn) => gn.select('name')))
        )
        .all(),
    ])

    const normalizeGenres = (items: any[], mediaKey: string) =>
      items.map((item) => {
        const media = item[mediaKey]
        if (!media) return item
        return {
          ...item,
          [mediaKey]: {
            ...media,
            genres: (media.genres || [])
              .filter((g: any) => Boolean(g.genre))
              .map((g: any) => ({ name: g.genre!.name })),
          },
        }
      })

    const animeList = normalizeGenres(animeRaw, 'anime')
    const mangaList = normalizeGenres(mangaRaw, 'manga')
    const tvList = normalizeGenres(tvRaw, 'tv')
    const movieList = normalizeGenres(movieRaw, 'movie')
    const gameList = normalizeGenres(gameRaw, 'game')
    const bookList = normalizeGenres(bookRaw, 'book')
    const musicList = normalizeGenres(musicRaw, 'music')

    const filterEntries = (arr: any[]) =>
      isPeriodFiltered
        ? arr.filter((e) => inRange(e.completedAt ?? e.startedAt ?? e.createdAt))
        : arr

    const fAnime = filterEntries(animeList)
    const fManga = filterEntries(mangaList)
    const fTv = filterEntries(tvList)
    const fMovie = filterEntries(movieList)
    const fGame = filterEntries(gameList)
    const fBook = filterEntries(bookList)
    const fMusic = filterEntries(musicList)

    const allEntries = [...fAnime, ...fManga, ...fTv, ...fMovie, ...fGame, ...fBook, ...fMusic]
    const totalTitles = allEntries.length

    let completedTitles = 0
    let planningCount = 0
    let totalScoreSum = 0
    let scoredCount = 0
    const scoresList: number[] = []
    const statusCounts: Record<string, number> = {}
    const scoreBuckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }
    let unratedCount = 0
    const genreMap: Record<string, { count: number; scoreSum: number; scoredCount: number }> = {}
    const yearActivityMap: Record<number, number> = {}
    const monthlyActivityMap: Record<string, { year: number; month: number; count: number }> = {}

    let animeMinutes = 0
    for (const e of fAnime) {
      animeMinutes += (e.progress ?? 0) * 24
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNED') planningCount++
    }

    let mangaMinutes = 0
    for (const e of fManga) {
      mangaMinutes += (e.chaptersProgress ?? 0) * 8
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNED') planningCount++
    }

    let tvMinutes = 0
    for (const e of fTv) {
      tvMinutes += (e.progress ?? 0) * 45
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNED') planningCount++
    }

    let movieMinutes = 0
    for (const e of fMovie) {
      movieMinutes += (e.status === 'COMPLETED' ? 1 : 0) * (e.movie?.runtime ?? 110)
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNED') planningCount++
    }

    let gameMinutes = 0
    for (const e of fGame) {
      gameMinutes += (e.progress ?? 0) * 60
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNED') planningCount++
    }

    let bookMinutes = 0
    for (const e of fBook) {
      bookMinutes += (e.progressPages ?? 0) * 1.5
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNED') planningCount++
    }

    let musicMinutes = 0
    for (const e of fMusic) {
      const dur = e.music?.duration ? e.music.duration / 60 : 3.5
      musicMinutes += (e.playCount ?? 0) * dur
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNED') planningCount++
    }

    const totalTimeMinutes = Math.round(
      animeMinutes + mangaMinutes + tvMinutes + movieMinutes + gameMinutes + bookMinutes + musicMinutes
    )
    const daysConsumed = Math.round((totalTimeMinutes / 1440) * 10) / 10
    const daysPlanned = Math.round(((planningCount * 120) / 1440) * 10) / 10

    for (const e of allEntries) {
      const st = e.status || 'UNKNOWN'
      statusCounts[st] = (statusCounts[st] || 0) + 1

      if (e.score != null && e.score > 0) {
        const sc = Math.max(1, Math.min(10, Math.round(e.score)))
        scoreBuckets[sc] = (scoreBuckets[sc] || 0) + 1
        totalScoreSum += Number(e.score)
        scoredCount++
        scoresList.push(Number(e.score))
      } else {
        unratedCount++
      }

      const date = e.completedAt ?? e.startedAt ?? e.createdAt
      if (date) {
        const y = new Date(date).getUTCFullYear()
        const m = new Date(date).getUTCMonth() + 1
        yearActivityMap[y] = (yearActivityMap[y] || 0) + 1
        const key = `${y}-${m}`
        if (!monthlyActivityMap[key]) {
          monthlyActivityMap[key] = { year: y, month: m, count: 0 }
        }
        monthlyActivityMap[key].count++
      }

      const mediaObj = e.anime || e.manga || e.tv || e.movie || e.game || e.book || e.music
      if (mediaObj?.genres && Array.isArray(mediaObj.genres)) {
        for (const g of mediaObj.genres) {
          const gName = g.name || 'General'
          if (!genreMap[gName]) {
            genreMap[gName] = { count: 0, scoreSum: 0, scoredCount: 0 }
          }
          genreMap[gName].count++
          if (e.score != null && e.score > 0) {
            genreMap[gName].scoreSum += Number(e.score)
            genreMap[gName].scoredCount++
          }
        }
      }
    }

    const meanScore = scoredCount > 0 ? Math.round((totalScoreSum / scoredCount) * 10) / 10 : 0
    let standardDeviation = 0
    if (scoredCount > 1) {
      const variance = scoresList.reduce((acc, val) => acc + Math.pow(val - meanScore, 2), 0) / scoredCount
      standardDeviation = Math.round(Math.sqrt(variance) * 10) / 10
    }

    const mediaMinutesMap = [
      { mediaType: 'ANIME', count: fAnime.length, mins: animeMinutes },
      { mediaType: 'MANGA', count: fManga.length, mins: mangaMinutes },
      { mediaType: 'TV', count: fTv.length, mins: tvMinutes },
      { mediaType: 'MOVIE', count: fMovie.length, mins: movieMinutes },
      { mediaType: 'GAME', count: fGame.length, mins: gameMinutes },
      { mediaType: 'BOOK', count: fBook.length, mins: bookMinutes },
      { mediaType: 'MUSIC', count: fMusic.length, mins: musicMinutes },
    ]

    const mediaBreakdown = mediaMinutesMap.map((m) => ({
      mediaType: m.mediaType,
      count: m.count,
      hours: Math.round((m.mins / 60) * 10) / 10,
      percentage: totalTitles > 0 ? Math.round((m.count / totalTitles) * 1000) / 10 : 0,
    }))

    const statusDistribution = Object.entries(statusCounts).map(([name, count]) => ({
      name,
      count,
      percentage: totalTitles > 0 ? Math.round((count / totalTitles) * 1000) / 10 : 0,
    }))

    const scoreDistribution = {
      scores: Object.entries(scoreBuckets).map(([score, count]) => ({
        score: Number(score),
        count,
      })),
      unratedCount,
    }

    const activityYearGraph = Object.entries(yearActivityMap).map(([year, titles]) => ({
      year: Number(year),
      titles,
      meanScore,
      hours: Math.round((totalTimeMinutes / 60) * 10) / 10,
    }))

    const topGenres = Object.entries(genreMap)
      .map(([genre, data]) => ({
        genre,
        count: data.count,
        meanScore: data.scoredCount > 0 ? Math.round((data.scoreSum / data.scoredCount) * 10) / 10 : 0,
        hours: 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const monthlyActivity = Object.values(monthlyActivityMap).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

    return {
      success: true,
      data: {
        isPeriodFiltered,
        period: isPeriodFiltered
          ? {
              year: filterYear,
              quarter: filterQuarter,
              month: filterMonth,
            }
          : null,
        overview: {
          totalTitles,
          completedTitles,
          planningCount,
          totalTimeMinutes,
          daysConsumed,
          daysPlanned,
          meanScore,
          standardDeviation,
          scoredCount,
        },
        mediaBreakdown,
        statusDistribution,
        scoreDistribution,
        activityYearGraph,
        topGenres,
        monthlyActivity,
      },
    }
  }

  public static async listExportShares(userId: string) {
    const shares = await prisma.orm.public.ListExportShare.where({ userId })
      .orderBy((s) => s.createdAt.desc())
      .all()

    return {
      success: true,
      shares: shares.map((s) => ({
        id: s.id,
        description: s.description,
        mediaTypes: s.mediaTypes,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt?.toISOString() ?? null,
        lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
        isExpired: s.expiresAt ? s.expiresAt.getTime() < Date.now() : false,
      })),
    }
  }

  public static async createExportShare(
    userId: string,
    params: {
      password: string
      mediaTypes: string[]
      description?: string
      expiresInHours?: number | null
    }
  ) {
    if (!params.password || params.password.length < 4) {
      throw new BadRequest('Export password must be at least 4 characters')
    }

    if (!params.mediaTypes || params.mediaTypes.length === 0) {
      throw new BadRequest('Please select at least one media type to export')
    }

    const passwordHash = await hashPassword(params.password)

    let expiresAt: Date | null = null
    if (params.expiresInHours && params.expiresInHours > 0) {
      expiresAt = new Date(Date.now() + params.expiresInHours * 3600 * 1000)
    }

    const share = await prisma.orm.public.ListExportShare.create({
      userId,
      passwordHash,
      mediaTypes: params.mediaTypes,
      description: params.description || null,
      expiresAt,
    })

    return {
      success: true,
      shareId: share.id,
      expiresAt: share.expiresAt?.toISOString() ?? null,
    }
  }

  public static async revokeExportShare(userId: string, shareId: string) {
    const share = await prisma.orm.public.ListExportShare.where({ id: shareId, userId }).first()

    if (!share) {
      throw new NotFound('Export share link not found')
    }

    await prisma.orm.public.ListExportShare.where({ id: share.id }).delete()

    return {
      success: true,
      message: 'Export share link revoked successfully',
    }
  }
}

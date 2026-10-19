import { prisma } from '@IRIS/database'
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

  const currentStatus = inc.status ?? (existing ? existing.status : 'PLANNING')
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

    const where: any = { userId }
    if (query?.status) {
      where.status = query.status.trim().toUpperCase()
    }
    const mediaWhere: any = query?.q
      ? {
          OR: [
            { titlePrimary: { contains: query.q.trim(), mode: 'insensitive' } },
            { titleSecondary: { contains: query.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}
    const animeWhere = applyListMediaFilters(mediaWhere, query, {
      yearKey: 'startDateYear',
      formatField: 'format',
      formatTransform: (f) => f.toUpperCase(),
    })
    if (Object.keys(animeWhere).length > 0) {
      where.anime = animeWhere
    }

    let orderBy: any = { updatedAt: order }
    if (query?.sortBy === 'title') {
      orderBy = { anime: { titlePrimary: order } }
    } else if (query?.sortBy === 'score') {
      orderBy = { score: order }
    } else if (query?.sortBy === 'progress') {
      orderBy = { progress: order }
    } else if (query?.sortBy === 'createdAt') {
      orderBy = { createdAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.animeList.count({ where }),
      prisma.animeList.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
              status: true,
              episodeCount: true,
              averageScore: true,
              startDateYear: true,
              genres: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { anime, ...entryData } = e
        return {
          entry: formatEntry(entryData),
          media: anime,
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
    const entry = await prisma.animeList.findUnique({
      where: { userId_animeId: { userId, animeId } },
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
            status: true,
            episodeCount: true,
            averageScore: true,
            startDateYear: true,
            genres: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { anime, ...entryData } = entry
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: anime,
    }
  }

  public static async upsertAnimeEntry(userId: string, animeId: number, body: any) {
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      select: {
        id: true,
        episodeCount: true,
        status: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!anime) {
      throw new NotFound(`Anime with ID ${animeId} does not exist`)
    }

    const existing = await prisma.animeList.findUnique({
      where: { userId_animeId: { userId, animeId } },
    })

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

    const entry = await prisma.animeList.upsert({
      where: { userId_animeId: { userId, animeId } },
      create: {
        userId,
        animeId,
        status: body.status ?? 'PLANNING',
        progress: progress ?? 0,
        score: body.score ?? null,
        notes: encryptNotes(body.notes, userId),
        rewatched: body.rewatched ?? 0,
        private: body.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        rewatchHistory: body.rewatchHistory ?? null,
        connections: body.connections ?? null,
      },
      update: updateData,
    })

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
    const existing = await prisma.animeList.findUnique({
      where: { userId_animeId: { userId, animeId } },
    })
    if (!existing) {
      throw new NotFound(`Anime with ID ${animeId} is not in user list`)
    }

    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })

    await prisma.animeList.delete({
      where: { id: existing.id },
    })

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
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      select: {
        id: true,
        episodeCount: true,
        status: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!anime) {
      throw new NotFound(`Anime with ID ${animeId} does not exist`)
    }

    const existing = await prisma.animeList.findUnique({
      where: { userId_animeId: { userId, animeId } },
    })

    const count = Math.max(1, body?.count ?? 1)
    const currentProgress = existing?.progress ?? 0
    let newProgress = currentProgress + count
    let newStatus = body?.status ?? existing?.status ?? 'WATCHING'
    let completedAt = existing?.completedAt ?? null

    if (newStatus === 'PLANNING') {
      newStatus = 'WATCHING'
    }

    if (anime.episodeCount && anime.episodeCount > 0 && newProgress >= anime.episodeCount) {
      newProgress = anime.episodeCount
      newStatus = 'COMPLETED'
      if (!completedAt) {
        completedAt = new Date()
      }
    }

    const entry = await prisma.animeList.upsert({
      where: { userId_animeId: { userId, animeId } },
      create: {
        userId,
        animeId,
        status: newStatus as any,
        progress: newProgress,
        startedAt: new Date(),
        completedAt,
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus as any,
        progress: newProgress,
        completedAt,
        ...(existing?.status === 'PLANNING' ? { startedAt: new Date() } : {}),
        ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
      },
    })

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
    const items = await prisma.animeList.findMany({
      where: { userId, ...(isOwner ? {} : { private: false }) },
      select: {
        status: true,
        progress: true,
        score: true,
        rewatched: true,
      },
    })
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
    const items = await prisma.animeList.findMany({
      where: { userId },
      select: {
        status: true,
        anime: {
          select: {
            format: true,
            status: true,
            startDateYear: true,
            genres: { select: { name: true } },
          },
        },
      },
    })
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

    const where: any = { userId }
    if (query?.status) {
      where.status = query.status.trim().toUpperCase()
    }
    const mediaWhere: any = query?.q
      ? {
          OR: [
            { titlePrimary: { contains: query.q.trim(), mode: 'insensitive' } },
            { titleSecondary: { contains: query.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}
    const mangaWhere = applyListMediaFilters(mediaWhere, query, {
      yearKey: 'startDateYear',
      formatField: 'format',
      formatTransform: (f) => f.toUpperCase(),
    })
    if (Object.keys(mangaWhere).length > 0) {
      where.manga = mangaWhere
    }

    let orderBy: any = { updatedAt: order }
    if (query?.sortBy === 'title') {
      orderBy = { manga: { titlePrimary: order } }
    } else if (query?.sortBy === 'score') {
      orderBy = { score: order }
    } else if (query?.sortBy === 'progress') {
      orderBy = { chaptersProgress: order }
    } else if (query?.sortBy === 'createdAt') {
      orderBy = { createdAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.mangaList.count({ where }),
      prisma.mangaList.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          manga: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              status: true,
              chapterCount: true,
              volumeCount: true,
              averageScore: true,
              startDateYear: true,
              genres: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { manga, ...entryData } = e
        return {
          entry: formatEntry(entryData),
          media: manga,
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
    const entry = await prisma.mangaList.findUnique({
      where: { userId_mangaId: { userId, mangaId } },
      include: {
        manga: {
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            bannerImage: true,
            format: true,
            status: true,
            chapterCount: true,
            volumeCount: true,
            averageScore: true,
            startDateYear: true,
            genres: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { manga, ...entryData } = entry
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: manga,
    }
  }

  public static async upsertMangaEntry(userId: string, mangaId: number, body: any) {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: {
        id: true,
        chapterCount: true,
        volumeCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!manga) {
      throw new NotFound(`Manga with ID ${mangaId} does not exist`)
    }

    const existing = await prisma.mangaList.findUnique({
      where: { userId_mangaId: { userId, mangaId } },
    })

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

    const entry = await prisma.mangaList.upsert({
      where: { userId_mangaId: { userId, mangaId } },
      create: {
        userId,
        mangaId,
        status: body.status ?? 'PLANNING',
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
      },
      update: updateData,
    })

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
    const existing = await prisma.mangaList.findUnique({
      where: { userId_mangaId: { userId, mangaId } },
    })
    if (!existing) {
      throw new NotFound(`Manga with ID ${mangaId} is not in user list`)
    }

    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })

    await prisma.mangaList.delete({
      where: { id: existing.id },
    })

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
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: {
        id: true,
        chapterCount: true,
        volumeCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!manga) {
      throw new NotFound(`Manga with ID ${mangaId} does not exist`)
    }

    const existing = await prisma.mangaList.findUnique({
      where: { userId_mangaId: { userId, mangaId } },
    })

    const count = Math.max(1, body?.count ?? 1)
    const isVolume = body?.type === 'volume'
    let chaptersProgress = existing?.chaptersProgress ?? 0
    let volumesProgress = existing?.volumesProgress ?? 0
    let newStatus = body?.status ?? existing?.status ?? 'READING'
    let completedAt = existing?.completedAt ?? null

    if (newStatus === 'PLANNING') {
      newStatus = 'READING'
    }

    if (isVolume) {
      volumesProgress += count
    } else {
      chaptersProgress += count
      if (manga.chapterCount && manga.chapterCount > 0 && chaptersProgress >= manga.chapterCount) {
        chaptersProgress = manga.chapterCount
        newStatus = 'COMPLETED'
        if (!completedAt) {
          completedAt = new Date()
        }
      }
    }

    const entry = await prisma.mangaList.upsert({
      where: { userId_mangaId: { userId, mangaId } },
      create: {
        userId,
        mangaId,
        status: newStatus as any,
        chaptersProgress,
        volumesProgress,
        startedAt: new Date(),
        completedAt,
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus as any,
        chaptersProgress,
        volumesProgress,
        completedAt,
        ...(existing?.status === 'PLANNING' ? { startedAt: new Date() } : {}),
        ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
      },
    })

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
    const items = await prisma.mangaList.findMany({
      where: { userId, ...(isOwner ? {} : { private: false }) },
      select: {
        status: true,
        chaptersProgress: true,
        volumesProgress: true,
        score: true,
        reread: true,
      },
    })
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
    const items = await prisma.mangaList.findMany({
      where: { userId },
      select: {
        status: true,
        manga: {
          select: {
            format: true,
            status: true,
            startDateYear: true,
            genres: { select: { name: true } },
          },
        },
      },
    })
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

    const where: any = { userId }
    if (query?.status) {
      where.status = query.status.trim().toUpperCase()
    }
    const mediaWhere: any = query?.q
      ? {
          OR: [
            { titlePrimary: { contains: query.q.trim(), mode: 'insensitive' } },
            { titleSecondary: { contains: query.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}
    const movieWhere = applyListMediaFilters(mediaWhere, query, {
      yearKey: 'releaseDateYear',
      formatField: '',
    })
    if (Object.keys(movieWhere).length > 0) {
      where.movie = movieWhere
    }

    let orderBy: any = { updatedAt: order }
    if (query?.sortBy === 'title') {
      orderBy = { movie: { titlePrimary: order } }
    } else if (query?.sortBy === 'score') {
      orderBy = { score: order }
    } else if (query?.sortBy === 'createdAt') {
      orderBy = { createdAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.movieList.count({ where }),
      prisma.movieList.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          movie: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              status: true,
              runtime: true,
              averageScore: true,
              releaseDateYear: true,
              genres: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { movie, ...entryData } = e
        return {
          entry: formatEntry(entryData),
          media: movie,
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
    const entry = await prisma.movieList.findUnique({
      where: { userId_movieId: { userId, movieId } },
      include: {
        movie: {
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            bannerImage: true,
            status: true,
            runtime: true,
            averageScore: true,
            releaseDateYear: true,
            genres: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { movie, ...entryData } = entry
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: movie,
    }
  }

  public static async upsertMovieEntry(userId: string, movieId: number, body: any) {
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!movie) {
      throw new NotFound(`Movie with ID ${movieId} does not exist`)
    }

    const existing = await prisma.movieList.findUnique({
      where: { userId_movieId: { userId, movieId } },
    })

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

    const entry = await prisma.movieList.upsert({
      where: { userId_movieId: { userId, movieId } },
      create: {
        userId,
        movieId,
        status: body.status ?? 'PLANNING',
        score: body.score ?? null,
        notes: encryptNotes(body.notes, userId),
        rewatched: body.rewatched ?? 0,
        private: body.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        rewatchHistory: body.rewatchHistory ?? null,
        connections: body.connections ?? null,
      },
      update: updateData,
    })

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
    const existing = await prisma.movieList.findUnique({
      where: { userId_movieId: { userId, movieId } },
    })
    if (!existing) {
      throw new NotFound(`Movie with ID ${movieId} is not in user list`)
    }

    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })

    await prisma.movieList.delete({
      where: { id: existing.id },
    })

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
    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!movie) {
      throw new NotFound(`Movie with ID ${movieId} does not exist`)
    }

    const existing = await prisma.movieList.findUnique({
      where: { userId_movieId: { userId, movieId } },
    })

    const count = Math.max(1, body?.count ?? 1)
    const newRewatched = (existing?.rewatched ?? 0) + count

    const entry = await prisma.movieList.upsert({
      where: { userId_movieId: { userId, movieId } },
      create: {
        userId,
        movieId,
        status: 'COMPLETED',
        rewatched: newRewatched,
        completedAt: new Date(),
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: 'COMPLETED',
        rewatched: newRewatched,
        completedAt: existing?.completedAt ?? new Date(),
        ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
      },
    })

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
    const items = await prisma.movieList.findMany({
      where: { userId, ...(isOwner ? {} : { private: false }) },
      select: {
        status: true,
        score: true,
        rewatched: true,
      },
    })
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
    const items = await prisma.movieList.findMany({
      where: { userId },
      select: {
        status: true,
        movie: {
          select: {
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
      },
    })
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

    const where: any = { userId }
    if (query?.status) {
      where.status = query.status.trim().toUpperCase()
    }
    const mediaWhere: any = query?.q
      ? {
          OR: [
            { titlePrimary: { contains: query.q.trim(), mode: 'insensitive' } },
            { titleSecondary: { contains: query.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}
    const tvWhere = applyListMediaFilters(mediaWhere, query, {
      yearKey: 'firstAiredYear',
      formatField: '',
    })
    if (Object.keys(tvWhere).length > 0) {
      where.tv = tvWhere
    }

    let orderBy: any = { updatedAt: order }
    if (query?.sortBy === 'title') {
      orderBy = { tv: { titlePrimary: order } }
    } else if (query?.sortBy === 'score') {
      orderBy = { score: order }
    } else if (query?.sortBy === 'progress') {
      orderBy = { progress: order }
    } else if (query?.sortBy === 'createdAt') {
      orderBy = { createdAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.tvList.count({ where }),
      prisma.tvList.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          tv: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              status: true,
              episodeCount: true,
              seasonCount: true,
              averageScore: true,
              firstAiredYear: true,
              genres: { select: { id: true, name: true } },
              seasons: {
                select: {
                  id: true,
                  seasonNumber: true,
                  titlePrimary: true,
                  titleSecondary: true,
                  episodeCount: true,
                },
                orderBy: { seasonNumber: 'asc' },
              },
            },
          },
        },
      }),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { tv, ...entryData } = e
        return {
          entry: formatEntry(entryData),
          media: tv,
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
    const entry = await prisma.tvList.findUnique({
      where: { userId_tvId: { userId, tvId } },
      include: {
        tv: {
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            bannerImage: true,
            status: true,
            episodeCount: true,
            seasonCount: true,
            averageScore: true,
            firstAiredYear: true,
            genres: { select: { id: true, name: true } },
            seasons: {
              select: {
                id: true,
                seasonNumber: true,
                titlePrimary: true,
                titleSecondary: true,
                episodeCount: true,
              },
              orderBy: { seasonNumber: 'asc' },
            },
          },
        },
      },
    })

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { tv, ...entryData } = entry
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: tv,
    }
  }

  public static async upsertTvEntry(userId: string, tvId: number, body: any) {
    const tv = await prisma.tv.findUnique({
      where: { id: tvId },
      select: {
        id: true,
        episodeCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!tv) {
      throw new NotFound(`TV series with ID ${tvId} does not exist`)
    }

    const existing = await prisma.tvList.findUnique({
      where: { userId_tvId: { userId, tvId } },
    })

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

    const entry = await prisma.tvList.upsert({
      where: { userId_tvId: { userId, tvId } },
      create: {
        userId,
        tvId,
        status: body.status ?? 'PLANNING',
        progress: progress ?? 0,
        score: body.score ?? null,
        notes: encryptNotes(body.notes, userId),
        rewatched: body.rewatched ?? 0,
        private: body.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        rewatchHistory: body.rewatchHistory ?? null,
        connections: body.connections ?? null,
      },
      update: updateData,
    })

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
    const existing = await prisma.tvList.findUnique({
      where: { userId_tvId: { userId, tvId } },
    })
    if (!existing) {
      throw new NotFound(`TV show with ID ${tvId} is not in user list`)
    }

    const tv = await prisma.tv.findUnique({
      where: { id: tvId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })

    await prisma.tvList.delete({
      where: { id: existing.id },
    })

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
    const tv = await prisma.tv.findUnique({
      where: { id: tvId },
      select: {
        id: true,
        episodeCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!tv) {
      throw new NotFound(`TV series with ID ${tvId} does not exist`)
    }

    const existing = await prisma.tvList.findUnique({
      where: { userId_tvId: { userId, tvId } },
    })

    const count = Math.max(1, body?.count ?? 1)
    const currentProgress = existing?.progress ?? 0
    let newProgress = currentProgress + count
    let newStatus = body?.status ?? existing?.status ?? 'WATCHING'
    let completedAt = existing?.completedAt ?? null

    if (newStatus === 'PLANNING') {
      newStatus = 'WATCHING'
    }

    if (tv.episodeCount && tv.episodeCount > 0 && newProgress >= tv.episodeCount) {
      newProgress = tv.episodeCount
      newStatus = 'COMPLETED'
      if (!completedAt) {
        completedAt = new Date()
      }
    }

    const entry = await prisma.tvList.upsert({
      where: { userId_tvId: { userId, tvId } },
      create: {
        userId,
        tvId,
        status: newStatus as any,
        progress: newProgress,
        startedAt: new Date(),
        completedAt,
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus as any,
        progress: newProgress,
        completedAt,
        ...(existing?.status === 'PLANNING' ? { startedAt: new Date() } : {}),
        ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
      },
    })

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
    const items = await prisma.tvList.findMany({
      where: { userId, ...(isOwner ? {} : { private: false }) },
      select: {
        status: true,
        progress: true,
        score: true,
        rewatched: true,
      },
    })
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
    const items = await prisma.tvList.findMany({
      where: { userId },
      select: {
        status: true,
        tv: {
          select: {
            status: true,
            firstAiredYear: true,
            genres: { select: { name: true } },
          },
        },
      },
    })
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

    const where: any = { userId }
    if (query?.status) {
      where.status = query.status.trim().toUpperCase()
    }
    const mediaWhere: any = query?.q
      ? {
          OR: [
            { titlePrimary: { contains: query.q.trim(), mode: 'insensitive' } },
            { titleSecondary: { contains: query.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}
    const gameWhere = applyListMediaFilters(mediaWhere, query, {
      yearKey: 'releaseDateYear',
      formatField: '',
    })
    if (Object.keys(gameWhere).length > 0) {
      where.game = gameWhere
    }

    let orderBy: any = { updatedAt: order }
    if (query?.sortBy === 'title') {
      orderBy = { game: { titlePrimary: order } }
    } else if (query?.sortBy === 'score') {
      orderBy = { score: order }
    } else if (query?.sortBy === 'progress') {
      orderBy = { progress: order }
    } else if (query?.sortBy === 'createdAt') {
      orderBy = { createdAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.gameList.count({ where }),
      prisma.gameList.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          game: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              status: true,
              platforms: true,
              developers: true,
              publishers: true,
              averageScore: true,
              releaseDateYear: true,
              genres: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { game, ...entryData } = e
        return {
          entry: formatEntry(entryData),
          media: game,
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
    const entry = await prisma.gameList.findUnique({
      where: { userId_gameId: { userId, gameId } },
      include: {
        game: {
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            bannerImage: true,
            status: true,
            platforms: true,
            developers: true,
            publishers: true,
            averageScore: true,
            releaseDateYear: true,
            genres: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { game, ...entryData } = entry
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: game,
    }
  }

  public static async upsertGameEntry(userId: string, gameId: number, body: any) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!game) {
      throw new NotFound(`Game with ID ${gameId} does not exist`)
    }

    const existing = await prisma.gameList.findUnique({
      where: { userId_gameId: { userId, gameId } },
    })

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

    const entry = await prisma.gameList.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: {
        userId,
        gameId,
        status: body.status ?? 'PLANNING',
        progress: progress ?? 0,
        score: body.score ?? null,
        notes: encryptNotes(body.notes, userId),
        replayed: body.replayed ?? 0,
        private: body.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        replayHistory: body.replayHistory ?? null,
        connections: body.connections ?? null,
      },
      update: updateData,
    })

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
    const existing = await prisma.gameList.findUnique({
      where: { userId_gameId: { userId, gameId } },
    })
    if (!existing) {
      throw new NotFound(`Game with ID ${gameId} is not in user list`)
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })

    await prisma.gameList.delete({
      where: { id: existing.id },
    })

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
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!game) {
      throw new NotFound(`Game with ID ${gameId} does not exist`)
    }

    const existing = await prisma.gameList.findUnique({
      where: { userId_gameId: { userId, gameId } },
    })

    const count = Math.max(1, body?.count ?? 1)
    const currentProgress = existing?.progress ?? 0
    const newProgress = currentProgress + count
    let newStatus = body?.status ?? existing?.status ?? 'PLAYING'

    if (newStatus === 'PLANNING') {
      newStatus = 'PLAYING'
    }

    const entry = await prisma.gameList.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: {
        userId,
        gameId,
        status: newStatus as any,
        progress: newProgress,
        startedAt: new Date(),
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus as any,
        progress: newProgress,
        ...(existing?.status === 'PLANNING' ? { startedAt: new Date() } : {}),
        ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
      },
    })

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
    const items = await prisma.gameList.findMany({
      where: { userId, ...(isOwner ? {} : { private: false }) },
      select: {
        status: true,
        progress: true,
        score: true,
        replayed: true,
      },
    })
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
    const items = await prisma.gameList.findMany({
      where: { userId },
      select: {
        status: true,
        game: {
          select: {
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
      },
    })
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

    const where: any = { userId }
    if (query?.status) {
      where.status = query.status.trim().toUpperCase()
    }
    const mediaWhere: any = query?.q
      ? {
          OR: [
            { titlePrimary: { contains: query.q.trim(), mode: 'insensitive' } },
            { titleSecondary: { contains: query.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}
    const bookWhere = applyListMediaFilters(mediaWhere, query, {
      yearKey: 'releaseDateYear',
      formatField: 'format',
      formatTransform: (f) => f,
    })
    if (Object.keys(bookWhere).length > 0) {
      where.book = bookWhere
    }

    let orderBy: any = { updatedAt: order }
    if (query?.sortBy === 'title') {
      orderBy = { book: { titlePrimary: order } }
    } else if (query?.sortBy === 'score') {
      orderBy = { score: order }
    } else if (query?.sortBy === 'progress') {
      orderBy = { progressPages: order }
    } else if (query?.sortBy === 'createdAt') {
      orderBy = { createdAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.bookList.count({ where }),
      prisma.bookList.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          book: {
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              subtitle: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              status: true,
              pageCount: true,
              chapterCount: true,
              volumeCount: true,
              authors: true,
              averageScore: true,
              releaseDateYear: true,
              genres: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { book, ...entryData } = e
        return {
          entry: formatEntry(entryData),
          media: book,
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
    const entry = await prisma.bookList.findUnique({
      where: { userId_bookId: { userId, bookId } },
      include: {
        book: {
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            subtitle: true,
            coverImage: true,
            bannerImage: true,
            status: true,
            pageCount: true,
            chapterCount: true,
            volumeCount: true,
            authors: true,
            averageScore: true,
            releaseDateYear: true,
            genres: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { book, ...entryData } = entry
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: book,
    }
  }

  public static async upsertBookEntry(userId: string, bookId: number, body: any) {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        pageCount: true,
        chapterCount: true,
        volumeCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!book) {
      throw new NotFound(`Book with ID ${bookId} does not exist`)
    }

    const existing = await prisma.bookList.findUnique({
      where: { userId_bookId: { userId, bookId } },
    })

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

    const entry = await prisma.bookList.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: {
        userId,
        bookId,
        status: body.status ?? 'PLANNING',
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
      },
      update: updateData,
    })

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
    const existing = await prisma.bookList.findUnique({
      where: { userId_bookId: { userId, bookId } },
    })
    if (!existing) {
      throw new NotFound(`Book with ID ${bookId} is not in user list`)
    }

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, titlePrimary: true, titleSecondary: true, coverImage: true, bannerImage: true, format: true },
    })

    await prisma.bookList.delete({
      where: { id: existing.id },
    })

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
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, pageCount: true, chapterCount: true, volumeCount: true, titlePrimary: true, titleSecondary: true, coverImage: true, bannerImage: true, format: true },
    })
    if (!book) {
      throw new NotFound(`Book with ID ${bookId} does not exist`)
    }

    const existing = await prisma.bookList.findUnique({
      where: { userId_bookId: { userId, bookId } },
    })

    const count = Math.max(1, body?.count ?? 1)
    const type = body?.type ?? 'page'
    let progressPages = existing?.progressPages ?? 0
    let progressChapters = existing?.progressChapters ?? 0
    let progressVolumes = existing?.progressVolumes ?? 0
    let newStatus = body?.status ?? existing?.status ?? 'READING'
    let completedAt = existing?.completedAt ?? null

    if (newStatus === 'PLANNING') {
      newStatus = 'READING'
    }

    if (type === 'chapter') {
      progressChapters += count
    } else if (type === 'volume') {
      progressVolumes += count
    } else {
      progressPages += count
      if (book.pageCount && book.pageCount > 0 && progressPages >= book.pageCount) {
        progressPages = book.pageCount
        newStatus = 'COMPLETED'
        if (!completedAt) {
          completedAt = new Date()
        }
      }
    }

    const entry = await prisma.bookList.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: {
        userId,
        bookId,
        status: newStatus as any,
        progressPages,
        progressChapters,
        progressVolumes,
        startedAt: new Date(),
        completedAt,
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus as any,
        progressPages,
        progressChapters,
        progressVolumes,
        completedAt,
        ...(existing?.status === 'PLANNING' ? { startedAt: new Date() } : {}),
        ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
      },
    })

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
    const items = await prisma.bookList.findMany({
      where: { userId, ...(isOwner ? {} : { private: false }) },
      select: {
        status: true,
        progressPages: true,
        progressChapters: true,
        progressVolumes: true,
        score: true,
        reread: true,
      },
    })
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
    const items = await prisma.bookList.findMany({
      where: { userId },
      select: {
        status: true,
        book: {
          select: {
            format: true,
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
      },
    })
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

    const where: any = { userId }
    if (query?.status) {
      where.status = query.status.trim().toUpperCase()
    }
    const mediaWhere: any = query?.q
      ? {
          OR: [
            { titlePrimary: { contains: query.q.trim(), mode: 'insensitive' } },
            { titleSecondary: { contains: query.q.trim(), mode: 'insensitive' } },
            { artistName: { contains: query.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}
    const musicWhere = applyListMediaFilters(mediaWhere, query, {
      yearKey: 'releaseDateYear',
      formatField: 'type',
      formatTransform: (f) => f.toUpperCase(),
    })
    if (Object.keys(musicWhere).length > 0) {
      where.music = musicWhere
    }

    let orderBy: any = { updatedAt: order }
    if (query?.sortBy === 'title') {
      orderBy = { music: { titlePrimary: order } }
    } else if (query?.sortBy === 'score') {
      orderBy = { score: order }
    } else if (query?.sortBy === 'progress' || query?.sortBy === 'playCount') {
      orderBy = { playCount: order }
    } else if (query?.sortBy === 'createdAt') {
      orderBy = { createdAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.musicList.count({ where }),
      prisma.musicList.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          music: {
            select: {
              id: true,
              type: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              duration: true,
              artistName: true,
              recordType: true,
              status: true,
              releaseDateYear: true,
              genres: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ])

    return {
      success: true,
      items: entries.map((e) => {
        const { music, ...entryData } = e
        return {
          entry: formatEntry(entryData),
          media: music,
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
    const entry = await prisma.musicList.findUnique({
      where: { userId_musicId: { userId, musicId } },
      include: {
        music: {
          select: {
            id: true,
            type: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            duration: true,
            artistName: true,
            recordType: true,
            status: true,
            releaseDateYear: true,
            genres: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!entry) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    const { music, ...entryData } = entry
    return {
      success: true,
      inList: true,
      entry: formatEntry(entryData),
      media: music,
    }
  }

  public static async upsertMusicEntry(userId: string, musicId: number, body: any) {
    const music = await prisma.music.findUnique({
      where: { id: musicId },
      select: { id: true, titlePrimary: true, titleSecondary: true, titleNative: true, coverImage: true, type: true },
    })
    if (!music) {
      throw new NotFound(`Music with ID ${musicId} does not exist`)
    }

    const existing = await prisma.musicList.findUnique({
      where: { userId_musicId: { userId, musicId } },
    })

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

    const entry = await prisma.musicList.upsert({
      where: { userId_musicId: { userId, musicId } },
      create: {
        userId,
        musicId,
        status: body.status ?? 'PLANNING',
        score: body.score ?? null,
        playCount: body.playCount !== undefined ? Number(body.playCount) : 0,
        notes: encryptNotes(body.notes, userId),
        private: body.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        connections: body.connections ?? null,
      },
      update: updateData,
    })

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
    const existing = await prisma.musicList.findUnique({
      where: { userId_musicId: { userId, musicId } },
    })
    if (!existing) {
      throw new NotFound(`Music with ID ${musicId} is not in user list`)
    }

    const music = await prisma.music.findUnique({
      where: { id: musicId },
      select: { id: true, titlePrimary: true, titleSecondary: true, titleNative: true, coverImage: true, type: true },
    })

    await prisma.musicList.delete({
      where: { id: existing.id },
    })

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
    const music = await prisma.music.findUnique({
      where: { id: musicId },
      select: { id: true, titlePrimary: true, titleSecondary: true, titleNative: true, coverImage: true, type: true },
    })
    if (!music) {
      throw new NotFound(`Music with ID ${musicId} does not exist`)
    }

    const existing = await prisma.musicList.findUnique({
      where: { userId_musicId: { userId, musicId } },
    })

    const count = Math.max(1, body?.count ?? 1)
    const newPlayCount = (existing?.playCount ?? 0) + count
    let newStatus = existing?.status ?? 'LISTENING'
    if (newStatus === 'PLANNING') {
      newStatus = 'LISTENING'
    }

    const entry = await prisma.musicList.upsert({
      where: { userId_musicId: { userId, musicId } },
      create: {
        userId,
        musicId,
        status: newStatus as any,
        playCount: newPlayCount,
        startedAt: new Date(),
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus as any,
        playCount: newPlayCount,
        ...(existing?.status === 'PLANNING' ? { startedAt: new Date() } : {}),
        ...((body as any)?.connections !== undefined ? { connections: (body as any).connections } : {}),
      },
    })

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
    const items = await prisma.musicList.findMany({
      where: { userId, ...(isOwner ? {} : { private: false }) },
      select: {
        status: true,
        playCount: true,
        score: true,
      },
    })
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
    const items = await prisma.musicList.findMany({
      where: { userId },
      select: {
        status: true,
        music: {
          select: {
            type: true,
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
      },
    })
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

    const where: any = { userId }
    if (query?.status && query.status !== 'ALL') {
      if (
        query.status === 'WATCHING' ||
        query.status === 'CURRENT' ||
        query.status === 'TRACKING'
      ) {
        where.status = { in: ['WATCHING', 'CURRENT', 'TRACKING'] }
      } else {
        where.status = query.status
      }
    }
    const mediaWhere: any = query?.q
      ? { titlePrimary: { contains: query.q, mode: 'insensitive' } }
      : {}
    const otherWhere = applyListMediaFilters(mediaWhere, query, {
      isDateStringYear: true,
      formatField: 'format',
      formatTransform: (f) => f.toLowerCase(),
    })
    if (Object.keys(otherWhere).length > 0) {
      where.other = otherWhere
    }

    let orderBy: any = { updatedAt: 'desc' }
    const sortField = query?.sortBy ?? 'updatedAt'
    const sortOrder = query?.order ?? 'desc'
    if (sortField === 'score') {
      orderBy = { score: sortOrder }
    } else if (sortField === 'createdAt') {
      orderBy = { createdAt: sortOrder }
    } else if (sortField === 'title') {
      orderBy = { other: { titlePrimary: sortOrder } }
    } else {
      orderBy = { [sortField]: sortOrder }
    }

    const [total, entries] = await Promise.all([
      prisma.otherList.count({ where }),
      prisma.otherList.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          other: true,
        },
      }),
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
    const existing = await prisma.otherList.findUnique({
      where: { userId_otherId: { userId, otherId } },
      include: { other: true },
    })

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

    const item = await prisma.other.findUnique({
      where: { id: otherId },
    })

    return {
      success: true,
      inList: false,
      entry: null,
      media: item,
    }
  }

  public static async upsertOtherEntry(userId: string, otherId: number, body: any) {
    const item = await prisma.other.findUnique({
      where: { id: otherId },
    })
    if (!item) {
      throw new NotFound(`Custom item with ID ${otherId} does not exist`)
    }

    const existing = await prisma.otherList.findUnique({
      where: { userId_otherId: { userId, otherId } },
    })

    const status = body?.status ?? existing?.status ?? 'PLANNING'
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

    const entry = await prisma.otherList.upsert({
      where: { userId_otherId: { userId, otherId } },
      create: {
        userId,
        otherId,
        status,
        progressValues,
        score: body?.score !== undefined ? body.score : null,
        notes: body?.notes !== undefined ? body.notes : null,
        private: body?.private !== undefined ? Boolean(body.private) : false,
        startedAt,
        completedAt,
      },
      update: {
        status,
        progressValues,
        score: body?.score !== undefined ? body.score : undefined,
        notes: body?.notes !== undefined ? body.notes : undefined,
        private: body?.private !== undefined ? Boolean(body.private) : undefined,
        startedAt,
        completedAt,
      },
      include: {
        other: true,
      },
    })

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
    const existing = await prisma.otherList.findUnique({
      where: { userId_otherId: { userId, otherId } },
      include: { other: true },
    })

    await prisma.otherList.deleteMany({
      where: { userId, otherId },
    })

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
    const item = await prisma.other.findUnique({
      where: { id: otherId },
    })
    if (!item) {
      throw new NotFound(`Custom item with ID ${otherId} does not exist`)
    }

    const existing = await prisma.otherList.findUnique({
      where: { userId_otherId: { userId, otherId } },
    })

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
    let newStatus = body?.status ?? existing?.status ?? 'IN_PROGRESS'
    let completedAt = existing?.completedAt ?? null

    if (newStatus === 'PLANNING') {
      newStatus = 'IN_PROGRESS'
    }

    if (maxVal && maxVal > 0 && newVal >= maxVal) {
      newVal = maxVal
      newStatus = 'COMPLETED'
      if (!completedAt) {
        completedAt = new Date()
      }
    }

    const updatedProgValues = {
      ...currentProgValues,
      [incKey]: newVal,
    }

    const entry = await prisma.otherList.upsert({
      where: { userId_otherId: { userId, otherId } },
      create: {
        userId,
        otherId,
        status: newStatus,
        progressValues: updatedProgValues,
        startedAt: new Date(),
        completedAt,
      },
      update: {
        status: newStatus,
        progressValues: updatedProgValues,
        completedAt,
      },
      include: {
        other: true,
      },
    })

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
    const entries = await prisma.otherList.findMany({
      where: { userId },
      include: { other: true },
    })

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
    const entries = await prisma.otherList.findMany({
      where: { userId },
      select: {
        status: true,
        other: {
          select: {
            startDate: true,
            format: true,
          },
        },
      },
    })

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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    })

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
      const items = await prisma.animeList.findMany({
        where: { userId },
        include: { anime: true },
        orderBy: { updatedAt: 'desc' },
      })
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
      const items = await prisma.mangaList.findMany({
        where: { userId },
        include: { manga: true },
        orderBy: { updatedAt: 'desc' },
      })
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
      const items = await prisma.tvList.findMany({
        where: { userId },
        include: { tv: true },
        orderBy: { updatedAt: 'desc' },
      })
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
      const items = await prisma.movieList.findMany({
        where: { userId },
        include: { movie: true },
        orderBy: { updatedAt: 'desc' },
      })
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
      const items = await prisma.gameList.findMany({
        where: { userId },
        include: { game: true },
        orderBy: { updatedAt: 'desc' },
      })
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
      const items = await prisma.bookList.findMany({
        where: { userId },
        include: { book: true },
        orderBy: { updatedAt: 'desc' },
      })
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
      const items = await prisma.musicList.findMany({
        where: { userId },
        include: { music: true },
        orderBy: { updatedAt: 'desc' },
      })
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
      const customLists = await prisma.customList.findMany({
        where: { userId },
        include: {
          entries: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      })
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
      const status = item.status || 'PLANNING'
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
            let anime = await prisma.anime.findFirst({
              where: {
                OR: [
                  item.externalIds?.anilistId ? { anilistId: Number(item.externalIds.anilistId) } : undefined,
                  item.externalIds?.malId ? { malId: Number(item.externalIds.malId) } : undefined,
                  { titlePrimary: { equals: title, mode: 'insensitive' } },
                ].filter(Boolean) as any,
              },
            })
            if (!anime) {
              anime = await prisma.anime.create({
                data: {
                  titlePrimary: title,
                  anilistId: item.externalIds?.anilistId ? Number(item.externalIds.anilistId) : null,
                  malId: item.externalIds?.malId ? Number(item.externalIds.malId) : null,
                },
              })
            }
            const existing = await prisma.animeList.findUnique({
              where: { userId_animeId: { userId, animeId: anime.id } },
            })
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.animeList.update({
                  where: { id: existing.id },
                  data: {
                    status,
                    progress: item.progress ?? existing.progress,
                    score: score ?? existing.score,
                    notes: notes ?? existing.notes,
                    private: isPrivate,
                    startedAt: startedAt ?? existing.startedAt,
                    completedAt: completedAt ?? existing.completedAt,
                  },
                })
                updated++
                touchedMedia.set(`anime:${anime.id}`, { type: 'ANIME', id: anime.id })
              }
            } else {
              await prisma.animeList.create({
                data: {
                  userId,
                  animeId: anime.id,
                  status,
                  progress: item.progress ?? 0,
                  score,
                  notes,
                  private: isPrivate,
                  startedAt,
                  completedAt,
                },
              })
              imported++
              touchedMedia.set(`anime:${anime.id}`, { type: 'ANIME', id: anime.id })
            }
            break
          }
          case 'manga': {
            let manga = await prisma.manga.findFirst({
              where: {
                OR: [
                  item.externalIds?.anilistId ? { anilistId: Number(item.externalIds.anilistId) } : undefined,
                  item.externalIds?.malId ? { malId: Number(item.externalIds.malId) } : undefined,
                  { titlePrimary: { equals: title, mode: 'insensitive' } },
                ].filter(Boolean) as any,
              },
            })
            if (!manga) {
              manga = await prisma.manga.create({
                data: {
                  titlePrimary: title,
                  anilistId: item.externalIds?.anilistId ? Number(item.externalIds.anilistId) : null,
                  malId: item.externalIds?.malId ? Number(item.externalIds.malId) : null,
                },
              })
            }
            const existing = await prisma.mangaList.findUnique({
              where: { userId_mangaId: { userId, mangaId: manga.id } },
            })
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.mangaList.update({
                  where: { id: existing.id },
                  data: {
                    status,
                    chaptersProgress: item.progress ?? item.progressChapters ?? existing.chaptersProgress,
                    volumesProgress: item.progressVolumes ?? existing.volumesProgress,
                    score: score ?? existing.score,
                    notes: notes ?? existing.notes,
                    private: isPrivate,
                  },
                })
                updated++
                touchedMedia.set(`manga:${manga.id}`, { type: 'MANGA', id: manga.id })
              }
            } else {
              await prisma.mangaList.create({
                data: {
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
                },
              })
              imported++
              touchedMedia.set(`manga:${manga.id}`, { type: 'MANGA', id: manga.id })
            }
            break
          }
          case 'movie': {
            let movie = await prisma.movie.findFirst({
              where: {
                OR: [
                  item.externalIds?.tmdbId ? { tmdbId: Number(item.externalIds.tmdbId) } : undefined,
                  item.externalIds?.imdbId ? { imdbId: String(item.externalIds.imdbId) } : undefined,
                  { titlePrimary: { equals: title, mode: 'insensitive' } },
                ].filter(Boolean) as any,
              },
            })
            if (!movie) {
              movie = await prisma.movie.create({
                data: {
                  titlePrimary: title,
                  tmdbId: item.externalIds?.tmdbId ? Number(item.externalIds.tmdbId) : null,
                  imdbId: item.externalIds?.imdbId ? String(item.externalIds.imdbId) : null,
                },
              })
            }
            const existing = await prisma.movieList.findUnique({
              where: { userId_movieId: { userId, movieId: movie.id } },
            })
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.movieList.update({
                  where: { id: existing.id },
                  data: { status, score: score ?? existing.score, notes: notes ?? existing.notes },
                })
                updated++
                touchedMedia.set(`movie:${movie.id}`, { type: 'MOVIE', id: movie.id })
              }
            } else {
              await prisma.movieList.create({
                data: { userId, movieId: movie.id, status, score, notes, private: isPrivate, startedAt, completedAt },
              })
              imported++
              touchedMedia.set(`movie:${movie.id}`, { type: 'MOVIE', id: movie.id })
            }
            break
          }
          case 'tv': {
            let tv = await prisma.tv.findFirst({
              where: {
                OR: [
                  item.externalIds?.tmdbId ? { tmdbId: Number(item.externalIds.tmdbId) } : undefined,
                  item.externalIds?.tvDBId ? { tvDBId: Number(item.externalIds.tvDBId) } : undefined,
                  { titlePrimary: { equals: title, mode: 'insensitive' } },
                ].filter(Boolean) as any,
              },
            })
            if (!tv) {
              tv = await prisma.tv.create({
                data: {
                  titlePrimary: title,
                  tmdbId: item.externalIds?.tmdbId ? Number(item.externalIds.tmdbId) : null,
                  tvDBId: item.externalIds?.tvDBId ? Number(item.externalIds.tvDBId) : null,
                },
              })
            }
            const existing = await prisma.tvList.findUnique({
              where: { userId_tvId: { userId, tvId: tv.id } },
            })
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.tvList.update({
                  where: { id: existing.id },
                  data: { status, progress: item.progress ?? existing.progress, score: score ?? existing.score },
                })
                updated++
                touchedMedia.set(`tv:${tv.id}`, { type: 'TV', id: tv.id })
              }
            } else {
              await prisma.tvList.create({
                data: { userId, tvId: tv.id, status, progress: item.progress ?? 0, score, notes, private: isPrivate, startedAt, completedAt },
              })
              imported++
              touchedMedia.set(`tv:${tv.id}`, { type: 'TV', id: tv.id })
            }
            break
          }
          case 'game': {
            let game = await prisma.game.findFirst({
              where: {
                OR: [
                  item.externalIds?.igdbId ? { igdbId: Number(item.externalIds.igdbId) } : undefined,
                  item.externalIds?.steamAppId ? { steamAppId: Number(item.externalIds.steamAppId) } : undefined,
                  { titlePrimary: { equals: title, mode: 'insensitive' } },
                ].filter(Boolean) as any,
              },
            })
            if (!game) {
              game = await prisma.game.create({
                data: {
                  titlePrimary: title,
                  igdbId: item.externalIds?.igdbId ? Number(item.externalIds.igdbId) : null,
                },
              })
            }
            const existing = await prisma.gameList.findUnique({
              where: { userId_gameId: { userId, gameId: game.id } },
            })
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.gameList.update({
                  where: { id: existing.id },
                  data: { status, progress: item.progress ?? existing.progress, score: score ?? existing.score },
                })
                updated++
                touchedMedia.set(`game:${game.id}`, { type: 'GAME', id: game.id })
              }
            } else {
              await prisma.gameList.create({
                data: { userId, gameId: game.id, status, progress: item.progress ?? 0, score, notes, private: isPrivate, startedAt, completedAt },
              })
              imported++
              touchedMedia.set(`game:${game.id}`, { type: 'GAME', id: game.id })
            }
            break
          }
          case 'book': {
            let book = await prisma.book.findFirst({
              where: {
                OR: [
                  item.externalIds?.googleBookId ? { googleBookId: String(item.externalIds.googleBookId) } : undefined,
                  item.externalIds?.isbn13 ? { isbn13: String(item.externalIds.isbn13) } : undefined,
                  { titlePrimary: { equals: title, mode: 'insensitive' } },
                ].filter(Boolean) as any,
              },
            })
            if (!book) {
              book = await prisma.book.create({
                data: {
                  titlePrimary: title,
                  googleBookId: item.externalIds?.googleBookId ? String(item.externalIds.googleBookId) : null,
                },
              })
            }
            const existing = await prisma.bookList.findUnique({
              where: { userId_bookId: { userId, bookId: book.id } },
            })
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.bookList.update({
                  where: { id: existing.id },
                  data: { status, progressPages: item.progressPages ?? existing.progressPages, score: score ?? existing.score },
                })
                updated++
                touchedMedia.set(`book:${book.id}`, { type: 'BOOK', id: book.id })
              }
            } else {
              await prisma.bookList.create({
                data: { userId, bookId: book.id, status, progressPages: item.progressPages ?? 0, score, notes, private: isPrivate, startedAt, completedAt },
              })
              imported++
              touchedMedia.set(`book:${book.id}`, { type: 'BOOK', id: book.id })
            }
            break
          }
          case 'music': {
            let music = await prisma.music.findFirst({
              where: {
                OR: [
                  item.externalIds?.deezerId ? { deezerId: String(item.externalIds.deezerId) } : undefined,
                  { titlePrimary: { equals: title, mode: 'insensitive' } },
                ].filter(Boolean) as any,
              },
            })
            if (!music) {
              music = await prisma.music.create({
                data: {
                  titlePrimary: title,
                  artistName: item.artistName || 'Unknown Artist',
                  deezerId: item.externalIds?.deezerId ? String(item.externalIds.deezerId) : null,
                },
              })
            }
            const existing = await prisma.musicList.findUnique({
              where: { userId_musicId: { userId, musicId: music.id } },
            })
            if (existing) {
              if (skipExisting) {
                skipped++
              } else {
                await prisma.musicList.update({
                  where: { id: existing.id },
                  data: { status, playCount: item.playCount ?? existing.playCount, score: score ?? existing.score },
                })
                updated++
                touchedMedia.set(`music:${music.id}`, { type: 'MUSIC', id: music.id })
              }
            } else {
              await prisma.musicList.create({
                data: { userId, musicId: music.id, status, playCount: item.playCount ?? 0, score, notes, private: isPrivate, startedAt, completedAt },
              })
              imported++
              touchedMedia.set(`music:${music.id}`, { type: 'MUSIC', id: music.id })
            }
            break
          }
          case 'custom_lists': {
            const listName = item.customListName || item.name || title
            let cList = await prisma.customList.findFirst({
              where: { userId, name: listName },
            })
            if (!cList) {
              cList = await prisma.customList.create({
                data: {
                  userId,
                  name: listName,
                  description: item.description ?? null,
                  isPrivate: isPrivate,
                },
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

    const [animeList, mangaList, tvList, movieList, gameList, bookList, musicList] = await Promise.all([
      prisma.animeList.findMany({
        where: { userId },
        include: { anime: { select: { averageScore: true, genres: { select: { name: true } } } } },
      }),
      prisma.mangaList.findMany({
        where: { userId },
        include: { manga: { select: { averageScore: true, genres: { select: { name: true } } } } },
      }),
      prisma.tvList.findMany({
        where: { userId },
        include: { tv: { select: { averageScore: true, genres: { select: { name: true } } } } },
      }),
      prisma.movieList.findMany({
        where: { userId },
        include: { movie: { select: { runtime: true, averageScore: true, genres: { select: { name: true } } } } },
      }),
      prisma.gameList.findMany({
        where: { userId },
        include: { game: { select: { averageScore: true, genres: { select: { name: true } } } } },
      }),
      prisma.bookList.findMany({
        where: { userId },
        include: { book: { select: { averageScore: true, genres: { select: { name: true } } } } },
      }),
      prisma.musicList.findMany({
        where: { userId },
        include: { music: { select: { duration: true, genres: { select: { name: true } } } } },
      }),
    ])

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
      if (e.status === 'PLANNING') planningCount++
    }

    let mangaMinutes = 0
    for (const e of fManga) {
      mangaMinutes += (e.chaptersProgress ?? 0) * 8
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNING') planningCount++
    }

    let tvMinutes = 0
    for (const e of fTv) {
      tvMinutes += (e.progress ?? 0) * 45
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNING') planningCount++
    }

    let movieMinutes = 0
    for (const e of fMovie) {
      movieMinutes += (e.status === 'COMPLETED' ? 1 : 0) * (e.movie?.runtime ?? 110)
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNING') planningCount++
    }

    let gameMinutes = 0
    for (const e of fGame) {
      gameMinutes += (e.progress ?? 0) * 60
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNING') planningCount++
    }

    let bookMinutes = 0
    for (const e of fBook) {
      bookMinutes += (e.progressPages ?? 0) * 1.5
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNING') planningCount++
    }

    let musicMinutes = 0
    for (const e of fMusic) {
      const dur = e.music?.duration ? e.music.duration / 60 : 3.5
      musicMinutes += (e.playCount ?? 0) * dur
      if (e.status === 'COMPLETED') completedTitles++
      if (e.status === 'PLANNING') planningCount++
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
    const shares = await prisma.listExportShare.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

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

    const share = await prisma.listExportShare.create({
      data: {
        userId,
        passwordHash,
        mediaTypes: params.mediaTypes,
        description: params.description || null,
        expiresAt,
      },
    })

    return {
      success: true,
      shareId: share.id,
      expiresAt: share.expiresAt?.toISOString() ?? null,
    }
  }

  public static async revokeExportShare(userId: string, shareId: string) {
    const share = await prisma.listExportShare.findFirst({
      where: { id: shareId, userId },
    })

    if (!share) {
      throw new NotFound('Export share link not found')
    }

    await prisma.listExportShare.delete({
      where: { id: share.id },
    })

    return {
      success: true,
      message: 'Export share link revoked successfully',
    }
  }
}


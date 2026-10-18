import {
  prisma,
  NotificationType,
  NotificationPriority,
  type AnimeListStatus,
  type MangaListStatus,
  type TvListStatus,
  type MovieListStatus,
  type GameListStatus,
  type BookListStatus,
  type MusicListStatus,
  type MediaType,
} from "@IRIS/database"
import {
  mediaDbSyncer,
  queueAnimeFetch,
  queueMangaFetch,
  queueTvFetch,
  queueMovieFetch,
  queueBookFetch,
  queueGameFetch,
  queueMusicTrackFetch,
} from "../media-queue/index.js"
import { sendNotification } from "../notification.service.js"
import { logger } from "../../utils/logger.js"
import type {
  IrisExternalIds,
  IrisListItemExport,
} from "./list-export.service.js"

export interface ImportItemPayload {
  mediaType:
    | "anime"
    | "manga"
    | "tv"
    | "movie"
    | "game"
    | "book"
    | "music"
    | "custom_lists"
  title: string
  externalIds: IrisExternalIds
  status: string
  progress?: number
  progressVolumes?: number | null
  progressPages?: number | null
  progressChapters?: number | null
  score?: number | null
  notes?: string | null
  rewatched?: number
  reread?: number
  replayed?: number
  playCount?: number
  startedAt?: string | null
  completedAt?: string | null
  connections?: unknown
  customListName?: string
  customNotes?: string | null
  order?: number
}

export interface ImportOptions {
  skipExisting?: boolean
}

export interface ImportExecutionResult {
  success: boolean
  imported: number
  updated: number
  skipped: number
  queued: number
  total: number
}

function parseDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function normalizeScore(score: unknown): number | null {
  if (score === null || score === undefined || score === "" || score === 0)
    return null
  const num = typeof score === "number" ? score : Number(score)
  if (isNaN(num) || num <= 0) return null
  const scaled = num > 10 ? num / 10 : num
  return Math.round(Math.min(10, Math.max(0, scaled)) * 10) / 10
}

function mergeConnections(
  existing: unknown,
  providerKey: string,
  externalId: string | number
): Record<string, { id: string | number; sync: boolean }> {
  const current =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : {}
  return {
    ...current,
    [providerKey.toLowerCase()]: { id: externalId, sync: true },
  } as Record<string, { id: string | number; sync: boolean }>
}

export class ListFileImportService {
  private static instance: ListFileImportService

  private constructor() {
    ListFileImportService.logStatus()
  }

  public static logStatus(): void {
    logger.service(
      "list-file-import",
      "media import with automatic external ID resolution & queuing"
    )
  }

  public static getInstance(): ListFileImportService {
    if (!ListFileImportService.instance) {
      ListFileImportService.instance = new ListFileImportService()
    }
    return ListFileImportService.instance
  }

  /**
   * Executes the import of an array of items for the authenticated user.
   * Queues missing media items in background workers via external IDs.
   */
  public async executeImport(
    userId: string,
    items: ImportItemPayload[],
    options: ImportOptions = {}
  ): Promise<ImportExecutionResult> {
    const result: ImportExecutionResult = {
      success: true,
      imported: 0,
      updated: 0,
      skipped: 0,
      queued: 0,
      total: items.length,
    }

    for (const item of items) {
      try {
        switch (item.mediaType) {
          case "anime":
            await this.importAnimeItem(userId, item, options, result)
            break
          case "manga":
            await this.importMangaItem(userId, item, options, result)
            break
          case "tv":
            await this.importTvItem(userId, item, options, result)
            break
          case "movie":
            await this.importMovieItem(userId, item, options, result)
            break
          case "game":
            await this.importGameItem(userId, item, options, result)
            break
          case "book":
            await this.importBookItem(userId, item, options, result)
            break
          case "music":
            await this.importMusicItem(userId, item, options, result)
            break
          case "custom_lists":
            await this.importCustomListItem(userId, item, options, result)
            break
        }
      } catch (err: any) {
        logger.warn(
          `[ListFileImport] Failed to import ${item.mediaType} "${item.title}": ${err?.message || err}`
        )
      }
    }

    // Send in-app notification upon completion
    try {
      await sendNotification({
        userId,
        app: "IRIS List",
        category: "Import",
        type: NotificationType.INFO,
        priority: NotificationPriority.NORMAL,
        content: {
          title: "Import Finished",
          body: `Processed ${result.total} item(s): ${result.imported} created, ${result.updated} updated${result.queued > 0 ? `, ${result.queued} queued for metadata enrichment` : ""}.`,
          link: "/settings?tab=lists",
        },
      })
    } catch {
      // Non-critical notification failure
    }

    return result
  }

  // 1. Anime Item Import
  private async importAnimeItem(
    userId: string,
    item: ImportItemPayload,
    options: ImportOptions,
    result: ImportExecutionResult
  ): Promise<void> {
    const { externalIds, title } = item
    const anilistId = externalIds.anilistId
      ? Number(externalIds.anilistId)
      : undefined
    const malId = externalIds.malId ? Number(externalIds.malId) : undefined
    const tvDBId = externalIds.tvDBId ? Number(externalIds.tvDBId) : undefined

    let anime = await prisma.anime.findFirst({
      where: {
        OR: [
          anilistId ? { anilistId } : undefined,
          malId ? { malId } : undefined,
          tvDBId ? { tvDBId } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    })

    if (!anime) {
      // Upsert minimal preview stub and enqueue background job
      const refId = anilistId || malId || Date.now()
      const preview = await mediaDbSyncer.upsertAnimeSearchPreview({
        id: refId,
        title: { userPreferred: title || "Unknown Anime" },
      })
      anime = { id: preview.id }
      result.queued++

      // Queue background metadata fetch
      if (anilistId) {
        void queueAnimeFetch(anilistId).catch(() => {})
      } else if (malId) {
        void queueAnimeFetch(malId).catch(() => {})
      }
    }

    const animeId = anime.id
    const existing = await prisma.animeList.findUnique({
      where: { userId_animeId: { userId, animeId } },
    })

    if (existing && options.skipExisting) {
      result.skipped++
      return
    }

    const mapStatus = (st: string): AnimeListStatus => {
      const u = st.toUpperCase()
      if (u === "WATCHING" || u === "CURRENT") return "WATCHING"
      if (u === "COMPLETED") return "COMPLETED"
      if (u === "ON_HOLD" || u === "ON-HOLD" || u === "PAUSED") return "ON_HOLD"
      if (u === "DROPPED") return "DROPPED"
      return "PLANNING"
    }

    let connections = existing?.connections
    if (anilistId)
      connections = mergeConnections(connections, "anilist", anilistId)
    if (malId) connections = mergeConnections(connections, "mal", malId)

    const status = mapStatus(item.status)
    const progress = item.progress ?? 0
    const score = normalizeScore(item.score)
    const notes = item.notes || null
    const startedAt = parseDate(item.startedAt)
    const completedAt = parseDate(item.completedAt)

    if (existing) {
      await prisma.animeList.update({
        where: { userId_animeId: { userId, animeId } },
        data: {
          status,
          progress: progress || existing.progress,
          score: score ?? existing.score,
          notes: notes ?? existing.notes,
          startedAt: startedAt ?? existing.startedAt,
          completedAt: completedAt ?? existing.completedAt,
          connections: connections ?? undefined,
        },
      })
      result.updated++
    } else {
      await prisma.animeList.create({
        data: {
          userId,
          animeId,
          status,
          progress,
          score,
          notes,
          rewatched: item.rewatched || 0,
          startedAt,
          completedAt,
          connections: connections ?? undefined,
        },
      })
      result.imported++
    }
  }

  // 2. Manga Item Import
  private async importMangaItem(
    userId: string,
    item: ImportItemPayload,
    options: ImportOptions,
    result: ImportExecutionResult
  ): Promise<void> {
    const { externalIds, title } = item
    const anilistId = externalIds.anilistId
      ? Number(externalIds.anilistId)
      : undefined
    const malId = externalIds.malId ? Number(externalIds.malId) : undefined

    let manga = await prisma.manga.findFirst({
      where: {
        OR: [
          anilistId ? { anilistId } : undefined,
          malId ? { malId } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    })

    if (!manga) {
      const refId = anilistId || malId || Date.now()
      const preview = await mediaDbSyncer.upsertMangaSearchPreview({
        id: refId,
        title: { userPreferred: title || "Unknown Manga" },
      })
      manga = { id: preview.id }
      result.queued++

      if (anilistId) {
        void queueMangaFetch(anilistId).catch(() => {})
      } else if (malId) {
        void queueMangaFetch(malId).catch(() => {})
      }
    }

    const mangaId = manga.id
    const existing = await prisma.mangaList.findUnique({
      where: { userId_mangaId: { userId, mangaId } },
    })

    if (existing && options.skipExisting) {
      result.skipped++
      return
    }

    const mapStatus = (st: string): MangaListStatus => {
      const u = st.toUpperCase()
      if (u === "READING" || u === "CURRENT") return "READING"
      if (u === "COMPLETED") return "COMPLETED"
      if (u === "ON_HOLD" || u === "ON-HOLD" || u === "PAUSED") return "ON_HOLD"
      if (u === "DROPPED") return "DROPPED"
      return "PLANNING"
    }

    let connections = existing?.connections
    if (anilistId)
      connections = mergeConnections(connections, "anilist", anilistId)
    if (malId) connections = mergeConnections(connections, "mal", malId)

    const status = mapStatus(item.status)
    const chaptersProgress = item.progressChapters ?? item.progress ?? 0
    const volumesProgress = item.progressVolumes ?? 0
    const score = normalizeScore(item.score)
    const notes = item.notes || null
    const startedAt = parseDate(item.startedAt)
    const completedAt = parseDate(item.completedAt)

    if (existing) {
      await prisma.mangaList.update({
        where: { userId_mangaId: { userId, mangaId } },
        data: {
          status,
          chaptersProgress: chaptersProgress || existing.chaptersProgress,
          volumesProgress: volumesProgress || existing.volumesProgress,
          score: score ?? existing.score,
          notes: notes ?? existing.notes,
          startedAt: startedAt ?? existing.startedAt,
          completedAt: completedAt ?? existing.completedAt,
          connections: connections ?? undefined,
        },
      })
      result.updated++
    } else {
      await prisma.mangaList.create({
        data: {
          userId,
          mangaId,
          status,
          chaptersProgress,
          volumesProgress,
          score,
          notes,
          reread: item.reread || 0,
          startedAt,
          completedAt,
          connections: connections ?? undefined,
        },
      })
      result.imported++
    }
  }

  // 3. TV Shows Import
  private async importTvItem(
    userId: string,
    item: ImportItemPayload,
    options: ImportOptions,
    result: ImportExecutionResult
  ): Promise<void> {
    const { externalIds, title } = item
    const tvDBId = externalIds.tvDBId ? Number(externalIds.tvDBId) : undefined
    const simklId = externalIds.simklId
      ? Number(externalIds.simklId)
      : undefined

    let tv = await prisma.tv.findFirst({
      where: {
        OR: [
          tvDBId ? { tvDBId } : undefined,
          simklId ? { simklId } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    })

    if (!tv) {
      if (tvDBId) {
        const preview = await mediaDbSyncer.upsertTvSearchPreview({
          tvdb_id: tvDBId,
          name: title || "Unknown TV Show",
        })
        tv = { id: preview.id }
        void queueTvFetch(tvDBId).catch(() => {})
      } else {
        const created = await prisma.tv.create({
          data: {
            titlePrimary: title || "Unknown TV Show",
            simklId: simklId || null,
          },
          select: { id: true },
        })
        tv = { id: created.id }
      }
      result.queued++
    }

    const tvId = tv.id
    const existing = await prisma.tvList.findUnique({
      where: { userId_tvId: { userId, tvId } },
    })

    if (existing && options.skipExisting) {
      result.skipped++
      return
    }

    const mapStatus = (st: string): TvListStatus => {
      const u = st.toUpperCase()
      if (u === "WATCHING" || u === "CURRENT") return "WATCHING"
      if (u === "COMPLETED") return "COMPLETED"
      if (u === "ON_HOLD" || u === "ON-HOLD" || u === "PAUSED") return "ON_HOLD"
      if (u === "DROPPED") return "DROPPED"
      return "PLANNING"
    }

    let connections = existing?.connections
    if (simklId) connections = mergeConnections(connections, "simkl", simklId)
    if (tvDBId) connections = mergeConnections(connections, "tvdb", tvDBId)

    const status = mapStatus(item.status)
    const progress = item.progress ?? 0
    const score = normalizeScore(item.score)
    const notes = item.notes || null
    const startedAt = parseDate(item.startedAt)
    const completedAt = parseDate(item.completedAt)

    if (existing) {
      await prisma.tvList.update({
        where: { userId_tvId: { userId, tvId } },
        data: {
          status,
          progress: progress || existing.progress,
          score: score ?? existing.score,
          notes: notes ?? existing.notes,
          startedAt: startedAt ?? existing.startedAt,
          completedAt: completedAt ?? existing.completedAt,
          connections: connections ?? undefined,
        },
      })
      result.updated++
    } else {
      await prisma.tvList.create({
        data: {
          userId,
          tvId,
          status,
          progress,
          score,
          notes,
          rewatched: item.rewatched || 0,
          startedAt,
          completedAt,
          connections: connections ?? undefined,
        },
      })
      result.imported++
    }
  }

  // 4. Movie Import
  private async importMovieItem(
    userId: string,
    item: ImportItemPayload,
    options: ImportOptions,
    result: ImportExecutionResult
  ): Promise<void> {
    const { externalIds, title } = item
    const tvDBId = externalIds.tvDBId ? Number(externalIds.tvDBId) : undefined
    const simklId = externalIds.simklId
      ? Number(externalIds.simklId)
      : undefined

    let movie = await prisma.movie.findFirst({
      where: {
        OR: [
          tvDBId ? { tvDBId } : undefined,
          simklId ? { simklId } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    })

    if (!movie) {
      if (tvDBId) {
        const preview = await mediaDbSyncer.upsertMovieSearchPreview({
          tvdb_id: tvDBId,
          name: title || "Unknown Movie",
        })
        movie = { id: preview.id }
        void queueMovieFetch(tvDBId).catch(() => {})
      } else {
        const created = await prisma.movie.create({
          data: {
            titlePrimary: title || "Unknown Movie",
            simklId: simklId || null,
          },
          select: { id: true },
        })
        movie = { id: created.id }
      }
      result.queued++
    }

    const movieId = movie.id
    const existing = await prisma.movieList.findUnique({
      where: { userId_movieId: { userId, movieId } },
    })

    if (existing && options.skipExisting) {
      result.skipped++
      return
    }

    const mapStatus = (st: string): MovieListStatus => {
      const u = st.toUpperCase()
      if (u === "WATCHING" || u === "CURRENT") return "WATCHING"
      if (u === "COMPLETED") return "COMPLETED"
      if (u === "DROPPED") return "DROPPED"
      return "PLANNING"
    }

    let connections = existing?.connections
    if (simklId) connections = mergeConnections(connections, "simkl", simklId)
    if (tvDBId) connections = mergeConnections(connections, "tvdb", tvDBId)

    const status = mapStatus(item.status)
    const score = normalizeScore(item.score)
    const notes = item.notes || null
    const startedAt = parseDate(item.startedAt)
    const completedAt = parseDate(item.completedAt)

    if (existing) {
      await prisma.movieList.update({
        where: { userId_movieId: { userId, movieId } },
        data: {
          status,
          score: score ?? existing.score,
          notes: notes ?? existing.notes,
          startedAt: startedAt ?? existing.startedAt,
          completedAt: completedAt ?? existing.completedAt,
          connections: connections ?? undefined,
        },
      })
      result.updated++
    } else {
      await prisma.movieList.create({
        data: {
          userId,
          movieId,
          status,
          score,
          notes,
          rewatched: item.rewatched || 0,
          startedAt,
          completedAt,
          connections: connections ?? undefined,
        },
      })
      result.imported++
    }
  }

  // 5. Game Import
  private async importGameItem(
    userId: string,
    item: ImportItemPayload,
    options: ImportOptions,
    result: ImportExecutionResult
  ): Promise<void> {
    const { externalIds, title } = item
    const igdbId = externalIds.igdbId ? Number(externalIds.igdbId) : undefined
    const steamAppId = externalIds.steamAppId
      ? Number(externalIds.steamAppId)
      : undefined

    let game = await prisma.game.findFirst({
      where: {
        OR: [
          igdbId ? { igdbId } : undefined,
          steamAppId ? { steamAppId } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    })

    if (!game) {
      const created = await prisma.game.create({
        data: {
          titlePrimary: title || "Unknown Game",
          igdbId: igdbId || null,
          steamAppId: steamAppId || null,
        },
        select: { id: true },
      })
      game = { id: created.id }
      result.queued++

      if (igdbId) {
        void queueGameFetch(igdbId).catch(() => {})
      }
    }

    const gameId = game.id
    const existing = await prisma.gameList.findUnique({
      where: { userId_gameId: { userId, gameId } },
    })

    if (existing && options.skipExisting) {
      result.skipped++
      return
    }

    const mapStatus = (st: string): GameListStatus => {
      const u = st.toUpperCase()
      if (u === "PLAYING" || u === "CURRENT") return "PLAYING"
      if (u === "COMPLETED") return "COMPLETED"
      if (u === "ON_HOLD" || u === "ON-HOLD" || u === "PAUSED") return "ON_HOLD"
      if (u === "DROPPED") return "DROPPED"
      return "PLANNING"
    }

    const status = mapStatus(item.status)
    const progress = item.progress ?? 0
    const score = normalizeScore(item.score)
    const notes = item.notes || null
    const startedAt = parseDate(item.startedAt)
    const completedAt = parseDate(item.completedAt)

    if (existing) {
      await prisma.gameList.update({
        where: { userId_gameId: { userId, gameId } },
        data: {
          status,
          progress: progress || existing.progress,
          score: score ?? existing.score,
          notes: notes ?? existing.notes,
          startedAt: startedAt ?? existing.startedAt,
          completedAt: completedAt ?? existing.completedAt,
        },
      })
      result.updated++
    } else {
      await prisma.gameList.create({
        data: {
          userId,
          gameId,
          status,
          progress,
          score,
          notes,
          replayed: item.replayed || 0,
          startedAt,
          completedAt,
        },
      })
      result.imported++
    }
  }

  // 6. Book Import
  private async importBookItem(
    userId: string,
    item: ImportItemPayload,
    options: ImportOptions,
    result: ImportExecutionResult
  ): Promise<void> {
    const { externalIds, title } = item
    const googleBookId = externalIds.googleBookId || undefined
    const isbn13 = externalIds.isbn13 || undefined

    let book = await prisma.book.findFirst({
      where: {
        OR: [
          googleBookId ? { googleBookId } : undefined,
          isbn13 ? { isbn13 } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    })

    if (!book) {
      const created = await prisma.book.create({
        data: {
          titlePrimary: title || "Unknown Book",
          googleBookId: googleBookId || null,
          isbn13: isbn13 || null,
        },
        select: { id: true },
      })
      book = { id: created.id }
      result.queued++

      if (googleBookId) {
        void queueBookFetch(googleBookId).catch(() => {})
      } else if (isbn13) {
        void queueBookFetch(isbn13).catch(() => {})
      }
    }

    const bookId = book.id
    const existing = await prisma.bookList.findUnique({
      where: { userId_bookId: { userId, bookId } },
    })

    if (existing && options.skipExisting) {
      result.skipped++
      return
    }

    const mapStatus = (st: string): BookListStatus => {
      const u = st.toUpperCase()
      if (u === "READING" || u === "CURRENT") return "READING"
      if (u === "COMPLETED") return "COMPLETED"
      if (u === "ON_HOLD" || u === "ON-HOLD" || u === "PAUSED") return "ON_HOLD"
      if (u === "DROPPED") return "DROPPED"
      return "PLANNING"
    }

    const status = mapStatus(item.status)
    const progressPages = item.progressPages ?? item.progress ?? 0
    const progressChapters = item.progressChapters ?? 0
    const progressVolumes = item.progressVolumes ?? 0
    const score = normalizeScore(item.score)
    const notes = item.notes || null
    const startedAt = parseDate(item.startedAt)
    const completedAt = parseDate(item.completedAt)

    if (existing) {
      await prisma.bookList.update({
        where: { userId_bookId: { userId, bookId } },
        data: {
          status,
          progressPages: progressPages || existing.progressPages,
          progressChapters: progressChapters || existing.progressChapters,
          progressVolumes: progressVolumes || existing.progressVolumes,
          score: score ?? existing.score,
          notes: notes ?? existing.notes,
          startedAt: startedAt ?? existing.startedAt,
          completedAt: completedAt ?? existing.completedAt,
        },
      })
      result.updated++
    } else {
      await prisma.bookList.create({
        data: {
          userId,
          bookId,
          status,
          progressPages,
          progressChapters,
          progressVolumes,
          score,
          notes,
          reread: item.reread || 0,
          startedAt,
          completedAt,
        },
      })
      result.imported++
    }
  }

  // 7. Music Import
  private async importMusicItem(
    userId: string,
    item: ImportItemPayload,
    options: ImportOptions,
    result: ImportExecutionResult
  ): Promise<void> {
    const { externalIds, title } = item
    const deezerId = externalIds.deezerId || undefined
    const isrc = externalIds.isrc || undefined

    let music = await prisma.music.findFirst({
      where: {
        OR: [
          deezerId ? { deezerId } : undefined,
          isrc ? { isrc } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    })

    if (!music) {
      const created = await prisma.music.create({
        data: {
          titlePrimary: title || "Unknown Track",
          deezerId: deezerId || null,
          isrc: isrc || null,
        },
        select: { id: true },
      })
      music = { id: created.id }
      result.queued++

      if (deezerId || title) {
        void queueMusicTrackFetch(deezerId || title).catch(() => {})
      }
    }

    const musicId = music.id
    const existing = await prisma.musicList.findUnique({
      where: { userId_musicId: { userId, musicId } },
    })

    if (existing && options.skipExisting) {
      result.skipped++
      return
    }

    const mapStatus = (st: string): MusicListStatus => {
      const u = st.toUpperCase()
      if (u === "LISTENING" || u === "CURRENT") return "LISTENING"
      if (u === "COMPLETED") return "COMPLETED"
      if (u === "ON_HOLD" || u === "ON-HOLD" || u === "PAUSED") return "ON_HOLD"
      if (u === "DROPPED") return "DROPPED"
      return "PLANNING"
    }

    const status = mapStatus(item.status)
    const playCount = item.playCount ?? item.progress ?? 0
    const score = normalizeScore(item.score)
    const notes = item.notes || null
    const startedAt = parseDate(item.startedAt)
    const completedAt = parseDate(item.completedAt)

    if (existing) {
      await prisma.musicList.update({
        where: { userId_musicId: { userId, musicId } },
        data: {
          status,
          playCount: playCount || existing.playCount,
          score: score ?? existing.score,
          notes: notes ?? existing.notes,
          startedAt: startedAt ?? existing.startedAt,
          completedAt: completedAt ?? existing.completedAt,
        },
      })
      result.updated++
    } else {
      await prisma.musicList.create({
        data: {
          userId,
          musicId,
          status,
          playCount,
          score,
          notes,
          startedAt,
          completedAt,
        },
      })
      result.imported++
    }
  }

  // 8. Custom Lists Import
  private async importCustomListItem(
    userId: string,
    item: ImportItemPayload,
    options: ImportOptions,
    result: ImportExecutionResult
  ): Promise<void> {
    const listName = item.customListName || "Imported Custom List"
    let customList = await prisma.customList.findFirst({
      where: { userId, name: listName },
    })

    if (!customList) {
      customList = await prisma.customList.create({
        data: {
          userId,
          name: listName,
          description: "Imported custom collection",
        },
      })
    }

    // Resolve media item
    const typeUpper = (item.mediaType || "ANIME").toUpperCase() as MediaType
    let mediaId: number | null = null

    if (typeUpper === "ANIME") {
      const a = await prisma.anime.findFirst({
        where: {
          OR: [
            item.externalIds.anilistId
              ? { anilistId: Number(item.externalIds.anilistId) }
              : undefined,
            item.externalIds.malId
              ? { malId: Number(item.externalIds.malId) }
              : undefined,
          ].filter(Boolean) as any,
        },
        select: { id: true },
      })
      if (a) mediaId = a.id
    }

    if (!mediaId) {
      result.skipped++
      return
    }

    const existingEntry = await prisma.customListEntry.findFirst({
      where: { listId: customList.id, mediaType: typeUpper, mediaId },
    })

    if (existingEntry) {
      result.skipped++
      return
    }

    await prisma.customListEntry.create({
      data: {
        listId: customList.id,
        mediaType: typeUpper,
        mediaId,
        order: item.order || 0,
        customNotes: item.customNotes || null,
        animeId: typeUpper === "ANIME" ? mediaId : null,
      },
    })
    result.imported++
  }
}

export const listFileImportService = ListFileImportService.getInstance()

import { prisma } from "@IRIS/database"
import { hashPassword, verifyPassword } from "../../utils/auth-crypto.js"
import { BadRequest, NotFound, Forbidden } from "../../utils/errors.js"
import { logger } from "../../utils/logger.js"

export interface IrisExternalIds {
  anilistId?: number | null
  malId?: number | null
  aniDBId?: number | null
  tvDBId?: number | null
  bangumiId?: number | null
  kitsuId?: number | null
  tmdbId?: number | null
  imdbId?: string | null
  simklId?: number | null
  tvmazeId?: number | null
  igdbId?: number | null
  steamAppId?: number | null
  rawgId?: number | null
  giantbombId?: string | null
  vndbId?: string | null
  googleBookId?: string | null
  isbn10?: string | null
  isbn13?: string | null
  openLibraryId?: string | null
  deezerId?: string | null
  isrc?: string | null
  upc?: string | null
  deezerArtistId?: string | null
}

export interface IrisListItemExport {
  externalIds: IrisExternalIds
  title: string
  status: string
  progress: number
  progressVolumes?: number | null
  progressPages?: number | null
  progressChapters?: number | null
  score: number | null
  notes: string | null
  rewatched?: number
  reread?: number
  replayed?: number
  playCount?: number
  private: boolean
  startedAt: string | null
  completedAt: string | null
  rewatchHistory?: unknown
  rereadHistory?: unknown
  replayHistory?: unknown
  connections?: unknown
}

export interface IrisCustomListEntryExport {
  mediaType: string
  externalIds: IrisExternalIds
  title: string
  order: number
  customNotes?: string | null
  addedAt: string
}

export interface IrisCustomListExport {
  id: string
  name: string
  description?: string | null
  isPrivate: boolean
  coverImage?: string | null
  order: number
  entries: IrisCustomListEntryExport[]
}

export interface IrisExportData {
  version: "1.0"
  exportedAt: string
  source: "IRIS"
  username: string
  lists: {
    anime?: IrisListItemExport[]
    manga?: IrisListItemExport[]
    tv?: IrisListItemExport[]
    movie?: IrisListItemExport[]
    game?: IrisListItemExport[]
    book?: IrisListItemExport[]
    music?: IrisListItemExport[]
    customLists?: IrisCustomListExport[]
  }
}

export class ListExportService {
  private static instance: ListExportService

  private constructor() {
    ListExportService.logStatus()
  }

  public static logStatus(): void {
    logger.service(
      "list-export",
      "media export & password-protected share service"
    )
  }

  public static getInstance(): ListExportService {
    if (!ListExportService.instance) {
      ListExportService.instance = new ListExportService()
    }
    return ListExportService.instance
  }

  /**
   * Generates the canonical IRIS JSON export object for a user based on requested media types.
   */
  public async generateIrisJsonExport(
    userId: string,
    requestedTypes?: string[]
  ): Promise<IrisExportData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    })

    if (!user) {
      throw new NotFound("User not found")
    }

    const types =
      requestedTypes && requestedTypes.length > 0
        ? requestedTypes
        : [
            "anime",
            "manga",
            "tv",
            "movie",
            "game",
            "book",
            "music",
            "custom_lists",
          ]

    const exportData: IrisExportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      source: "IRIS",
      username: user.username,
      lists: {},
    }

    // 1. Anime
    if (types.includes("anime")) {
      const items = await prisma.animeList.findMany({
        where: { userId },
        include: { anime: true },
        orderBy: { updatedAt: "desc" },
      })

      exportData.lists.anime = items.map((item) => ({
        externalIds: {
          anilistId: item.anime.anilistId,
          malId: item.anime.malId,
          aniDBId: item.anime.aniDBId,
          tvDBId: item.anime.tvDBId,
          bangumiId: item.anime.bangumiId,
          kitsuId: item.anime.kitsuId,
        },
        title: item.anime.titlePrimary,
        status: item.status,
        progress: item.progress,
        score: item.score,
        notes: item.notes,
        rewatched: item.rewatched,
        private: item.private,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        rewatchHistory: item.rewatchHistory,
        connections: item.connections,
      }))
    }

    // 2. Manga
    if (types.includes("manga")) {
      const items = await prisma.mangaList.findMany({
        where: { userId },
        include: { manga: true },
        orderBy: { updatedAt: "desc" },
      })

      exportData.lists.manga = items.map((item) => ({
        externalIds: {
          anilistId: item.manga.anilistId,
          malId: item.manga.malId,
          mangaUpdatesId: item.manga.mangaUpdatesId,
          bangumiId: item.manga.bangumiId,
          kitsuId: item.manga.kitsuId,
        },
        title: item.manga.titlePrimary,
        status: item.status,
        progress: item.chaptersProgress,
        progressVolumes: item.volumesProgress,
        score: item.score,
        notes: item.notes,
        reread: item.reread,
        private: item.private,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        rereadHistory: item.rereadHistory,
        connections: item.connections,
      }))
    }

    // 3. TV Shows
    if (types.includes("tv")) {
      const items = await prisma.tvList.findMany({
        where: { userId },
        include: { tv: true },
        orderBy: { updatedAt: "desc" },
      })

      exportData.lists.tv = items.map((item) => ({
        externalIds: {
          tvDBId: item.tv.tvDBId,
          tmdbId: item.tv.tmdbId,
          imdbId: item.tv.imdbId,
          simklId: item.tv.simklId,
          tvmazeId: item.tv.tvmazeId,
        },
        title: item.tv.titlePrimary,
        status: item.status,
        progress: item.progress,
        score: item.score,
        notes: item.notes,
        rewatched: item.rewatched,
        private: item.private,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        rewatchHistory: item.rewatchHistory,
        connections: item.connections,
      }))
    }

    // 4. Movies
    if (types.includes("movie")) {
      const items = await prisma.movieList.findMany({
        where: { userId },
        include: { movie: true },
        orderBy: { updatedAt: "desc" },
      })

      exportData.lists.movie = items.map((item) => ({
        externalIds: {
          tvDBId: item.movie.tvDBId,
          tmdbId: item.movie.tmdbId,
          imdbId: item.movie.imdbId,
          simklId: item.movie.simklId,
        },
        title: item.movie.titlePrimary,
        status: item.status,
        progress: item.status === "COMPLETED" ? 1 : 0,
        score: item.score,
        notes: item.notes,
        rewatched: item.rewatched,
        private: item.private,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        rewatchHistory: item.rewatchHistory,
        connections: item.connections,
      }))
    }

    // 5. Games
    if (types.includes("game")) {
      const items = await prisma.gameList.findMany({
        where: { userId },
        include: { game: true },
        orderBy: { updatedAt: "desc" },
      })

      exportData.lists.game = items.map((item) => ({
        externalIds: {
          igdbId: item.game.igdbId,
          steamAppId: item.game.steamAppId,
          rawgId: item.game.rawgId,
          giantbombId: item.game.giantbombId,
          vndbId: item.game.vndbId,
        },
        title: item.game.titlePrimary,
        status: item.status,
        progress: item.progress,
        score: item.score,
        notes: item.notes,
        replayed: item.replayed,
        private: item.private,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        replayHistory: item.replayHistory,
        connections: item.connections,
      }))
    }

    // 6. Books
    if (types.includes("book")) {
      const items = await prisma.bookList.findMany({
        where: { userId },
        include: { book: true },
        orderBy: { updatedAt: "desc" },
      })

      exportData.lists.book = items.map((item) => ({
        externalIds: {
          googleBookId: item.book.googleBookId,
          isbn10: item.book.isbn10,
          isbn13: item.book.isbn13,
          openLibraryId: item.book.openLibraryId,
        },
        title: item.book.titlePrimary,
        status: item.status,
        progress: item.progressChapters,
        progressPages: item.progressPages,
        progressChapters: item.progressChapters,
        progressVolumes: item.progressVolumes,
        score: item.score,
        notes: item.notes,
        reread: item.reread,
        private: item.private,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        rereadHistory: item.rereadHistory,
        connections: item.connections,
      }))
    }

    // 7. Music
    if (types.includes("music")) {
      const items = await prisma.musicList.findMany({
        where: { userId },
        include: { music: true },
        orderBy: { updatedAt: "desc" },
      })

      exportData.lists.music = items.map((item) => ({
        externalIds: {
          deezerId: item.music.deezerId,
          isrc: item.music.isrc,
          upc: item.music.upc,
          deezerArtistId: item.music.deezerArtistId,
        },
        title: item.music.titlePrimary,
        status: item.status,
        progress: item.playCount,
        playCount: item.playCount,
        score: item.score,
        notes: item.notes,
        private: item.private,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        connections: item.connections,
      }))
    }

    // 8. Custom Lists
    if (types.includes("custom_lists") || types.includes("custom")) {
      const customLists = await prisma.customList.findMany({
        where: { userId },
        include: {
          entries: {
            include: {
              anime: true,
              manga: true,
              tv: true,
              movie: true,
              game: true,
              book: true,
              music: true,
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      })

      exportData.lists.customLists = customLists.map((cl) => ({
        id: cl.id,
        name: cl.name,
        description: cl.description,
        isPrivate: cl.isPrivate,
        coverImage: cl.coverImage,
        order: cl.order,
        entries: cl.entries.map((e) => {
          let title = "Unknown Item"
          const externalIds: IrisExternalIds = {}

          if (e.mediaType === "ANIME" && e.anime) {
            title = e.anime.titlePrimary
            externalIds.anilistId = e.anime.anilistId
            externalIds.malId = e.anime.malId
            externalIds.tvDBId = e.anime.tvDBId
          } else if (e.mediaType === "MANGA" && e.manga) {
            title = e.manga.titlePrimary
            externalIds.anilistId = e.manga.anilistId
            externalIds.malId = e.manga.malId
          } else if (e.mediaType === "TV" && e.tv) {
            title = e.tv.titlePrimary
            externalIds.tvDBId = e.tv.tvDBId
            externalIds.simklId = e.tv.simklId
          } else if (e.mediaType === "MOVIE" && e.movie) {
            title = e.movie.titlePrimary
            externalIds.tvDBId = e.movie.tvDBId
            externalIds.simklId = e.movie.simklId
          } else if (e.mediaType === "GAME" && e.game) {
            title = e.game.titlePrimary
            externalIds.igdbId = e.game.igdbId
            externalIds.steamAppId = e.game.steamAppId
          } else if (e.mediaType === "BOOK" && e.book) {
            title = e.book.titlePrimary
            externalIds.googleBookId = e.book.googleBookId
            externalIds.isbn13 = e.book.isbn13
          } else if (e.mediaType === "MUSIC" && e.music) {
            title = e.music.titlePrimary
            externalIds.deezerId = e.music.deezerId
          }

          return {
            mediaType: e.mediaType.toLowerCase(),
            externalIds,
            title,
            order: e.order,
            customNotes: e.customNotes,
            addedAt: e.addedAt.toISOString(),
          }
        }),
      }))
    }

    return exportData
  }

  /**
   * Generates MAL standard XML export for Anime and Manga.
   */
  public async generateMalXmlExport(
    userId: string,
    requestedTypes?: string[]
  ): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    })

    if (!user) {
      throw new NotFound("User not found")
    }

    const types =
      requestedTypes && requestedTypes.length > 0
        ? requestedTypes
        : ["anime", "manga"]
    const includeAnime = types.includes("anime")
    const includeManga = types.includes("manga")

    const formatDate = (date: Date | null | undefined): string => {
      if (!date) return "0000-00-00"
      return date.toISOString().split("T")[0] || "0000-00-00"
    }

    const mapAnimeStatus = (st: string): string => {
      switch (st) {
        case "WATCHING":
          return "Watching"
        case "COMPLETED":
          return "Completed"
        case "ON_HOLD":
          return "On-Hold"
        case "DROPPED":
          return "Dropped"
        case "PLANNING":
        default:
          return "Plan to Watch"
      }
    }

    const mapMangaStatus = (st: string): string => {
      switch (st) {
        case "READING":
          return "Reading"
        case "COMPLETED":
          return "Completed"
        case "ON_HOLD":
          return "On-Hold"
        case "DROPPED":
          return "Dropped"
        case "PLANNING":
        default:
          return "Plan to Read"
      }
    }

    let xml = `<?xml version="1.0" encoding="UTF-8" ?>\n`
    xml += `<!--\n  Exported from IRIS\n  Date: ${new Date().toISOString()}\n-->\n`
    xml += `<myanimelist>\n`
    xml += `  <myinfo>\n`
    xml += `    <user_name><![CDATA[${user.username}]]></user_name>\n`
    xml += `    <user_export_type>${includeAnime && !includeManga ? "1" : !includeAnime && includeManga ? "2" : "1"}</user_export_type>\n`
    xml += `  </myinfo>\n`

    if (includeAnime) {
      const animeItems = await prisma.animeList.findMany({
        where: { userId },
        include: { anime: true },
        orderBy: { updatedAt: "desc" },
      })

      for (const item of animeItems) {
        const malId = item.anime.malId || 0
        xml += `  <anime>\n`
        xml += `    <series_animedb_id>${malId}</series_animedb_id>\n`
        xml += `    <series_title><![CDATA[${item.anime.titlePrimary}]]></series_title>\n`
        xml += `    <series_type>${item.anime.format || "TV"}</series_type>\n`
        xml += `    <series_episodes>${item.anime.episodeCount || 0}</series_episodes>\n`
        xml += `    <my_id>${item.id}</my_id>\n`
        xml += `    <my_watched_episodes>${item.progress}</my_watched_episodes>\n`
        xml += `    <my_start_date>${formatDate(item.startedAt)}</my_start_date>\n`
        xml += `    <my_finish_date>${formatDate(item.completedAt)}</my_finish_date>\n`
        xml += `    <my_score>${item.score || 0}</my_score>\n`
        xml += `    <my_status>${mapAnimeStatus(item.status)}</my_status>\n`
        xml += `    <my_comments><![CDATA[${item.notes || ""}]]></my_comments>\n`
        xml += `    <my_times_watched>${item.rewatched || 0}</my_times_watched>\n`
        xml += `    <update_on_import>0</update_on_import>\n`
        xml += `  </anime>\n`
      }
    }

    if (includeManga) {
      const mangaItems = await prisma.mangaList.findMany({
        where: { userId },
        include: { manga: true },
        orderBy: { updatedAt: "desc" },
      })

      for (const item of mangaItems) {
        const malId = item.manga.malId || 0
        xml += `  <manga>\n`
        xml += `    <manga_mangadb_id>${malId}</manga_mangadb_id>\n`
        xml += `    <manga_title><![CDATA[${item.manga.titlePrimary}]]></manga_title>\n`
        xml += `    <manga_volumes>${item.manga.volumeCount || 0}</manga_volumes>\n`
        xml += `    <manga_chapters>${item.manga.chapterCount || 0}</manga_chapters>\n`
        xml += `    <my_id>${item.id}</my_id>\n`
        xml += `    <my_read_volumes>${item.volumesProgress || 0}</my_read_volumes>\n`
        xml += `    <my_read_chapters>${item.chaptersProgress || 0}</my_read_chapters>\n`
        xml += `    <my_start_date>${formatDate(item.startedAt)}</my_start_date>\n`
        xml += `    <my_finish_date>${formatDate(item.completedAt)}</my_finish_date>\n`
        xml += `    <my_score>${item.score || 0}</my_score>\n`
        xml += `    <my_status>${mapMangaStatus(item.status)}</my_status>\n`
        xml += `    <my_comments><![CDATA[${item.notes || ""}]]></my_comments>\n`
        xml += `    <my_times_read>${item.reread || 0}</my_times_read>\n`
        xml += `    <update_on_import>0</update_on_import>\n`
        xml += `  </manga>\n`
      }
    }

    xml += `</myanimelist>\n`
    return xml
  }

  /**
   * Creates a new password-protected export share link record.
   */
  public async createShare(
    userId: string,
    params: {
      password: string
      mediaTypes: string[]
      description?: string
      expiresInHours?: number | null // null for never
    }
  ): Promise<{ shareId: string; expiresAt: string | null }> {
    if (!params.password || params.password.length < 4) {
      throw new BadRequest("Export password must be at least 4 characters")
    }

    if (!params.mediaTypes || params.mediaTypes.length === 0) {
      throw new BadRequest("Please select at least one media type to export")
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
      shareId: share.id,
      expiresAt: share.expiresAt?.toISOString() ?? null,
    }
  }

  /**
   * Lists all active export shares for a user.
   */
  public async listShares(userId: string) {
    const shares = await prisma.listExportShare.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })

    return shares.map((s) => ({
      id: s.id,
      description: s.description,
      mediaTypes: s.mediaTypes,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt?.toISOString() ?? null,
      lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
      isExpired: s.expiresAt ? s.expiresAt.getTime() < Date.now() : false,
    }))
  }

  /**
   * Revokes (deletes) an export share link.
   */
  public async revokeShare(userId: string, shareId: string): Promise<void> {
    const share = await prisma.listExportShare.findFirst({
      where: { id: shareId, userId },
    })

    if (!share) {
      throw new NotFound("Export share link not found")
    }

    await prisma.listExportShare.delete({
      where: { id: shareId },
    })
  }

  /**
   * Validates password and fetches live export data for a remote client.
   */
  public async fetchSharePayload(
    shareId: string,
    password: string
  ): Promise<IrisExportData> {
    const share = await prisma.listExportShare.findUnique({
      where: { id: shareId },
    })

    if (!share) {
      throw new NotFound("Export share link not found or has been revoked")
    }

    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      throw new Forbidden("This export share link has expired")
    }

    const isValid = await verifyPassword(password, share.passwordHash)
    if (!isValid) {
      throw new Forbidden("Invalid export password")
    }

    // Update last used timestamp
    await prisma.listExportShare
      .update({
        where: { id: shareId },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {})

    return await this.generateIrisJsonExport(share.userId, share.mediaTypes)
  }
}

export const listExportService = ListExportService.getInstance()

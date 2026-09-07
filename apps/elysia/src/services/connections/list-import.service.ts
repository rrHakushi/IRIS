import { prisma, NotificationType, NotificationPriority } from "@IRIS/database"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionProvider,
  type ConnectionCredentials,
} from "@IRIS/connections"
import {
  mediaDbSyncer,
  mediaQueueService,
} from "../media-queue/index.js"
import { AnimeMappingProvider } from "../media-queue/providers/anime-mapping.provider.js"
import { deezerPlaylistService } from "./deezer-playlist.service.js"
import { sendNotification } from "../notification.service.js"
import { logger } from "../../utils/logger.js"
import { BadRequest, NotFound } from "../../utils/errors.js"

export interface FailedImportItem {
  title: string
  providerId: string | number
  reason: string
  mediaType: string
}

export interface ImportOptions {
  mediaTypes?: string[]
  customLists?: boolean
}

class ImportMutex {
  private queue: Promise<void> = Promise.resolve()

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void
    const next = new Promise<void>((res) => (release = res))
    const prev = this.queue
    this.queue = next
    await prev
    try {
      return await fn()
    } finally {
      release!()
    }
  }
}

const userImportMutexes = new Map<string, ImportMutex>()

function getUserMutex(userId: string): ImportMutex {
  let mutex = userImportMutexes.get(userId)
  if (!mutex) {
    mutex = new ImportMutex()
    userImportMutexes.set(userId, mutex)
  }
  return mutex
}

function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "") return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === "number") {
    const ms = val < 1e11 ? val * 1000 : val
    const date = new Date(ms)
    return isNaN(date.getTime()) ? null : date
  }
  if (typeof val === "string") {
    const date = new Date(val)
    return isNaN(date.getTime()) ? null : date
  }
  return null
}

function fuzzyDateToDate(
  fuzzy?: { year?: number; month?: number; day?: number } | null
): Date | null {
  if (!fuzzy || !fuzzy.year) return null
  const month = fuzzy.month ? fuzzy.month - 1 : 0
  const day = fuzzy.day || 1
  const d = new Date(fuzzy.year, month, day)
  return isNaN(d.getTime()) ? null : d
}

function normalizeScore(score: unknown): number | null {
  if (score === null || score === undefined || score === "" || score === 0) return null
  const num = typeof score === "number" ? score : Number(score)
  if (isNaN(num) || num <= 0) return null
  const scaled = num > 10 ? num / 10 : num
  const clamped = Math.min(10, Math.max(0, scaled))
  return Math.round(clamped * 10) / 10
}

function mergeConnectionsJson(
  existingConnections: unknown,
  providerKey: string,
  externalId: string | number
): Record<string, { id: string | number; sync: boolean }> {
  const current =
    existingConnections && typeof existingConnections === "object"
      ? { ...(existingConnections as Record<string, unknown>) }
      : {}

  return {
    ...current,
    [providerKey.toLowerCase()]: { id: externalId, sync: true },
  } as Record<string, { id: string | number; sync: boolean }>
}

export class ListImportService {
  private static instance: ListImportService
  private activeUserImports = new Set<string>()
  private animeMapping = new AnimeMappingProvider()

  private constructor() {
    ListImportService.logStatus()
  }

  public static logStatus(): void {
    logger.service(
      "list-import",
      "multi-provider tracking list and custom list importer"
    )
  }

  public static getInstance(): ListImportService {
    if (!ListImportService.instance) {
      ListImportService.instance = new ListImportService()
    }
    return ListImportService.instance
  }

  private async sendImportNotification(
    userId: string,
    title: string,
    body: string,
    icon?: string,
    type: NotificationType = NotificationType.INFO,
    priority: NotificationPriority = NotificationPriority.NORMAL
  ): Promise<void> {
    try {
      await sendNotification({
        userId,
        app: "IRIS List",
        category: "Import",
        type,
        priority,
        content: {
          title,
          body,
          icon,
          link: `/settings?tab=lists`,
        },
      })
    } catch (err: any) {
      logger.warn(
        `[ListImport] Failed to deliver import notification to user ${userId}: ${err?.message || err}`
      )
    }
  }

  public async startImport(
    userId: string,
    providerName: string,
    options?: ImportOptions
  ): Promise<{ success: boolean; status: string; message: string }> {
    const providerKey = providerName.toUpperCase() as ConnectionProvider
    const stateKey = `${userId}:${providerKey.toLowerCase()}`

    if (this.activeUserImports.has(stateKey)) {
      throw new BadRequest(
        `An import is already in progress for ${providerKey}`
      )
    }

    // Lookup connection in database
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        OR: [
          { provider: providerKey as any },
          { id: providerName },
        ],
      },
    })

    if (!connection) {
      throw new NotFound(`No connection found for provider ${providerKey}`)
    }

    this.activeUserImports.add(stateKey)

    // Run execution in background without blocking response
    const mutex = getUserMutex(userId)
    void mutex
      .runExclusive(async () => {
        await this.executeImport(userId, connection, providerKey, options)
      })
      .catch(async (err) => {
        logger.error(
          `[ListImport] Background import crashed for user ${userId} on ${providerKey}: ${err?.message || err}`
        )
        await this.sendImportNotification(
          userId,
          `Import Failed (${providerKey})`,
          `Failed to import from ${providerKey}: ${err?.message || "Internal error during list import"}`,
          undefined,
          NotificationType.INFO,
          NotificationPriority.HIGH
        )
      })
      .finally(() => {
        this.activeUserImports.delete(stateKey)
      })

    return {
      success: true,
      status: "processing",
      message: `Import from ${providerKey} started`,
    }
  }

  private async executeImport(
    userId: string,
    connection: {
      id: string
      provider: string
      encryptedData: string
      externalId: string | null
    },
    providerKey: ConnectionProvider,
    options?: ImportOptions
  ): Promise<void> {
    let credentials: ConnectionCredentials
    try {
      credentials = decryptConnectionData<ConnectionCredentials>(
        connection.encryptedData,
        userId
      )
    } catch (err: any) {
      logger.error(
        `[ListImport] Failed to decrypt connection credentials for user ${userId}: ${err?.message || err}`
      )
      await this.sendImportNotification(
        userId,
        `Import Failed (${providerKey})`,
        `Failed to decrypt credentials for ${providerKey}. Please reconnect your account.`,
        undefined,
        NotificationType.INFO,
        NotificationPriority.HIGH
      )
      return
    }

    try {
      if (providerKey === "DEEZER") {
        await this.importDeezer(userId, credentials)
      } else if (providerKey === "ANILIST") {
        await this.importAniList(userId, connection, credentials, options)
      } else if (providerKey === "MAL") {
        await this.importMal(userId, credentials, options)
      } else if (providerKey === "SIMKL") {
        await this.importSimkl(userId, credentials, options)
      } else if (providerKey === "BANGUMI") {
        await this.importBangumi(userId, connection, credentials, options)
      }
    } catch (err: any) {
      logger.error(
        `[ListImport] Error during ${providerKey} import for user ${userId}: ${err?.message || err}`
      )
      await this.sendImportNotification(
        userId,
        `Import Failed (${providerKey})`,
        `An error occurred while importing from ${providerKey}: ${err?.message || "Unknown error"}`,
        undefined,
        NotificationType.INFO,
        NotificationPriority.HIGH
      )
    }
  }

  // ===========================================================================
  // 1. DEEZER IMPORT
  // ===========================================================================
  private async importDeezer(
    userId: string,
    credentials: ConnectionCredentials
  ): Promise<void> {
    if (!credentials.accessToken) {
      throw new BadRequest("Deezer connection is missing an access token")
    }

    const res = await deezerPlaylistService.importUserPlaylists(
      userId,
      credentials.accessToken
    )

    if (!res.success) {
      throw new Error(res.error || "Failed to import Deezer playlists")
    }

    await this.sendImportNotification(
      userId,
      "Playlists Imported",
      `Finished importing your playlists from Deezer (${res.playlistsImported} playlist(s), ${res.tracksImported} track(s)).`,
      "https://e-cdns-files.dzcdn.net/img/common/favicon/favicon.ico"
    )
  }

  // ===========================================================================
  // 2. ANILIST IMPORT
  // ===========================================================================
  private async importAniList(
    userId: string,
    connection: { externalId: string | null },
    credentials: ConnectionCredentials,
    options?: ImportOptions
  ): Promise<void> {
    if (!credentials.accessToken) {
      throw new BadRequest("AniList connection is missing an access token")
    }

    let numericUserId = connection.externalId ? Number(connection.externalId) : null
    if (!numericUserId || isNaN(numericUserId)) {
      const viewerRes = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        body: JSON.stringify({
          query: `query { Viewer { id name } }`,
        }),
      })
      const viewerJson = (await viewerRes.json()) as any
      numericUserId = viewerJson?.data?.Viewer?.id
    }

    if (!numericUserId) {
      throw new Error("Could not resolve AniList numeric user ID")
    }

    const requestedTypes = options?.mediaTypes || ["anime", "manga", "custom_lists"]
    const shouldFetchAnime = requestedTypes.includes("anime")
    const shouldFetchManga = requestedTypes.includes("manga")
    const shouldFetchCustomLists =
      options?.customLists !== false && requestedTypes.includes("custom_lists")

    const query = `
      query ($userId: Int, $type: MediaType) {
        MediaListCollection (userId: $userId, type: $type) {
          lists {
            name
            isCustomList
            status
            entries {
              status
              score (format: POINT_10_DECIMAL)
              progress
              progressVolumes
              repeat
              notes
              startedAt { year month day }
              completedAt { year month day }
              media {
                id
                idMal
                type
                format
                status
                episodes
                chapters
                volumes
                title {
                  romaji
                  english
                  native
                  userPreferred
                }
                coverImage {
                  extraLarge
                  large
                  medium
                }
                bannerImage
              }
            }
          }
        }
      }
    `

    const fetchCollection = async (type: "ANIME" | "MANGA") => {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        body: JSON.stringify({ query, variables: { userId: numericUserId, type } }),
      })
      if (!res.ok) {
        throw new Error(`AniList ${type} list query failed: HTTP ${res.status}`)
      }
      const data = (await res.json()) as any
      return (data?.data?.MediaListCollection?.lists as any[]) || []
    }

    const [animeLists, mangaLists] = await Promise.all([
      shouldFetchAnime ? fetchCollection("ANIME") : Promise.resolve([]),
      shouldFetchManga ? fetchCollection("MANGA") : Promise.resolve([]),
    ])

    const icon = "https://cdn.simpleicons.org/anilist/02A9FF"

    // 2.1 Process AniList Anime List
    if (shouldFetchAnime) {
      let importedAnime = 0
      let failedAnime = 0

      for (const list of animeLists) {
        if (list.isCustomList) continue
        for (const entry of list.entries || []) {
          const media = entry.media
          const title =
            media.title?.userPreferred ||
            media.title?.english ||
            media.title?.romaji ||
            media.title?.native ||
            `AniList ${media.id}`

          try {
            const dbAnime = await this.ensureAnimeInDb(media.id, media.idMal, title, media)
            const animeId = dbAnime.id

            let status: "PLANNING" | "WATCHING" | "COMPLETED" | "ON_HOLD" | "DROPPED" = "PLANNING"
            if (entry.status === "CURRENT" || entry.status === "REPEATING") status = "WATCHING"
            else if (entry.status === "COMPLETED") status = "COMPLETED"
            else if (entry.status === "PAUSED") status = "ON_HOLD"
            else if (entry.status === "DROPPED") status = "DROPPED"

            const existing = await prisma.animeList.findUnique({
              where: { userId_animeId: { userId, animeId } },
            })

            const connections = mergeConnectionsJson(
              existing?.connections,
              "anilist",
              media.id
            )

            await prisma.animeList.upsert({
              where: { userId_animeId: { userId, animeId } },
              create: {
                userId,
                animeId,
                status,
                progress: entry.progress || 0,
                score: normalizeScore(entry.score),
                notes: entry.notes || null,
                startedAt: fuzzyDateToDate(entry.startedAt),
                completedAt: fuzzyDateToDate(entry.completedAt),
                connections,
              },
              update: {
                status,
                progress: entry.progress || existing?.progress || 0,
                score: normalizeScore(entry.score) || existing?.score || null,
                notes: entry.notes || existing?.notes || null,
                startedAt: fuzzyDateToDate(entry.startedAt) || existing?.startedAt,
                completedAt: fuzzyDateToDate(entry.completedAt) || existing?.completedAt,
                connections,
              },
            })
            importedAnime++
          } catch (err: any) {
            logger.warn(`[ListImport] AniList anime import failed for "${title}": ${err?.message || err}`)
            failedAnime++
          }
        }
      }

      if (importedAnime > 0 || failedAnime > 0) {
        await this.sendImportNotification(
          userId,
          "Anime List Imported",
          `Finished importing your Anime list from AniList (${importedAnime} item${importedAnime === 1 ? "" : "s"} imported${failedAnime > 0 ? `, ${failedAnime} failed` : ""}).`,
          icon
        )
      }
    }

    // 2.2 Process AniList Manga List
    if (shouldFetchManga) {
      let importedManga = 0
      let failedManga = 0

      for (const list of mangaLists) {
        if (list.isCustomList) continue
        for (const entry of list.entries || []) {
          const media = entry.media
          const title =
            media.title?.userPreferred ||
            media.title?.english ||
            media.title?.romaji ||
            media.title?.native ||
            `AniList ${media.id}`

          try {
            const dbManga = await this.ensureMangaInDb(media.id, media.idMal, title, media)
            const mangaId = dbManga.id

            let status: "PLANNING" | "READING" | "COMPLETED" | "ON_HOLD" | "DROPPED" = "PLANNING"
            if (entry.status === "CURRENT") status = "READING"
            else if (entry.status === "COMPLETED") status = "COMPLETED"
            else if (entry.status === "PAUSED") status = "ON_HOLD"
            else if (entry.status === "DROPPED") status = "DROPPED"

            const existing = await prisma.mangaList.findUnique({
              where: { userId_mangaId: { userId, mangaId } },
            })

            const connections = mergeConnectionsJson(
              existing?.connections,
              "anilist",
              media.id
            )

            await prisma.mangaList.upsert({
              where: { userId_mangaId: { userId, mangaId } },
              create: {
                userId,
                mangaId,
                status,
                chaptersProgress: entry.progress || 0,
                volumesProgress: entry.progressVolumes || 0,
                score: normalizeScore(entry.score),
                notes: entry.notes || null,
                startedAt: fuzzyDateToDate(entry.startedAt),
                completedAt: fuzzyDateToDate(entry.completedAt),
                connections,
              },
              update: {
                status,
                chaptersProgress: entry.progress || existing?.chaptersProgress || 0,
                volumesProgress: entry.progressVolumes || existing?.volumesProgress || 0,
                score: normalizeScore(entry.score) || existing?.score || null,
                notes: entry.notes || existing?.notes || null,
                startedAt: fuzzyDateToDate(entry.startedAt) || existing?.startedAt,
                completedAt: fuzzyDateToDate(entry.completedAt) || existing?.completedAt,
                connections,
              },
            })
            importedManga++
          } catch (err: any) {
            logger.warn(`[ListImport] AniList manga import failed for "${title}": ${err?.message || err}`)
            failedManga++
          }
        }
      }

      if (importedManga > 0 || failedManga > 0) {
        await this.sendImportNotification(
          userId,
          "Manga List Imported",
          `Finished importing your Manga list from AniList (${importedManga} item${importedManga === 1 ? "" : "s"} imported${failedManga > 0 ? `, ${failedManga} failed` : ""}).`,
          icon
        )
      }
    }

    // 2.3 Process AniList Custom Lists
    if (shouldFetchCustomLists) {
      let importedCustom = 0
      const allCustomLists = [...animeLists, ...mangaLists].filter((l) => Boolean(l.isCustomList))

      for (const list of allCustomLists) {
        let order = 0
        for (const entry of list.entries || []) {
          const media = entry.media
          const title =
            media.title?.userPreferred ||
            media.title?.english ||
            media.title?.romaji ||
            `AniList ${media.id}`

          try {
            if (media.type === "ANIME") {
              const dbAnime = await this.ensureAnimeInDb(media.id, media.idMal, title, media)
              await this.addToCustomList(userId, list.name, "ANIME", dbAnime.id, order++)
            } else {
              const dbManga = await this.ensureMangaInDb(media.id, media.idMal, title, media)
              await this.addToCustomList(userId, list.name, "MANGA", dbManga.id, order++)
            }
            importedCustom++
          } catch (err: any) {
            logger.warn(`[ListImport] AniList custom list item failed for "${title}": ${err?.message || err}`)
          }
        }
      }

      if (allCustomLists.length > 0) {
        await this.sendImportNotification(
          userId,
          "Custom Lists Imported",
          `Finished importing ${allCustomLists.length} custom collection(s) with ${importedCustom} items from AniList.`,
          icon
        )
      }
    }
  }

  // ===========================================================================
  // 3. MAL IMPORT
  // ===========================================================================
  private async importMal(
    userId: string,
    credentials: ConnectionCredentials,
    options?: ImportOptions
  ): Promise<void> {
    if (!credentials.accessToken) {
      throw new BadRequest("MyAnimeList connection is missing an access token")
    }

    let token = credentials.accessToken
    if (credentials.refreshToken && credentials.expiresAt) {
      const expiresAtDate = new Date(credentials.expiresAt)
      if (expiresAtDate.getTime() - Date.now() < 300000) {
        try {
          const adapter = getConnectionAdapter("MAL" as ConnectionProvider) as any
          const refreshed = await adapter.refreshAccessToken(credentials.refreshToken)
          token = refreshed.accessToken
        } catch {
          // Proceed with current token
        }
      }
    }

    const requestedTypes = options?.mediaTypes || ["anime", "manga"]
    const shouldFetchAnime = requestedTypes.includes("anime")
    const shouldFetchManga = requestedTypes.includes("manga")

    const fetchAllPages = async (initialUrl: string) => {
      let nextUrl: string | null = initialUrl
      const entries: any[] = []
      while (nextUrl) {
        const res = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          throw new Error(`Failed to fetch MAL list: HTTP ${res.status}`)
        }
        const json = (await res.json()) as any
        if (json.data && Array.isArray(json.data)) {
          entries.push(...json.data)
        }
        nextUrl = json.paging?.next || null
      }
      return entries
    }

    const icon = "https://cdn.simpleicons.org/myanimelist/2E51A2"

    // 3.1 MAL Anime List
    if (shouldFetchAnime) {
      let importedAnime = 0
      let failedAnime = 0

      const animeEntries = await fetchAllPages(
        "https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status{status,score,num_episodes_watched,comments,start_date,finish_date},alternative_titles,num_episodes,main_picture&limit=1000"
      )

      for (const item of animeEntries) {
        const node = item.node
        const listStatus = item.list_status || {}
        const title = node.title || `MAL Anime ${node.id}`

        try {
          const dbAnime = await this.ensureAnimeInDb(undefined, node.id, title, {
            coverImage: { large: node.main_picture?.large || node.main_picture?.medium },
            episodes: node.num_episodes,
          })
          const animeId = dbAnime.id

          let status: "PLANNING" | "WATCHING" | "COMPLETED" | "ON_HOLD" | "DROPPED" = "PLANNING"
          if (listStatus.status === "watching") status = "WATCHING"
          else if (listStatus.status === "completed") status = "COMPLETED"
          else if (listStatus.status === "on_hold") status = "ON_HOLD"
          else if (listStatus.status === "dropped") status = "DROPPED"

          const existing = await prisma.animeList.findUnique({
            where: { userId_animeId: { userId, animeId } },
          })

          const connections = mergeConnectionsJson(
            existing?.connections,
            "mal",
            node.id
          )

          await prisma.animeList.upsert({
            where: { userId_animeId: { userId, animeId } },
            create: {
              userId,
              animeId,
              status,
              progress: listStatus.num_episodes_watched || 0,
              score: normalizeScore(listStatus.score),
              notes: listStatus.comments || null,
              startedAt: parseDate(listStatus.start_date),
              completedAt: parseDate(listStatus.finish_date),
              connections,
            },
            update: {
              status,
              progress: listStatus.num_episodes_watched || existing?.progress || 0,
              score: normalizeScore(listStatus.score) || existing?.score || null,
              notes: listStatus.comments || existing?.notes || null,
              startedAt: parseDate(listStatus.start_date) || existing?.startedAt,
              completedAt: parseDate(listStatus.finish_date) || existing?.completedAt,
              connections,
            },
          })
          importedAnime++
        } catch (err: any) {
          logger.warn(`[ListImport] MAL anime import failed for "${title}": ${err?.message || err}`)
          failedAnime++
        }
      }

      if (animeEntries.length > 0) {
        await this.sendImportNotification(
          userId,
          "Anime List Imported",
          `Finished importing your Anime list from MyAnimeList (${importedAnime} item${importedAnime === 1 ? "" : "s"} imported${failedAnime > 0 ? `, ${failedAnime} failed` : ""}).`,
          icon
        )
      }
    }

    // 3.2 MAL Manga List
    if (shouldFetchManga) {
      let importedManga = 0
      let failedManga = 0

      const mangaEntries = await fetchAllPages(
        "https://api.myanimelist.net/v2/users/@me/mangalist?fields=list_status{status,score,num_chapters_read,num_volumes_read,comments,start_date,finish_date},alternative_titles,num_chapters,num_volumes,main_picture&limit=1000"
      )

      for (const item of mangaEntries) {
        const node = item.node
        const listStatus = item.list_status || {}
        const title = node.title || `MAL Manga ${node.id}`

        try {
          const dbManga = await this.ensureMangaInDb(undefined, node.id, title, {
            coverImage: { large: node.main_picture?.large || node.main_picture?.medium },
            chapters: node.num_chapters,
            volumes: node.num_volumes,
          })
          const mangaId = dbManga.id

          let status: "PLANNING" | "READING" | "COMPLETED" | "ON_HOLD" | "DROPPED" = "PLANNING"
          if (listStatus.status === "reading") status = "READING"
          else if (listStatus.status === "completed") status = "COMPLETED"
          else if (listStatus.status === "on_hold") status = "ON_HOLD"
          else if (listStatus.status === "dropped") status = "DROPPED"

          const existing = await prisma.mangaList.findUnique({
            where: { userId_mangaId: { userId, mangaId } },
          })

          const connections = mergeConnectionsJson(
            existing?.connections,
            "mal",
            node.id
          )

          await prisma.mangaList.upsert({
            where: { userId_mangaId: { userId, mangaId } },
            create: {
              userId,
              mangaId,
              status,
              chaptersProgress: listStatus.num_chapters_read || 0,
              volumesProgress: listStatus.num_volumes_read || 0,
              score: normalizeScore(listStatus.score),
              notes: listStatus.comments || null,
              startedAt: parseDate(listStatus.start_date),
              completedAt: parseDate(listStatus.finish_date),
              connections,
            },
            update: {
              status,
              chaptersProgress: listStatus.num_chapters_read || existing?.chaptersProgress || 0,
              volumesProgress: listStatus.num_volumes_read || existing?.volumesProgress || 0,
              score: normalizeScore(listStatus.score) || existing?.score || null,
              notes: listStatus.comments || existing?.notes || null,
              startedAt: parseDate(listStatus.start_date) || existing?.startedAt,
              completedAt: parseDate(listStatus.finish_date) || existing?.completedAt,
              connections,
            },
          })
          importedManga++
        } catch (err: any) {
          logger.warn(`[ListImport] MAL manga import failed for "${title}": ${err?.message || err}`)
          failedManga++
        }
      }

      if (mangaEntries.length > 0) {
        await this.sendImportNotification(
          userId,
          "Manga List Imported",
          `Finished importing your Manga list from MyAnimeList (${importedManga} item${importedManga === 1 ? "" : "s"} imported${failedManga > 0 ? `, ${failedManga} failed` : ""}).`,
          icon
        )
      }
    }
  }

  // ===========================================================================
  // 4. SIMKL IMPORT (Canonical TV & Movie Source: TheTVDB)
  // ===========================================================================
  private async importSimkl(
    userId: string,
    credentials: ConnectionCredentials,
    options?: ImportOptions
  ): Promise<void> {
    if (!credentials.accessToken) {
      throw new BadRequest("Simkl connection is missing an access token")
    }

    const clientId = process.env.SIMKL_CLIENT_ID
    if (!clientId) {
      throw new Error("SIMKL_CLIENT_ID is not configured in server environment")
    }

    const requestedTypes = options?.mediaTypes || ["anime", "tv", "movie"]
    const typesToFetch: string[] = []
    if (requestedTypes.includes("anime")) typesToFetch.push("anime")
    if (requestedTypes.includes("tv")) typesToFetch.push("tv")
    if (requestedTypes.includes("movie")) typesToFetch.push("movies")

    const statuses = ["watching", "plantowatch", "completed", "dropped", "onhold"]

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.accessToken}`,
      "simkl-api-key": clientId,
    }

    const fetchedItems: Array<{
      category: "anime" | "tv" | "movies"
      status: string
      entry: any
    }> = []

    for (const cat of typesToFetch) {
      for (const st of statuses) {
        try {
          const res = await fetch(
            `https://api.simkl.com/sync/all-items/${cat}/${st}?extended=full`,
            { headers }
          )
          if (!res.ok) continue
          const data = (await res.json()) as any
          const list = Array.isArray(data)
            ? data
            : data.anime || data.shows || data.movies || []

          for (const entry of list) {
            fetchedItems.push({
              category: cat as "anime" | "tv" | "movies",
              status: st,
              entry,
            })
          }
        } catch {
          // Continue to next category/status
        }
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    const icon = "https://cdn.simpleicons.org/simkl/00ADEF"

    const animeItems = fetchedItems.filter((i) => i.category === "anime")
    const tvItems = fetchedItems.filter((i) => i.category === "tv")
    const movieItems = fetchedItems.filter((i) => i.category === "movies")

    // 4.1 Simkl Anime
    if (requestedTypes.includes("anime") && animeItems.length > 0) {
      let importedAnime = 0
      let failedAnime = 0

      for (const item of animeItems) {
        const { status: rawStatus, entry } = item
        const mediaItem = entry.anime
        if (!mediaItem) continue

        const title = mediaItem.title || mediaItem.title_en || mediaItem.title_romaji || `Simkl ${entry.id}`
        const ids = mediaItem.ids || {}
        const simklId = ids.simkl || entry.id

        try {
          const anilistId = ids.anilist ? Number(ids.anilist) : undefined
          const malId = ids.mal ? Number(ids.mal) : undefined

          const dbAnime = await this.ensureAnimeInDb(anilistId, malId, title, {
            coverImage: { large: mediaItem.poster ? `https://simkl.in/posters/${mediaItem.poster}_m.jpg` : undefined },
            episodes: mediaItem.ep_count,
          })
          const animeId = dbAnime.id

          let status: "PLANNING" | "WATCHING" | "COMPLETED" | "ON_HOLD" | "DROPPED" = "PLANNING"
          if (rawStatus === "watching") status = "WATCHING"
          else if (rawStatus === "completed") status = "COMPLETED"
          else if (rawStatus === "onhold") status = "ON_HOLD"
          else if (rawStatus === "dropped") status = "DROPPED"

          const existing = await prisma.animeList.findUnique({
            where: { userId_animeId: { userId, animeId } },
          })

          const connections = mergeConnectionsJson(existing?.connections, "simkl", simklId)

          await prisma.animeList.upsert({
            where: { userId_animeId: { userId, animeId } },
            create: {
              userId,
              animeId,
              status,
              progress: entry.watched_episodes_count || 0,
              score: normalizeScore(entry.user_rating),
              notes: entry.memo || null,
              startedAt: parseDate(entry.created_at || entry.watched_at),
              completedAt: rawStatus === "completed" ? parseDate(entry.last_watched_at) : null,
              connections,
            },
            update: {
              status,
              progress: entry.watched_episodes_count || existing?.progress || 0,
              score: normalizeScore(entry.user_rating) || existing?.score || null,
              notes: entry.memo || existing?.notes || null,
              startedAt: parseDate(entry.created_at || entry.watched_at) || existing?.startedAt,
              completedAt: (rawStatus === "completed" ? parseDate(entry.last_watched_at) : null) || existing?.completedAt,
              connections,
            },
          })
          importedAnime++
        } catch (err: any) {
          logger.warn(`[ListImport] Simkl anime import failed for "${title}": ${err?.message || err}`)
          failedAnime++
        }
      }

      await this.sendImportNotification(
        userId,
        "Anime List Imported",
        `Finished importing your Anime list from Simkl (${importedAnime} item${importedAnime === 1 ? "" : "s"} imported${failedAnime > 0 ? `, ${failedAnime} failed` : ""}).`,
        icon
      )
    }

    // 4.2 Simkl TV Shows (Canonical metadata: TheTVDB)
    if (requestedTypes.includes("tv") && tvItems.length > 0) {
      let importedTv = 0
      let failedTv = 0

      for (const item of tvItems) {
        const { status: rawStatus, entry } = item
        const mediaItem = entry.show
        if (!mediaItem) continue

        const title = mediaItem.title || mediaItem.title_en || mediaItem.title_romaji || `Simkl ${entry.id}`
        const ids = mediaItem.ids || {}
        const simklId = ids.simkl || entry.id

        try {
          const tvdbId = ids.tvdb ? Number(ids.tvdb) : undefined
          const dbTv = await this.ensureTvInDb(tvdbId, title, simklId, mediaItem)
          const tvId = dbTv.id

          let status: "PLANNING" | "WATCHING" | "COMPLETED" | "ON_HOLD" | "DROPPED" = "PLANNING"
          if (rawStatus === "watching") status = "WATCHING"
          else if (rawStatus === "completed") status = "COMPLETED"
          else if (rawStatus === "onhold") status = "ON_HOLD"
          else if (rawStatus === "dropped") status = "DROPPED"

          const existing = await prisma.tvList.findUnique({
            where: { userId_tvId: { userId, tvId } },
          })

          const connections = mergeConnectionsJson(existing?.connections, "simkl", simklId || tvdbId || tvId)

          const listEntry = await prisma.tvList.upsert({
            where: { userId_tvId: { userId, tvId } },
            create: {
              userId,
              tvId,
              status,
              progress: entry.watched_episodes_count || 0,
              score: normalizeScore(entry.user_rating),
              notes: entry.memo || null,
              startedAt: parseDate(entry.created_at || entry.watched_at),
              completedAt: rawStatus === "completed" ? parseDate(entry.last_watched_at) : null,
              connections,
            },
            update: {
              status,
              progress: entry.watched_episodes_count || existing?.progress || 0,
              score: normalizeScore(entry.user_rating) || existing?.score || null,
              notes: entry.memo || existing?.notes || null,
              startedAt: parseDate(entry.created_at || entry.watched_at) || existing?.startedAt,
              completedAt: (rawStatus === "completed" ? parseDate(entry.last_watched_at) : null) || existing?.completedAt,
              connections,
            },
          })

          // Sync individual watched episodes
          if (entry.seasons && Array.isArray(entry.seasons)) {
            for (const s of entry.seasons) {
              const seasonNum = s.number
              if (s.episodes && Array.isArray(s.episodes)) {
                for (const ep of s.episodes) {
                  const epNum = ep.number
                  if (ep.watched_at || ep.completed) {
                    await prisma.tvWatchedEpisode.upsert({
                      where: {
                        tvListId_seasonNumber_episodeNumber: {
                          tvListId: listEntry.id,
                          seasonNumber: seasonNum,
                          episodeNumber: epNum,
                        },
                      },
                      create: {
                        tvListId: listEntry.id,
                        seasonNumber: seasonNum,
                        episodeNumber: epNum,
                        watchedAt: parseDate(ep.watched_at) || new Date(),
                      },
                      update: {
                        watchedAt: parseDate(ep.watched_at) || new Date(),
                      },
                    }).catch(() => {})
                  }
                }
              }
            }
          }
          importedTv++
        } catch (err: any) {
          logger.warn(`[ListImport] Simkl TV import failed for "${title}": ${err?.message || err}`)
          failedTv++
        }
      }

      await this.sendImportNotification(
        userId,
        "TV Shows List Imported",
        `Finished importing your TV Shows list from Simkl (${importedTv} item${importedTv === 1 ? "" : "s"} imported${failedTv > 0 ? `, ${failedTv} failed` : ""}).`,
        icon
      )
    }

    // 4.3 Simkl Movies (Canonical metadata: TheTVDB; startDate same as finish date)
    if (requestedTypes.includes("movie") && movieItems.length > 0) {
      let importedMovies = 0
      let failedMovies = 0

      for (const item of movieItems) {
        const { status: rawStatus, entry } = item
        const mediaItem = entry.movie
        if (!mediaItem) continue

        const title = mediaItem.title || mediaItem.title_en || mediaItem.title_romaji || `Simkl ${entry.id}`
        const ids = mediaItem.ids || {}
        const simklId = ids.simkl || entry.id

        try {
          const tvdbId = ids.tvdb ? Number(ids.tvdb) : undefined
          const dbMovie = await this.ensureMovieInDb(tvdbId, title, simklId, mediaItem)
          const movieId = dbMovie.id

          let status: "PLANNING" | "WATCHING" | "COMPLETED" | "DROPPED" = "PLANNING"
          if (rawStatus === "watching") status = "WATCHING"
          else if (rawStatus === "completed") status = "COMPLETED"
          else if (rawStatus === "dropped") status = "DROPPED"

          const existing = await prisma.movieList.findUnique({
            where: { userId_movieId: { userId, movieId } },
          })

          const connections = mergeConnectionsJson(existing?.connections, "simkl", simklId || tvdbId || movieId)

          // Movie requirement: startDate should be the same as finish date
          const finishDate = parseDate(entry.last_watched_at || entry.watched_at || entry.created_at)
          const startDate = finishDate

          await prisma.movieList.upsert({
            where: { userId_movieId: { userId, movieId } },
            create: {
              userId,
              movieId,
              status,
              score: normalizeScore(entry.user_rating),
              notes: entry.memo || null,
              startedAt: startDate,
              completedAt: finishDate,
              connections,
            },
            update: {
              status,
              score: normalizeScore(entry.user_rating) || existing?.score || null,
              notes: entry.memo || existing?.notes || null,
              startedAt: finishDate ?? existing?.completedAt ?? existing?.startedAt,
              completedAt: finishDate ?? existing?.completedAt ?? existing?.startedAt,
              connections,
            },
          })
          importedMovies++
        } catch (err: any) {
          logger.warn(`[ListImport] Simkl movie import failed for "${title}": ${err?.message || err}`)
          failedMovies++
        }
      }

      await this.sendImportNotification(
        userId,
        "Movies List Imported",
        `Finished importing your Movies list from Simkl (${importedMovies} item${importedMovies === 1 ? "" : "s"} imported${failedMovies > 0 ? `, ${failedMovies} failed` : ""}).`,
        icon
      )
    }
  }

  // ===========================================================================
  // 5. BANGUMI IMPORT
  // ===========================================================================
  private async importBangumi(
    userId: string,
    connection: { externalId: string | null },
    credentials: ConnectionCredentials,
    options?: ImportOptions
  ): Promise<void> {
    const token = credentials.accessToken || credentials.apiKey
    const username = connection.externalId || credentials.username
    if (!token || !username) {
      throw new BadRequest("Bangumi connection requires an access token and username")
    }

    const requestedTypes = options?.mediaTypes || ["anime", "manga"]
    const shouldFetchAnime = requestedTypes.includes("anime")
    const shouldFetchManga = requestedTypes.includes("manga")

    const collections: any[] = []
    let offset = 0
    const limit = 50

    while (true) {
      const url = `https://api.bgm.tv/v0/users/${username}/collections?limit=${limit}&offset=${offset}`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "IRIS/1.0 (https://github.com/rrHakushi/IRIS)",
        },
      })

      if (!res.ok) break
      const json = (await res.json()) as any
      const data = json.data || []
      collections.push(...data)
      if (data.length < limit) break
      offset += limit
    }

    const icon = "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/bangumi.svg"

    // 5.1 Bangumi Anime (subject_type === 2)
    if (shouldFetchAnime) {
      const animeItems = collections.filter((c) => c.subject_type === 2)
      let importedAnime = 0
      let failedAnime = 0

      for (const item of animeItems) {
        const subject = item.subject || {}
        const subjectId = item.subject_id
        const title = subject.name_cn || subject.name || `Bangumi Subject ${subjectId}`

        try {
          const dbAnime = await this.ensureAnimeInDb(undefined, undefined, title, {
            coverImage: { large: subject.images?.large || subject.images?.medium },
            episodes: subject.eps,
          }, subjectId)
          const animeId = dbAnime.id

          let status: "PLANNING" | "WATCHING" | "COMPLETED" | "ON_HOLD" | "DROPPED" = "PLANNING"
          if (item.type === 1) status = "PLANNING"
          else if (item.type === 2) status = "COMPLETED"
          else if (item.type === 3) status = "WATCHING"
          else if (item.type === 4) status = "ON_HOLD"
          else if (item.type === 5) status = "DROPPED"

          const existing = await prisma.animeList.findUnique({
            where: { userId_animeId: { userId, animeId } },
          })

          const connections = mergeConnectionsJson(existing?.connections, "bangumi", subjectId)

          await prisma.animeList.upsert({
            where: { userId_animeId: { userId, animeId } },
            create: {
              userId,
              animeId,
              status,
              progress: item.ep_status || 0,
              score: normalizeScore(item.rate),
              notes: item.comment || null,
              startedAt: parseDate(item.updated_at),
              completedAt: item.type === 2 ? parseDate(item.updated_at) : null,
              connections,
            },
            update: {
              status,
              progress: item.ep_status || existing?.progress || 0,
              score: normalizeScore(item.rate) || existing?.score || null,
              notes: item.comment || existing?.notes || null,
              startedAt: parseDate(item.updated_at) || existing?.startedAt,
              completedAt: (item.type === 2 ? parseDate(item.updated_at) : null) || existing?.completedAt,
              connections,
            },
          })
          importedAnime++
        } catch (err: any) {
          logger.warn(`[ListImport] Bangumi anime import failed for "${title}": ${err?.message || err}`)
          failedAnime++
        }
      }

      if (animeItems.length > 0) {
        await this.sendImportNotification(
          userId,
          "Anime List Imported",
          `Finished importing your Anime list from Bangumi (${importedAnime} item${importedAnime === 1 ? "" : "s"} imported${failedAnime > 0 ? `, ${failedAnime} failed` : ""}).`,
          icon
        )
      }
    }

    // 5.2 Bangumi Manga / Books (subject_type === 1)
    if (shouldFetchManga) {
      const mangaItems = collections.filter((c) => c.subject_type === 1)
      let importedManga = 0
      let failedManga = 0

      for (const item of mangaItems) {
        const subject = item.subject || {}
        const subjectId = item.subject_id
        const title = subject.name_cn || subject.name || `Bangumi Subject ${subjectId}`

        try {
          const dbManga = await this.ensureMangaInDb(undefined, undefined, title, {
            coverImage: { large: subject.images?.large || subject.images?.medium },
            chapters: subject.eps,
            volumes: subject.volumes,
          }, subjectId)
          const mangaId = dbManga.id

          let status: "PLANNING" | "READING" | "COMPLETED" | "ON_HOLD" | "DROPPED" = "PLANNING"
          if (item.type === 1) status = "PLANNING"
          else if (item.type === 2) status = "COMPLETED"
          else if (item.type === 3) status = "READING"
          else if (item.type === 4) status = "ON_HOLD"
          else if (item.type === 5) status = "DROPPED"

          const existing = await prisma.mangaList.findUnique({
            where: { userId_mangaId: { userId, mangaId } },
          })

          const connections = mergeConnectionsJson(existing?.connections, "bangumi", subjectId)

          await prisma.mangaList.upsert({
            where: { userId_mangaId: { userId, mangaId } },
            create: {
              userId,
              mangaId,
              status,
              chaptersProgress: item.ep_status || 0,
              volumesProgress: item.vol_status || 0,
              score: normalizeScore(item.rate),
              notes: item.comment || null,
              startedAt: parseDate(item.updated_at),
              completedAt: item.type === 2 ? parseDate(item.updated_at) : null,
              connections,
            },
            update: {
              status,
              chaptersProgress: item.ep_status || existing?.chaptersProgress || 0,
              volumesProgress: item.vol_status || existing?.volumesProgress || 0,
              score: normalizeScore(item.rate) || existing?.score || null,
              notes: item.comment || existing?.notes || null,
              startedAt: parseDate(item.updated_at) || existing?.startedAt,
              completedAt: (item.type === 2 ? parseDate(item.updated_at) : null) || existing?.completedAt,
              connections,
            },
          })
          importedManga++
        } catch (err: any) {
          logger.warn(`[ListImport] Bangumi manga import failed for "${title}": ${err?.message || err}`)
          failedManga++
        }
      }

      if (mangaItems.length > 0) {
        await this.sendImportNotification(
          userId,
          "Manga List Imported",
          `Finished importing your Manga list from Bangumi (${importedManga} item${importedManga === 1 ? "" : "s"} imported${failedManga > 0 ? `, ${failedManga} failed` : ""}).`,
          icon
        )
      }
    }
  }

  // ===========================================================================
  // HELPERS: Ensure Media In Database (with TVDB for TV & Movies)
  // ===========================================================================

  private async ensureAnimeInDb(
    anilistId?: number,
    malId?: number,
    title?: string,
    fallback?: any,
    bangumiId?: number
  ): Promise<{ id: number }> {
    if (anilistId) {
      const existing = await prisma.anime.findUnique({ where: { anilistId } })
      if (existing) return { id: existing.id }
    }
    if (malId) {
      const existing = await prisma.anime.findUnique({ where: { malId } })
      if (existing) return { id: existing.id }
    }
    if (bangumiId) {
      const existing = await prisma.anime.findFirst({ where: { bangumiId } })
      if (existing) return { id: existing.id }
    }

    if (anilistId) {
      try {
        const fullRecord = await mediaQueueService.anilist.fetchAnime(anilistId)
        if (fullRecord) {
          const res = await mediaDbSyncer.upsertAnime(fullRecord)
          if (res?.id) return { id: res.id }
        }
      } catch {
        // Fall back to preview stub creation
      }
    }

    const preview = await mediaDbSyncer.upsertAnimeSearchPreview({
      id: anilistId || malId || Math.floor(Math.random() * 1000000),
      title: typeof title === "object" ? title : { userPreferred: title || "Unknown" },
      coverImage: fallback?.coverImage?.large ? { large: fallback.coverImage.large } : undefined,
    })

    if (malId || bangumiId) {
      await prisma.anime.update({
        where: { id: preview.id },
        data: {
          ...(malId ? { malId } : {}),
          ...(bangumiId ? { bangumiId } : {}),
        },
      }).catch(() => {})
    }

    return { id: preview.id }
  }

  private async ensureMangaInDb(
    anilistId?: number,
    malId?: number,
    title?: string,
    fallback?: any,
    bangumiId?: number
  ): Promise<{ id: number }> {
    if (anilistId) {
      const existing = await prisma.manga.findUnique({ where: { anilistId } })
      if (existing) return { id: existing.id }
    }
    if (malId) {
      const existing = await prisma.manga.findFirst({ where: { malId } })
      if (existing) return { id: existing.id }
    }
    if (bangumiId) {
      const existing = await prisma.manga.findFirst({ where: { bangumiId } })
      if (existing) return { id: existing.id }
    }

    if (anilistId) {
      try {
        const fullRecord = await mediaQueueService.anilist.fetchManga(anilistId)
        if (fullRecord) {
          const res = await mediaDbSyncer.upsertManga(fullRecord)
          if (res?.id) return { id: res.id }
        }
      } catch {
        // Fall back to stub
      }
    }

    const preview = await mediaDbSyncer.upsertMangaSearchPreview({
      id: anilistId || malId || Math.floor(Math.random() * 1000000),
      title: typeof title === "object" ? title : { userPreferred: title || "Unknown" },
      coverImage: fallback?.coverImage?.large ? { large: fallback.coverImage.large } : undefined,
    })

    if (malId || bangumiId) {
      await prisma.manga.update({
        where: { id: preview.id },
        data: {
          ...(malId ? { malId } : {}),
          ...(bangumiId ? { bangumiId } : {}),
        },
      }).catch(() => {})
    }

    return { id: preview.id }
  }

  private async ensureTvInDb(
    tvdbId?: number,
    title?: string,
    simklId?: number | string,
    fallback?: any
  ): Promise<{ id: number }> {
    if (tvdbId) {
      const existing = await prisma.tv.findUnique({ where: { tvDBId: tvdbId } })
      if (existing) return { id: existing.id }
    }
    if (simklId) {
      const existing = await prisma.tv.findFirst({ where: { simklId: Number(simklId) } })
      if (existing) return { id: existing.id }
    }

    if (tvdbId) {
      try {
        const preview = await mediaDbSyncer.upsertTvSearchPreview({
          tvdb_id: tvdbId,
          name: title,
          image_url: fallback?.poster ? `https://simkl.in/posters/${fallback.poster}_m.jpg` : undefined,
        })
        if (preview?.id) {
          if (simklId) {
            await prisma.tv.update({
              where: { id: preview.id },
              data: { simklId: Number(simklId) },
            }).catch(() => {})
          }
          return { id: preview.id }
        }
      } catch {
        // Fall back to title search
      }
    }

    if (title) {
      try {
        const searchResults = await mediaQueueService.tvdb.searchTvSeries(title)
        if (searchResults && searchResults.length > 0) {
          const first = searchResults[0]
          const preview = await mediaDbSyncer.upsertTvSearchPreview(first)
          if (preview?.id) {
            if (simklId) {
              await prisma.tv.update({
                where: { id: preview.id },
                data: { simklId: Number(simklId) },
              }).catch(() => {})
            }
            return { id: preview.id }
          }
        }
      } catch {
        // Search failed
      }
    }

    const created = await prisma.tv.create({
      data: {
        titlePrimary: typeof title === "string" ? title : "Unknown TV Show",
        tvDBId: tvdbId || null,
        simklId: simklId ? Number(simklId) : null,
        coverImage: fallback?.poster ? `https://simkl.in/posters/${fallback.poster}_m.jpg` : null,
      },
    })
    return { id: created.id }
  }

  private async ensureMovieInDb(
    tvdbId?: number,
    title?: string,
    simklId?: number | string,
    fallback?: any
  ): Promise<{ id: number }> {
    if (tvdbId) {
      const existing = await prisma.movie.findUnique({ where: { tvDBId: tvdbId } })
      if (existing) return { id: existing.id }
    }
    if (simklId) {
      const existing = await prisma.movie.findFirst({ where: { simklId: Number(simklId) } })
      if (existing) return { id: existing.id }
    }

    if (tvdbId) {
      try {
        const preview = await mediaDbSyncer.upsertMovieSearchPreview({
          tvdb_id: tvdbId,
          name: title,
          image_url: fallback?.poster ? `https://simkl.in/posters/${fallback.poster}_m.jpg` : undefined,
        })
        if (preview?.id) {
          if (simklId) {
            await prisma.movie.update({
              where: { id: preview.id },
              data: { simklId: Number(simklId) },
            }).catch(() => {})
          }
          return { id: preview.id }
        }
      } catch {
        // Fall back
      }
    }

    if (title) {
      try {
        const searchResults = await mediaQueueService.tvdb.searchMovies(title)
        if (searchResults && searchResults.length > 0) {
          const first = searchResults[0]
          const preview = await mediaDbSyncer.upsertMovieSearchPreview(first)
          if (preview?.id) {
            if (simklId) {
              await prisma.movie.update({
                where: { id: preview.id },
                data: { simklId: Number(simklId) },
              }).catch(() => {})
            }
            return { id: preview.id }
          }
        }
      } catch {
        // Search failed
      }
    }

    const created = await prisma.movie.create({
      data: {
        titlePrimary: typeof title === "string" ? title : "Unknown Movie",
        tvDBId: tvdbId || null,
        simklId: simklId ? Number(simklId) : null,
        coverImage: fallback?.poster ? `https://simkl.in/posters/${fallback.poster}_m.jpg` : null,
      },
    })
    return { id: created.id }
  }

  private async addToCustomList(
    userId: string,
    listName: string,
    mediaType: "ANIME" | "MANGA" | "TV" | "MOVIE" | "MUSIC",
    mediaId: number,
    order: number
  ): Promise<void> {
    let customList = await prisma.customList.findFirst({
      where: { userId, name: listName },
    })

    if (!customList) {
      customList = await prisma.customList.create({
        data: {
          userId,
          name: listName,
          description: `Imported collection: ${listName}`,
          isPrivate: false,
        },
      })
    }

    const existingEntry = await prisma.customListEntry.findFirst({
      where: {
        listId: customList.id,
        mediaType,
        mediaId,
      },
    })

    if (!existingEntry) {
      await prisma.customListEntry.create({
        data: {
          listId: customList.id,
          mediaType,
          mediaId,
          order,
          animeId: mediaType === "ANIME" ? mediaId : null,
          mangaId: mediaType === "MANGA" ? mediaId : null,
          tvId: mediaType === "TV" ? mediaId : null,
          movieId: mediaType === "MOVIE" ? mediaId : null,
        },
      })
    }
  }
}

export const listImportService = ListImportService.getInstance()

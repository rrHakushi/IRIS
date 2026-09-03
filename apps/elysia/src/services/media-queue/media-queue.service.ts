import { Subject, from, of } from "rxjs"
import { mergeMap, catchError, delay, retry } from "rxjs/operators"
import { prisma } from "@IRIS/database"
import { cache } from "../../utils/cache.js"
import { wsHub } from "../websocket-hub.js"
import { c, colorDuration } from "../../utils/colors.js"
import { logger } from "../../utils/logger.js"
import {
  AniListProvider,
  MyAnimeListProvider,
  TheTVDBProvider,
  GoogleBooksProvider,
  IGDBProvider,
  MusicBrainzProvider,
  LrcLibProvider,
  AnimeMappingProvider,
  AniSkipProvider,
  SimklProvider,
  SteamProvider,
  type AnimeMappingEntry,
  type MangaMappingEntry,
  type EpisodeSkipTimestamps,
  type SimklMoviePayload,
  type SimklTvPayload,
  type SteamAppDetailsPayload,
  type SteamDeckCompatibilityReport,
} from "./providers/index.js"
import { mediaDbSyncer } from "./media-db.syncer.js"
import type {
  MediaJob,
  MediaJobType,
  QueueJobOptions,
  QueueSearchOptions,
  DiscoveredRelation,
} from "./types.js"

import { logQueue } from "./logger.js"

const REDIS_KEY_PREFIX = "media-queue"
const MAX_CONCURRENCY = 4

export class MediaQueueService {
  private static logged = false
  private queueSubject$ = new Subject<MediaJob>()
  private inFlightJobs = new Map<string, MediaJob>()
  private isInitialized = false
  private idleCheckTimeout: NodeJS.Timeout | null = null
  private sessionStartTime = 0
  private sessionProcessedCount = 0

  // Provider instances
  public readonly anilist = new AniListProvider()
  public readonly mal = new MyAnimeListProvider()
  public readonly tvdb = new TheTVDBProvider()
  public readonly googleBooks = new GoogleBooksProvider()
  public readonly igdb = new IGDBProvider()
  public readonly steam = new SteamProvider()
  public readonly musicbrainz = new MusicBrainzProvider()
  public readonly lrclib = new LrcLibProvider()
  public readonly animeMapping = new AnimeMappingProvider()
  public readonly aniskip = new AniSkipProvider()
  public readonly simkl = new SimklProvider()
  public readonly syncer = mediaDbSyncer

  constructor() {
    MediaQueueService.logStatus()
    this.setupPipeline()
  }

  public static logStatus(): void {
    if (MediaQueueService.logged) return
    MediaQueueService.logged = true

    logger.service(
      "media-queue",
      "distributed media metadata queue & sync pipeline"
    )

    const missingRequired: Array<{
      provider: string
      envVar: string
      reason: string
    }> = []
    const missingOptional: Array<{
      provider: string
      envVar: string
      fallback: string
    }> = []

    // TheTVDB
    const tvdbKey =
      process.env.THETVDB_KEY ||
      process.env.TVDB_API_KEY ||
      process.env.THETVDB_API_KEY ||
      process.env.TVDB_KEY
    if (!tvdbKey) {
      missingRequired.push({
        provider: "TheTVDB",
        envVar: "THETVDB_KEY / TVDB_API_KEY",
        reason: "required for TV series & movie metadata fetching",
      })
    }

    // IGDB
    const igdbId = process.env.IGDB_CLIENT_ID
    const igdbSecret = process.env.IGDB_CLIENT_SECRET
    if (!igdbId || !igdbSecret) {
      const missing = [
        !igdbId && "IGDB_CLIENT_ID",
        !igdbSecret && "IGDB_CLIENT_SECRET",
      ]
        .filter(Boolean)
        .join(", ")
      missingRequired.push({
        provider: "IGDB",
        envVar: missing,
        reason: "required for Twitch OAuth & video game metadata fetching",
      })
    }

    // Simkl
    const simklKey =
      process.env.SIMKL_CLIENT_ID ||
      process.env.SIMKL_KEY ||
      process.env.SIMKL_API_KEY
    if (!simklKey) {
      missingRequired.push({
        provider: "Simkl",
        envVar: "SIMKL_CLIENT_ID",
        reason: "required for Simkl movie/TV metadata lookups",
      })
    }

    // MyAnimeList
    const malClientId = process.env.MAL_CLIENT_ID
    if (!malClientId) {
      missingRequired.push({
        provider: "MyAnimeList",
        envVar: "MAL_CLIENT_ID",
        reason: "required for MAL secondary anime/manga metadata fetching",
      })
    }

    // Database
    if (!process.env.DATABASE_URL) {
      missingRequired.push({
        provider: "Database",
        envVar: "DATABASE_URL",
        reason: "required for Prisma media entity synchronization",
      })
    }

    // Optional: AniList
    const alId = process.env.ANILIST_CLIENT_ID
    const alSecret = process.env.ANILIST_CLIENT_SECRET
    if (!alId || !alSecret) {
      missingOptional.push({
        provider: "AniList",
        envVar: "ANILIST_CLIENT_ID / ANILIST_CLIENT_SECRET",
        fallback: "using public unauthenticated rate limit (30 req/min)",
      })
    }

    // Optional: Google Books
    if (!process.env.GOOGLE_BOOKS_API_KEY) {
      missingOptional.push({
        provider: "Google Books",
        envVar: "GOOGLE_BOOKS_API_KEY",
        fallback: "using public IP-based rate limit",
      })
    }

    // Optional: Redis
    if (!process.env.REDIS_URL) {
      missingOptional.push({
        provider: "Redis",
        envVar: "REDIS_URL",
        fallback: "using in-memory LRU cache fallback",
      })
    }

    // Print missing required
    for (const item of missingRequired) {
      logger.service.providerMissingEnv(item.provider, item.envVar, item.reason)
    }

    // Print missing optional
    for (const item of missingOptional) {
      logger.service.providerOptionalEnv(
        item.provider,
        item.envVar,
        item.fallback
      )
    }

    if (missingRequired.length === 0) {
      logger.service.verified("All required media provider API keys verified")
    }
  }

  /**
   * Checks if an error is non-retryable (e.g. 404 Not Found from AniList, MAL, TVDB, etc.).
   */
  private isNonRetryableError(error: unknown): boolean {
    if (!error) return false
    const msg = (error as Error)?.message || String(error)
    const status = (error as any)?.status || (error as any)?.statusCode
    if (status === 404) return true
    if (
      msg.includes("HTTP 404") ||
      msg.includes('status":404') ||
      msg.includes("status: 404") ||
      msg.includes("404") ||
      msg.includes("Not Found") ||
      msg.includes("not found") ||
      msg.includes("Record not found")
    ) {
      return true
    }
    return false
  }

  /**
   * Sets up the RxJS processing stream with concurrency control, retry backoff, and error handling.
   */
  private setupPipeline(): void {
    this.queueSubject$
      .pipe(
        mergeMap((job) => {
          return from(this.executeJob(job)).pipe(
            retry({
              count: job.maxRetries ?? 3,
              delay: (error, retryCount) => {
                if (this.isNonRetryableError(error)) {
                  throw error
                }
                const backoffMs = Math.min(
                  30000,
                  Math.pow(2, retryCount) * 1000
                )
                logQueue(
                  `${c.magenta(c.bold("[MediaQueue]"))} ${c.yellow(`⚠️ Retry #${retryCount} for ${job.id}`)} in ${backoffMs}ms: ${(error as Error)?.message || error}`
                )
                return of(null).pipe(delay(backoffMs))
              },
            }),
            catchError((err) => {
              this.handleJobFailure(job, err)
              return of(null)
            })
          )
        }, MAX_CONCURRENCY)
      )
      .subscribe()
  }

  /**
   * Initializes queue service and rehydrates interrupted/pending jobs from Redis.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    this.isInitialized = true

    try {
      // Rehydrate pending & processing jobs from Redis for crash recovery
      const pendingKeys = await this.getRedisSet(`${REDIS_KEY_PREFIX}:pending`)
      const processingKeys = await this.getRedisSet(
        `${REDIS_KEY_PREFIX}:processing`
      )

      const allJobIds = Array.from(new Set([...pendingKeys, ...processingKeys]))
      if (allJobIds.length > 0) {
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} ${c.cyan(`🔄 Crash recovery:`)} restoring ${c.bold(allJobIds.length)} pending jobs from Redis...`
        )
      }

      for (const jobId of allJobIds) {
        const jobData = await cache.get<MediaJob>(
          `${REDIS_KEY_PREFIX}:job:${jobId}`
        )
        if (
          jobData &&
          jobData.status !== "COMPLETED" &&
          jobData.status !== "CANCELLED"
        ) {
          jobData.status = "PENDING"
          this.inFlightJobs.set(jobId, jobData)
          this.queueSubject$.next(jobData)
        }
      }
    } catch {
      // If Redis rehydration fails or is offline, continue safely
    }
  }

  private async getRedisSet(key: string): Promise<string[]> {
    try {
      const items = await cache.get<string[]>(key)
      return Array.isArray(items) ? items : []
    } catch {
      return []
    }
  }

  private async addToRedisSet(key: string, value: string): Promise<void> {
    try {
      const current = await this.getRedisSet(key)
      if (!current.includes(value)) {
        current.push(value)
        await cache.set(key, current, 86400 * 7) // 7 days retention
      }
    } catch {}
  }

  private async removeFromRedisSet(key: string, value: string): Promise<void> {
    try {
      const current = await this.getRedisSet(key)
      const filtered = current.filter((item) => item !== value)
      await cache.set(key, filtered, 86400 * 7)
    } catch {}
  }

  private getJobId(type: MediaJobType, externalId: string | number): string {
    return `${type}:${String(externalId).trim()}`
  }

  /**
   * Checks database record to see if item already exists and is fresh.
   */
  private async checkExistingFreshness(
    type: MediaJobType,
    externalId: string | number
  ): Promise<boolean> {
    const extIdNum = Number(externalId)

    switch (type) {
      case "ANIME": {
        if (isNaN(extIdNum)) return false
        const record = await prisma.anime.findFirst({
          where: { OR: [{ anilistId: extIdNum }, { malId: extIdNum }] },
        })
        return !mediaDbSyncer.isRecordStale(record, "ANIME")
      }
      case "MANGA": {
        if (isNaN(extIdNum)) return false
        const record = await prisma.manga.findFirst({
          where: { OR: [{ anilistId: extIdNum }, { malId: extIdNum }] },
        })
        return !mediaDbSyncer.isRecordStale(record, "MANGA")
      }
      case "TV": {
        if (isNaN(extIdNum)) return false
        const record = await prisma.tv.findUnique({
          where: { tvDBId: extIdNum },
        })
        return !mediaDbSyncer.isRecordStale(record, "TV")
      }
      case "MOVIE": {
        if (isNaN(extIdNum)) return false
        const record = await prisma.movie.findUnique({
          where: { tvDBId: extIdNum },
        })
        return !mediaDbSyncer.isRecordStale(record, "MOVIE")
      }
      case "BOOK": {
        const idStr = String(externalId)
        const record = await prisma.book.findFirst({
          where: {
            OR: [{ googleBookId: idStr }, { isbn13: idStr }, { isbn10: idStr }],
          },
        })
        return !mediaDbSyncer.isRecordStale(record, "BOOK")
      }
      case "GAME": {
        if (isNaN(extIdNum)) return false
        const record = await prisma.game.findUnique({
          where: { igdbId: extIdNum },
        })
        return !mediaDbSyncer.isRecordStale(record, "GAME")
      }
      case "MUSIC": {
        const idStr = String(externalId)
        const record = await prisma.music.findUnique({
          where: { musicBrainzId: idStr },
        })
        return !mediaDbSyncer.isRecordStale(record as any, "MUSIC")
      }
      default:
        return false
    }
  }

  /**
   * Enqueues a media fetch job. Deduplicates in-flight jobs and evaluates smart freshness.
   */
  async enqueueJob(
    type: MediaJobType,
    externalId: string | number,
    options?: QueueJobOptions
  ): Promise<MediaJob> {
    await this.initialize()

    const jobId = this.getJobId(type, externalId)

    if (this.sessionStartTime === 0) {
      this.sessionStartTime = performance.now()
      this.sessionProcessedCount = 0
    }
    if (this.idleCheckTimeout) {
      clearTimeout(this.idleCheckTimeout)
      this.idleCheckTimeout = null
    }

    // 1. In-flight deduplication
    const inFlight = this.inFlightJobs.get(jobId)
    if (
      inFlight &&
      (inFlight.status === "PENDING" || inFlight.status === "PROCESSING")
    ) {
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.dim("⏩ Deduplicated (Already in flight):")} ${c.cyan(jobId)} (${inFlight.status})`
      )
      return inFlight
    }

    // 2. Smart Freshness check (skip if fresh and not forceRefresh)
    if (!options?.forceRefresh) {
      const isFresh = await this.checkExistingFreshness(type, externalId)
      if (isFresh) {
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} ${c.green("⏭️ Skipped (Already fresh in DB):")} ${c.cyan(jobId)}`
        )
        const skippedJob: MediaJob = {
          id: jobId,
          type,
          externalId,
          status: "COMPLETED",
          depth: options?.maxDepth ?? 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          metadata: { skipped: true, reason: "Already fresh in database" },
        }
        return skippedJob
      }
    }

    const depth = (options?.metadata?.depth as number) || 0
    const maxDepth = options?.maxDepth ?? Infinity

    const job: MediaJob = {
      id: jobId,
      type,
      externalId,
      status: "PENDING",
      depth,
      maxDepth: maxDepth === Infinity ? undefined : maxDepth,
      priority: options?.priority ?? 0,
      maxRetries: options?.maxRetries ?? 3,
      retries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: options?.metadata,
    }

    logQueue(
      `${c.magenta(c.bold("[MediaQueue]"))} ${c.yellow("📥 Enqueued:")} ${c.cyan(c.bold(jobId))} ${c.dim(`(depth=${depth}, maxDepth=${maxDepth === Infinity ? "∞" : maxDepth}, priority=${job.priority})`)}`
    )

    this.inFlightJobs.set(jobId, job)

    // Persist to Redis
    await cache.set(`${REDIS_KEY_PREFIX}:job:${jobId}`, job, 86400 * 7)
    await this.addToRedisSet(`${REDIS_KEY_PREFIX}:pending`, jobId)

    // Push into RxJS Subject
    this.queueSubject$.next(job)

    return job
  }

  /**
   * Searches external provider APIs by title/query, extracts discovered IDs,
   * and enqueues fetch/sync jobs for each item.
   *
   * Providers used:
   * - ANIME: AniList GraphQL searchAnime
   * - MANGA: AniList GraphQL searchManga
   * - TV: TheTVDB searchTvSeries
   * - MOVIE: TheTVDB searchMovies
   * - BOOK: Google Books searchBooks
   * - GAME: IGDB searchGames
   * - MUSIC: MusicBrainz searchMusic
   *
   * @param type - Target MediaJobType
   * @param query - Search query / title string
   * @param options - Optional QueueSearchOptions (limit, priority, forceRefresh, etc.)
   * @returns Array of queued MediaJob instances
   */
  /**
   * Searches external provider APIs by title/query, creates/retrieves initial search preview stubs
   * in the database, enqueues full background fetch jobs, and returns search result records immediately.
   *
   * @param type - Target MediaJobType
   * @param query - Search query / title string
   * @param options - Optional QueueSearchOptions (limit, priority, forceRefresh, etc.)
   * @returns Array of search result items
   */
  async enqueueSearchFetch(
    type: MediaJobType,
    query: string,
    options?: QueueSearchOptions
  ): Promise<any[]> {
    const cleanQuery = query?.trim()
    if (!cleanQuery) return []

    const limit = options?.limit ?? 10
    const results: any[] = []

    logQueue(
      `${c.magenta(c.bold("[MediaQueue]"))} 🔍 ${c.cyan("Search & Enqueue Fetch")} for ${c.bold(type)}: "${c.yellow(cleanQuery)}" (limit=${limit})...`
    )

    switch (type) {
      case "ANIME": {
        const previews = await this.anilist.searchAnime(cleanQuery, limit)
        for (const item of previews) {
          try {
            const previewResult =
              await this.syncer.upsertAnimeSearchPreview(item)
            results.push(previewResult)
            await this.enqueueJob("ANIME", item.id, {
              ...options,
              priority: options?.priority ?? 2,
            })
          } catch (err: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Search stub error for ANIME:${item.id}: ${err.message}`
            )
          }
        }
        break
      }
      case "MANGA": {
        const previews = await this.anilist.searchManga(cleanQuery, limit)
        for (const item of previews) {
          try {
            const previewResult =
              await this.syncer.upsertMangaSearchPreview(item)
            results.push(previewResult)
            await this.enqueueJob("MANGA", item.id, {
              ...options,
              priority: options?.priority ?? 2,
            })
          } catch (err: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Search stub error for MANGA:${item.id}: ${err.message}`
            )
          }
        }
        break
      }
      case "TV": {
        const items = await this.tvdb.searchTvSeries(cleanQuery, limit)
        for (const item of items) {
          try {
            const previewResult = await this.syncer.upsertTvSearchPreview(item)
            results.push(previewResult)
            const rawId = item.tvdb_id || item.id || item.objectID
            const extId =
              typeof rawId === "number"
                ? rawId
                : parseInt(String(rawId).replace(/\D/g, ""), 10)
            if (extId) {
              await this.enqueueJob("TV", extId, {
                ...options,
                priority: options?.priority ?? 2,
              })
            }
          } catch (err: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Search stub error for TV: ${err.message}`
            )
          }
        }
        break
      }
      case "MOVIE": {
        const items = await this.tvdb.searchMovies(cleanQuery, limit)
        for (const item of items) {
          try {
            const previewResult =
              await this.syncer.upsertMovieSearchPreview(item)
            results.push(previewResult)
            const rawId = item.tvdb_id || item.id || item.objectID
            const extId =
              typeof rawId === "number"
                ? rawId
                : parseInt(String(rawId).replace(/\D/g, ""), 10)
            if (extId) {
              await this.enqueueJob("MOVIE", extId, {
                ...options,
                priority: options?.priority ?? 2,
              })
            }
          } catch (err: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Search stub error for MOVIE: ${err.message}`
            )
          }
        }
        break
      }
      case "BOOK": {
        const items = await this.googleBooks.searchBooks(cleanQuery, limit)
        for (const item of items) {
          try {
            const previewResult =
              await this.syncer.upsertBookSearchPreview(item)
            results.push(previewResult)
            if (item.id) {
              await this.enqueueJob("BOOK", item.id, {
                ...options,
                priority: options?.priority ?? 2,
              })
            }
          } catch (err: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Search stub error for BOOK: ${err.message}`
            )
          }
        }
        break
      }
      case "GAME": {
        const items = await this.igdb.searchGames(cleanQuery, limit)
        for (const item of items) {
          try {
            const previewResult =
              await this.syncer.upsertGameSearchPreview(item)
            results.push(previewResult)
            if (item.id) {
              await this.enqueueJob("GAME", item.id, {
                ...options,
                priority: options?.priority ?? 2,
              })
            }
          } catch (err: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Search stub error for GAME:${item.id}: ${err.message}`
            )
          }
        }
        break
      }
      case "MUSIC": {
        const items = await this.musicbrainz.searchRecording(cleanQuery, limit)
        for (const item of items) {
          try {
            const previewResult =
              await this.syncer.upsertMusicSearchPreview(item)
            results.push(previewResult)
            if (item.id) {
              await this.enqueueJob("MUSIC", item.id, {
                ...options,
                priority: options?.priority ?? 2,
              })
            }
          } catch (err: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Search stub error for MUSIC:${item.id}: ${err.message}`
            )
          }
        }
        break
      }
    }

    logQueue(
      `${c.magenta(c.bold("[MediaQueue]"))} ✨ Created/found ${c.bold(results.length)} search preview stubs for ${type}. Background fetch jobs queued.`
    )

    return results
  }

  /**
   * Main job execution handler with rich real-time terminal logs.
   */
  private async executeJob(job: MediaJob): Promise<void> {
    const startTime = performance.now()
    job.status = "PROCESSING"
    job.startedAt = new Date().toISOString()
    job.updatedAt = new Date().toISOString()

    logQueue(
      `${c.magenta(c.bold("[MediaQueue]"))} ${c.blue(c.bold("🚀 Starting processing:"))} ${c.cyan(job.id)} ${c.dim(`(depth=${job.depth || 0})`)}`
    )

    await cache.set(`${REDIS_KEY_PREFIX}:job:${job.id}`, job, 86400 * 7)
    await this.removeFromRedisSet(`${REDIS_KEY_PREFIX}:pending`, job.id)
    await this.addToRedisSet(`${REDIS_KEY_PREFIX}:processing`, job.id)

    let localId: number | undefined
    let relationsToCrawl: DiscoveredRelation[] = []
    let summaryText = ""

    switch (job.type) {
      case "ANIME": {
        const anilistId = Number(job.externalId)
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📡 [1/3] Querying AniList GraphQL API for Anime #${anilistId}...`
        )
        const alData = await this.anilist.fetchAnime(anilistId)
        summaryText =
          alData.title.userPreferred ||
          alData.title.english ||
          alData.title.romaji ||
          ""

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📥 [1/3] AniList received: "${c.bold(summaryText)}" (episodes=${alData.episodes || "N/A"}, relations=${alData.relations?.edges?.length || 0}, characters=${alData.characters?.edges?.length || 0}, staff=${alData.staff?.edges?.length || 0})`
        )

        // Fetch remaining MAL data if malId is present
        let malData:
          import("./providers/mal.provider.js").MalAnimePayload | null = null
        let malEpisodes: import("./providers/mal.provider.js").MalScrapedEpisode[] =
          []
        const malId = alData.idMal
        if (malId) {
          try {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 📡 [2/3] Querying Official MyAnimeList API v2 for MAL ID #${malId}...`
            )
            malData = await this.mal.fetchAnime(malId)
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 📥 [2/3] MAL received: (score=${malData.mean || "N/A"}, rating=${malData.rating || "N/A"}, OP/ED themes=${(malData.opening_themes?.length || 0) + (malData.ending_themes?.length || 0)})`
            )
          } catch (malErr: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ [2/3] MAL supplement warning: ${malErr.message}`
            )
          }

          try {
            malEpisodes = await this.mal.fetchAnimeEpisodes(malId)
            if (malEpisodes.length > 0) {
              logQueue(
                `${c.magenta(c.bold("[MediaQueue]"))} 📺 [2/3] MAL received ${malEpisodes.length} named episodes with air dates.`
              )
            }
          } catch {}
        }

        // Cross-site ID mapping (AniDB, TheTVDB, Bangumi, Kitsu, IMDb, TMDB)
        const mappedIds: AnimeMappingEntry = await this.animeMapping
          .lookup({ anilistId, malId })
          .catch(() => ({}) as AnimeMappingEntry)
        if (
          mappedIds.anidbId ||
          mappedIds.tvdbId ||
          mappedIds.bangumiId ||
          mappedIds.kitsuId
        ) {
          const parts: string[] = []
          if (mappedIds.anidbId) parts.push(`AniDB=#${mappedIds.anidbId}`)
          if (mappedIds.tvdbId) parts.push(`TheTVDB=#${mappedIds.tvdbId}`)
          if (mappedIds.bangumiId) parts.push(`Bangumi=#${mappedIds.bangumiId}`)
          if (mappedIds.kitsuId) parts.push(`Kitsu=#${mappedIds.kitsuId}`)
          if (mappedIds.imdbId) parts.push(`IMDb=${mappedIds.imdbId}`)
          logQueue(
            `${c.magenta(c.bold("[MediaQueue]"))} 🔗 [2/3] Mapped IDs: ${parts.join(", ")}`
          )
        }

        // TheTVDB Artworks & Images (if tvdbId is mapped)
        let tvdbImages: string[] = []
        if (mappedIds.tvdbId) {
          try {
            tvdbImages = await this.tvdb.fetchTvSeriesArtworks(mappedIds.tvdbId)
            if (tvdbImages.length > 0) {
              logQueue(
                `${c.magenta(c.bold("[MediaQueue]"))} 🖼️ [2/3] TheTVDB received ${tvdbImages.length} images/artworks for Series #${mappedIds.tvdbId}.`
              )
            }
          } catch (tvdbErr: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ [2/3] TheTVDB images warning: ${tvdbErr.message}`
            )
          }
        }

        // AniSkip OP/ED/Recap timestamps (if malId is available)
        let skipMap = new Map<number, EpisodeSkipTimestamps>()
        if (malId) {
          const totalEpCount = alData.episodes || malEpisodes.length || 0
          if (totalEpCount > 0) {
            const epNums = Array.from({ length: totalEpCount }, (_, i) => i + 1)
            try {
              skipMap = await this.aniskip.fetchEpisodesSkipTimes(malId, epNums)
              if (skipMap.size > 0) {
                logQueue(
                  `${c.magenta(c.bold("[MediaQueue]"))} ⏭️ [2/3] AniSkip received skip timestamps for ${skipMap.size} episodes.`
                )
              }
            } catch {}
          }
        }

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 💾 [3/3] Upserting Anime to database using Local IDs...`
        )
        const result = await mediaDbSyncer.upsertAnime(
          alData,
          malData,
          malEpisodes,
          mappedIds,
          tvdbImages,
          skipMap
        )
        localId = result.id
        relationsToCrawl = result.discoveredRelations

        if (result.characterIds && result.characterIds.length > 0) {
          await this.resolveCharacterDescriptionLinks(result.characterIds)
        }
        break
      }

      case "MANGA": {
        const anilistId = Number(job.externalId)
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📡 [1/3] Querying AniList GraphQL API for Manga #${anilistId}...`
        )
        const alData = await this.anilist.fetchManga(anilistId)
        summaryText =
          alData.title.userPreferred ||
          alData.title.english ||
          alData.title.romaji ||
          ""

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📥 [1/3] AniList received: "${c.bold(summaryText)}" (chapters=${alData.chapters || "N/A"}, relations=${alData.relations?.edges?.length || 0}, characters=${alData.characters?.edges?.length || 0})`
        )

        let malData:
          import("./providers/mal.provider.js").MalMangaPayload | null = null
        const malId = alData.idMal
        if (malId) {
          try {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 📡 [2/3] Querying Official MyAnimeList API v2 for Manga MAL ID #${malId}...`
            )
            malData = await this.mal.fetchManga(malId)
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 📥 [2/3] MAL received: (score=${malData.mean || "N/A"}, rank=${malData.rank || "N/A"})`
            )
          } catch (malErr: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ [2/3] MAL supplement warning: ${malErr.message}`
            )
          }
        }

        // Cross-site Manga ID mapping (MangaUpdates, Kitsu, Bangumi)
        const mappedMangaIds: MangaMappingEntry = await this.animeMapping
          .lookupManga({
            anilistId,
            malId,
            title: summaryText,
            titleNative: alData.title.native,
          })
          .catch(() => ({}) as MangaMappingEntry)
        if (
          mappedMangaIds.mangaUpdatesId ||
          mappedMangaIds.kitsuId ||
          mappedMangaIds.bangumiId
        ) {
          const parts: string[] = []
          if (mappedMangaIds.mangaUpdatesId)
            parts.push(`MangaUpdates=#${mappedMangaIds.mangaUpdatesId}`)
          if (mappedMangaIds.kitsuId)
            parts.push(`Kitsu=#${mappedMangaIds.kitsuId}`)
          if (mappedMangaIds.bangumiId)
            parts.push(`Bangumi=#${mappedMangaIds.bangumiId}`)
          logQueue(
            `${c.magenta(c.bold("[MediaQueue]"))} 🔗 [2/3] Mapped Manga IDs: ${parts.join(", ")}`
          )
        }

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 💾 [3/3] Upserting Manga to database using Local IDs...`
        )
        const result = await mediaDbSyncer.upsertManga(
          alData,
          malData,
          mappedMangaIds
        )
        localId = result.id
        relationsToCrawl = result.discoveredRelations

        if (result.characterIds && result.characterIds.length > 0) {
          await this.resolveCharacterDescriptionLinks(result.characterIds)
        }
        break
      }

      case "TV": {
        const tvdbId = Number(job.externalId)
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📡 Querying TheTVDB API v4 for Series #${tvdbId}...`
        )
        const series = await this.tvdb.fetchTvSeries(tvdbId)
        summaryText = series.name
        const [episodes, characters] = await Promise.all([
          this.tvdb.fetchTvEpisodes(tvdbId),
          this.tvdb.fetchTvCharacters(tvdbId),
        ])

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📥 TVDB received: "${c.bold(summaryText)}" (episodes=${episodes.length}, cast/characters=${characters.length})`
        )

        let tvdbImages: string[] = []
        try {
          tvdbImages = await this.tvdb.fetchTvSeriesArtworks(tvdbId)
          if (tvdbImages.length > 0) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 🖼️ TheTVDB received ${tvdbImages.length} images/artworks for Series #${tvdbId}.`
            )
          }
        } catch {}

        // Simkl Enrichment (Ratings, IMDb votes, certifications)
        let imdbId: string | undefined
        let tmdbId: number | undefined
        if (series.remoteIds) {
          for (const r of series.remoteIds) {
            if (r.sourceName?.toUpperCase() === "IMDB" || r.type === 2)
              imdbId = r.id
            else if (
              r.sourceName?.toLowerCase().includes("themoviedb") ||
              r.type === 12 ||
              r.type === 10
            ) {
              const p = parseInt(r.id, 10)
              if (!isNaN(p)) tmdbId = p
            }
          }
        }

        let simklData: SimklTvPayload | null = null
        try {
          simklData = await this.simkl.lookupTv({
            imdbId,
            tmdbId,
            tvdbId,
            title: series.name,
          })
          if (simklData) {
            const parts: string[] = []
            if (simklData.simklId) parts.push(`Simkl=#${simklData.simklId}`)
            if (simklData.imdbRating)
              parts.push(
                `IMDb=${simklData.imdbRating}★ (${simklData.imdbVotes || 0} votes)`
              )
            if (simklData.certification)
              parts.push(`Rated=${simklData.certification}`)
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 📺 Simkl enriched: ${parts.join(", ")}`
            )
          }
        } catch {}

        // Fetch English translation if available (English is always primary)
        let engTranslation: { name?: string; overview?: string } | null = null
        try {
          engTranslation = await this.tvdb.fetchTvSeriesTranslation(
            tvdbId,
            "eng"
          )
          if (engTranslation?.name) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 🌐 English translation found: "${c.bold(engTranslation.name)}"`
            )
          }
        } catch {}

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 💾 Upserting TV Show, Seasons, Episodes, and Cast to database...`
        )
        const result = await mediaDbSyncer.upsertTv(
          series,
          episodes,
          characters,
          tvdbImages,
          simklData,
          engTranslation
        )
        localId = result.id
        break
      }

      case "MOVIE": {
        const tvdbId = Number(job.externalId)
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📡 Querying TheTVDB API v4 for Movie #${tvdbId}...`
        )
        const movie = await this.tvdb.fetchMovie(tvdbId)
        summaryText = movie.name
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📥 TVDB received Movie: "${c.bold(summaryText)}" (runtime=${movie.runtime || "N/A"}m, score=${movie.score || "N/A"})`
        )

        let tvdbImages: string[] = []
        try {
          tvdbImages = await this.tvdb.fetchMovieArtworks(tvdbId)
          if (tvdbImages.length > 0) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 🖼️ TheTVDB received ${tvdbImages.length} images/artworks for Movie #${tvdbId}.`
            )
          }
        } catch {}

        // Simkl Enrichment (Ratings, IMDb votes, certifications)
        let imdbId: string | undefined
        let tmdbId: number | undefined
        if (movie.remoteIds) {
          for (const r of movie.remoteIds) {
            if (r.sourceName?.toUpperCase() === "IMDB" || r.type === 2)
              imdbId = r.id
            else if (
              r.sourceName?.toLowerCase().includes("themoviedb") ||
              r.type === 10
            ) {
              const p = parseInt(r.id, 10)
              if (!isNaN(p)) tmdbId = p
            }
          }
        }

        let simklData: SimklMoviePayload | null = null
        try {
          simklData = await this.simkl.lookupMovie({
            imdbId,
            tmdbId,
            tvdbId,
            title: movie.name,
          })
          if (simklData) {
            const parts: string[] = []
            if (simklData.simklId) parts.push(`Simkl=#${simklData.simklId}`)
            if (simklData.imdbRating)
              parts.push(
                `IMDb=${simklData.imdbRating}★ (${simklData.imdbVotes || 0} votes)`
              )
            if (simklData.certification)
              parts.push(`Rated=${simklData.certification}`)
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 🎬 Simkl enriched: ${parts.join(", ")}`
            )
          }
        } catch {}

        // Fetch English translation if available (English is always primary)
        let engTranslation: { name?: string; overview?: string } | null = null
        try {
          engTranslation = await this.tvdb.fetchMovieTranslation(tvdbId, "eng")
          if (engTranslation?.name) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 🌐 English translation found: "${c.bold(engTranslation.name)}"`
            )
          }
        } catch {}

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 💾 Upserting Movie to database...`
        )
        const result = await mediaDbSyncer.upsertMovie(
          movie,
          tvdbImages,
          simklData,
          engTranslation
        )
        localId = result.id
        break
      }

      case "BOOK": {
        const volumeId = String(job.externalId)
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📡 Querying Google Books API for "${volumeId}"...`
        )
        const bookData = await this.googleBooks.fetchBook(volumeId)
        summaryText = bookData.volumeInfo.title
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📥 Google Books received: "${c.bold(summaryText)}" by ${bookData.volumeInfo.authors?.join(", ") || "Unknown"}`
        )
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 💾 Upserting Book to database...`
        )
        const result = await mediaDbSyncer.upsertBook(bookData)
        localId = result.id
        break
      }

      case "GAME": {
        const igdbId = Number(job.externalId)
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📡 Querying IGDB API v4 for Game #${igdbId}...`
        )
        const gameData = await this.igdb.fetchGame(igdbId)
        summaryText = gameData.name
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📥 IGDB received: "${c.bold(summaryText)}" (rating=${gameData.rating?.toFixed(1) || "N/A"})`
        )

        // Check if Steam App ID is available from external_games or websites
        let steamAppId: number | undefined
        if (gameData.external_games) {
          const steamExt = gameData.external_games.find((e) => e.category === 1)
          if (steamExt?.uid) {
            const parsed = parseInt(steamExt.uid, 10)
            if (!isNaN(parsed)) steamAppId = parsed
          }
        }
        if (!steamAppId && gameData.websites) {
          const steamWeb = gameData.websites.find((w) =>
            w.url.includes("store.steampowered.com/app/")
          )
          if (steamWeb) {
            const match = steamWeb.url.match(/app\/(\d+)/)
            if (match?.[1]) {
              const parsed = parseInt(match[1], 10)
              if (!isNaN(parsed)) steamAppId = parsed
            }
          }
        }

        let steamData: SteamAppDetailsPayload | null = null
        let deckData: SteamDeckCompatibilityReport | null = null

        if (steamAppId) {
          try {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 🎮 Querying Steam Store API for App #${steamAppId}...`
            )
            steamData = await this.steam.fetchAppDetails(steamAppId)
            if (steamData) {
              logQueue(
                `${c.magenta(c.bold("[MediaQueue]"))} 📥 Steam Store received: "${steamData.name}" (achievements=${steamData.achievements?.total || 0}, controller=${steamData.controller_support || "None"})`
              )
            }
          } catch (steamErr: any) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Steam details warning: ${steamErr.message}`
            )
          }

          try {
            deckData = await this.steam.fetchDeckCompatibility(steamAppId)
            if (deckData) {
              const catNames: Record<number, string> = {
                1: "Unsupported",
                2: "Playable",
                3: "Verified",
              }
              const catStr = catNames[deckData.resolved_category] || "Unknown"
              logQueue(
                `${c.magenta(c.bold("[MediaQueue]"))} 🕹️ Steam Deck Compatibility: ${catStr}`
              )
            }
          } catch {}
        }

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 💾 Upserting Game to database...`
        )
        const result = await mediaDbSyncer.upsertGame(
          gameData,
          steamData,
          deckData
        )
        localId = result.id
        break
      }

      case "MUSIC": {
        const mbid = String(job.externalId)
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 📡 Querying MusicBrainz WS/2 for Recording "${mbid}"...`
        )
        const mbData = await this.musicbrainz.fetchRecording(mbid)
        summaryText = `${mbData.title} by ${mbData["artist-credit"]?.[0]?.name || "Unknown"}`

        const artist = mbData["artist-credit"]?.[0]?.name || ""
        const track = mbData.title
        const album = mbData.releases?.[0]?.title
        const duration = mbData.length ? mbData.length / 1000 : undefined

        let lyrics:
          import("./providers/lrclib.provider.js").LrcLibLyricsPayload | null =
          null
        if (track && artist) {
          logQueue(
            `${c.magenta(c.bold("[MediaQueue]"))} 📡 Querying LRCLIB for lyrics ("${track}" - "${artist}")...`
          )
          lyrics = await this.lrclib.fetchLyrics(track, artist, album, duration)
          if (lyrics) {
            logQueue(
              `${c.magenta(c.bold("[MediaQueue]"))} 📥 LRCLIB lyrics received (${lyrics.plainLyrics ? `${lyrics.plainLyrics.length} chars` : "synced only"})`
            )
          }
        }

        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} 💾 Upserting Music track to database...`
        )
        const result = await mediaDbSyncer.upsertMusic(mbData, lyrics)
        localId = result.id
        break
      }
    }

    const durationMs = performance.now() - startTime

    // Mark completed
    job.status = "COMPLETED"
    job.completedAt = new Date().toISOString()
    job.updatedAt = new Date().toISOString()

    await cache.set(`${REDIS_KEY_PREFIX}:job:${job.id}`, job, 86400 * 7)
    await this.removeFromRedisSet(`${REDIS_KEY_PREFIX}:processing`, job.id)
    this.inFlightJobs.delete(job.id)
    this.sessionProcessedCount++
    this.checkQueueCompletion()

    logQueue(
      `${c.magenta(c.bold("[MediaQueue]"))} ${c.green(c.bold("✨ [SUCCESS] Finished:"))} ${c.cyan(job.id)} ${c.bold(summaryText ? `("${summaryText}")` : "")} -> Local ID: ${c.bold(localId ?? "N/A")} ${colorDuration(durationMs)}`
    )

    // Broadcast WebSocket progress event
    try {
      wsHub.broadcast("media:synced", {
        jobId: job.id,
        type: job.type,
        externalId: job.externalId,
        localId,
        completedAt: job.completedAt,
      })
    } catch {}

    // Recursive relation crawling with deduplication and cycle prevention
    const currentDepth = job.depth || 0
    const maxDepth = job.maxDepth ?? Infinity
    const lineage: string[] = (job.metadata?.lineage as string[]) || [job.id]

    if (relationsToCrawl.length > 0 && currentDepth < maxDepth) {
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.yellow(`⚡ Discovered ${relationsToCrawl.length} relations for ${job.id}:`)} queueing connected nodes (depth=${currentDepth + 1})...`
      )
      for (const rel of relationsToCrawl) {
        const targetJobId = this.getJobId(rel.targetType, rel.targetExternalId)
        if (lineage.includes(targetJobId)) {
          logQueue(
            `  ↳ ${c.cyan(`[${rel.type}]`)} ${c.yellow(`${rel.targetType}:${rel.targetExternalId}`)} ${c.dim("⏩ Skipped (Cycle detected in lineage)")}`
          )
          continue
        }

        logQueue(
          `  ↳ ${c.cyan(`[${rel.type}]`)} ${c.yellow(`${rel.targetType}:${rel.targetExternalId}`)} ${c.dim(`(depth=${currentDepth + 1})`)}`
        )
        this.enqueueJob(rel.targetType, rel.targetExternalId, {
          maxDepth,
          metadata: {
            depth: currentDepth + 1,
            parentJobId: job.id,
            lineage: [...lineage, targetJobId],
          },
        }).catch((err) => {
          logQueue(
            `${c.magenta(c.bold("[MediaQueue]"))} ⚠️ Failed to enqueue relation ${rel.targetType}:${rel.targetExternalId}: ${err.message}`
          )
        })
      }
    }
  }

  /**
   * Resolves internal character links in descriptions from AniList URLs to NEXT_PUBLIC_URL/IRIS-list/characters/:id.
   * Looks up the character strictly from the local database. If not found in the DB, skips it without making API calls.
   */
  private async resolveCharacterDescriptionLinks(
    characterIds: number[]
  ): Promise<void> {
    if (!characterIds || characterIds.length === 0) return

    const baseUrl = process.env.NEXTAUTH_URL!.replace(/\/+$/, "")
    const ANILIST_CHAR_URL_REGEX =
      /https?:\/\/(?:www\.)?anilist\.co\/character\/(\d+)(?:\/[^\s\)\"\]\.]*)?/gi

    for (const charId of characterIds) {
      try {
        const char = await prisma.character.findUnique({
          where: { id: charId },
          select: { id: true, description: true },
        })

        if (
          !char?.description ||
          !char.description.includes("anilist.co/character/")
        ) {
          continue
        }

        let updatedDesc = char.description
        const matches = [...char.description.matchAll(ANILIST_CHAR_URL_REGEX)]
        if (matches.length === 0) continue

        let changed = false

        for (const match of matches) {
          const fullUrl = match[0]
          const targetAnilistId = parseInt(match[1]!, 10)
          if (!targetAnilistId || isNaN(targetAnilistId)) continue

          // 1. Query database with extracted anilistId
          const targetChar = await prisma.character.findUnique({
            where: { anilistId: targetAnilistId },
            select: { id: true },
          })

          // 2. If found in DB, replace with local URL. If not found, skip it.
          if (targetChar?.id) {
            const localUrl = `${baseUrl}/IRIS-list/characters/${targetChar.id}`
            updatedDesc = updatedDesc.replaceAll(fullUrl, localUrl)
            changed = true
          }
        }

        if (changed && updatedDesc !== char.description) {
          await prisma.character.update({
            where: { id: char.id },
            data: { description: updatedDesc },
          })
        }
      } catch {}
    }
  }

  /**
   * Handles permanent job failure after max retries.
   */
  private async handleJobFailure(job: MediaJob, error: unknown): Promise<void> {
    const errorMsg = (error as Error).message || String(error)
    job.status = "FAILED"
    job.error = errorMsg
    job.updatedAt = new Date().toISOString()
    job.completedAt = new Date().toISOString()

    logQueue(
      `${c.magenta(c.bold("[MediaQueue]"))} ${c.red(c.bold("❌ [JOB FAILED]"))} ${c.cyan(job.id)}: ${c.red(errorMsg)}`
    )

    await cache.set(`${REDIS_KEY_PREFIX}:job:${job.id}`, job, 86400 * 7)
    await this.removeFromRedisSet(`${REDIS_KEY_PREFIX}:processing`, job.id)
    await this.addToRedisSet(`${REDIS_KEY_PREFIX}:failed`, job.id)
    this.inFlightJobs.delete(job.id)
    this.sessionProcessedCount++
    this.checkQueueCompletion()

    try {
      wsHub.broadcast("media:failed", {
        jobId: job.id,
        type: job.type,
        externalId: job.externalId,
        error: errorMsg,
      })
    } catch {}
  }

  /**
   * Checks if all in-flight jobs have completed and logs queue completion status.
   */
  private checkQueueCompletion(): void {
    if (this.idleCheckTimeout) {
      clearTimeout(this.idleCheckTimeout)
      this.idleCheckTimeout = null
    }

    if (this.inFlightJobs.size === 0 && this.sessionProcessedCount > 0) {
      this.idleCheckTimeout = setTimeout(() => {
        if (this.inFlightJobs.size === 0 && this.sessionProcessedCount > 0) {
          const elapsed = performance.now() - this.sessionStartTime
          logQueue(
            `${c.magenta(c.bold("[MediaQueue]"))} ${c.green(c.bold("🏁 [QUEUE FINISHED]"))} ${c.bold("All queued media fetch jobs have completed!")} ${c.dim(`(Processed: ${this.sessionProcessedCount} items, Total elapsed: ${colorDuration(elapsed)})`)}`
          )
          this.sessionProcessedCount = 0
          this.sessionStartTime = 0
        }
      }, 500)
    }
  }
}

export const mediaQueueService = new MediaQueueService()

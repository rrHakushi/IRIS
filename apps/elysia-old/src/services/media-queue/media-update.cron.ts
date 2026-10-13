import { prisma } from "@IRIS/database"
import { mediaQueueService } from "./media-queue.service.js"
import { mediaDbSyncer } from "./media-db.syncer.js"
import { schedule, Patterns } from "../../plugins/cron.js"
import { logger } from "../../utils/logger.js"
import { c } from "../../utils/colors.js"

export interface ActiveMediaSyncResult {
  anime: number
  manga: number
  tv: number
  book: number
  game: number
  movie: number
  total: number
}

/**
 * Scans all media entities currently in active/ongoing publication/broadcasting status
 * (RELEASING, HIATUS, NOT_YET_RELEASED, IN_PRODUCTION, RETURNING_SERIES, etc.)
 * and enqueues background refresh jobs if the record is stale or not already fresh in DB.
 */
export async function syncActiveMedia(): Promise<ActiveMediaSyncResult> {
  const result: ActiveMediaSyncResult = {
    anime: 0,
    manga: 0,
    tv: 0,
    book: 0,
    game: 0,
    movie: 0,
    total: 0,
  }

  logger.service(
    "media-queue",
    `${c.magenta(c.bold("[ActiveMediaSync]"))} Starting weekly active media synchronization...`
  )

  // 1. Anime (RELEASING, HIATUS, NOT_YET_RELEASED, or nextAiringAt has passed)
  try {
    const animes = await prisma.anime.findMany({
      where: {
        anilistId: { not: null },
        OR: [
          { status: { in: ["RELEASING", "HIATUS", "NOT_YET_RELEASED"] } },
          {
            nextAiringAt: { lte: new Date() },
            status: { notIn: ["FINISHED", "CANCELLED"] },
          },
        ],
      },
      select: {
        id: true,
        anilistId: true,
        malId: true,
        status: true,
        updatedAt: true,
        alUpdatedAt: true,
        malUpdatedAt: true,
        nextAiringAt: true,
      },
    })

    for (const anime of animes) {
      if (!anime.anilistId) continue
      if (mediaDbSyncer.isRecordStale(anime, "ANIME")) {
        await mediaQueueService
          .enqueueJob("ANIME", anime.anilistId, { priority: 10 })
          .catch(() => {})
        result.anime++
      }
    }
  } catch (err) {
    logger.error("[ActiveMediaSync] Error checking active anime:", err)
  }

  // 2. Manga (RELEASING, HIATUS, NOT_YET_RELEASED)
  try {
    const mangas = await prisma.manga.findMany({
      where: {
        anilistId: { not: null },
        status: { in: ["RELEASING", "HIATUS", "NOT_YET_RELEASED"] },
      },
      select: {
        id: true,
        anilistId: true,
        malId: true,
        status: true,
        updatedAt: true,
        alUpdatedAt: true,
        malUpdatedAt: true,
      },
    })

    for (const manga of mangas) {
      if (!manga.anilistId) continue
      if (mediaDbSyncer.isRecordStale(manga, "MANGA")) {
        await mediaQueueService
          .enqueueJob("MANGA", manga.anilistId, { priority: 10 })
          .catch(() => {})
        result.manga++
      }
    }
  } catch (err) {
    logger.error("[ActiveMediaSync] Error checking active manga:", err)
  }

  // 3. TV (RETURNING_SERIES, IN_PRODUCTION, UPCOMING)
  try {
    const tvs = await prisma.tv.findMany({
      where: {
        tvDBId: { not: null },
        status: { in: ["RETURNING_SERIES", "IN_PRODUCTION", "UPCOMING"] },
      },
      select: {
        id: true,
        tvDBId: true,
        status: true,
        updatedAt: true,
        tvdbUpdatedAt: true,
      },
    })

    for (const tv of tvs) {
      if (!tv.tvDBId) continue
      if (mediaDbSyncer.isRecordStale(tv, "TV")) {
        await mediaQueueService
          .enqueueJob("TV", tv.tvDBId, { priority: 10 })
          .catch(() => {})
        result.tv++
      }
    }
  } catch (err) {
    logger.error("[ActiveMediaSync] Error checking active TV series:", err)
  }

  // 4. Books (RELEASING, ON_HIATUS)
  try {
    const books = await prisma.book.findMany({
      where: {
        googleBookId: { not: null },
        status: { in: ["RELEASING", "ON_HIATUS"] },
      },
      select: {
        id: true,
        googleBookId: true,
        status: true,
        updatedAt: true,
        googleBooksUpdatedAt: true,
      },
    })

    for (const book of books) {
      if (!book.googleBookId) continue
      if (mediaDbSyncer.isRecordStale(book, "BOOK")) {
        await mediaQueueService
          .enqueueJob("BOOK", book.googleBookId, { priority: 10 })
          .catch(() => {})
        result.book++
      }
    }
  } catch (err) {
    logger.error("[ActiveMediaSync] Error checking active books:", err)
  }

  // 5. Games (EARLY_ACCESS, IN_DEVELOPMENT, ANNOUNCED, DELAYED)
  try {
    const games = await prisma.game.findMany({
      where: {
        igdbId: { not: null },
        status: {
          in: ["EARLY_ACCESS", "IN_DEVELOPMENT", "ANNOUNCED", "DELAYED"],
        },
      },
      select: {
        id: true,
        igdbId: true,
        status: true,
        updatedAt: true,
        igdbUpdatedAt: true,
      },
    })

    for (const game of games) {
      if (!game.igdbId) continue
      if (mediaDbSyncer.isRecordStale(game, "GAME")) {
        await mediaQueueService
          .enqueueJob("GAME", game.igdbId, { priority: 10 })
          .catch(() => {})
        result.game++
      }
    }
  } catch (err) {
    logger.error("[ActiveMediaSync] Error checking active games:", err)
  }

  // 6. Movies (IN_PRODUCTION, POST_PRODUCTION, RUMORED)
  try {
    const movies = await prisma.movie.findMany({
      where: {
        tvDBId: { not: null },
        status: { in: ["IN_PRODUCTION", "POST_PRODUCTION", "RUMORED"] },
      },
      select: {
        id: true,
        tvDBId: true,
        status: true,
        updatedAt: true,
        tvdbUpdatedAt: true,
      },
    })

    for (const movie of movies) {
      if (!movie.tvDBId) continue
      if (mediaDbSyncer.isRecordStale(movie, "MOVIE")) {
        await mediaQueueService
          .enqueueJob("MOVIE", movie.tvDBId, { priority: 10 })
          .catch(() => {})
        result.movie++
      }
    }
  } catch (err) {
    logger.error("[ActiveMediaSync] Error checking active movies:", err)
  }

  result.total =
    result.anime +
    result.manga +
    result.tv +
    result.book +
    result.game +
    result.movie

  logger.service(
    "media-queue",
    `${c.magenta(c.bold("[ActiveMediaSync]"))} Completed weekly sync: enqueued ${c.cyan(String(result.total))} stale active items ` +
      `(Anime: ${result.anime}, Manga: ${result.manga}, TV: ${result.tv}, Books: ${result.book}, Games: ${result.game}, Movies: ${result.movie})`
  )

  return result
}

let activeMediaCronRegistered = false

/**
 * Initializes the weekly cron job that updates media that is RELEASING, HIATUS etc.
 * Runs once a week every Sunday at midnight ("0 0 * * 0").
 */
export function initActiveMediaCron(): void {
  if (activeMediaCronRegistered) return
  activeMediaCronRegistered = true

  schedule({
    name: "weekly-active-media-sync",
    pattern: Patterns.everyWeekOn(Patterns.SUNDAY, "00:00"), // "0 0 * * 0"
    runOnInit: false,
    async run() {
      try {
        await syncActiveMedia()
      } catch (error) {
        logger.error(
          "[ActiveMediaCron] Execution error in weekly active media sync job:",
          error
        )
      }
    },
    catch(error, job) {
      logger.error(
        `[ActiveMediaCron] Uncaught error in cron job "${job.name}":`,
        error
      )
    },
  })
}

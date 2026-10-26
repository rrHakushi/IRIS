import { Queue, type Job, type JobsOptions } from 'bullmq'
import { prisma, and, or, not } from '@Iris/db'
import { LogFactory, c } from '@Iris/logger'
import { getRedisConnectionOptions } from '../email/queue'
import {
  getMediaWorker,
  closeMediaWorker,
  executeMediaUpdate,
} from '../../workers/media.wrk'
import { getEntityFreshness } from './freshness'

export { getMediaWorker, closeMediaWorker, executeMediaUpdate }

const logger = new LogFactory('BullMQ:MediaQueue')

export const MEDIA_QUEUE_NAME = 'media-updates'

export type MediaType =
  | 'ANIME'
  | 'MANGA'
  | 'TV'
  | 'MOVIE'
  | 'BOOK'
  | 'GAME'
  | 'MUSIC'

export interface MediaUpdateJobData {
  type: 'media-update'
  mediaType: MediaType
  mediaId: number
  externalId?: number | string | null
  triggeredBy?: 'cron' | 'manual' | 'sync'
  priority?: number
  depth?: number
  maxDepth?: number
  lineage?: string[]
  timestamp?: number
}

export interface WeeklyCronJobData {
  type: 'weekly-active-sync'
  scheduledAt: string
}

export type MediaJobData = MediaUpdateJobData | WeeklyCronJobData

export interface ActiveMediaSyncResult {
  anime: number
  manga: number
  tv: number
  movie: number
  book: number
  game: number
  total: number
}

let mediaQueueInstance: Queue<MediaJobData> | null = null
let isShuttingDown = false

export function getMediaQueue(): Queue<MediaJobData> {
  if (!mediaQueueInstance) {
    const connection = getRedisConnectionOptions()
    mediaQueueInstance = new Queue<MediaJobData>(MEDIA_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 5000 },
      },
    })

    logger.info(
      `${c.cyan('🚀 [MediaQueue Initialized]')}: Connected to Redis queue "${c.bold(MEDIA_QUEUE_NAME)}"`
    )

    mediaQueueInstance.on('error', (err) => {
      logger.warn(`${c.red('⚠️ [Media Queue Error]')}: ${err.message}`)
    })
  }

  return mediaQueueInstance
}

/**
 * Returns ISO week string for deterministic deduplication (e.g. "2026-W42")
 */
function getWeekIdentifier(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNo}`
}

/**
 * Scans all media entities currently in active/ongoing publication/broadcasting status
 * (RELEASING, HIATUS, UPCOMING)
 * and enqueues background refresh jobs into the reusable BullMQ media queue.
 *
 * For weekly updates, depth is strictly set to 0 so only this single media item updates without cascading to relations.
 */
export async function syncActiveMedia(): Promise<ActiveMediaSyncResult> {
  const result: ActiveMediaSyncResult = {
    anime: 0,
    manga: 0,
    tv: 0,
    movie: 0,
    book: 0,
    game: 0,
    total: 0,
  }

  logger.info(
    `${c.blue('🔄 [SyncScan]')} Starting weekly active media synchronization scan (depth: 0)...`
  )
  const weekKey = getWeekIdentifier()

  // 1. Anime (RELEASING, HIATUS, UPCOMING, or nextAiringAt has arrived)
  try {
    const animes = await prisma.orm.public.Anime.where((a) =>
      or(
        a.status.in(['RELEASING', 'HIATUS', 'UPCOMING']),
        and(
          a.nextAiringAt.lte(new Date()),
          not(a.status.in(['RELEASED', 'CANCELLED']))
        )
      )
    )
      .select('id', 'anilistId', 'status')
      .all()

    for (const anime of animes) {
      await MediaQueueManager.enqueueMediaUpdate('ANIME', anime.id, {
        externalId: anime.anilistId,
        priority: 10,
        triggeredBy: 'cron',
        depth: 0,
        maxDepth: 0,
        jobId: `media-update-ANIME-${anime.id}-${weekKey}`,
      }).catch(() => { })
      result.anime++
    }
    logger.info(`${c.cyan('Anime Scan')}: enqueued ${c.bold(String(result.anime))} active items`)
  } catch (err: any) {
    logger.error(`Error scanning active anime: ${err?.message || err}`)
  }

  // 2. Manga (RELEASING, HIATUS, UPCOMING)
  try {
    const mangas = await prisma.orm.public.Manga.where((m) =>
      m.status.in(['RELEASING', 'HIATUS', 'UPCOMING'])
    )
      .select('id', 'anilistId', 'status')
      .all()

    for (const manga of mangas) {
      await MediaQueueManager.enqueueMediaUpdate('MANGA', manga.id, {
        externalId: manga.anilistId,
        priority: 10,
        triggeredBy: 'cron',
        depth: 0,
        maxDepth: 0,
        jobId: `media-update-MANGA-${manga.id}-${weekKey}`,
      }).catch(() => { })
      result.manga++
    }
    logger.info(`${c.cyan('Manga Scan')}: enqueued ${c.bold(String(result.manga))} active items`)
  } catch (err: any) {
    logger.error(`Error scanning active manga: ${err?.message || err}`)
  }

  // 3. TV Series (RELEASING, UPCOMING)
  try {
    const tvs = await prisma.orm.public.Tv.where((t) =>
      t.status.in(['RELEASING', 'UPCOMING'])
    )
      .select('id', 'tvDBId', 'status')
      .all()

    for (const tv of tvs) {
      await MediaQueueManager.enqueueMediaUpdate('TV', tv.id, {
        externalId: tv.tvDBId,
        priority: 10,
        triggeredBy: 'cron',
        depth: 0,
        jobId: `media-update-TV-${tv.id}-${weekKey}`,
      }).catch(() => { })
      result.tv++
    }
    logger.info(`${c.cyan('TV Scan')}: enqueued ${c.bold(String(result.tv))} active items`)
  } catch (err: any) {
    logger.error(`Error scanning active TV series: ${err?.message || err}`)
  }

  // 4. Movies (UPCOMING)
  try {
    const movies = await prisma.orm.public.Movie.where((m) =>
      m.status.in(['UPCOMING'])
    )
      .select('id', 'tvDBId', 'status')
      .all()

    for (const movie of movies) {
      await MediaQueueManager.enqueueMediaUpdate('MOVIE', movie.id, {
        externalId: movie.tvDBId,
        priority: 10,
        triggeredBy: 'cron',
        depth: 0,
        jobId: `media-update-MOVIE-${movie.id}-${weekKey}`,
      }).catch(() => { })
      result.movie++
    }
    logger.info(`${c.cyan('Movies Scan')}: enqueued ${c.bold(String(result.movie))} active items`)
  } catch (err: any) {
    logger.error(`Error scanning active movies: ${err?.message || err}`)
  }

  // 5. Books (RELEASING, HIATUS)
  try {
    const books = await prisma.orm.public.Book.where((b) =>
      b.status.in(['RELEASING', 'HIATUS'])
    )
      .select('id', 'googleBookId', 'status')
      .all()

    for (const book of books) {
      await MediaQueueManager.enqueueMediaUpdate('BOOK', book.id, {
        externalId: book.googleBookId,
        priority: 10,
        triggeredBy: 'cron',
        depth: 0,
        jobId: `media-update-BOOK-${book.id}-${weekKey}`,
      }).catch(() => { })
      result.book++
    }
    logger.info(`${c.cyan('Books Scan')}: enqueued ${c.bold(String(result.book))} active items`)
  } catch (err: any) {
    logger.error(`Error scanning active books: ${err?.message || err}`)
  }

  // 6. Games (RELEASING, UPCOMING, HIATUS)
  try {
    const games = await prisma.orm.public.Game.where((g) =>
      g.status.in(['RELEASING', 'UPCOMING', 'HIATUS'])
    )
      .select('id', 'igdbId', 'status')
      .all()

    for (const game of games) {
      await MediaQueueManager.enqueueMediaUpdate('GAME', game.id, {
        externalId: game.igdbId,
        priority: 10,
        triggeredBy: 'cron',
        depth: 0,
        jobId: `media-update-GAME-${game.id}-${weekKey}`,
      }).catch(() => { })
      result.game++
    }
    logger.info(`${c.cyan('Games Scan')}: enqueued ${c.bold(String(result.game))} active items`)
  } catch (err: any) {
    logger.error(`Error scanning active games: ${err?.message || err}`)
  }

  result.total =
    result.anime +
    result.manga +
    result.tv +
    result.movie +
    result.book +
    result.game

  logger.info(
    `${c.green(c.bold('✅ [SyncScan Complete]'))}: Enqueued ${c.bold(String(result.total))} active items ` +
    `(${c.cyan(`Anime: ${result.anime}`)}, ${c.cyan(`Manga: ${result.manga}`)}, ${c.cyan(`TV: ${result.tv}`)}, ${c.cyan(`Movies: ${result.movie}`)}, ${c.cyan(`Books: ${result.book}`)}, ${c.cyan(`Games: ${result.game}`)})`
  )

  return result
}

export const MediaQueueManager = {
  getQueue: getMediaQueue,

  /**
   * Returns the singleton media worker instance.
   */
  getWorker() {
    return getMediaWorker()
  },

  /**
   * Enqueue a media item for metadata refresh.
   * Reusable by manual refresh endpoints, airing schedule webhooks, and the weekly cron.
   *
   * @param mediaType - Media category ('ANIME', 'MANGA', 'TV', 'MOVIE', 'BOOK', 'GAME', 'MUSIC')
   * @param mediaId - Primary key ID of the media entity
   * @param options - Queue options (priority: 1 for manual click, 10 for cron; depth: 0 to prevent cascading relations; externalId, custom jobId)
   */
  async enqueueMediaUpdate(
    mediaType: MediaType,
    mediaId: number,
    options?: {
      externalId?: number | string | null
      priority?: number
      depth?: number
      maxDepth?: number
      lineage?: string[]
      triggeredBy?: 'cron' | 'manual' | 'sync'
      jobId?: string
      forceRefresh?: boolean
    }
  ): Promise<Job<MediaJobData> | null> {
    if (isShuttingDown) {
      logger.warn(
        `${c.yellow('⚠️ [Queue Shutdown]')}: Skipping enqueue for ${mediaType} #${mediaId} because queue is shutting down`
      )
      return null
    }

    const jobName = `update-${mediaType.toLowerCase()}-${mediaId}`
    const deterministicJobId = options?.jobId ?? `${jobName}-${Date.now()}`

    // Smart Freshness check: if not forceRefresh, verify if local record is already fresh
    if (!options?.forceRefresh) {
      const freshness = await getEntityFreshness(mediaType, mediaId)
      if (freshness.isFresh) {
        logger.info(
          `${c.magenta('⏩ [Skipped (Fresh in DB)]')}: ${c.cyan(deterministicJobId)} | ${c.bold(mediaType)} #${mediaId} is already fresh (${freshness.reason})`
        )
        return null
      }
    }

    const jobData: MediaUpdateJobData = {
      type: 'media-update',
      mediaType,
      mediaId,
      externalId: options?.externalId,
      triggeredBy: options?.triggeredBy ?? 'manual',
      priority: options?.priority ?? (options?.triggeredBy === 'cron' ? 10 : 1),
      depth: options?.depth ?? 0,
      maxDepth: options?.maxDepth,
      lineage: options?.lineage,
      timestamp: Date.now(),
    }

    const opts: JobsOptions = {
      priority: jobData.priority,
      jobId: deterministicJobId,
    }

    try {
      const queue = this.getQueue()
      const job = await queue.add(jobName, jobData, opts)
      const depthStr = `Depth: ${jobData.depth}${jobData.maxDepth !== undefined ? ` (max: ${jobData.maxDepth})` : ''}`
      logger.info(
        `${c.yellow('📥 [Enqueued]')}: ${c.cyan(c.bold(deterministicJobId))} | ${c.bold(mediaType)} #${mediaId} | Priority: ${jobData.priority} | ${depthStr} | External ID: ${jobData.externalId ?? 'none'} | Trigger: ${c.dim(jobData.triggeredBy || 'manual')}`
      )
      return job
    } catch (err: any) {
      logger.warn(
        `${c.red('❌ [Queue Error]')}: Failed to enqueue media update for ${mediaType} #${mediaId} (${deterministicJobId}): ${err?.message || err}`
      )
      return null
    }
  },

  /**
   * Registers a BullMQ repeatable job that runs every Sunday at midnight ("0 0 * * 0").
   * Uses BullMQ 6's upsertJobScheduler API with fallback for mocks/older clients.
   */
  async scheduleWeeklyActiveMediaSync(): Promise<any> {
    if (isShuttingDown) {
      return null
    }

    try {
      const queue = this.getQueue()
      let res: any
      if (typeof (queue as any).upsertJobScheduler === 'function') {
        res = await (queue as any).upsertJobScheduler(
          'weekly-active-media-sync-cron',
          { pattern: '0 0 * * 0' },
          {
            name: 'weekly-active-media-sync',
            data: {
              type: 'weekly-active-sync',
              scheduledAt: new Date().toISOString(),
            },
          }
        )
      } else {
        res = await queue.add(
          'weekly-active-media-sync',
          {
            type: 'weekly-active-sync',
            scheduledAt: new Date().toISOString(),
          },
          {
            jobId: 'weekly-active-media-sync-cron',
          }
        )
      }
      logger.info(
        `${c.green('📅 [Schedule Cron]')}: Weekly active media sync scheduled (pattern: "0 0 * * 0")`
      )
      return res
    } catch (err: any) {
      logger.warn(
        `${c.red('⚠️ [Schedule Error]')}: Failed to register weekly active media sync cron: ${err?.message || err}`
      )
      return null
    }
  },

  /**
   * Manually trigger the weekly active media sync immediately (useful for testing or admin dispatch).
   */
  triggerActiveMediaSync: syncActiveMedia,

  /**
   * Inspect current queue job counts.
   */
  async getQueueStatus() {
    try {
      const queue = this.getQueue()
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ])

      const status = {
        queue: MEDIA_QUEUE_NAME,
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + delayed,
      }
      logger.info(
        `${c.cyan('📊 [Queue Status]')}: ${c.bold(MEDIA_QUEUE_NAME)} -> Waiting: ${waiting}, Active: ${active}, Delayed: ${delayed}, Completed: ${completed}, Failed: ${failed}`
      )
      return status
    } catch (err: any) {
      logger.warn(`${c.red('⚠️ [Queue Status Error]')}: ${err?.message || String(err)}`)
      return {
        queue: MEDIA_QUEUE_NAME,
        error: err?.message || String(err),
      }
    }
  },

  /**
   * Initializes both the background worker and the weekly cron schedule.
   */
  async initWorkerAndSchedule() {
    try {
      getMediaWorker()
      await this.scheduleWeeklyActiveMediaSync()
      logger.info(`${c.green('✨ [Worker & Cron Ready]')}: Media worker initialized and weekly Sunday midnight cron registered`)
    } catch (err: any) {
      logger.warn(`${c.yellow('⚠️ [Startup Notice]')}: Media worker/cron startup notice: ${err?.message || err}`)
    }
  },

  /**
   * Graceful shutdown of queue and worker instances.
   */
  async shutdown() {
    isShuttingDown = true
    logger.info(`${c.yellow('🛑 [Queue Shutdown]')}: Closing Media worker and BullMQ queue...`)
    try {
      await closeMediaWorker()
    } catch { }
    if (mediaQueueInstance) {
      await mediaQueueInstance.close()
      mediaQueueInstance = null
    }
    isShuttingDown = false
    logger.info(`${c.green('✅ [Queue Shutdown]')}: Media queue shut down cleanly`)
  },
}

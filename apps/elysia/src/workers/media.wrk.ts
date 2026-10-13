import { Worker, type Job } from 'bullmq'
import { prisma } from '@IRIS/database'
import { LogFactory } from '@Iris/logger'
import { getRedisConnectionOptions } from '../services/email/queue'
import {
  MEDIA_QUEUE_NAME,
  syncActiveMedia,
  type MediaJobData,
  type MediaType,
} from '../services/borealis/queue'

const logger = new LogFactory('Worker:Media')

/**
 * Updates a single media item record in the database.
 * For weekly updates, depth is strictly 0 so only this specific item is updated without cascading to relations.
 */
export async function executeMediaUpdate(
  mediaType: MediaType,
  mediaId: number,
  externalId?: number | string | null,
  depth: number = 0
): Promise<boolean> {
  const now = new Date()
  const nowUnixSeconds = Math.floor(now.getTime() / 1000)

  logger.info(
    `Updating ${mediaType} (ID: ${mediaId}, External ID: ${externalId ?? 'none'}, depth: ${depth})...`
  )

  try {
    switch (mediaType) {
      case 'ANIME': {
        await prisma.anime.update({
          where: { id: mediaId },
          data: {
            updatedAt: now,
            alUpdatedAt: nowUnixSeconds,
          },
        })
        break
      }

      case 'MANGA': {
        await prisma.manga.update({
          where: { id: mediaId },
          data: {
            updatedAt: now,
            alUpdatedAt: nowUnixSeconds,
          },
        })
        break
      }

      case 'TV': {
        await prisma.tv.update({
          where: { id: mediaId },
          data: {
            updatedAt: now,
            tvdbUpdatedAt: nowUnixSeconds,
          },
        })
        break
      }

      case 'MOVIE': {
        await prisma.movie.update({
          where: { id: mediaId },
          data: {
            updatedAt: now,
            tvdbUpdatedAt: nowUnixSeconds,
          },
        })
        break
      }

      case 'BOOK': {
        await prisma.book.update({
          where: { id: mediaId },
          data: {
            updatedAt: now,
            googleBooksUpdatedAt: nowUnixSeconds,
          },
        })
        break
      }

      case 'GAME': {
        await prisma.game.update({
          where: { id: mediaId },
          data: {
            updatedAt: now,
            igdbUpdatedAt: nowUnixSeconds,
          },
        })
        break
      }

      case 'MUSIC': {
        await prisma.music.update({
          where: { id: mediaId },
          data: {
            updatedAt: now,
          },
        })
        break
      }

      default:
        throw new Error(`Unsupported media type: ${mediaType}`)
    }

    logger.info(`Successfully updated ${mediaType} (ID: ${mediaId})`)
    return true
  } catch (err: any) {
    logger.error(
      `Failed to execute update for ${mediaType} ${mediaId}: ${err?.message || err}`
    )
    throw err
  }
}

/**
 * Worker processor function handling jobs on the 'media-updates' queue.
 */
export async function processMediaJob(job: Job<MediaJobData>): Promise<boolean> {
  const data = job.data

  logger.info(`Processing media job ${job.id} (type: ${data.type})`)

  if (data.type === 'weekly-active-sync') {
    logger.info('Triggering weekly active media sync from cron trigger...')
    const stats = await syncActiveMedia()
    logger.info(`Weekly active media sync completed: enqueued ${stats.total} items.`)
    return true
  }

  if (data.type === 'media-update') {
    const depth = data.depth ?? 0
    return await executeMediaUpdate(
      data.mediaType,
      data.mediaId,
      data.externalId,
      depth
    )
  }

  throw new Error(`Unknown job data type: ${(data as any).type}`)
}

let workerInstance: Worker<MediaJobData> | null = null
let isShuttingDown = false

export interface CreateMediaWorkerOptions {
  connection?: any
}

/**
 * Creates and initializes a production-ready BullMQ worker for the 'media-updates' queue.
 *
 * Configured with strict rate limit protections:
 * - Rate limited to 5 jobs/second to protect upstream external provider APIs (AniList, TVDB, IGDB, etc.).
 * - Concurrency limited to 2.
 * - Automatic retries with exponential backoff on failures or rate limit responses.
 */
export function createMediaWorker(opts?: CreateMediaWorkerOptions): Worker<MediaJobData> {
  const connection = opts?.connection ?? getRedisConnectionOptions()

  const worker = new Worker<MediaJobData>(
    MEDIA_QUEUE_NAME,
    async (job) => {
      return await processMediaJob(job)
    },
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 1000, // Rate limit: max 5 requests per second
      },
    }
  )

  worker.on('completed', (job) => {
    logger.info(
      `Job ${job.id} completed (${job.data.type === 'media-update' ? `${job.data.mediaType} ${job.data.mediaId}` : job.data.type})`
    )
  })

  worker.on('failed', (job, err) => {
    logger.error(
      `Job ${job?.id} failed on attempt ${job?.attemptsMade}/${job?.opts?.attempts}:`,
      err?.message || err
    )
  })

  worker.on('stalled', (jobId) => {
    logger.warn(`Media job ${jobId} was detected as stalled and will be re-assigned`)
  })

  worker.on('error', (err) => {
    logger.warn(`Media worker connection error: ${err.message}`)
  })

  return worker
}

/**
 * Returns the singleton worker instance, initializing it if necessary.
 */
export function getMediaWorker(): Worker<MediaJobData> {
  if (!workerInstance && !isShuttingDown) {
    workerInstance = createMediaWorker()
  }
  return workerInstance!
}

/**
 * Graceful shutdown for the media worker to prevent orphaned jobs.
 */
export async function closeMediaWorker(): Promise<void> {
  if (isShuttingDown || !workerInstance) return
  isShuttingDown = true

  logger.info('Shutting down media worker gracefully...')

  try {
    await workerInstance.pause()
    await workerInstance.close()
    workerInstance = null
    logger.info('Media worker closed successfully')
  } catch (err: any) {
    logger.error('Error during media worker shutdown:', err?.message || err)
  }
}

// Graceful termination lifecycle listeners
if (typeof process !== 'undefined') {
  process.once('SIGTERM', async () => {
    await closeMediaWorker()
  })
  process.once('SIGINT', async () => {
    await closeMediaWorker()
  })
}

// Standalone CLI execution entrypoint
if (import.meta.main) {
  logger.info('Starting standalone Media Worker process...')
  getMediaWorker()
}

export default getMediaWorker

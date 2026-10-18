import { Worker, type Job } from 'bullmq'
import { prisma } from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'
import { getRedisConnectionOptions } from '../services/email/queue'
import {
  MEDIA_QUEUE_NAME,
  syncActiveMedia,
  MediaQueueManager,
  type MediaJobData,
  type MediaType,
} from '../services/borealis/queue'
import { MediaEntitySyncer } from '../services/borealis/syncer/media-entity.syncer'

const logger = new LogFactory('Worker:Media')

/**
 * Updates a single media item record in the database.
 * For weekly updates, depth is strictly 0 so only this specific item is updated without cascading to relations.
 */
export async function executeMediaUpdate(
  mediaType: MediaType,
  mediaId: number,
  externalId?: number | string | null,
  depth: number = 0,
  maxDepth?: number,
  lineage: string[] = []
): Promise<boolean> {
  const syncStart = performance.now()
  const depthStr = `Depth: ${depth}${maxDepth !== undefined ? ` (max: ${maxDepth})` : ''}`
  logger.info(
    `${c.blue('🔄 [Syncing Entity]')} ${c.bold(mediaType)} #${mediaId} | External ID: ${c.cyan(String(externalId ?? 'none'))} | ${depthStr}`
  )

  try {
    const syncResult = await MediaEntitySyncer.syncEntity(mediaType, mediaId, externalId)
    const elapsed = Math.round(performance.now() - syncStart)
    if (syncResult.synced) {
      logger.info(
        `${c.green('✅ [Sync Success]')} Synchronized ${c.bold(mediaType)} #${mediaId} in ${c.bold(`${elapsed}ms`)}`
      )

      // Recursive relation crawling with deduplication and cycle prevention
      const currentDepth = depth
      const effectiveMaxDepth = maxDepth ?? Infinity
      const currentJobId = `media-update-${mediaType}-${mediaId}`
      const updatedLineage = [...lineage, currentJobId]

      if (syncResult.discoveredRelations.length > 0 && currentDepth < effectiveMaxDepth) {
        logger.info(
          `${c.magenta(c.bold('[Worker:Media]'))} ${c.yellow(`⚡ Discovered ${syncResult.discoveredRelations.length} relations for ${mediaType} #${mediaId}:`)} queueing connected nodes (depth=${currentDepth + 1})...`
        )

        for (const rel of syncResult.discoveredRelations) {
          const targetJobId = `media-update-${rel.targetType}-${rel.targetLocalId}`
          if (updatedLineage.includes(targetJobId)) {
            logger.info(
              `  ↳ ${c.cyan(`[${rel.type}]`)} ${c.yellow(`${rel.targetType} #${rel.targetLocalId}`)} (Ext ID: ${rel.targetExternalId}) ${c.dim('⏩ Skipped (Cycle detected in lineage)')}`
            )
            continue
          }

          logger.info(
            `  ↳ ${c.cyan(`[${rel.type}]`)} ${c.yellow(`${rel.targetType} #${rel.targetLocalId}`)} (Ext ID: ${rel.targetExternalId}) ${c.dim(`(depth=${currentDepth + 1})`)}`
          )

          await MediaQueueManager.enqueueMediaUpdate(rel.targetType, rel.targetLocalId, {
            externalId: rel.targetExternalId,
            priority: 3,
            depth: currentDepth + 1,
            maxDepth,
            lineage: updatedLineage,
            triggeredBy: 'sync',
            jobId: targetJobId,
          }).catch((err) => {
            logger.warn(
              `${c.red('⚠️ [Relation Enqueue Error]')}: Failed to enqueue relation ${rel.targetType} #${rel.targetLocalId}: ${err?.message || err}`
            )
          })
        }
      }

      return true
    }

    // Fallback: update timestamp if external provider had no details or was unconfigured
    const now = new Date()
    const nowUnixSeconds = Math.floor(now.getTime() / 1000)
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

    logger.info(
      `${c.yellow('⏩ [Fallback Touch]')} External provider had no fresh payload for ${c.bold(mediaType)} #${mediaId}; touched updatedAt in ${elapsed}ms`
    )
    return true
  } catch (err: any) {
    logger.error(
      `${c.red('❌ [Sync Failed]')} Failed to execute update for ${mediaType} #${mediaId}: ${err?.message || err}`
    )
    throw err
  }
}

/**
 * Worker processor function handling jobs on the 'media-updates' queue.
 */
export async function processMediaJob(job: Job<MediaJobData>): Promise<boolean> {
  const data = job.data
  const jobStart = performance.now()

  logger.info(
    `${c.magenta(c.bold('⚡ [Processing Job]'))} ${c.cyan(job.id ?? 'unknown')} | Type: ${c.bold(data.type)} | Priority: ${job.opts.priority ?? 1}`
  )

  if (data.type === 'weekly-active-sync') {
    logger.info(`${c.blue('🔄 [Cron Trigger]')} Triggering weekly active media sync...`)
    const stats = await syncActiveMedia()
    const elapsed = Math.round(performance.now() - jobStart)
    logger.info(
      `${c.green('✅ [Cron Complete]')} Weekly active media sync finished in ${elapsed}ms: enqueued ${stats.total} items`
    )
    return true
  }

  if (data.type === 'media-update') {
    const depth = data.depth ?? 0
    const maxDepth = data.maxDepth
    const lineage = data.lineage ?? []
    const result = await executeMediaUpdate(
      data.mediaType,
      data.mediaId,
      data.externalId,
      depth,
      maxDepth,
      lineage
    )
    const elapsed = Math.round(performance.now() - jobStart)
    logger.info(
      `${c.green('✨ [Job Processed]')} ${c.cyan(job.id ?? 'unknown')} (${data.mediaType} #${data.mediaId}) finished in ${c.bold(`${elapsed}ms`)}`
    )
    return result
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

  logger.info(`${c.cyan('🚀 [Worker Spawn]')} Initializing BullMQ Worker for queue "${c.bold(MEDIA_QUEUE_NAME)}"...`)

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

  worker.on('active', (job) => {
    const targetDesc =
      job.data.type === 'media-update'
        ? `${job.data.mediaType} #${job.data.mediaId}`
        : job.data.type
    logger.info(
      `${c.blue(c.bold('🚀 [Job Active]'))} ${c.cyan(job.id)} (${targetDesc}) | Priority: ${job.opts.priority ?? 1} | Attempt: ${job.attemptsMade + 1}/${job.opts.attempts ?? 3}`
    )
  })

  worker.on('completed', (job) => {
    const targetDesc =
      job.data.type === 'media-update'
        ? `${job.data.mediaType} #${job.data.mediaId}`
        : job.data.type
    logger.info(
      `${c.green(c.bold('✅ [Job Completed]'))} ${c.cyan(job.id)} (${targetDesc})`
    )
  })

  worker.on('failed', (job, err) => {
    logger.error(
      `${c.red(c.bold('❌ [Job Failed]'))} ${c.cyan(job?.id ?? 'unknown')} on attempt ${c.yellow(`${job?.attemptsMade}/${job?.opts?.attempts}`)}: ${c.red(err?.message || err)}`
    )
  })

  worker.on('stalled', (jobId) => {
    logger.warn(
      `${c.yellow(c.bold('⏳ [Job Stalled]'))} Media job ${c.cyan(jobId)} was detected as stalled and will be re-assigned`
    )
  })

  worker.on('drained', () => {
    logger.info(`${c.dim('💤 [Queue Drained]')} All jobs in media-updates queue have been processed`)
  })

  worker.on('error', (err) => {
    logger.warn(`${c.red('⚠️ [Worker Error]')}: ${err.message}`)
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

  logger.info(`${c.yellow('🛑 [Worker Shutdown]')} Shutting down media worker gracefully...`)

  try {
    await workerInstance.pause()
    await workerInstance.close()
    workerInstance = null
    logger.info(`${c.green('✅ [Worker Shutdown]')} Media worker closed successfully`)
  } catch (err: any) {
    logger.error(`${c.red('❌ [Worker Shutdown Error]')}:`, err?.message || err)
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
  logger.info(`${c.cyan('🚀 [Standalone]')} Starting standalone Media Worker process...`)
  getMediaWorker()
}

export default getMediaWorker

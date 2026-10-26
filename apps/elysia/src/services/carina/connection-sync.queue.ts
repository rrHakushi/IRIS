import { Queue, type JobsOptions } from 'bullmq'
import type { ConnectionProvider, MediaType } from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'
import { getRedisConnectionOptions } from '../email/queue'
import {
  initConnectionWorkers,
  closeConnectionWorkers,
  type ConnectionSyncJobData,
} from '../../workers/connection-sync.wrk'

export { type ConnectionSyncJobData }

const logger = new LogFactory('BullMQ:ConnectionSync')

export const SYNC_PROVIDERS: readonly ConnectionProvider[] = [
  'ANILIST',
  'MAL',
  'SIMKL',
  'BANGUMI',
  'HIKKA',
  'MANGAUPDATES',
  'MANGABAKA',
  'TRAKT',
] as const

/**
 * Returns whether an external provider adapter supports updating a specific media category.
 */
export function isProviderSupportedForMediaType(
  provider: ConnectionProvider,
  mediaType: MediaType
): boolean {
  switch (provider) {
    case 'ANILIST':
    case 'MAL':
    case 'HIKKA':
      return mediaType === 'ANIME' || mediaType === 'MANGA'
    case 'MANGAUPDATES':
    case 'MANGABAKA':
      return mediaType === 'MANGA' || mediaType === 'BOOK'
    case 'SIMKL':
      return mediaType === 'ANIME' || mediaType === 'TV' || mediaType === 'MOVIE'
    case 'TRAKT':
      return mediaType === 'TV' || mediaType === 'MOVIE'
    case 'BANGUMI':
      return (
        mediaType === 'ANIME' ||
        mediaType === 'MANGA' ||
        mediaType === 'BOOK' ||
        mediaType === 'GAME' ||
        mediaType === 'MUSIC'
      )
    default:
      return false
  }
}

export interface EnqueueSyncOptions {
  userId: string
  mediaType: MediaType
  mediaId: number
  mediaTitle: string
  entry: {
    status: string
    progress?: number
    score?: number | null
    notes?: string | null
    rewatched?: number
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    seasonNumber?: number
    episodeNumber?: number
    extra?: Record<string, unknown>
  }
  connections?: Record<string, any> | null
}

const queueInstances = new Map<ConnectionProvider, Queue<ConnectionSyncJobData>>()
let isShuttingDown = false

/**
 * Returns a dedicated BullMQ queue for a specific connection provider.
 * Queues are isolated per provider so outages and rate-limiting on one service
 * never delay operations on others.
 */
export function getConnectionSyncQueue(
  provider: ConnectionProvider
): Queue<ConnectionSyncJobData> {
  let queue = queueInstances.get(provider)
  if (!queue) {
    const queueName = `connection-sync-${provider.toLowerCase()}`
    const connection = getRedisConnectionOptions()

    queue = new Queue<ConnectionSyncJobData>(queueName, {
      connection,
      defaultJobOptions: {
        attempts: 4, // 1 initial try + 3 retries (for 429 rate limits)
        backoff: {
          type: 'fixed',
          delay: 60000, // 1 minute between retries
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    })

    queue.on('error', (err) => {
      logger.warn(
        `${c.red('⚠️ [ConnectionSync Queue Error]')}: (${provider}) ${err.message}`
      )
    })

    queueInstances.set(provider, queue)
    logger.info(
      `${c.cyan('🚀 [ConnectionSync Queue Ready]')}: Initialized BullMQ queue "${c.bold(queueName)}"`
    )
  }

  return queue
}

export class ConnectionSyncQueueManager {
  /**
   * Retrieves or initializes the provider's dedicated queue.
   */
  public static getQueue(provider: ConnectionProvider): Queue<ConnectionSyncJobData> {
    return getConnectionSyncQueue(provider)
  }

  /**
   * Enqueues connection sync jobs for each valid provider configured on the entry.
   * Performs validation, resolves progress/status overrides, and dispatches to
   * provider-specific BullMQ queues in fire-and-forget mode.
   */
  public static async enqueueSyncJobs(options: EnqueueSyncOptions): Promise<void> {
    const { connections, userId, mediaType, mediaId, mediaTitle, entry } = options
    if (!connections || typeof connections !== 'object') return

    const providerKeys = Object.keys(connections)
    if (providerKeys.length === 0) return

    for (const rawKey of providerKeys) {
      const normProvider = rawKey.trim().toUpperCase() as ConnectionProvider
      if (!SYNC_PROVIDERS.includes(normProvider)) {
        continue
      }

      // Verify provider supports target media type
      if (!isProviderSupportedForMediaType(normProvider, mediaType)) {
        continue
      }

      const rawVal = connections[rawKey]
      let rawConn: any
      if (typeof rawVal === 'number' || typeof rawVal === 'string') {
        rawConn = { id: rawVal }
      } else if (rawVal && typeof rawVal === 'object') {
        rawConn = rawVal
      } else {
        continue
      }

      // Skip explicitly disabled connections
      if (rawConn.sync === false) continue

      const rawMediaId =
        rawConn.id ??
        rawConn.slug ??
        rawConn.simklId ??
        rawConn.providerId ??
        rawConn.malId ??
        rawConn.anilistId ??
        rawConn.bangumiId

      if (rawMediaId === undefined || rawMediaId === null || String(rawMediaId).trim() === '') {
        continue
      }

      const isPureNumeric =
        typeof rawMediaId === 'number' ||
        (typeof rawMediaId === 'string' && /^\d+$/.test(rawMediaId.trim()))

      const providerMediaId: number | string = isPureNumeric
        ? Number(rawMediaId)
        : String(rawMediaId).trim()

      if (
        typeof providerMediaId === 'number' &&
        (Number.isNaN(providerMediaId) || providerMediaId <= 0)
      ) {
        continue
      }

      // Resolve overrides
      let connStatus = entry.status
      if (rawConn.overrideStatus && rawConn.status) {
        connStatus = rawConn.status
      }

      let connProgress = entry.progress
      if (rawConn.progressOffset !== undefined && rawConn.progressOffset !== null) {
        connProgress = (entry.progress || 0) + Number(rawConn.progressOffset)
      } else if (
        rawConn.overrideProgress &&
        rawConn.progress !== undefined &&
        rawConn.progress !== null
      ) {
        connProgress = Number(rawConn.progress)
      }

      let connScore = entry.score
      if (rawConn.score !== undefined && rawConn.score !== null) {
        connScore = Number(rawConn.score)
      }

      let connStartedAt = entry.startedAt
      if (rawConn.overrideDates && rawConn.startedAt !== undefined) {
        connStartedAt = rawConn.startedAt
      }

      let connCompletedAt = entry.completedAt
      if (rawConn.overrideDates && rawConn.completedAt !== undefined) {
        connCompletedAt = rawConn.completedAt
      }

      let connNotes = entry.notes
      if (rawConn.notes !== undefined) {
        connNotes = rawConn.notes
      }

      let connRewatched = entry.rewatched
      if (rawConn.rewatched !== undefined) {
        connRewatched = Number(rawConn.rewatched)
      }

      const jobData: ConnectionSyncJobData = {
        userId,
        provider: normProvider,
        providerMediaId,
        mediaType,
        mediaId,
        mediaTitle,
        autoInjected: Boolean(rawConn.autoInjected),
        payload: {
          status: connStatus,
          progress: connProgress,
          score: connScore,
          notes: connNotes,
          rewatched: connRewatched,
          startedAt: connStartedAt
            ? connStartedAt instanceof Date
              ? connStartedAt.toISOString()
              : String(connStartedAt)
            : null,
          completedAt: connCompletedAt
            ? connCompletedAt instanceof Date
              ? connCompletedAt.toISOString()
              : String(connCompletedAt)
            : null,
          seasonNumber: entry.seasonNumber,
          episodeNumber: entry.episodeNumber,
          extra: entry.extra,
        },
      }

      try {
        const queue = this.getQueue(normProvider)
        await queue.add('sync-entry', jobData, {
          attempts: 4,
          backoff: {
            type: 'fixed',
            delay: 60000, // 1 minute between retries
          },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        })
        logger.info(
          `${c.blue('🔄 [Sync Enqueued]')} Enqueued ${normProvider} sync job for user ${c.cyan(userId)} | Media #${mediaId} (${mediaTitle})`
        )
      } catch (err: any) {
        logger.warn(
          `${c.red('⚠️ [Sync Enqueue Error]')}: Failed to enqueue ${normProvider} job for media #${mediaId}: ${err?.message || err}`
        )
      }
    }
  }

  /**
   * Initializes all provider background workers.
   */
  public static initWorkers(): void {
    initConnectionWorkers()
  }

  /**
   * Graceful shutdown of all connection sync queues and workers.
   */
  public static async shutdown(): Promise<void> {
    if (isShuttingDown) return
    isShuttingDown = true

    logger.info(`${c.yellow('🛑 [ConnectionSync Shutdown]')}: Stopping all provider workers and queues...`)
    try {
      await closeConnectionWorkers()
    } catch {}

    for (const [provider, queue] of queueInstances.entries()) {
      try {
        await queue.close()
      } catch (err: any) {
        logger.warn(`Error closing queue for ${provider}: ${err?.message || err}`)
      }
    }
    queueInstances.clear()
    isShuttingDown = false
    logger.info(`${c.green('✅ [ConnectionSync Shutdown]')}: All provider queues stopped cleanly`)
  }
}

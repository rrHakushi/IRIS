import { Worker, UnrecoverableError, type Job } from 'bullmq'
import {
  prisma,
  and,
  toDate,
  type ConnectionProvider,
  type MediaType,
} from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'
import { getRedisConnectionOptions } from '../services/email/queue'
import {
  getConnectionAdapter,
  decryptConnectionData,
  encryptConnectionData,
  ConnectionAuthError,
  ConnectionRateLimitError,
  type ConnectionCredentials,
  type UpdateMediaPayload,
} from '@IRIS/connections'
import { CarinaNotificationsServ } from '../services/carina/notifications.serv'

const logger = new LogFactory('Worker:ConnectionSync')

export interface ConnectionSyncJobData {
  userId: string
  provider: ConnectionProvider
  providerMediaId: number
  mediaType: MediaType
  mediaId: number
  mediaTitle: string
  autoInjected?: boolean
  payload: {
    status: string
    progress?: number
    score?: number | null
    notes?: string | null
    rewatched?: number
    startedAt?: string | null
    completedAt?: string | null
    seasonNumber?: number
    episodeNumber?: number
    extra?: Record<string, unknown>
  }
}

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  ANILIST: 'AniList',
  MAL: 'MyAnimeList',
  SIMKL: 'Simkl',
  BANGUMI: 'Bangumi',
}

/**
 * Provider-specific rate limits and concurrency limits
 */
export const PROVIDER_WORKER_CONFIGS: Record<
  string,
  { concurrency: number; max: number; duration: number }
> = {
  ANILIST: { concurrency: 3, max: 80, duration: 60000 },
  MAL: { concurrency: 1, max: 30, duration: 60000 },
  SIMKL: { concurrency: 2, max: 40, duration: 60000 },
  BANGUMI: { concurrency: 3, max: 60, duration: 60000 },
}

const workerInstances = new Map<ConnectionProvider, Worker<ConnectionSyncJobData>>()
let isShuttingDown = false

export interface ProcessConnectionSyncJobDeps {
  adapter?: any
  decrypt?: (encrypted: string, secret: string) => any
  encrypt?: (data: any, secret: string) => string
}

/**
 * Core processor for connection sync jobs.
 * Fetches latest encrypted credentials, handles proactive and reactive token refresh,
 * rate limit pausing, and updates connection lastSyncedAt on success.
 */
export async function processConnectionSyncJob(
  job: Job<ConnectionSyncJobData>,
  worker?: Worker<ConnectionSyncJobData>,
  deps?: ProcessConnectionSyncJobDeps
): Promise<boolean> {
  const { userId, provider, providerMediaId, mediaType, mediaTitle, payload, autoInjected } =
    job.data
  const displayName = PROVIDER_DISPLAY_NAMES[provider] || provider

  const decryptFn = deps?.decrypt ?? decryptConnectionData
  const encryptFn = deps?.encrypt ?? encryptConnectionData

  let adapter = deps?.adapter
  if (!adapter) {
    try {
      adapter = getConnectionAdapter(provider)
    } catch (err: any) {
      logger.warn(`[Worker:${provider}] Unsupported connection provider: ${provider}`)
      throw new UnrecoverableError(`Unsupported connection provider: ${provider}`)
    }
  }

  if (!adapter.updateMediaEntry) {
    logger.warn(`[Worker:${provider}] Adapter does not support updateMediaEntry`)
    throw new UnrecoverableError(`Provider ${displayName} does not support syncing media entries`)
  }

  // 1. Fetch user's active connection from database
  const userConn = await prisma.orm.public.Connection.where((c) =>
    and(
      c.userId.eq(userId),
      c.provider.eq(provider),
      c.status.in(['CONNECTED', 'EXPIRED'])
    )
  ).first()

  if (!userConn) {
    if (!autoInjected) {
      await CarinaNotificationsServ.createNotification({
        userId,
        app: 'Borealis',
        category: 'Connections',
        type: 'INFO',
        priority: 'NORMAL',
        content: {
          title: `${displayName} Not Connected`,
          body: `Could not sync "${mediaTitle}" to ${displayName}. Please connect your ${displayName} account in Settings > Connections.`,
          icon: adapter.iconUrl,
          link: '/settings?tab=connections',
        },
      }).catch((notifErr) => {
        logger.warn(`Failed to dispatch not connected notification: ${notifErr?.message || notifErr}`)
      })
    }
    // Non-retryable: do not throw to avoid retrying missing connection
    return false
  }

  // 2. Decrypt credentials using user secret
  let credentials: ConnectionCredentials
  try {
    credentials = decryptFn<ConnectionCredentials>(
      userConn.encryptedData,
      userId
    )
  } catch (decryptErr: any) {
    throw new UnrecoverableError(
      `Failed to decrypt credentials for ${displayName}. Please reconnect your account.`
    )
  }

  // 3. Proactive token refresh if expiring (< 5 minutes left)
  const isExpiring =
    userConn.expiresAt &&
    toDate(userConn.expiresAt).getTime() - Date.now() < 300000

  if (isExpiring && credentials.refreshToken && adapter.refreshAccessToken) {
    try {
      const refreshed = await adapter.refreshAccessToken(credentials.refreshToken)
      credentials = { ...credentials, ...refreshed }
      const updatedEncrypted = encryptFn(credentials, userId)
      await prisma.orm.public.Connection.where((c) => c.id.eq(userConn.id)).update({
        encryptedData: updatedEncrypted,
        expiresAt: refreshed.expiresAt ? new Date(refreshed.expiresAt) : null,
        status: 'CONNECTED',
      })
      logger.info(`[Worker:${provider}] Proactive token refresh succeeded for user ${userId}`)
    } catch (refreshErr: any) {
      logger.warn(`[Worker:${provider}] Proactive token refresh failed: ${refreshErr?.message || refreshErr}`)
    }
  }

  const updatePayload: UpdateMediaPayload = {
    mediaId: providerMediaId,
    mediaType: mediaType as any,
    status: payload.status,
    progress: payload.progress,
    score: payload.score,
    notes: payload.notes,
    rewatched: payload.rewatched,
    startedAt: payload.startedAt,
    completedAt: payload.completedAt,
    seasonNumber: payload.seasonNumber,
    episodeNumber: payload.episodeNumber,
    extra: payload.extra,
  }

  // 4. Execute external API update with automatic 401 retry & 429 rate limit check
  try {
    await adapter.updateMediaEntry(credentials, updatePayload)
  } catch (firstErr: any) {
    const isRateLimit =
      firstErr instanceof ConnectionRateLimitError ||
      firstErr?.statusCode === 429 ||
      /rate limit|too many requests/i.test(firstErr?.message || '')

    if (isRateLimit) {
      const retryAfterSec = firstErr?.retryAfterSeconds || 60
      logger.warn(
        `${c.yellow('⏳ [Rate Limited]')}: ${provider} rate limit hit. Pausing worker for ${retryAfterSec}s...`
      )
      if (worker && typeof (worker as any).rateLimit === 'function') {
        try {
          await (worker as any).rateLimit(Math.max(retryAfterSec, 60) * 1000)
        } catch {}
      }
      // Re-throw regular error to allow BullMQ fixed 60s backoff (retry 3x)
      throw firstErr
    }

    const isAuthErr =
      firstErr instanceof ConnectionAuthError ||
      firstErr?.statusCode === 401 ||
      /unauthorized|token/i.test(firstErr?.message || '')

    if (isAuthErr && credentials.refreshToken && adapter.refreshAccessToken) {
      try {
        const refreshed = await adapter.refreshAccessToken(credentials.refreshToken)
        credentials = { ...credentials, ...refreshed }
        const updatedEncrypted = encryptFn(credentials, userId)
        await prisma.orm.public.Connection.where((c) => c.id.eq(userConn.id)).update({
          encryptedData: updatedEncrypted,
          expiresAt: refreshed.expiresAt ? new Date(refreshed.expiresAt) : null,
          status: 'CONNECTED',
        })

        // Retry update with fresh token
        await adapter.updateMediaEntry(credentials, updatePayload)
      } catch (retryErr: any) {
        const isRetryRateLimit =
          retryErr instanceof ConnectionRateLimitError ||
          retryErr?.statusCode === 429 ||
          /rate limit|too many requests/i.test(retryErr?.message || '')

        if (isRetryRateLimit) {
          throw retryErr
        }
        throw new UnrecoverableError(retryErr?.message || String(retryErr))
      }
    } else {
      // Non-429 error fails immediately without retrying
      throw new UnrecoverableError(firstErr?.message || String(firstErr))
    }
  }

  // 5. Update lastSyncedAt on successful sync
  await prisma.orm.public.Connection.where((c) => c.id.eq(userConn.id)).update({
    lastSyncedAt: new Date(),
    status: 'CONNECTED',
    errorMessage: null,
  })

  logger.info(
    `${c.green('✅ [Sync Success]')}: Synced ${mediaTitle} to ${displayName} for user ${c.cyan(userId)}`
  )
  return true
}

/**
 * Handles failed connection sync attempts and complete exhaustion notifications.
 */
export async function handleJobFailure(
  provider: ConnectionProvider,
  job: Job<ConnectionSyncJobData> | undefined,
  err: any
): Promise<void> {
  if (!job) return

  const maxAttempts = job.opts.attempts ?? 4
  const isRateLimit =
    err instanceof ConnectionRateLimitError ||
    err?.statusCode === 429 ||
    /rate limit|too many requests/i.test(err?.message || '')

  const isUnrecoverable =
    err instanceof UnrecoverableError ||
    err?.name === 'UnrecoverableError' ||
    !isRateLimit

  const isExhausted = job.attemptsMade >= maxAttempts
  const isTerminal = isUnrecoverable || isExhausted

  logger.warn(
    `${c.red(c.bold('❌ [Job Attempt Failed]'))}: [${provider}] Attempt ${job.attemptsMade}/${maxAttempts} failed: ${err?.message || err}`
  )

  // Send failure notification & persist error message when failure is terminal
  if (isTerminal) {
    const displayName = PROVIDER_DISPLAY_NAMES[provider] || provider
    const errMsg = err?.message || String(err)

    logger.error(
      `${c.red(c.bold('🚨 [Sync Completely Failed]'))}: [${provider}] Sync failed for "${job.data.mediaTitle}" (User: ${job.data.userId}): ${errMsg}`
    )

    let adapter
    try {
      adapter = getConnectionAdapter(provider)
    } catch {}

    // 1. Send in-app notification to user
    await CarinaNotificationsServ.createNotification({
      userId: job.data.userId,
      app: 'Borealis',
      category: 'Connections',
      type: 'INFO',
      priority: 'HIGH',
      content: {
        title: `${displayName} Sync Failed`,
        body: `Failed to update "${job.data.mediaTitle}" on ${displayName}: ${errMsg}`,
        icon: adapter?.iconUrl,
        link: '/settings?tab=connections',
      },
    }).catch((notifErr) => {
      logger.warn(`Failed to dispatch failure notification: ${notifErr?.message || notifErr}`)
    })

    // 2. Persist error message on the connection record
    await prisma.orm.public.Connection
      .where((c) => and(c.userId.eq(job.data.userId), c.provider.eq(provider)))
      .updateAndCount({
        errorMessage: `Sync failed: ${errMsg}`,
      })
      .catch(() => {})
  }
}


/**
 * Creates and initializes a production-ready BullMQ worker for a specific connection provider.
 */
export function createConnectionProviderWorker(
  provider: ConnectionProvider
): Worker<ConnectionSyncJobData> {
  const queueName = `connection-sync-${provider.toLowerCase()}`
  const connection = getRedisConnectionOptions()
  const config = PROVIDER_WORKER_CONFIGS[provider] || {
    concurrency: 2,
    max: 30,
    duration: 60000,
  }

  logger.info(
    `${c.cyan('🚀 [Worker Spawn]')}: Initializing BullMQ Worker for provider "${c.bold(provider)}" (Queue: ${queueName})`
  )

  let worker: Worker<ConnectionSyncJobData>

  worker = new Worker<ConnectionSyncJobData>(
    queueName,
    async (job) => {
      return await processConnectionSyncJob(job, worker)
    },
    {
      connection,
      concurrency: config.concurrency,
      limiter: {
        max: config.max,
        duration: config.duration,
      },
    }
  )

  worker.on('active', (job) => {
    logger.info(
      `${c.blue(c.bold('🚀 [Job Active]'))}: [${provider}] Syncing ${job.data.mediaType} #${job.data.mediaId} (${job.data.mediaTitle}) | Attempt: ${job.attemptsMade + 1}/${job.opts.attempts ?? 4}`
    )
  })

  worker.on('completed', (job) => {
    logger.info(
      `${c.green(c.bold('✅ [Job Completed]'))}: [${provider}] Synced ${job.data.mediaType} #${job.data.mediaId} for user ${job.data.userId}`
    )
  })

  worker.on('failed', async (job, err) => {
    await handleJobFailure(provider, job, err)
  })

  worker.on('stalled', (jobId) => {
    logger.warn(
      `${c.yellow(c.bold('⏳ [Job Stalled]'))}: [${provider}] Job ${jobId} was detected as stalled and will be re-assigned`
    )
  })

  worker.on('error', (err) => {
    logger.warn(`${c.red('⚠️ [Worker Error]')}: [${provider}] ${err.message}`)
  })

  workerInstances.set(provider, worker)
  return worker
}

/**
 * Returns worker instance for a provider, instantiating it if not yet running.
 */
export function getConnectionWorker(
  provider: ConnectionProvider
): Worker<ConnectionSyncJobData> {
  let worker = workerInstances.get(provider)
  if (!worker && !isShuttingDown) {
    worker = createConnectionProviderWorker(provider)
  }
  return worker!
}

/**
 * Initializes all provider workers simultaneously.
 */
export function initConnectionWorkers(): void {
  const providers: ConnectionProvider[] = ['ANILIST', 'MAL', 'SIMKL', 'BANGUMI']
  for (const provider of providers) {
    getConnectionWorker(provider)
  }
}

/**
 * Gracefully shuts down all active provider workers.
 */
export async function closeConnectionWorkers(): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true

  logger.info(`${c.yellow('🛑 [Worker Shutdown]')}: Closing all connection sync workers gracefully...`)

  for (const [provider, worker] of workerInstances.entries()) {
    try {
      await worker.pause()
      await worker.close()
    } catch (err: any) {
      logger.warn(`Error closing worker for ${provider}: ${err?.message || err}`)
    }
  }

  workerInstances.clear()
  isShuttingDown = false
  logger.info(`${c.green('✅ [Worker Shutdown]')}: All connection workers closed successfully`)
}

// Graceful process signal handling
if (typeof process !== 'undefined') {
  process.once('SIGTERM', async () => {
    await closeConnectionWorkers()
  })
  process.once('SIGINT', async () => {
    await closeConnectionWorkers()
  })
}

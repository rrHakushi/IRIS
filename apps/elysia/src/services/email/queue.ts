import { Queue, type Job, type JobsOptions } from 'bullmq'
import { LogFactory } from '@Iris/logger'
import {
  getEmailWorker,
  closeEmailWorker,
  processEmailJob,
} from '../../workers/email.wrk'

export { getEmailWorker, closeEmailWorker, processEmailJob }

const logger = new LogFactory('BullMQ:Emails')

export const EMAIL_QUEUE_NAME = 'emails'

export type EmailJobData =
  | {
      type: 'mfa-verification'
      to: string
      code: string
      validityMinutes?: number
      appName?: string
    }
  | {
      type: 'password-reset'
      to: string
      resetUrl: string
      validityMinutes?: number
      appName?: string
    }
  | {
      type: 'custom'
      to: string
      subject: string
      html: string
      text: string
    }

export function getRedisConnectionOptions() {
  const commonOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 10000,
    connectTimeout: 15000,
    enableOfflineQueue: true,
    reconnectOnError(err: Error) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE']
      return targetErrors.some((t) => err.message.includes(t))
    },
    retryStrategy(times: number) {
      return Math.min(times * 200, 3000)
    },
  }

  const host = Bun.env.REDIS_HOST
  const portStr = Bun.env.REDIS_PORT
  if (!host || !portStr) {
    throw new Error('Missing required Redis environment variable(s): REDIS_HOST and/or REDIS_PORT')
  }

  const port = parseInt(portStr, 10)
  if (Number.isNaN(port)) {
    throw new Error(`Invalid REDIS_PORT environment variable value: "${portStr}". Expected a number.`)
  }

  return {
    ...commonOptions,
    host,
    port,
    password: Bun.env.REDIS_PASSWORD || undefined,
    db: Bun.env.REDIS_DB ? Number(Bun.env.REDIS_DB) : 0,
  }
}



let emailQueueInstance: Queue<EmailJobData> | null = null
let isShuttingDown = false

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueueInstance) {
    const connection = getRedisConnectionOptions()
    emailQueueInstance = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    })

    emailQueueInstance.on('error', (err: any) => {
      const isSocketReset =
        err?.code === 'ECONNRESET' ||
        err?.code === 'EPIPE' ||
        err?.code === 'ETIMEDOUT' ||
        /ECONNRESET|EPIPE|ETIMEDOUT/i.test(err?.message || '')
      if (isSocketReset) return
      logger.warn(`Queue error: ${err?.message || err}`)
    })
  }

  return emailQueueInstance
}

export const EmailQueueManager = {
  getQueue: getEmailQueue,
  getWorker: getEmailWorker,

  /**
   * Enqueue a job into the BullMQ emails queue.
   */
  async addJob(
    name: string,
    data: EmailJobData,
    opts?: JobsOptions
  ): Promise<Job<EmailJobData> | null> {
    if (isShuttingDown) {
      return null
    }

    try {
      const queue = getEmailQueue()
      return await queue.add(name, data, opts)
    } catch (err: any) {
      logger.warn(`Failed to enqueue job '${name}': ${err?.message || err}`)
      return null
    }
  },

  /**
   * Graceful shutdown of queue and worker.
   */
  async shutdown(): Promise<void> {
    if (isShuttingDown) return
    isShuttingDown = true
    logger.info('Shutting down BullMQ email queue and worker...')

    try {
      await closeEmailWorker()

      if (emailQueueInstance) {
        await emailQueueInstance.close()
        emailQueueInstance = null
      }
      logger.info('BullMQ email queue shutdown complete')
    } catch (err: any) {
      logger.error('Error during BullMQ shutdown:', err?.message || err)
    }
  },
}

// Graceful shutdown hooks
if (typeof process !== 'undefined') {
  process.once('SIGTERM', async () => {
    await EmailQueueManager.shutdown()
  })
  process.once('SIGINT', async () => {
    await EmailQueueManager.shutdown()
  })
}

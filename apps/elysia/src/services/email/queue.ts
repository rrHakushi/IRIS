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
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL)
      return {
        host: url.hostname || '127.0.0.1',
        port: parseInt(url.port || '6379', 10),
        username: url.username || undefined,
        password: url.password || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }
    } catch {
      // Fallback if parsing fails
    }
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB) || 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      if (times > 5) return null // Stop retrying after 5 attempts to avoid flood
      return Math.min(times * 300, 2000)
    },
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

    emailQueueInstance.on('error', (err) => {
      logger.warn(`Queue error: ${err.message}`)
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

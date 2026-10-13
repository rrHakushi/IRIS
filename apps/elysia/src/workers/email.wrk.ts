import { Worker, type Job } from 'bullmq'
import { LogFactory } from '@Iris/logger'
import {
  EMAIL_QUEUE_NAME,
  getRedisConnectionOptions,
  type EmailJobData,
} from '../services/email/queue'
import {
  sendMfaVerificationEmailDirect,
  sendPasswordResetEmailDirect,
  sendDirectMail,
} from '../services/email/mailer'

const logger = new LogFactory('Worker:Email')

/**
 * Worker processor function handling jobs on the 'emails' queue.
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<boolean> {
  const data = job.data

  logger.info(
    `Processing email job ${job.id} (type: ${data.type}, to: ${(data as any).to})`
  )

  switch (data.type) {
    case 'mfa-verification': {
      return await sendMfaVerificationEmailDirect({
        to: data.to,
        code: data.code,
        validityMinutes: data.validityMinutes,
        appName: data.appName,
      })
    }

    case 'password-reset': {
      return await sendPasswordResetEmailDirect({
        to: data.to,
        resetUrl: data.resetUrl,
        validityMinutes: data.validityMinutes,
        appName: data.appName,
      })
    }

    case 'custom': {
      return await sendDirectMail({
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      })
    }

    default:
      throw new Error(`Unknown email job type: ${(data as any).type}`)
  }
}

let workerInstance: Worker<EmailJobData> | null = null
let isShuttingDown = false

/**
 * Creates and initializes a production-ready BullMQ worker for the 'emails' queue.
 *
 * Configured according to BullMQ best practices:
 * - Concurrency limited to 5 to protect downstream SMTP services.
 * - Rate limited to 100 jobs/minute.
 * - Handlers registered for failed, stalled, completed, and connection error events.
 */
export function createEmailWorker(): Worker<EmailJobData> {
  const connection = getRedisConnectionOptions()

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      return await processEmailJob(job)
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 60000, // 100 jobs per minute
      },
    }
  )

  worker.on('completed', (job) => {
    logger.info(
      `Job ${job.id} completed (${job.data.type} -> ${(job.data as any).to})`
    )
  })

  // Mandatory monitoring: detect worker crashes & alert on failed jobs
  worker.on('failed', (job, err) => {
    logger.error(
      `Job ${job?.id} (${job?.data.type}) failed on attempt ${job?.attemptsMade}:`,
      err?.message || err
    )
  })

  // Mandatory monitoring: detect stalled jobs from worker timeouts or crashes
  worker.on('stalled', (jobId) => {
    logger.warn(`Job ${jobId} was detected as stalled and will be re-assigned`)
  })

  worker.on('error', (err) => {
    logger.warn(`Email worker connection error: ${err.message}`)
  })

  return worker
}

/**
 * Returns the singleton worker instance, initializing it if necessary.
 */
export function getEmailWorker(): Worker<EmailJobData> {
  if (!workerInstance && !isShuttingDown) {
    workerInstance = createEmailWorker()
  }
  return workerInstance!
}

/**
 * Graceful shutdown for the email worker to prevent orphaned jobs.
 */
export async function closeEmailWorker(): Promise<void> {
  if (isShuttingDown || !workerInstance) return
  isShuttingDown = true

  logger.info('Shutting down email worker gracefully...')

  try {
    // 1. Stop accepting new jobs from the queue
    await workerInstance.pause()

    // 2. Wait for currently active jobs to finish processing
    await workerInstance.close()

    workerInstance = null
    logger.info('Email worker closed successfully')
  } catch (err: any) {
    logger.error('Error during email worker shutdown:', err?.message || err)
  }
}

// Graceful termination lifecycle listeners
if (typeof process !== 'undefined') {
  process.once('SIGTERM', async () => {
    await closeEmailWorker()
  })
  process.once('SIGINT', async () => {
    await closeEmailWorker()
  })
}

export default getEmailWorker

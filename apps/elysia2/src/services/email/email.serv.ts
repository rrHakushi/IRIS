import { LogFactory } from '@Iris/logger'
import {
  EmailQueueManager,
  getEmailWorker,
  type EmailJobData,
} from './queue'
import {
  sendDirectMail,
  sendMfaVerificationEmailDirect,
  sendPasswordResetEmailDirect,
  type SendMailParams,
} from './mailer'

const logger = new LogFactory('EmailService')

// Ensure worker is initialized when service is imported (if not in test/disabled mode)
if (process.env.NODE_ENV !== 'test') {
  try {
    getEmailWorker()
  } catch (err: any) {
    logger.warn(`Failed to initialize email worker: ${err?.message || err}`)
  }
}

export abstract class EmailService {
  /**
   * Dispatch an MFA verification code email via the BullMQ background queue,
   * falling back to direct delivery if Redis is unavailable.
   */
  static async sendMfaVerificationEmail(
    to: string,
    code: string,
    validityMinutes = 5,
    appName = 'IRIS'
  ): Promise<boolean> {
    const jobData: EmailJobData = {
      type: 'mfa-verification',
      to,
      code,
      validityMinutes,
      appName,
    }

    try {
      const job = await EmailQueueManager.addJob('send-mfa-verification', jobData)
      if (job) {
        logger.info(`Enqueued MFA verification email for ${to} (job ID: ${job.id})`)
        return true
      }
    } catch (err: any) {
      logger.warn(
        `Queue dispatch failed for MFA verification email to ${to}: ${err?.message || err}. Falling back to direct send.`
      )
    }

    // Direct send fallback if queue unavailable
    return await sendMfaVerificationEmailDirect({
      to,
      code,
      validityMinutes,
      appName,
    })
  }

  /**
   * Dispatch a Password Reset actionable link email via the BullMQ background queue,
   * falling back to direct delivery if Redis is unavailable.
   */
  static async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    validityMinutes = 15,
    appName = 'IRIS'
  ): Promise<boolean> {
    const jobData: EmailJobData = {
      type: 'password-reset',
      to,
      resetUrl,
      validityMinutes,
      appName,
    }

    try {
      const job = await EmailQueueManager.addJob('send-password-reset', jobData)
      if (job) {
        logger.info(`Enqueued Password Reset email for ${to} (job ID: ${job.id})`)
        return true
      }
    } catch (err: any) {
      logger.warn(
        `Queue dispatch failed for Password Reset email to ${to}: ${err?.message || err}. Falling back to direct send.`
      )
    }

    // Direct send fallback if queue unavailable
    return await sendPasswordResetEmailDirect({
      to,
      resetUrl,
      validityMinutes,
      appName,
    })
  }

  /**
   * Dispatch a custom email via the BullMQ background queue,
   * falling back to direct delivery if Redis is unavailable.
   */
  static async sendEmail(params: SendMailParams): Promise<boolean> {
    const jobData: EmailJobData = {
      type: 'custom',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }

    try {
      const job = await EmailQueueManager.addJob('send-custom-email', jobData)
      if (job) {
        logger.info(`Enqueued custom email for ${params.to} (job ID: ${job.id})`)
        return true
      }
    } catch (err: any) {
      logger.warn(
        `Queue dispatch failed for email to ${params.to}: ${err?.message || err}. Falling back to direct send.`
      )
    }

    return await sendDirectMail(params)
  }

  /**
   * Retrieve current BullMQ email queue statistics.
   */
  static async getQueueStatus() {
    try {
      const queue = EmailQueueManager.getQueue()
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ])

      return {
        online: true,
        counts: {
          waiting,
          active,
          completed,
          failed,
          delayed,
        },
      }
    } catch (err: any) {
      return {
        online: false,
        error: err?.message || String(err),
      }
    }
  }

  /**
   * Gracefully close worker and queue connections.
   */
  static async shutdown() {
    await EmailQueueManager.shutdown()
  }
}

export default EmailService

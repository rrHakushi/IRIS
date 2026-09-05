import {
  prisma,
  type Prisma,
  type ActivityType,
  type MediaType,
} from "@IRIS/database"
import { logger } from "../utils/logger"

/**
 * Payload parameters for enqueueing an activity log event.
 */
export interface ActivityLogJob {
  userId: string
  type: ActivityType
  mediaType?: MediaType
  mediaId?: number
  status?: string
  progress?: number
  progressVolumes?: number
  score?: number
  title?: string
  content?: string
  metadata?: Prisma.InputJsonValue
  isPrivate?: boolean
  isSpoiler?: boolean
}

/**
 * Payload parameters for enqueueing a media stats recomputation job.
 */
export interface StatsUpdateJob {
  userId: string
  mediaType: MediaType
}

type QueueJob =
  | { kind: "activity"; data: ActivityLogJob }
  | { kind: "stats"; data: StatsUpdateJob }

let statsQueueServiceLogged = false

/**
 * Asynchronous background worker queue service for media stats and activity logs.
 *
 * Offloads activity stream recording and UserStats recomputation to a non-blocking
 * background processing loop, preserving sub-millisecond HTTP response latencies.
 */
export class StatsQueueService {
  private static instance: StatsQueueService
  private queue: QueueJob[] = []
  private isProcessing = false

  private constructor() {
    StatsQueueService.logStatus()
  }

  /**
   * Logs status of the StatsQueueService on boot.
   */
  public static logStatus(): void {
    if (statsQueueServiceLogged) return
    statsQueueServiceLogged = true
    logger.service("stats-queue", "media activity & user stats queue worker")
  }

  /**
   * Returns the singleton instance of the stats queue service.
   */
  public static getInstance(): StatsQueueService {
    if (!StatsQueueService.instance) {
      StatsQueueService.instance = new StatsQueueService()
    }
    return StatsQueueService.instance
  }

  /**
   * Enqueues a user activity log event to be persisted in the background.
   *
   * @param job - Activity log job parameters
   */
  public logActivity(job: ActivityLogJob): void {
    this.queue.push({ kind: "activity", data: job })
    this.scheduleProcessing()
  }

  /**
   * Enqueues an asynchronous media stats recalculation for a user and media type.
   *
   * @param userId - User ID to update stats for
   * @param mediaType - Media domain type (e.g. ANIME, MANGA, MOVIE, TV, etc.)
   */
  public enqueueStatsUpdate(userId: string, mediaType: MediaType): void {
    this.queue.push({ kind: "stats", data: { userId, mediaType } })
    this.scheduleProcessing()
  }

  private scheduleProcessing(): void {
    if (this.isProcessing) return
    setImmediate(() => this.processQueue())
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()
        if (!job) break

        try {
          if (job.kind === "activity") {
            await prisma.activityLog.create({
              data: {
                userId: job.data.userId,
                type: job.data.type,
                mediaType: job.data.mediaType ?? null,
                mediaId: job.data.mediaId ?? null,
                status: job.data.status ?? null,
                progress: job.data.progress ?? null,
                progressVolumes: job.data.progressVolumes ?? null,
                score: job.data.score ?? null,
                title: job.data.title ?? null,
                content: job.data.content ?? null,
                metadata: job.data.metadata ?? undefined,
                isPrivate: job.data.isPrivate ?? false,
                isSpoiler: job.data.isSpoiler ?? false,
              },
            })
          } else if (job.kind === "stats") {
            // Recalculate or upsert stats partitioned by userId and mediaType
            await prisma.userStats.upsert({
              where: {
                userId_mediaType: {
                  userId: job.data.userId,
                  mediaType: job.data.mediaType,
                },
              },
              create: {
                userId: job.data.userId,
                mediaType: job.data.mediaType,
                totalCount: 1,
              },
              update: {
                totalCount: { increment: 1 },
              },
            })
          }
        } catch (jobErr) {
          logger.service.missingEnv(
            `stats-queue:job:${job.kind}`,
            String(jobErr)
          )
        }
      }
    } finally {
      this.isProcessing = false
      if (this.queue.length > 0) {
        this.scheduleProcessing()
      }
    }
  }
}

export const statsQueueService = StatsQueueService.getInstance()

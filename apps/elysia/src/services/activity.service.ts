import {
  prisma,
  type ActivityType,
  type MediaType,
} from "@IRIS/database"
import { logger } from "../utils/logger.js"
import { Patterns, schedule } from "../plugins/cron.js"
import { statsQueueService } from "./stats-queue.service.js"

export interface RecordActivityInput {
  userId: string
  mediaType: MediaType
  mediaId: number
  action:
    | "ADDED"
    | "STATUS_CHANGED"
    | "PROGRESS_CHANGED"
    | "SCORE_CHANGED"
    | "COMPLETED"
    | "REMOVED"
  title?: string | null
  coverImage?: string | null
  bannerImage?: string | null
  format?: string | null
  status?: string | null
  progress?: number | null
  progressVolumes?: number | null
  score?: number | null
  prevStatus?: string | null
  prevProgress?: number | null
  prevScore?: number | null
  isPrivate?: boolean
}

/**
 * Purges activity log records older than the specified retention window (default: 30 days).
 */
export async function purgeOldActivities(daysToKeep = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  const result = await prisma.activityLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  })
  return result.count
}

/**
 * Records an AniList-style list activity event into the background processing queue.
 */
export function recordMediaListActivity(input: RecordActivityInput): void {
  let type: ActivityType

  switch (input.action) {
    case "ADDED":
      type = "LIST_ITEM_ADDED"
      break
    case "COMPLETED":
      type = "LIST_COMPLETED"
      break
    case "STATUS_CHANGED":
      type = "LIST_STATUS_UPDATED"
      break
    case "PROGRESS_CHANGED":
      type = "LIST_PROGRESS_UPDATED"
      break
    case "SCORE_CHANGED":
      type = "LIST_SCORE_UPDATED"
      break
    case "REMOVED":
      type = "LIST_ITEM_REMOVED"
      break
    default:
      type = "LIST_STATUS_UPDATED"
  }

  // Integer representation for DB score column (e.g. 8.5 -> 85 on 0-100 scale, or direct integer)
  const scoreInt =
    input.score !== null && input.score !== undefined
      ? Math.round(input.score <= 10 ? input.score * 10 : input.score)
      : undefined

  statsQueueService.logActivity({
    userId: input.userId,
    type,
    mediaType: input.mediaType,
    mediaId: input.mediaId,
    status: input.status ?? undefined,
    progress: input.progress ?? undefined,
    progressVolumes: input.progressVolumes ?? undefined,
    score: scoreInt,
    title: input.title ?? undefined,
    metadata: {
      exactScore: input.score ?? null,
      prevStatus: input.prevStatus ?? null,
      prevProgress: input.prevProgress ?? null,
      prevScore: input.prevScore ?? null,
      coverImage: input.coverImage ?? null,
      bannerImage: input.bannerImage ?? null,
      format: input.format ?? null,
    },
    isPrivate: input.isPrivate ?? false,
  })

  // Trigger user stats recomputation for this mediaType
  statsQueueService.enqueueStatsUpdate(input.userId, input.mediaType)
}

let activityServiceLogged = false

export class ActivityService {
  private static instance: ActivityService
  private cronJobRegistered = false

  public static logStatus(): void {
    if (activityServiceLogged) return
    activityServiceLogged = true
    logger.service("activity", "30-day activity stream & retention worker")
  }

  public static getInstance(): ActivityService {
    if (!ActivityService.instance) {
      ActivityService.instance = new ActivityService()
    }
    return ActivityService.instance
  }

  public initCron(): void {
    if (this.cronJobRegistered) return
    this.cronJobRegistered = true

    schedule({
      name: "purge-old-activity-logs",
      pattern: Patterns.daily(),
      runOnInit: true,
      async run() {
        try {
          const count = await purgeOldActivities(30)
          if (count > 0) {
            logger.service(
              "activity",
              `Retention cleanup: purged ${count} activity logs older than 30 days`
            )
          }
        } catch (error) {
          logger.service.missingEnv(
            "activity",
            `Retention cleanup error: ${error}`
          )
        }
      },
    })
  }
}

export const activityService = ActivityService.getInstance()

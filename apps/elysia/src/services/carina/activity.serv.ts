import { prisma, type ActivityType, type MediaType } from '@Iris/db'
import { LogFactory, c } from '@Iris/logger'

const logger = new LogFactory('ActivityServ')

export type MediaListAction =
  | 'ADDED'
  | 'STATUS_CHANGED'
  | 'PROGRESS_CHANGED'
  | 'SCORE_CHANGED'
  | 'COMPLETED'
  | 'REWATCH_STARTED'
  | 'REMOVED'

export interface RecordMediaListActivityInput {
  userId: string
  mediaType: MediaType
  mediaId: number
  action: MediaListAction
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
  isSpoiler?: boolean
}

export interface RecordFavoriteActivityInput {
  userId: string
  action: 'FAVORITE_ADDED' | 'FAVORITE_REMOVED'
  favoriteType: string
  targetId: number
  title?: string | null
  coverImage?: string | null
  mediaType?: MediaType | null
  isPrivate?: boolean
}

export interface RecordFriendActivityInput {
  userId: string
  friendId: string
  friendUsername?: string | null
  friendDisplayName?: string | null
  friendAvatarUrl?: string | null
}

export class ActivityServ {
  private static instance: ActivityServ
  private cronJobTimer: NodeJS.Timeout | null = null

  public static getInstance(): ActivityServ {
    if (!ActivityServ.instance) {
      ActivityServ.instance = new ActivityServ()
    }
    return ActivityServ.instance
  }

  /**
   * Helper to execute DB operations asynchronously without blocking HTTP request execution.
   */
  private static runNonBlocking(task: () => Promise<unknown>, context: string): void {
    setImmediate(async () => {
      try {
        await task()
      } catch (err: any) {
        logger.warn(
          `${c.red(`⚠️ [${context}]`)} Failed to record activity log asynchronously: ${err?.message || err}`
        )
      }
    })
  }

  /**
   * Records a media list tracking event (add, progress update, status change, completion, etc.).
   */
  public static recordMediaListActivity(input: RecordMediaListActivityInput): void {
    let type: ActivityType

    switch (input.action) {
      case 'ADDED':
        type = 'LIST_ITEM_ADDED'
        break
      case 'COMPLETED':
        type = 'LIST_COMPLETED'
        break
      case 'STATUS_CHANGED':
        type = 'LIST_STATUS_UPDATED'
        break
      case 'PROGRESS_CHANGED':
        type = 'LIST_PROGRESS_UPDATED'
        break
      case 'SCORE_CHANGED':
        type = 'LIST_SCORE_UPDATED'
        break
      case 'REWATCH_STARTED':
        type = 'LIST_REWATCH_STARTED'
        break
      case 'REMOVED':
        type = 'LIST_ITEM_REMOVED'
        break
      default:
        type = 'LIST_STATUS_UPDATED'
    }

    // Convert score (e.g. 8.5 -> 85 for integer scale, or 85 direct)
    const scoreInt =
      input.score !== null && input.score !== undefined
        ? Math.round(input.score <= 10 ? input.score * 10 : input.score)
        : undefined

    this.runNonBlocking(async () => {
      await prisma.orm.public.ActivityLog.create({
        userId: input.userId,
        type,
        mediaType: input.mediaType,
        mediaId: input.mediaId,
        status: input.status ?? null,
        progress: input.progress ?? null,
        progressVolumes: input.progressVolumes ?? null,
        score: scoreInt ?? null,
        title: input.title ?? null,
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
        isSpoiler: input.isSpoiler ?? false,
      })
    }, `MediaListActivity:${type}`)
  }

  /**
   * Records a user favorite addition or removal event.
   */
  public static recordFavoriteActivity(input: RecordFavoriteActivityInput): void {
    const isAdded = input.action === 'FAVORITE_ADDED'
    const verb = isAdded ? 'Added' : 'Removed'

    this.runNonBlocking(async () => {
      let title = input.title
      let coverImage = input.coverImage
      let mediaType: MediaType | null = null

      if (['ANIME', 'MANGA', 'MOVIE', 'TV', 'GAME', 'BOOK', 'OTHER'].includes(input.favoriteType)) {
        mediaType = input.favoriteType as MediaType
      }

      if (!title) {
        try {
          if (input.favoriteType === 'ANIME') {
            const m = await prisma.orm.public.Anime.where({ id: input.targetId }).first()
            if (m) {
              title = m.titlePrimary || m.titleSecondary
              coverImage = m.coverImage
            }
          } else if (input.favoriteType === 'MANGA') {
            const m = await prisma.orm.public.Manga.where({ id: input.targetId }).first()
            if (m) {
              title = m.titlePrimary || m.titleSecondary
              coverImage = m.coverImage
            }
          } else if (input.favoriteType === 'MOVIE') {
            const m = await prisma.orm.public.Movie.where({ id: input.targetId }).first()
            if (m) {
              title = m.titlePrimary || m.titleSecondary
              coverImage = m.coverImage
            }
          } else if (input.favoriteType === 'TV') {
            const m = await prisma.orm.public.Tv.where({ id: input.targetId }).first()
            if (m) {
              title = m.titlePrimary || m.titleSecondary
              coverImage = m.coverImage
            }
          } else if (input.favoriteType === 'GAME') {
            const m = await prisma.orm.public.Game.where({ id: input.targetId }).first()
            if (m) {
              title = m.titlePrimary || m.titleSecondary
              coverImage = m.coverImage
            }
          } else if (input.favoriteType === 'BOOK') {
            const m = await prisma.orm.public.Book.where({ id: input.targetId }).first()
            if (m) {
              title = m.titlePrimary || m.titleSecondary
              coverImage = m.coverImage
            }
          } else if (input.favoriteType === 'OTHER') {
            const o = await prisma.orm.public.Other.where({ id: input.targetId }).first()
            if (o) {
              title = o.titlePrimary || o.titleSecondary
              coverImage = o.coverImage
            }
          } else if (input.favoriteType === 'CHARACTER') {
            const c = await prisma.orm.public.Character.where({ id: input.targetId }).first()
            if (c) {
              title = c.namePrimary
              coverImage = c.image
            }
          } else if (input.favoriteType === 'PERSON') {
            const p = await prisma.orm.public.Person.where({ id: input.targetId }).first()
            if (p) {
              title = p.namePrimary
              coverImage = p.image
            }
          } else if (input.favoriteType === 'STUDIO') {
            const s = await prisma.orm.public.Studio.where({ id: input.targetId }).first()
            if (s) {
              title = s.name
            }
          }
        } catch {}
      }

      const displayTitle = title
        ? `${verb} ${title} ${isAdded ? 'to' : 'from'} favorites`
        : `${verb} ${input.favoriteType} #${input.targetId} ${isAdded ? 'to' : 'from'} favorites`

      await prisma.orm.public.ActivityLog.create({
        userId: input.userId,
        type: input.action,
        mediaType,
        mediaId: mediaType ? input.targetId : null,
        title: displayTitle,
        metadata: {
          favoriteType: input.favoriteType,
          targetId: input.targetId,
          itemTitle: title ?? null,
          coverImage: coverImage ?? null,
        },
        isPrivate: input.isPrivate ?? false,
      })
    }, `FavoriteActivity:${input.action}`)
  }

  /**
   * Records a bilateral friend acceptance event for both users.
   */
  public static recordFriendActivity(input: RecordFriendActivityInput): void {
    this.runNonBlocking(async () => {
      await prisma.orm.public.ActivityLog.create({
        userId: input.userId,
        type: 'FRIEND_ADDED',
        title: `Became friends with ${input.friendDisplayName || input.friendUsername || 'a user'}`,
        metadata: {
          friendId: input.friendId,
          friendUsername: input.friendUsername ?? null,
          friendDisplayName: input.friendDisplayName ?? null,
          friendAvatarUrl: input.friendAvatarUrl ?? null,
        },
        isPrivate: false,
      })
    }, 'FriendActivity:FRIEND_ADDED')
  }

  /**
   * Purges activity log records older than the specified retention window (default: 30 days).
   */
  public static async purgeOldActivities(daysToKeep = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    return await prisma.orm.public.ActivityLog.where((a) => a.createdAt.lt(cutoff)).deleteAndCount()
  }

  /**
   * Initializes a recurring daily retention cleanup task (default: 30 days).
   */
  public initCron(): void {
    if (this.cronJobTimer) return

    logger.info(
      `${c.green('📅 [Retention Cleanup]')}: 30-day activity stream retention scheduler registered`
    )

    const runCleanup = async () => {
      try {
        const count = await ActivityServ.purgeOldActivities(30)
        if (count > 0) {
          logger.info(
            `${c.cyan('🧹 [Retention Cleanup]')}: Purged ${c.bold(String(count))} activity logs older than 30 days`
          )
        }
      } catch (err: any) {
        logger.warn(
          `${c.red('⚠️ [Retention Cleanup Error]')}: Failed to purge old activities: ${err?.message || err}`
        )
      }
    }

    // Run once on boot after a brief startup delay (10s)
    setTimeout(() => {
      runCleanup().catch(() => {})
    }, 10_000)

    // Schedule to run every 24 hours
    this.cronJobTimer = setInterval(() => {
      runCleanup().catch(() => {})
    }, 24 * 60 * 60 * 1000)

    // Ensure timer doesn't keep the event loop alive on graceful shutdown
    if (this.cronJobTimer && typeof this.cronJobTimer.unref === 'function') {
      this.cronJobTimer.unref()
    }
  }

  public shutdown(): void {
    if (this.cronJobTimer) {
      clearInterval(this.cronJobTimer)
      this.cronJobTimer = null
    }
  }
}

export const activityServ = ActivityServ.getInstance()

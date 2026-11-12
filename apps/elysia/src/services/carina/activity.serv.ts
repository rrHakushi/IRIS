import {
  prisma,
  and,
  countOf,
  toDate,
  type ActivityType,
  type MediaType,
} from '@Iris/db'
import { LogFactory, c } from '@Iris/logger'
import { getBadgeById, getProfileCustomization } from '@IRIS/shared'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { BadRequest, Forbidden, NotFound } from '../../lib/errors'

const logger = new LogFactory('ActivityServ')

export type MediaListAction =
  | 'ADDED'
  | 'STATUS_CHANGED'
  | 'PROGRESS_CHANGED'
  | 'SCORE_CHANGED'
  | 'COMPLETED'
  | 'REWATCH_STARTED'
  | 'REMOVED'

export type ActivityDiffChange = {
  field:
    | 'status'
    | 'progress'
    | 'progressVolumes'
    | 'progressPages'
    | 'score'
    | 'rewatched'
  from?: string | number | null
  to?: string | number | null
}

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
  progressPages?: number | null
  score?: number | null
  rewatched?: number | null
  prevStatus?: string | null
  prevProgress?: number | null
  prevProgressVolumes?: number | null
  prevProgressPages?: number | null
  prevScore?: number | null
  prevRewatched?: number | null
  totalUnits?: number | null
  totalVolumes?: number | null
  totalPages?: number | null
  unitLabel?: string | null
  changes?: ActivityDiffChange[]
  isPrivate?: boolean
  isSpoiler?: boolean
  listModel?:
    | 'AnimeList'
    | 'MangaList'
    | 'MovieList'
    | 'TvList'
    | 'GameList'
    | 'BookList'
    | 'MusicList'
    | 'OtherList'
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
  isPrivate?: boolean
}

export interface RecordRecommendationActivityInput {
  userId: string
  mediaType: MediaType
  mediaId: number
  targetMediaType: MediaType
  targetMediaId: number
  title?: string | null
  targetTitle?: string | null
  coverImage?: string | null
  targetCoverImage?: string | null
  content?: string | null
  isPrivate?: boolean
  isSpoiler?: boolean
}

export interface RecordMilestoneActivityInput {
  userId: string
  milestoneKey: string
  milestoneKind: 'BADGE' | 'COMPLETION_COUNT'
  title: string
  content?: string | null
  mediaType?: MediaType | null
  badgeId?: number | null
  badgeName?: string | null
  badgeIcon?: string | null
  badgeColor?: string | null
  count?: number | null
  isPrivate?: boolean
}

export interface RecordImportOrSyncSummaryInput {
  userId: string
  source: 'BULK_IMPORT' | 'CONNECTION_SYNC'
  provider?: string | null
  importedCount: number
  updatedCount: number
  mediaTypes?: string[]
  mediaType?: MediaType | null
  isPrivate?: boolean
}

export interface ResolvedMediaSummary {
  title: string | null
  coverImage: string | null
  bannerImage: string | null
  format: string | null
}

const COMPLETED_MILESTONE_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000] as const

const MEDIA_MODEL_BY_TYPE: Record<
  string,
  {
    model: 'Anime' | 'Manga' | 'Movie' | 'Tv' | 'Game' | 'Book' | 'Music' | 'Other'
    hasBanner: boolean
    formatField?: 'format' | 'type'
  }
> = {
  ANIME: { model: 'Anime', hasBanner: true, formatField: 'format' },
  MANGA: { model: 'Manga', hasBanner: true, formatField: 'format' },
  MOVIE: { model: 'Movie', hasBanner: true },
  TV: { model: 'Tv', hasBanner: true },
  GAME: { model: 'Game', hasBanner: true },
  BOOK: { model: 'Book', hasBanner: true },
  MUSIC: { model: 'Music', hasBanner: false, formatField: 'type' },
  MUSIC_ALBUM: { model: 'Music', hasBanner: false, formatField: 'type' },
  MUSIC_TRACK: { model: 'Music', hasBanner: false, formatField: 'type' },
  OTHER: { model: 'Other', hasBanner: true, formatField: 'format' },
}

export function normalizeDisplayScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return null
  }
  const num = Number(score)
  if (num <= 0) return null
  const normalized = num > 10 ? num / 10 : num
  return Math.round(normalized * 10) / 10
}

export function toActivityScoreInt(score: number | null | undefined): number | null {
  const displayScore = normalizeDisplayScore(score)
  if (displayScore === null) return null
  return Math.round(displayScore * 10)
}

export function formatActivityAuthor(user: {
  id: string
  username: string
  customization?: any
}) {
  const profile = getProfileCustomization(user.customization)
  const displayName =
    typeof profile.displayName === 'string' && profile.displayName.trim() !== ''
      ? profile.displayName.trim()
      : null

  return {
    id: user.id,
    username: user.username,
    displayName,
    avatarUrl: profile.avatarUrl || null,
    avatarFrame: profile.avatarFrame || null,
    bannerUrl: profile.bannerUrl || null,
    bannerOverlayUrl: profile.bannerOverlayUrl || null,
    nameplateUrl: profile.nameplateUrl || null,
    accentColor: profile.accentColor || null,
    bio: profile.bio || null,
    statusText: profile.statusText || null,
    pronouns: profile.pronouns || null,
    displayNameStyle: profile.displayNameStyle || null,
    showcaseBadgeIds: profile.showcaseBadgeIds || [],
    pinnedSpotlight: profile.pinnedSpotlight || null,
    socialLinks: profile.socialLinks || [],
  }
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
   * Executes DB activity logging asynchronously without blocking HTTP request execution.
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
   * Resolves canonical title/cover/banner/format for any catalog media or profile entity.
   */
  public static async resolveEntitySummary(
    entityType: string,
    targetId: number
  ): Promise<ResolvedMediaSummary> {
    const upper = entityType.toUpperCase()
    try {
      const mediaSpec = MEDIA_MODEL_BY_TYPE[upper]
      if (mediaSpec) {
        const table = (prisma.orm.public as any)[mediaSpec.model]
        if (table?.where) {
          const item = await table.where({ id: targetId }).first()
          if (item) {
            return {
              title: item.titlePrimary || item.titleSecondary || item.titleNative || null,
              coverImage: item.coverImage ?? null,
              bannerImage: mediaSpec.hasBanner ? (item.bannerImage ?? null) : null,
              format: mediaSpec.formatField ? (item[mediaSpec.formatField] ?? null) : null,
            }
          }
        }
      } else if (upper === 'CHARACTER') {
        const ch = await prisma.orm.public.Character.where({ id: targetId }).first()
        if (ch) {
          return {
            title: ch.namePrimary ?? null,
            coverImage: ch.image ?? null,
            bannerImage: null,
            format: null,
          }
        }
      } else if (upper === 'PERSON') {
        const p = await prisma.orm.public.Person.where({ id: targetId }).first()
        if (p) {
          return {
            title: p.namePrimary ?? null,
            coverImage: p.image ?? null,
            bannerImage: null,
            format: null,
          }
        }
      } else if (upper === 'STUDIO') {
        const s = await prisma.orm.public.Studio.where({ id: targetId }).first()
        if (s) {
          return {
            title: s.name ?? null,
            coverImage: null,
            bannerImage: null,
            format: null,
          }
        }
      }
    } catch {}

    return { title: null, coverImage: null, bannerImage: null, format: null }
  }

  /**
   * Formats raw ActivityLog rows into unified API payload with full author profile and viewer like state.
   */
  public static async formatActivityEntries(
    rawActivities: any[],
    options?: {
      viewerUserId?: string | null
      isOwner?: boolean
      isAdmin?: boolean
    }
  ) {
    const viewerUserId = options?.viewerUserId ?? null
    const likedIds = new Set<string>()

    if (viewerUserId && rawActivities.length > 0) {
      try {
        const activityLikeTable = (prisma as any)?.orm?.public?.ActivityLike
        if (activityLikeTable?.where) {
          const ids = rawActivities.map((a) => a.id).filter(Boolean)
          if (ids.length > 0) {
            const likes = await activityLikeTable
              .where((l: any) => and(l.userId.eq(viewerUserId), l.activityId.in(ids)))
              .select('activityId')
              .all()
            for (const like of likes) {
              likedIds.add(like.activityId)
            }
          }
        }
      } catch {}
    }

    return rawActivities.map((a) => {
      const canDelete =
        Boolean(options?.isAdmin) ||
        (viewerUserId ? a.userId === viewerUserId : Boolean(options?.isOwner))
      const userObj = a.user
        ? formatActivityAuthor(a.user)
        : {
            id: a.userId,
            username: 'Unknown',
            displayName: null,
            avatarUrl: null,
            avatarFrame: null,
            bannerUrl: null,
            nameplateUrl: null,
            bio: null,
            statusText: null,
            pronouns: null,
            displayNameStyle: null,
          }

      return {
        id: a.id,
        userId: a.userId,
        type: a.type,
        mediaType: a.mediaType ?? null,
        mediaId: a.mediaId ?? null,
        status: a.status ?? null,
        progress: a.progress ?? null,
        progressVolumes: a.progressVolumes ?? null,
        score: a.score ?? null,
        title: a.title ?? null,
        content: a.content ?? null,
        metadata: a.metadata ?? null,
        isPrivate: Boolean(a.isPrivate),
        isSpoiler: Boolean(a.isSpoiler),
        likeCount: a.likeCount ?? 0,
        replyCount: a.replyCount ?? 0,
        isLiked: likedIds.has(a.id),
        createdAt: toDate(a.createdAt).toISOString(),
        user: userObj,
        canDelete,
      }
    })
  }

  /**
   * Ensures viewer has access to read or engage with an activity item.
   */
  public static async assertCanViewActivity(
    activity: any,
    viewer?: { id: string; permissions?: number[] } | null
  ): Promise<void> {
    if (!activity) {
      throw new NotFound('Activity item not found')
    }
    if (!activity.isPrivate) return

    const isOwner = viewer?.id === activity.userId
    const isAdmin = viewer?.permissions
      ? new IRISBitField(viewer.permissions).has(IRISFlags.ADMINISTRATOR)
      : false

    if (isOwner || isAdmin) return

    const customListId = (activity.metadata as any)?.customListId
    if (customListId && viewer?.id) {
      const list = await prisma.orm.public.CustomList
        .where({ id: customListId })
        .include('collaborators', (c) => c.select('userId'))
        .first()

      if (list) {
        const isCollab = (list.collaborators as any[])?.some(
          (c) => c.userId === viewer.id
        )
        if (list.userId === viewer.id || isCollab || !list.isPrivate) {
          return
        }
      }
    }

    throw new Forbidden('You do not have permission to view this private activity')
  }

  /**
   * Evaluates and records a USER_MILESTONE activity when completing a round count of titles.
   */
  private static async checkCompletedMilestone(input: {
    userId: string
    mediaType: MediaType
    listModel: NonNullable<RecordMediaListActivityInput['listModel']>
    isPrivate: boolean
  }): Promise<void> {
    const listTable = (prisma.orm.public as any)[input.listModel]
    if (!listTable?.where) return

    const completedQuery = input.isPrivate
      ? listTable.where({ userId: input.userId, status: 'COMPLETED' })
      : listTable.where({ userId: input.userId, status: 'COMPLETED', private: false })

    const completedCount = await countOf(completedQuery)
    const threshold = [...COMPLETED_MILESTONE_THRESHOLDS]
      .reverse()
      .find((t) => completedCount === t)

    if (!threshold) return

    const domainLabelMap: Record<string, string> = {
      ANIME: 'Anime',
      MANGA: 'Manga',
      MOVIE: 'Movies',
      TV: 'TV Shows',
      GAME: 'Games',
      BOOK: 'Books',
      MUSIC: 'Music Releases',
      OTHER: 'Custom Titles',
    }
    const label = domainLabelMap[input.mediaType] || input.mediaType
    const milestoneKey = `COMPLETED:${input.mediaType}:${threshold}`

    await this.recordMilestoneActivitySync({
      userId: input.userId,
      milestoneKey,
      milestoneKind: 'COMPLETION_COUNT',
      title: `Completed ${threshold} ${label}`,
      content: `Reached ${threshold} completed ${label.toLowerCase()} in collection`,
      mediaType: input.mediaType,
      count: threshold,
      isPrivate: input.isPrivate,
    })
  }

  /**
   * Records a USER_MILESTONE activity if no matching milestoneKey already exists for the user.
   */
  public static async recordMilestoneActivitySync(
    input: RecordMilestoneActivityInput
  ): Promise<boolean> {
    const existingMilestones = await prisma.orm.public.ActivityLog
      .where({ userId: input.userId, type: 'USER_MILESTONE' })
      .select('id', 'metadata')
      .all()

    const alreadyLogged = existingMilestones.some(
      (m: any) => (m.metadata as any)?.milestoneKey === input.milestoneKey
    )
    if (alreadyLogged) return false

    await prisma.orm.public.ActivityLog.create({
      userId: input.userId,
      type: 'USER_MILESTONE',
      mediaType: input.mediaType ?? null,
      mediaId: null,
      title: input.title,
      content: input.content ?? null,
      metadata: {
        milestoneKey: input.milestoneKey,
        milestoneKind: input.milestoneKind,
        badgeId: input.badgeId ?? null,
        badgeName: input.badgeName ?? null,
        badgeIcon: input.badgeIcon ?? null,
        badgeColor: input.badgeColor ?? null,
        count: input.count ?? null,
      },
      isPrivate: input.isPrivate ?? false,
    })

    return true
  }

  /**
   * Non-blocking wrapper to emit a badge unlock USER_MILESTONE activity.
   */
  public static recordBadgeMilestone(userId: string, badgeId: number): void {
    const badge = getBadgeById(badgeId)
    if (!badge) return

    this.runNonBlocking(async () => {
      await this.recordMilestoneActivitySync({
        userId,
        milestoneKey: `BADGE:${badge.id}`,
        milestoneKind: 'BADGE',
        title: `Unlocked "${badge.name}" badge`,
        content: badge.description,
        badgeId: badge.id,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        badgeColor: badge.color,
        isPrivate: false,
      })
    }, `MilestoneActivity:BADGE:${badgeId}`)
  }

  /**
   * Records a media list tracking event (supports combined multi-field diff pills + milestones).
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

    const scoreInt = toActivityScoreInt(input.score)
    const exactScore = normalizeDisplayScore(input.score)
    const prevScore = normalizeDisplayScore(input.prevScore)

    this.runNonBlocking(async () => {
      await prisma.orm.public.ActivityLog.create({
        userId: input.userId,
        type,
        mediaType: input.mediaType,
        mediaId: input.mediaId,
        status: input.status ?? null,
        progress: input.progress ?? null,
        progressVolumes: input.progressVolumes ?? null,
        score: scoreInt,
        title: input.title ?? null,
        metadata: {
          exactScore,
          prevStatus: input.prevStatus ?? null,
          prevProgress: input.prevProgress ?? null,
          prevProgressVolumes: input.prevProgressVolumes ?? null,
          progressPages: input.progressPages ?? null,
          prevProgressPages: input.prevProgressPages ?? null,
          prevScore,
          rewatched: input.rewatched ?? null,
          prevRewatched: input.prevRewatched ?? null,
          totalUnits: input.totalUnits ?? null,
          totalVolumes: input.totalVolumes ?? null,
          totalPages: input.totalPages ?? null,
          unitLabel: input.unitLabel ?? null,
          changes: input.changes ?? null,
          coverImage: input.coverImage ?? null,
          bannerImage: input.bannerImage ?? null,
          format: input.format ?? null,
        },
        isPrivate: input.isPrivate ?? false,
        isSpoiler: input.isSpoiler ?? false,
      })

      if (
        input.listModel &&
        (input.action === 'COMPLETED' ||
          (input.action === 'ADDED' && input.status === 'COMPLETED'))
      ) {
        await this.checkCompletedMilestone({
          userId: input.userId,
          mediaType: input.mediaType,
          listModel: input.listModel,
          isPrivate: Boolean(input.isPrivate),
        })
      }
    }, `MediaListActivity:${type}`)
  }

  /**
   * Records a user favorite addition or removal event.
   */
  public static recordFavoriteActivity(input: RecordFavoriteActivityInput): void {
    const isAdded = input.action === 'FAVORITE_ADDED'
    const verb = isAdded ? 'Added' : 'Removed'

    this.runNonBlocking(async () => {
      let title = input.title ?? null
      let coverImage = input.coverImage ?? null
      let mediaType: MediaType | null = input.mediaType ?? null

      if (
        !mediaType &&
        ['ANIME', 'MANGA', 'MOVIE', 'TV', 'GAME', 'BOOK', 'MUSIC', 'OTHER'].includes(
          input.favoriteType
        )
      ) {
        mediaType = input.favoriteType as MediaType
      }

      if (!title) {
        const resolved = await this.resolveEntitySummary(input.favoriteType, input.targetId)
        title = resolved.title
        coverImage = coverImage ?? resolved.coverImage
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
          itemTitle: title,
          coverImage,
        },
        isPrivate: input.isPrivate ?? false,
      })
    }, `FavoriteActivity:${input.action}`)
  }

  /**
   * Records a bilateral friend acceptance event.
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
        isPrivate: input.isPrivate ?? false,
      })
    }, 'FriendActivity:FRIEND_ADDED')
  }

  /**
   * Records a public media-to-media recommendation event.
   */
  public static recordRecommendationActivity(input: RecordRecommendationActivityInput): void {
    this.runNonBlocking(async () => {
      const [sourceSummary, targetSummary] = await Promise.all([
        input.title
          ? Promise.resolve({
              title: input.title,
              coverImage: input.coverImage ?? null,
              bannerImage: null,
              format: null,
            })
          : this.resolveEntitySummary(input.mediaType, input.mediaId),
        input.targetTitle
          ? Promise.resolve({
              title: input.targetTitle,
              coverImage: input.targetCoverImage ?? null,
              bannerImage: null,
              format: null,
            })
          : this.resolveEntitySummary(input.targetMediaType, input.targetMediaId),
      ])

      const sourceTitle = sourceSummary.title || `${input.mediaType} #${input.mediaId}`
      const targetTitle =
        targetSummary.title || `${input.targetMediaType} #${input.targetMediaId}`

      await prisma.orm.public.ActivityLog.create({
        userId: input.userId,
        type: 'RECOMMENDATION_POSTED',
        mediaType: input.mediaType,
        mediaId: input.mediaId,
        title: `Recommended ${targetTitle} if you liked ${sourceTitle}`,
        content: input.content?.trim() || null,
        metadata: {
          itemTitle: sourceTitle,
          mediaTitle: sourceTitle,
          coverImage: sourceSummary.coverImage,
          mediaCover: sourceSummary.coverImage,
          targetMediaType: input.targetMediaType,
          targetMediaId: input.targetMediaId,
          targetTitle,
          targetCoverImage: targetSummary.coverImage,
        },
        isPrivate: input.isPrivate ?? false,
        isSpoiler: input.isSpoiler ?? false,
      })
    }, 'RecommendationActivity:RECOMMENDATION_POSTED')
  }

  /**
   * Records a single concise summary activity entry for bulk list imports or connection syncs.
   */
  public static recordImportOrSyncSummaryActivity(
    input: RecordImportOrSyncSummaryInput
  ): void {
    const totalTouched = input.importedCount + input.updatedCount
    if (totalTouched <= 0) return

    const providerLabel = input.provider ? input.provider.toUpperCase() : null
    const verb =
      input.source === 'CONNECTION_SYNC'
        ? `Synced ${totalTouched} item${totalTouched === 1 ? '' : 's'}${providerLabel ? ` from ${providerLabel}` : ''}`
        : `Imported ${totalTouched} list item${totalTouched === 1 ? '' : 's'}`

    this.runNonBlocking(async () => {
      await prisma.orm.public.ActivityLog.create({
        userId: input.userId,
        type: 'LIST_ITEM_ADDED',
        mediaType: input.mediaType ?? null,
        mediaId: null,
        title: verb,
        content:
          input.importedCount > 0 && input.updatedCount > 0
            ? `${input.importedCount} added, ${input.updatedCount} updated`
            : input.importedCount > 0
              ? `${input.importedCount} new entries added`
              : `${input.updatedCount} existing entries updated`,
        metadata: {
          summaryKind: input.source,
          provider: providerLabel,
          importedCount: input.importedCount,
          updatedCount: input.updatedCount,
          mediaTypes: input.mediaTypes ?? [],
        },
        isPrivate: input.isPrivate ?? false,
      })
    }, `SummaryActivity:${input.source}`)
  }

  /**
   * Creates a user STATUS_POST activity with optional tagged media, spoiler flag, and privacy.
   */
  public static async createStatusPost(
    userId: string,
    body: {
      content: string
      isSpoiler?: boolean
      isPrivate?: boolean
      mediaType?: string | null
      mediaId?: number | null
    }
  ) {
    const content = body.content?.trim()
    if (!content) {
      throw new BadRequest('Status post cannot be empty')
    }
    if (content.length > 2000) {
      throw new BadRequest('Status post cannot exceed 2000 characters')
    }

    let mediaType: MediaType | null = null
    let mediaId: number | null = null
    let mediaSummary: ResolvedMediaSummary | null = null

    if (body.mediaType && body.mediaId) {
      const upper = body.mediaType.trim().toUpperCase()
      if (!MEDIA_MODEL_BY_TYPE[upper]) {
        throw new BadRequest(`Unsupported media type "${body.mediaType}"`)
      }
      mediaType = (upper === 'MUSIC_ALBUM' || upper === 'MUSIC_TRACK'
        ? 'MUSIC'
        : upper) as MediaType
      mediaId = Number(body.mediaId)
      if (!Number.isInteger(mediaId) || mediaId < 1) {
        throw new BadRequest('Invalid mediaId')
      }
      mediaSummary = await this.resolveEntitySummary(mediaType, mediaId)
      if (!mediaSummary.title) {
        throw new NotFound(`Media item ${mediaType} #${mediaId} not found`)
      }
    }

    const created = await prisma.orm.public.ActivityLog.create({
      userId,
      type: 'STATUS_POST',
      mediaType,
      mediaId,
      title: mediaSummary?.title ?? null,
      content,
      metadata: mediaSummary
        ? {
            itemTitle: mediaSummary.title,
            coverImage: mediaSummary.coverImage,
            bannerImage: mediaSummary.bannerImage,
            format: mediaSummary.format,
          }
        : null,
      isPrivate: Boolean(body.isPrivate),
      isSpoiler: Boolean(body.isSpoiler),
    })

    const hydrated = await prisma.orm.public.ActivityLog
      .where({ id: created.id })
      .include('user')
      .first()

    const [formatted] = await this.formatActivityEntries([hydrated || created], {
      viewerUserId: userId,
      isOwner: true,
      isAdmin: false,
    })

    if (!formatted) {
      throw new NotFound('Created activity entry could not be loaded')
    }

    return {
      success: true,
      activity: formatted,
    }
  }

  /**
   * Toggles a like on any visible ActivityLog entry and syncs likeCount.
   */
  public static async toggleLike(
    userId: string,
    permissions: number[],
    activityId: string
  ) {
    const activity = await prisma.orm.public.ActivityLog.where({ id: activityId }).first()
    await this.assertCanViewActivity(activity, { id: userId, permissions })

    const existing = await prisma.orm.public.ActivityLike
      .where({ activityId, userId })
      .first()

    let liked = false
    if (existing) {
      await prisma.orm.public.ActivityLike.where({ id: existing.id }).delete()
      liked = false
    } else {
      await prisma.orm.public.ActivityLike.create({
        activityId,
        userId,
      })
      liked = true
    }

    const likeCount = await countOf(
      prisma.orm.public.ActivityLike.where({ activityId })
    )
    await prisma.orm.public.ActivityLog
      .where({ id: activityId })
      .update({ likeCount })

    return {
      success: true,
      liked,
      likeCount,
    }
  }

  /**
   * Lists replies for an ActivityLog entry ordered oldest-first.
   */
  public static async getReplies(
    activityId: string,
    query?: { page?: number; limit?: number },
    viewer?: { id: string; permissions: number[] } | null
  ) {
    const activity = await prisma.orm.public.ActivityLog.where({ id: activityId }).first()
    await this.assertCanViewActivity(activity, viewer)

    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 20))
    const skip = (page - 1) * limit

    const replyQuery = prisma.orm.public.ActivityReply.where({ activityId })
    const [total, rawReplies] = await Promise.all([
      countOf(replyQuery),
      replyQuery
        .orderBy((r) => r.createdAt.asc())
        .offset(skip)
        .limit(limit)
        .include('user')
        .all(),
    ])

    const isAdmin = viewer
      ? new IRISBitField(viewer.permissions).has(IRISFlags.ADMINISTRATOR)
      : false

    const replies = rawReplies.map((r: any) => ({
      id: r.id,
      activityId: r.activityId,
      userId: r.userId,
      content: r.content,
      likeCount: r.likeCount ?? 0,
      createdAt: toDate(r.createdAt).toISOString(),
      updatedAt: toDate(r.updatedAt).toISOString(),
      user: r.user
        ? formatActivityAuthor(r.user)
        : {
            id: r.userId,
            username: 'Unknown',
            displayName: null,
            avatarUrl: null,
            avatarFrame: null,
            bannerUrl: null,
            nameplateUrl: null,
            bio: null,
            statusText: null,
            pronouns: null,
            displayNameStyle: null,
          },
      canDelete:
        isAdmin ||
        (viewer ? r.userId === viewer.id || activity!.userId === viewer.id : false),
    }))

    const totalPages = Math.max(1, Math.ceil(total / limit))
    return {
      success: true,
      replies,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    }
  }

  /**
   * Adds a reply to any visible ActivityLog entry and syncs replyCount.
   */
  public static async createReply(
    userId: string,
    permissions: number[],
    activityId: string,
    body: { content: string }
  ) {
    const activity = await prisma.orm.public.ActivityLog.where({ id: activityId }).first()
    await this.assertCanViewActivity(activity, { id: userId, permissions })

    const content = body.content?.trim()
    if (!content) {
      throw new BadRequest('Reply content cannot be empty')
    }
    if (content.length > 1000) {
      throw new BadRequest('Reply content cannot exceed 1000 characters')
    }

    const created = await prisma.orm.public.ActivityReply.create({
      activityId,
      userId,
      content,
    })

    const [replyCount, hydrated] = await Promise.all([
      countOf(prisma.orm.public.ActivityReply.where({ activityId })),
      prisma.orm.public.ActivityReply
        .where({ id: created.id })
        .include('user')
        .first(),
    ])

    await prisma.orm.public.ActivityLog
      .where({ id: activityId })
      .update({ replyCount })

    const row = hydrated || created
    return {
      success: true,
      reply: {
        id: row.id,
        activityId: row.activityId,
        userId: row.userId,
        content: row.content,
        likeCount: row.likeCount ?? 0,
        createdAt: toDate(row.createdAt).toISOString(),
        updatedAt: toDate(row.updatedAt).toISOString(),
        user: (row as any).user
          ? formatActivityAuthor((row as any).user)
          : {
              id: userId,
              username: 'Unknown',
              displayName: null,
              avatarUrl: null,
              avatarFrame: null,
              bannerUrl: null,
              nameplateUrl: null,
              bio: null,
              statusText: null,
              pronouns: null,
              displayNameStyle: null,
            },
        canDelete: true,
      },
      replyCount,
    }
  }

  /**
   * Deletes an ActivityReply (reply author, activity owner, or admin) and syncs replyCount.
   */
  public static async deleteReply(
    userId: string,
    permissions: number[],
    activityId: string,
    replyId: string
  ) {
    const [activity, reply] = await Promise.all([
      prisma.orm.public.ActivityLog.where({ id: activityId }).first(),
      prisma.orm.public.ActivityReply.where({ id: replyId }).first(),
    ])

    if (!activity || !reply || reply.activityId !== activityId) {
      throw new NotFound('Reply not found')
    }

    const isAdmin = new IRISBitField(permissions).has(IRISFlags.ADMINISTRATOR)
    const isAllowed =
      isAdmin || reply.userId === userId || activity.userId === userId

    if (!isAllowed) {
      throw new Forbidden('You do not have permission to delete this reply')
    }

    await prisma.orm.public.ActivityReply.where({ id: replyId }).delete()

    const replyCount = await countOf(
      prisma.orm.public.ActivityReply.where({ activityId })
    )
    await prisma.orm.public.ActivityLog
      .where({ id: activityId })
      .update({ replyCount })

    return {
      success: true,
      replyCount,
      message: 'Reply deleted successfully',
    }
  }

  /**
   * Purges ALL activity log records older than the retention window (default: 30 days).
   */
  public static async purgeOldActivities(daysToKeep = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    return await prisma.orm.public.ActivityLog
      .where((a) => a.createdAt.lt(cutoff))
      .deleteAndCount()
  }

  /**
   * Initializes a recurring daily retention cleanup task (30 days across all activity types).
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

    setTimeout(() => {
      runCleanup().catch(() => {})
    }, 10_000)

    this.cronJobTimer = setInterval(() => {
      runCleanup().catch(() => {})
    }, 24 * 60 * 60 * 1000)

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

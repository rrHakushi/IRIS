import { prisma, and, or, countOf, toDate, type ActivityType, type FavoriteType, type MediaType } from '@IRIS/database'
import { getBadgeById, getProfileCustomization, setProfileCustomization } from '@IRIS/shared'
import { IRISBitField, IRISFlags } from '@IRIS/permissions'
import { BadRequest, Forbidden, NotFound } from '../../lib/errors'
import { uploadPublicAsset, deletePublicAsset, extractS3Key } from '../../utils/s3'

/**
 * Milestone thresholds for media consumption badges (11 tiers).
 */
const MEDIA_MILESTONES = [1, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 5000] as const

/**
 * Mapping of media domains to their 11 badge IDs in badges.json.
 */
const MEDIA_BADGE_MAP: Record<string, readonly number[]> = {
  ANIME: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  MANGA: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
  MOVIE: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  TV: [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],
  GAME: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58],
  BOOK: [59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69],
  MUSIC: [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80],
} as const

/**
 * Custom list curation milestone thresholds and badge IDs.
 */
const CUSTOM_LIST_MILESTONES = [1, 5, 10, 25] as const
const CUSTOM_LIST_BADGE_IDS = [81, 82, 83, 84] as const

/**
 * Activity category groupings
 */
const ACTIVITY_CATEGORIES: Record<string, ActivityType[]> = {
  media: [
    'LIST_ITEM_ADDED',
    'LIST_STATUS_UPDATED',
    'LIST_PROGRESS_UPDATED',
    'LIST_SCORE_UPDATED',
    'LIST_COMPLETED',
    'LIST_REWATCH_STARTED',
    'LIST_ITEM_REMOVED',
    'WATCHLIST_CREATED',
    'CUSTOM_LIST_CREATED',
  ],
  lists: [
    'LIST_ITEM_ADDED',
    'LIST_STATUS_UPDATED',
    'LIST_PROGRESS_UPDATED',
    'LIST_SCORE_UPDATED',
    'LIST_COMPLETED',
    'LIST_REWATCH_STARTED',
    'LIST_ITEM_REMOVED',
    'WATCHLIST_CREATED',
    'CUSTOM_LIST_CREATED',
  ],
  social: [
    'REVIEW_POSTED',
    'REVIEW_VOTED',
    'RECOMMENDATION_POSTED',
    'FRIEND_ADDED',
    'FAVORITE_ADDED',
    'FAVORITE_REMOVED',
  ],
  posts: ['STATUS_POST', 'USER_MILESTONE'],
  status: ['STATUS_POST', 'USER_MILESTONE'],
}

/**
 * Supported media domains for list activity filtering
 */
const MEDIA_ACTIVITY_DOMAINS: Record<string, MediaType> = {
  anime: 'ANIME',
  manga: 'MANGA',
  movie: 'MOVIE',
  tv: 'TV',
  game: 'GAME',
  book: 'BOOK',
  music: 'MUSIC',
  other: 'OTHER',
}

/**
 * Filter action mapping for UI pills (All, Added, Progress, Status, Completed, Scored, Removed)
 */
const ACTION_TYPE_MAP: Record<string, ActivityType[]> = {
  added: ['LIST_ITEM_ADDED'],
  progress: ['LIST_PROGRESS_UPDATED'],
  status: ['LIST_STATUS_UPDATED'],
  completed: ['LIST_COMPLETED'],
  score: ['LIST_SCORE_UPDATED'],
  scored: ['LIST_SCORE_UPDATED'],
  removed: ['LIST_ITEM_REMOVED'],
  rewatch: ['LIST_REWATCH_STARTED'],
}

/**
 * Supported favorite type string mapping
 */
const FAVORITE_TYPE_MAP: Record<string, FavoriteType> = {
  anime: 'ANIME',
  manga: 'MANGA',
  movie: 'MOVIE',
  tv: 'TV',
  game: 'GAME',
  book: 'BOOK',
  music: 'MUSIC_ALBUM',
  music_album: 'MUSIC_ALBUM',
  musicalbum: 'MUSIC_ALBUM',
  music_track: 'MUSIC_TRACK',
  track: 'MUSIC_TRACK',
  character: 'CHARACTER',
  other: 'OTHER',
  person: 'PERSON',
  studio: 'STUDIO',
  user: 'USER',
}

export class CarinaUsersServ {
  /**
   * Resolves a user strictly by database user ID.
   */
  public static async resolveUser(identifier: string) {
    const trimmed = identifier.trim()
    if (!trimmed) {
      throw new NotFound('User not found')
    }

    const user = await prisma.orm.public.User.where({ id: trimmed }).first()

    if (!user) {
      throw new NotFound(`User "${trimmed}" not found`)
    }

    return user
  }

  /**
   * Resolves a user profile by case-insensitive username.
   */
  public static async getUserProfileByUsername(username: string) {
    const trimmed = username.trim()
    if (!trimmed) {
      throw new NotFound('User not found')
    }

    const user = await prisma.orm.public.User.where((u) => u.username.ilike(trimmed)).first()

    if (!user) {
      throw new NotFound(`User "${trimmed}" not found`)
    }

    return await this.getUserProfile(user.id)
  }

  /**
   * Search / list public users with pagination (10 per page default).
   */
  public static async listUsers(query?: {
    q?: string
    page?: number
    limit?: number
  }) {
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const searchTerm = query?.q?.trim()
    let queryUsers = prisma.orm.public.User
    if (searchTerm) {
      queryUsers = queryUsers.where((u) => u.username.ilike(`%${searchTerm}%`))
    }

    const [total, rawUsers] = await Promise.all([
      countOf(queryUsers),
      queryUsers
        .orderBy((u) => u.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .select('id', 'username', 'customization', 'badges', 'createdAt')
        .all(),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const users = rawUsers.map((u) => {
      const profile = getProfileCustomization(u.customization)
      return {
        id: u.id,
        username: u.username,
        displayName: profile.displayName || null,
        avatarUrl: profile.avatarUrl || null,
        avatarFrame: profile.avatarFrame || null,
        bannerUrl: profile.bannerUrl || null,
        bio: profile.bio || null,
        badges: [...u.badges],
        createdAt: toDate(u.createdAt).toISOString(),
      }
    })

    return {
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Get user public profile info by ID or username.
   */
  public static async getUserProfile(identifier: string, viewerUserId?: string) {
    const target = await this.resolveUser(identifier)
    const isOwner = viewerUserId === target.id

    const [friendsCount, favoritesCount, rawConnections] = await Promise.all([
      countOf(prisma.orm.public.Friend.where({ userId: target.id })),
      countOf(prisma.orm.public.Favorite.where({ userId: target.id })),
      prisma.orm.public.Connection.where({
        userId: target.id,
        status: 'CONNECTED',
      })
        .select('id', 'provider', 'displayName', 'avatarUrl', 'profileUrl', 'status', 'settings', 'createdAt')
        .orderBy((c) => c.createdAt.desc())
        .all(),
    ])

    const connections = rawConnections
      .filter((c) => isOwner || (c.settings as any)?.isPrivate !== true)
      .map((c) => ({
        id: c.id,
        provider: c.provider,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
        profileUrl: c.profileUrl,
        status: c.status,
        createdAt: toDate(c.createdAt).toISOString(),
      }))

    const profile = getProfileCustomization(target.customization)

    return {
      success: true,
      user: {
        id: target.id,
        username: target.username,
        displayName: profile.displayName || null,
        avatarUrl: profile.avatarUrl || null,
        avatarFrame: profile.avatarFrame || null,
        bannerUrl: profile.bannerUrl || null,
        bannerOverlayUrl: profile.bannerOverlayUrl || null,
        nameplateUrl: profile.nameplateUrl || null,
        bio: profile.bio || null,
        statusText: profile.statusText || null,
        pronouns: profile.pronouns || null,
        badges: [...target.badges],
        customization: target.customization as any,
        createdAt: toDate(target.createdAt).toISOString(),
        stats: {
          friendsCount,
          favoritesCount,
          badgesCount: target.badges.length,
        },
        connections,
      },
    }
  }

  /**
   * Block a target user.
   */
  public static async blockUser(currentUserId: string, targetIdentifier: string) {
    const target = await this.resolveUser(targetIdentifier)

    if (target.id === currentUserId) {
      throw new BadRequest('You cannot block yourself')
    }

    // 1. Upsert block record
    const existingBlock = await prisma.orm.public.UserBlock.where({
      blockerId: currentUserId,
      blockedId: target.id,
    }).first()

    if (!existingBlock) {
      await prisma.orm.public.UserBlock.create({
        blockerId: currentUserId,
        blockedId: target.id,
      })
    }

    // 2. Sever existing friendship & pending requests
    await Promise.all([
      prisma.orm.public.Friend.where((f) =>
        or(
          and(f.userId.eq(currentUserId), f.friendId.eq(target.id)),
          and(f.userId.eq(target.id), f.friendId.eq(currentUserId))
        )
      ).deleteAll(),
      prisma.orm.public.FriendRequest.where((r) =>
        or(
          and(r.senderId.eq(currentUserId), r.receiverId.eq(target.id)),
          and(r.senderId.eq(target.id), r.receiverId.eq(currentUserId))
        )
      ).deleteAll(),
    ])

    return {
      success: true,
      message: 'User blocked successfully',
      blockedId: target.id,
    }
  }

  /**
   * Unblock a target user.
   */
  public static async unblockUser(currentUserId: string, targetIdentifier: string) {
    const target = await this.resolveUser(targetIdentifier)

    await prisma.orm.public.UserBlock.where({
      blockerId: currentUserId,
      blockedId: target.id,
    }).deleteAll()

    return {
      success: true,
      message: 'User unblocked successfully',
    }
  }

  /**
   * Get friendship & relation status between authenticated user and target user.
   */
  public static async getFriendshipStatus(
    currentUserId: string,
    targetIdentifier: string
  ) {
    const target = await this.resolveUser(targetIdentifier)

    if (target.id === currentUserId) {
      return {
        success: true,
        status: 'self' as const,
        isFriend: false,
        isBlocked: false,
        isBlockedBy: false,
        isPending: false,
        requestId: null,
      }
    }

    // Check if blocked by caller
    const blockedByCaller = await prisma.orm.public.UserBlock.where({
      blockerId: currentUserId,
      blockedId: target.id,
    }).first()

    if (blockedByCaller) {
      return {
        success: true,
        status: 'blocked' as const,
        isFriend: false,
        isBlocked: true,
        isBlockedBy: false,
        isPending: false,
        requestId: null,
      }
    }

    // Check if caller is blocked by target
    const blockedByTarget = await prisma.orm.public.UserBlock.where({
      blockerId: target.id,
      blockedId: currentUserId,
    }).first()

    if (blockedByTarget) {
      return {
        success: true,
        status: 'blocked_by' as const,
        isFriend: false,
        isBlocked: false,
        isBlockedBy: true,
        isPending: false,
        requestId: null,
      }
    }

    // Check if friends
    const friend = await prisma.orm.public.Friend.where((f) =>
      or(
        and(f.userId.eq(currentUserId), f.friendId.eq(target.id)),
        and(f.userId.eq(target.id), f.friendId.eq(currentUserId))
      )
    ).first()

    if (friend) {
      return {
        success: true,
        status: 'friends' as const,
        isFriend: true,
        isBlocked: false,
        isBlockedBy: false,
        isPending: false,
        requestId: null,
      }
    }

    // Check pending friend requests
    const friendReq = await prisma.orm.public.FriendRequest.where((r) =>
      and(
        r.status.eq('PENDING'),
        or(
          and(r.senderId.eq(currentUserId), r.receiverId.eq(target.id)),
          and(r.senderId.eq(target.id), r.receiverId.eq(currentUserId))
        )
      )
    ).first()

    if (friendReq) {
      const isOutgoing = friendReq.senderId === currentUserId
      return {
        success: true,
        status: isOutgoing ? ('outgoing_request' as const) : ('incoming_request' as const),
        isFriend: false,
        isBlocked: false,
        isBlockedBy: false,
        isPending: true,
        requestId: friendReq.id,
      }
    }

    return {
      success: true,
      status: 'none' as const,
      isFriend: false,
      isBlocked: false,
      isBlockedBy: false,
      isPending: false,
      requestId: null,
    }
  }

  /**
   * Get user public assets (avatar, banner, decor).
   */
  public static async getUserAssets(targetIdentifier: string) {
    const target = await this.resolveUser(targetIdentifier)
    const profile = getProfileCustomization(target.customization)

    return {
      success: true,
      assets: {
        avatarUrl: profile.avatarUrl || null,
        avatarFrame: profile.avatarFrame || null,
        bannerUrl: profile.bannerUrl || null,
        bannerOverlayUrl: profile.bannerOverlayUrl || null,
        nameplateUrl: profile.nameplateUrl || null,
        sidebarBannerUrl: profile.sidebarBannerUrl || null,
        accentColor: profile.accentColor || null,
      },
    }
  }

  /**
   * Get user badges mapped with metadata from @IRIS/shared.
   */
  public static async getUserBadges(targetIdentifier: string) {
    const target = await this.resolveUser(targetIdentifier)

    const richBadges = target.badges
      .map((id) => getBadgeById(id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .map((badge) => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        color: badge.color,
        category: badge.category,
        earnable: badge.earnable,
      }))

    return {
      success: true,
      badges: richBadges,
      total: richBadges.length,
    }
  }

  /**
   * Evaluate and award eligible badges for target user.
   */
  public static async evaluateBadges(
    currentUser: { id: string; permissions: number[] },
    targetIdentifier: string
  ) {
    const target =
      targetIdentifier === 'me'
        ? await this.resolveUser(currentUser.id)
        : await this.resolveUser(targetIdentifier)

    const isSelf = target.id === currentUser.id
    const isAdmin = new IRISBitField(currentUser.permissions).has(IRISFlags.ADMINISTRATOR)

    if (!isSelf && !isAdmin) {
      throw new Forbidden('You cannot evaluate badges for other users')
    }

    // 1. Media counts across domains
    const [
      animeCount,
      mangaCount,
      movieCount,
      tvCount,
      gameCount,
      bookCount,
      musicCount,
      customListCount,
    ] = await Promise.all([
      countOf(prisma.orm.public.AnimeList.where({ userId: target.id })),
      countOf(prisma.orm.public.MangaList.where({ userId: target.id })),
      countOf(prisma.orm.public.MovieList.where({ userId: target.id })),
      countOf(prisma.orm.public.TvList.where({ userId: target.id })),
      countOf(prisma.orm.public.GameList.where({ userId: target.id })),
      countOf(prisma.orm.public.BookList.where({ userId: target.id })),
      countOf(prisma.orm.public.MusicList.where({ userId: target.id })),
      countOf(prisma.orm.public.CustomList.where({ userId: target.id })),
    ])

    const earnedBadgeIds = new Set<number>()

    // Evaluate media milestones
    const evaluateTrack = (count: number, badgeIds?: readonly number[]) => {
      if (!badgeIds) return
      for (let i = 0; i < MEDIA_MILESTONES.length; i++) {
        const threshold = MEDIA_MILESTONES[i]
        const badgeId = badgeIds[i]
        if (threshold !== undefined && badgeId !== undefined && count >= threshold) {
          earnedBadgeIds.add(badgeId)
        }
      }
    }

    evaluateTrack(animeCount, MEDIA_BADGE_MAP.ANIME)
    evaluateTrack(mangaCount, MEDIA_BADGE_MAP.MANGA)
    evaluateTrack(movieCount, MEDIA_BADGE_MAP.MOVIE)
    evaluateTrack(tvCount, MEDIA_BADGE_MAP.TV)
    evaluateTrack(gameCount, MEDIA_BADGE_MAP.GAME)
    evaluateTrack(bookCount, MEDIA_BADGE_MAP.BOOK)
    evaluateTrack(musicCount, MEDIA_BADGE_MAP.MUSIC)

    // Evaluate custom list milestones
    for (let i = 0; i < CUSTOM_LIST_MILESTONES.length; i++) {
      const threshold = CUSTOM_LIST_MILESTONES[i]
      const badgeId = CUSTOM_LIST_BADGE_IDS[i]
      if (threshold !== undefined && badgeId !== undefined && customListCount >= threshold) {
        earnedBadgeIds.add(badgeId)
      }
    }

    // Role badge #2 for Admin
    const targetIsAdmin = new IRISBitField(target.permissions).has(IRISFlags.ADMINISTRATOR)
    if (targetIsAdmin) {
      earnedBadgeIds.add(2)
    }

    const currentBadgesSet = new Set(target.badges)
    const newlyAwardedBadgeIds = Array.from(earnedBadgeIds).filter(
      (id) => !currentBadgesSet.has(id)
    )

    let updatedBadges = [...target.badges]
    if (newlyAwardedBadgeIds.length > 0) {
      updatedBadges = [...target.badges, ...newlyAwardedBadgeIds]
      await prisma.orm.public.User.where({ id: target.id }).update({
        badges: updatedBadges,
      })
    }

    return {
      success: true,
      newlyAwardedCount: newlyAwardedBadgeIds.length,
      newlyAwardedBadgeIds,
      badges: updatedBadges,
      message:
        newlyAwardedBadgeIds.length > 0
          ? `Successfully unlocked ${newlyAwardedBadgeIds.length} new badge(s)!`
          : 'All badge achievements are up to date.',
    }
  }

  /**
   * Get user full activity feed with pagination and privacy gating.
   */
  public static async getUserActivity(
    targetIdentifier: string,
    query?: { page?: number; limit?: number },
    sessionUser?: { id: string; permissions: number[] } | null
  ) {
    const target = await this.resolveUser(targetIdentifier)
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const isOwner = sessionUser?.id === target.id
    const isAdmin = sessionUser
      ? new IRISBitField(sessionUser.permissions).has(IRISFlags.ADMINISTRATOR)
      : false

    let activityQuery = prisma.orm.public.ActivityLog.where({ userId: target.id })
    if (!isOwner && !isAdmin) {
      activityQuery = activityQuery.where({ isPrivate: false })
    }

    const [total, rawActivities] = await Promise.all([
      countOf(activityQuery),
      activityQuery
        .orderBy((a) => a.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .include('user')
        .all(),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const activities = rawActivities.map((a) => {
      const authorProfile = getProfileCustomization(a.user.customization)
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
        metadata: a.metadata,
        isPrivate: a.isPrivate,
        isSpoiler: a.isSpoiler,
        likeCount: a.likeCount,
        replyCount: a.replyCount,
        createdAt: toDate(a.createdAt).toISOString(),
        user: {
          id: a.user.id,
          username: a.user.username,
          displayName: authorProfile.displayName || null,
          avatarUrl: authorProfile.avatarUrl || null,
          avatarFrame: authorProfile.avatarFrame || null,
          bannerUrl: authorProfile.bannerUrl || null,
          nameplateUrl: authorProfile.nameplateUrl || null,
          bio: authorProfile.bio || null,
          statusText: authorProfile.statusText || null,
          pronouns: authorProfile.pronouns || null,
          displayNameStyle: authorProfile.displayNameStyle || null,
        },
        canDelete: isOwner || isAdmin,
      }
    })

    return {
      success: true,
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Get user activity feed filtered by category or media domain.
   */
  public static async getUserActivityByCategory(
    targetIdentifier: string,
    category: string,
    query?: { page?: number; limit?: number; action?: string },
    sessionUser?: { id: string; permissions: number[] } | null
  ) {
    const target = await this.resolveUser(targetIdentifier)
    const normCategory = category.toLowerCase().trim()

    let mediaTypeFilter: MediaType | undefined
    let allowedTypes: ActivityType[] | undefined

    if (normCategory === 'all' || normCategory === 'overview') {
      // Return unrestricted activity stream across all types
      allowedTypes = undefined
    } else if (MEDIA_ACTIVITY_DOMAINS[normCategory]) {
      mediaTypeFilter = MEDIA_ACTIVITY_DOMAINS[normCategory]
      allowedTypes = [
        'LIST_ITEM_ADDED',
        'LIST_STATUS_UPDATED',
        'LIST_PROGRESS_UPDATED',
        'LIST_SCORE_UPDATED',
        'LIST_COMPLETED',
        'LIST_REWATCH_STARTED',
        'LIST_ITEM_REMOVED',
        'FAVORITE_ADDED',
        'FAVORITE_REMOVED',
      ]
    } else if (ACTIVITY_CATEGORIES[normCategory]) {
      allowedTypes = ACTIVITY_CATEGORIES[normCategory]
    } else {
      // Check if the category is an exact ActivityType enum member
      const upper = category.toUpperCase().trim() as ActivityType
      const allEnumKeys: ActivityType[] = [
        'LIST_ITEM_ADDED',
        'LIST_STATUS_UPDATED',
        'LIST_PROGRESS_UPDATED',
        'LIST_SCORE_UPDATED',
        'LIST_COMPLETED',
        'LIST_REWATCH_STARTED',
        'LIST_ITEM_REMOVED',
        'REVIEW_POSTED',
        'REVIEW_VOTED',
        'RECOMMENDATION_POSTED',
        'WATCHLIST_CREATED',
        'CUSTOM_LIST_CREATED',
        'FAVORITE_ADDED',
        'FAVORITE_REMOVED',
        'FRIEND_ADDED',
        'STATUS_POST',
        'USER_MILESTONE',
      ]

      if (allEnumKeys.includes(upper)) {
        allowedTypes = [upper]
      } else {
        throw new BadRequest(
          `Invalid activity category "${category}". Valid categories: anime, manga, movie, tv, game, book, music, other, media, lists, social, posts, status.`
        )
      }
    }

    // Narrow down by action filter if specified (e.g. ADDED, PROGRESS, STATUS, COMPLETED, SCORE, REMOVED)
    if (query?.action) {
      const normAction = query.action.toLowerCase().trim()
      if (ACTION_TYPE_MAP[normAction]) {
        allowedTypes = ACTION_TYPE_MAP[normAction]
      } else {
        const upperAction = query.action.toUpperCase().trim() as ActivityType
        if (allowedTypes && allowedTypes.includes(upperAction)) {
          allowedTypes = [upperAction]
        }
      }
    }

    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const isOwner = sessionUser?.id === target.id
    const isAdmin = sessionUser
      ? new IRISBitField(sessionUser.permissions).has(IRISFlags.ADMINISTRATOR)
      : false

    let activityQuery = prisma.orm.public.ActivityLog.where({ userId: target.id })
    if (mediaTypeFilter) {
      activityQuery = activityQuery.where({ mediaType: mediaTypeFilter })
    }
    if (allowedTypes && allowedTypes.length > 0) {
      activityQuery = activityQuery.where((a) => a.type.in(allowedTypes!))
    }
    if (!isOwner && !isAdmin) {
      activityQuery = activityQuery.where({ isPrivate: false })
    }

    const [total, rawActivities] = await Promise.all([
      countOf(activityQuery),
      activityQuery
        .orderBy((a) => a.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .include('user')
        .all(),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const activities = rawActivities.map((a) => {
      const authorProfile = getProfileCustomization(a.user.customization)
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
        metadata: a.metadata,
        isPrivate: a.isPrivate,
        isSpoiler: a.isSpoiler,
        likeCount: a.likeCount,
        replyCount: a.replyCount,
        createdAt: toDate(a.createdAt).toISOString(),
        user: {
          id: a.user.id,
          username: a.user.username,
          displayName: authorProfile.displayName || null,
          avatarUrl: authorProfile.avatarUrl || null,
          avatarFrame: authorProfile.avatarFrame || null,
          bannerUrl: authorProfile.bannerUrl || null,
          nameplateUrl: authorProfile.nameplateUrl || null,
          bio: authorProfile.bio || null,
          statusText: authorProfile.statusText || null,
          pronouns: authorProfile.pronouns || null,
          displayNameStyle: authorProfile.displayNameStyle || null,
        },
        canDelete: isOwner || isAdmin,
      }
    })

    return {
      success: true,
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Delete an activity log item.
   */
  public static async deleteActivity(
    currentUserId: string,
    currentUserPermissions: number[],
    activityId: string
  ) {
    const activity = await prisma.orm.public.ActivityLog.where({ id: activityId }).first()

    if (!activity) {
      throw new NotFound('Activity item not found')
    }

    const isAuthor = activity.userId === currentUserId
    const isAdmin = new IRISBitField(currentUserPermissions).has(IRISFlags.ADMINISTRATOR)

    if (!isAuthor && !isAdmin) {
      throw new Forbidden('You do not have permission to delete this activity item')
    }

    await prisma.orm.public.ActivityLog.where({ id: activityId }).delete()

    return {
      success: true,
      message: 'Activity item deleted successfully',
    }
  }

  /**
   * Helper to enrich raw favorite records with entity metadata (title, cover, link, format, score).
   */
  private static async enrichFavoritesWithEntities(
    rawFavorites: Array<{
      id: string
      userId: string
      type: FavoriteType
      targetId: number
      createdAt: any
    }>,
    targetUserId: string
  ) {
    if (!rawFavorites.length) return []

    const animeIds: number[] = []
    const mangaIds: number[] = []
    const movieIds: number[] = []
    const tvIds: number[] = []
    const gameIds: number[] = []
    const bookIds: number[] = []
    const musicIds: number[] = []
    const characterIds: number[] = []
    const personIds: number[] = []
    const studioIds: number[] = []
    const otherIds: number[] = []

    for (const item of rawFavorites) {
      if (item.type === 'ANIME') animeIds.push(item.targetId)
      else if (item.type === 'MANGA') mangaIds.push(item.targetId)
      else if (item.type === 'MOVIE') movieIds.push(item.targetId)
      else if (item.type === 'TV') tvIds.push(item.targetId)
      else if (item.type === 'GAME') gameIds.push(item.targetId)
      else if (item.type === 'BOOK') bookIds.push(item.targetId)
      else if (item.type === 'MUSIC_ALBUM' || item.type === 'MUSIC_TRACK')
        musicIds.push(item.targetId)
      else if (item.type === 'OTHER') otherIds.push(item.targetId)
      else if (item.type === 'CHARACTER') characterIds.push(item.targetId)
      else if (item.type === 'PERSON') personIds.push(item.targetId)
      else if (item.type === 'STUDIO') studioIds.push(item.targetId)
    }

    const [
      animeList,
      mangaList,
      movieList,
      tvList,
      gameList,
      bookList,
      musicList,
      characterList,
      personList,
      studioList,
      userAnimeEntries,
      userMangaEntries,
      userMovieEntries,
      userTvEntries,
      userGameEntries,
      userBookEntries,
      otherList,
      userOtherEntries,
    ] = await Promise.all([
      animeIds.length
        ? prisma.orm.public.Anime.where((m) => m.id.in(animeIds))
            .select('id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage', 'format')
            .all()
        : [],
      mangaIds.length
        ? prisma.orm.public.Manga.where((m) => m.id.in(mangaIds))
            .select('id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage', 'format')
            .all()
        : [],
      movieIds.length
        ? prisma.orm.public.Movie.where((m) => m.id.in(movieIds))
            .select('id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage')
            .all()
        : [],
      tvIds.length
        ? prisma.orm.public.Tv.where((m) => m.id.in(tvIds))
            .select('id', 'titlePrimary', 'titleSecondary', 'titleNative', 'coverImage')
            .all()
        : [],
      gameIds.length
        ? prisma.orm.public.Game.where((m) => m.id.in(gameIds))
            .select('id', 'titlePrimary', 'titleSecondary', 'coverImage')
            .all()
        : [],
      bookIds.length
        ? prisma.orm.public.Book.where((m) => m.id.in(bookIds))
            .select('id', 'titlePrimary', 'titleSecondary', 'coverImage')
            .all()
        : [],
      musicIds.length
        ? prisma.orm.public.Music.where((m) => m.id.in(musicIds))
            .select('id', 'titlePrimary', 'titleSecondary', 'coverImage', 'type')
            .all()
        : [],
      characterIds.length
        ? prisma.orm.public.Character.where((m) => m.id.in(characterIds))
            .select('id', 'namePrimary', 'nameNative', 'image')
            .all()
        : [],
      personIds.length
        ? prisma.orm.public.Person.where((m) => m.id.in(personIds))
            .select('id', 'namePrimary', 'nameNative', 'image')
            .all()
        : [],
      studioIds.length
        ? prisma.orm.public.Studio.where((m) => m.id.in(studioIds))
            .select('id', 'name')
            .all()
        : [],
      animeIds.length
        ? prisma.orm.public.AnimeList.where({ userId: targetUserId })
            .where((m) => m.animeId.in(animeIds))
            .select('animeId', 'score')
            .all()
        : [],
      mangaIds.length
        ? prisma.orm.public.MangaList.where({ userId: targetUserId })
            .where((m) => m.mangaId.in(mangaIds))
            .select('mangaId', 'score')
            .all()
        : [],
      movieIds.length
        ? prisma.orm.public.MovieList.where({ userId: targetUserId })
            .where((m) => m.movieId.in(movieIds))
            .select('movieId', 'score')
            .all()
        : [],
      tvIds.length
        ? prisma.orm.public.TvList.where({ userId: targetUserId })
            .where((m) => m.tvId.in(tvIds))
            .select('tvId', 'score')
            .all()
        : [],
      gameIds.length
        ? prisma.orm.public.GameList.where({ userId: targetUserId })
            .where((m) => m.gameId.in(gameIds))
            .select('gameId', 'score')
            .all()
        : [],
      bookIds.length
        ? prisma.orm.public.BookList.where({ userId: targetUserId })
            .where((m) => m.bookId.in(bookIds))
            .select('bookId', 'score')
            .all()
        : [],
      otherIds.length
        ? prisma.orm.public.Other.where((m) => m.id.in(otherIds))
            .select('id', 'titlePrimary', 'titleSecondary', 'coverImage')
            .all()
        : [],
      otherIds.length
        ? prisma.orm.public.OtherList.where({ userId: targetUserId })
            .where((m) => m.otherId.in(otherIds))
            .select('otherId', 'score')
            .all()
        : [],
    ])

    const animeMap = new Map<number, any>(animeList.map((i: any): [number, any] => [i.id, i]))
    const mangaMap = new Map<number, any>(mangaList.map((i: any): [number, any] => [i.id, i]))
    const movieMap = new Map<number, any>(movieList.map((i: any): [number, any] => [i.id, i]))
    const tvMap = new Map<number, any>(tvList.map((i: any): [number, any] => [i.id, i]))
    const gameMap = new Map<number, any>(gameList.map((i: any): [number, any] => [i.id, i]))
    const bookMap = new Map<number, any>(bookList.map((i: any): [number, any] => [i.id, i]))
    const musicMap = new Map<number, any>(musicList.map((i: any): [number, any] => [i.id, i]))
    const characterMap = new Map<number, any>(characterList.map((i: any): [number, any] => [i.id, i]))
    const personMap = new Map<number, any>(personList.map((i: any): [number, any] => [i.id, i]))
    const studioMap = new Map<number, any>(studioList.map((i: any): [number, any] => [i.id, i]))
    const otherMap = new Map<number, any>(otherList.map((i: any): [number, any] => [i.id, i]))

    const scoreMap = new Map<string, number>()
    userAnimeEntries.forEach((e: any) => e.score && scoreMap.set(`ANIME:${e.animeId}`, e.score))
    userMangaEntries.forEach((e: any) => e.score && scoreMap.set(`MANGA:${e.mangaId}`, e.score))
    userMovieEntries.forEach((e: any) => e.score && scoreMap.set(`MOVIE:${e.movieId}`, e.score))
    userTvEntries.forEach((e: any) => e.score && scoreMap.set(`TV:${e.tvId}`, e.score))
    userGameEntries.forEach((e: any) => e.score && scoreMap.set(`GAME:${e.gameId}`, e.score))
    userBookEntries.forEach((e: any) => e.score && scoreMap.set(`BOOK:${e.bookId}`, e.score))
    userOtherEntries.forEach((e: any) => e.score && scoreMap.set(`OTHER:${e.otherId}`, e.score))

    return rawFavorites.map((f) => {
      let title = ''
      let subtitle: string | null = null
      let coverImage: string | null = null
      let link = ''
      let format: string | null = null
      const userScore = scoreMap.get(`${f.type}:${f.targetId}`) || null

      if (f.type === 'ANIME') {
        const item = animeMap.get(f.targetId)
        title = item?.titlePrimary || item?.titleSecondary || `Anime #${f.targetId}`
        subtitle = item?.titleSecondary || item?.titleNative || null
        coverImage = item?.coverImage || null
        link = `/borealis/anime/${f.targetId}`
        format = item?.format || 'ANIME'
      } else if (f.type === 'MANGA') {
        const item = mangaMap.get(f.targetId)
        title = item?.titlePrimary || item?.titleSecondary || `Manga #${f.targetId}`
        subtitle = item?.titleSecondary || item?.titleNative || null
        coverImage = item?.coverImage || null
        link = `/borealis/manga/${f.targetId}`
        format = item?.format || 'MANGA'
      } else if (f.type === 'MOVIE') {
        const item = movieMap.get(f.targetId)
        title = item?.titlePrimary || item?.titleSecondary || `Movie #${f.targetId}`
        subtitle = item?.titleSecondary || item?.titleNative || null
        coverImage = item?.coverImage || null
        link = `/borealis/movies/${f.targetId}`
        format = 'MOVIE'
      } else if (f.type === 'TV') {
        const item = tvMap.get(f.targetId)
        title = item?.titlePrimary || item?.titleSecondary || `TV Series #${f.targetId}`
        subtitle = item?.titleSecondary || item?.titleNative || null
        coverImage = item?.coverImage || null
        link = `/borealis/tv/${f.targetId}`
        format = 'TV'
      } else if (f.type === 'GAME') {
        const item = gameMap.get(f.targetId)
        title = item?.titlePrimary || item?.titleSecondary || `Game #${f.targetId}`
        subtitle = item?.titleSecondary || null
        coverImage = item?.coverImage || null
        link = `/borealis/games/${f.targetId}`
        format = 'GAME'
      } else if (f.type === 'BOOK') {
        const item = bookMap.get(f.targetId)
        title = item?.titlePrimary || item?.titleSecondary || `Book #${f.targetId}`
        subtitle = item?.titleSecondary || null
        coverImage = item?.coverImage || null
        link = `/borealis/books/${f.targetId}`
        format = 'BOOK'
      } else if (f.type === 'MUSIC_ALBUM' || f.type === 'MUSIC_TRACK') {
        const item = musicMap.get(f.targetId)
        title = item?.titlePrimary || item?.titleSecondary || `Music #${f.targetId}`
        subtitle = item?.titleSecondary || null
        coverImage = item?.coverImage || null
        const subPath = item?.type === 'ALBUM' ? 'albums' : 'tracks'
        link = `/borealis/music/${subPath}/${f.targetId}`
        format = item?.type || 'MUSIC'
      } else if (f.type === 'CHARACTER') {
        const item = characterMap.get(f.targetId)
        title = item?.namePrimary || `Character #${f.targetId}`
        subtitle = item?.nameNative || null
        coverImage = item?.image || null
        link = `/borealis/characters/${f.targetId}`
        format = 'CHARACTER'
      } else if (f.type === 'PERSON') {
        const item = personMap.get(f.targetId)
        title = item?.namePrimary || `Person #${f.targetId}`
        subtitle = item?.nameNative || null
        coverImage = item?.image || null
        link = `/borealis/people/${f.targetId}`
        format = 'PERSON'
      } else if (f.type === 'STUDIO') {
        const item = studioMap.get(f.targetId)
        title = item?.name || `Studio #${f.targetId}`
        link = `/borealis/studios/${f.targetId}`
        format = 'STUDIO'
      } else if (f.type === 'OTHER') {
        const item = otherMap.get(f.targetId)
        title = item?.titlePrimary || item?.titleSecondary || `Item #${f.targetId}`
        subtitle = item?.titleSecondary || null
        coverImage = item?.coverImage || null
        link = `/borealis/other/${f.targetId}`
        format = 'OTHER'
      } else {
        title = `${f.type} #${f.targetId}`
        format = f.type
      }


      return {
        id: f.id,
        userId: f.userId,
        type: f.type,
        targetId: f.targetId,
        createdAt: toDate(f.createdAt).toISOString(),
        entity: {
          id: f.targetId,
          title,
          subtitle,
          coverImage,
          link,
          format,
          score: userScore,
        },
      }
    })
  }

  /**
   * Get user favorites with pagination.
   */
  public static async getUserFavorites(
    targetIdentifier: string,
    query?: { page?: number; limit?: number }
  ) {
    const target = await this.resolveUser(targetIdentifier)
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const favQuery = prisma.orm.public.Favorite.where({ userId: target.id })

    const [total, rawFavorites] = await Promise.all([
      countOf(favQuery),
      favQuery
        .orderBy((f) => f.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .all(),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const favorites = await this.enrichFavoritesWithEntities(rawFavorites, target.id)

    return {
      success: true,
      favorites,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Get user favorites filtered by category.
   */
  public static async getUserFavoritesByCategory(
    targetIdentifier: string,
    category: string,
    query?: { page?: number; limit?: number }
  ) {
    const target = await this.resolveUser(targetIdentifier)
    const normCategory = category.toLowerCase().trim()
    const targetType = FAVORITE_TYPE_MAP[normCategory]

    if (!targetType) {
      throw new BadRequest(
        `Invalid favorite category "${category}". Valid categories: anime, manga, movie, tv, game, book, music, other, character, person, studio, user.`
      )
    }

    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const favQuery = prisma.orm.public.Favorite.where({
      userId: target.id,
      type: targetType,
    })

    const [total, rawFavorites] = await Promise.all([
      countOf(favQuery),
      favQuery
        .orderBy((f) => f.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .all(),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const favorites = await this.enrichFavoritesWithEntities(rawFavorites, target.id)

    return {
      success: true,
      favorites,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Get user public friends with pagination.
   */
  public static async getUserFriends(
    targetIdentifier: string,
    query?: { page?: number; limit?: number },
    viewerUserId?: string
  ) {
    const target = await this.resolveUser(targetIdentifier)
    const isOwner = viewerUserId === target.id
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    let friendQuery = prisma.orm.public.Friend.where({ userId: target.id })
    if (!isOwner) {
      friendQuery = friendQuery.where({ isPrivate: false })
    }

    const [total, rawFriends] = await Promise.all([
      countOf(friendQuery),
      friendQuery
        .orderBy((f) => f.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .include('friend')
        .all(),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const friends = rawFriends.map((f) => {
      const profile = getProfileCustomization(f.friend.customization)
      return {
        id: f.id,
        friendId: f.friendId,
        nickname: isOwner ? f.nickname : null,
        isPrivate: f.isPrivate,
        createdAt: toDate(f.createdAt).toISOString(),
        user: {
          id: f.friend.id,
          username: f.friend.username,
          displayName: profile.displayName || null,
          avatarUrl: profile.avatarUrl || null,
          avatarFrame: profile.avatarFrame || null,
          badges: [...f.friend.badges],
        },
      }
    })

    return {
      success: true,
      friends,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Return full account info for authenticated user.
   */
  public static async getMe(currentUserId: string) {
    const dbUser = await prisma.orm.public.User.where({ id: currentUserId }).first()

    if (!dbUser) {
      throw new NotFound('User not found')
    }

    return {
      success: true,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        customization: dbUser.customization as any,
        settings: dbUser.settings as any,
        permissions: [...dbUser.permissions],
        badges: [...dbUser.badges],
        TOTPEnabled: dbUser.TOTPEnabled,
        emailMfaEnabled: dbUser.emailMfaEnabled,
        publicKey: dbUser.publicKey,
        createdAt: toDate(dbUser.createdAt).toISOString(),
        updatedAt: toDate(dbUser.updatedAt).toISOString(),
      },
    }
  }

  /**
   * Update account info, customization, settings, and assets for authenticated user.
   */
  public static async updateMe(
    currentUserId: string,
    body?: {
      username?: string
      email?: string
      customization?: any
      settings?: any
      assets?: {
        avatarUrl?: string | null
        bannerUrl?: string | null
        bannerOverlayUrl?: string | null
        nameplateUrl?: string | null
        avatarFrame?: string | null
      }
    } | null
  ) {
    const currentUser = await prisma.orm.public.User.where({ id: currentUserId }).first()

    if (!currentUser) {
      throw new NotFound('User not found')
    }

    const updates: Record<string, any> = {}

    // Check unique username if updated
    if (body?.username) {
      const newUsername = body.username.trim()
      if (newUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
        const existingUser = await prisma.orm.public.User.where((u) =>
          and(
            u.username.ilike(newUsername),
            u.id.neq(currentUserId)
          )
        ).first()
        if (existingUser) {
          throw new BadRequest(`Username "${newUsername}" is already taken`)
        }
        updates.username = newUsername
      }
    }

    // Check unique email if updated
    if (body?.email) {
      const newEmail = body.email.trim().toLowerCase()
      if (newEmail !== currentUser.email.toLowerCase()) {
        const existingEmail = await prisma.orm.public.User.where((u) =>
          and(
            u.email.ilike(newEmail),
            u.id.neq(currentUserId)
          )
        ).first()
        if (existingEmail) {
          throw new BadRequest(`Email "${newEmail}" is already in use`)
        }
        updates.email = newEmail
      }
    }

    // Handle customization and assets merging
    let currentCustomization =
      body?.customization !== undefined
        ? body.customization
        : currentUser.customization

    if (body?.assets) {
      const patchAssets: Record<string, string | null> = {}
      if (body.assets.avatarUrl !== undefined) patchAssets.avatarUrl = body.assets.avatarUrl
      if (body.assets.bannerUrl !== undefined) patchAssets.bannerUrl = body.assets.bannerUrl
      if (body.assets.bannerOverlayUrl !== undefined)
        patchAssets.bannerOverlayUrl = body.assets.bannerOverlayUrl
      if (body.assets.nameplateUrl !== undefined) patchAssets.nameplateUrl = body.assets.nameplateUrl
      if (body.assets.avatarFrame !== undefined) patchAssets.avatarFrame = body.assets.avatarFrame

      currentCustomization = setProfileCustomization(
        currentCustomization ?? {},
        patchAssets
      )
    }

    if (currentCustomization !== undefined) {
      updates.customization = currentCustomization as any
    }

    // Handle settings merging
    if (body?.settings !== undefined) {
      const existingSettings =
        typeof currentUser.settings === 'object' && currentUser.settings !== null
          ? (currentUser.settings as Record<string, unknown>)
          : {}
      const patchSettings =
        typeof body.settings === 'object' && body.settings !== null
          ? (body.settings as Record<string, unknown>)
          : {}
      updates.settings = { ...existingSettings, ...patchSettings } as any
    }

    const updatedUser = await prisma.orm.public.User.where({ id: currentUserId }).update(updates)

    if (!updatedUser) {
      throw new NotFound('User not found')
    }

    return {
      success: true,
      message: 'Account updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        customization: updatedUser.customization as any,
        settings: updatedUser.settings as any,
        permissions: [...updatedUser.permissions],
        badges: [...updatedUser.badges],
        TOTPEnabled: updatedUser.TOTPEnabled,
        emailMfaEnabled: updatedUser.emailMfaEnabled,
        publicKey: updatedUser.publicKey,
        createdAt: toDate(updatedUser.createdAt).toISOString(),
        updatedAt: toDate(updatedUser.updatedAt).toISOString(),
      },
    }
  }

  /**
   * Upload user asset (avatar, banner, etc.) to RustFS S3 storage.
   */
  public static async uploadAsset(
    userId: string,
    body: {
      file: File
      assetType: 'avatar' | 'banner' | 'bannerOverlay' | 'nameplate' | 'sidebarBanner' | 'avatarFrame'
    }
  ) {
    const { file, assetType } = body

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ]

    if (!allowedTypes.includes(file.type)) {
      throw new BadRequest('Unsupported file format. Please upload JPEG, PNG, WebP, GIF, or SVG.')
    }

    // Max size: 10MB
    const maxSizeBytes = 10 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      throw new BadRequest('File size exceeds 10MB limit.')
    }

    // Clean up previous asset of this type
    try {
      const user = await prisma.orm.public.User.where({ id: userId }).select('customization').first()

      if (user) {
        const profile = getProfileCustomization(user.customization)
        let oldUrl: string | null | undefined = null

        if (assetType === 'avatar') oldUrl = profile.avatarUrl
        else if (assetType === 'banner') oldUrl = profile.bannerUrl
        else if (assetType === 'bannerOverlay') oldUrl = profile.bannerOverlayUrl
        else if (assetType === 'nameplate' || assetType === 'sidebarBanner') {
          oldUrl = profile.nameplateUrl || profile.sidebarBannerUrl
        } else if (assetType === 'avatarFrame') oldUrl = profile.avatarFrame

        if (oldUrl) {
          const oldKey = extractS3Key(oldUrl)
          if (oldKey && oldKey.startsWith(`users/${userId}/`)) {
            await deletePublicAsset(oldKey)
          }
        }
      }
    } catch (cleanupErr) {
      console.warn('[Assets] Warning during old asset cleanup:', cleanupErr)
    }

    let ext = 'png'
    if (file.type === 'image/jpeg') ext = 'jpg'
    else if (file.type === 'image/webp') ext = 'webp'
    else if (file.type === 'image/gif') ext = 'gif'
    else if (file.type === 'image/svg+xml') ext = 'svg'

    const key = `users/${userId}/${assetType}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { publicUrl } = await uploadPublicAsset({
      key,
      body: buffer,
      contentType: file.type,
    })

    return {
      success: true,
      url: publicUrl,
      key,
      assetType,
    }
  }

  /**
   * Delete user asset from RustFS S3 storage.
   */
  public static async deleteAsset(userId: string, key: string) {
    const targetKey = extractS3Key(key) || key

    if (!targetKey.startsWith(`users/${userId}/`)) {
      throw new Forbidden("Cannot delete another user's asset")
    }

    const success = await deletePublicAsset(targetKey)
    return { success }
  }
}

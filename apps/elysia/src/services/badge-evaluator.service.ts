import { prisma, type MediaType } from "@IRIS/database"
import { getBadgeById } from "@IRIS/shared"
import { logger } from "../utils/logger.js"
import { cache } from "../utils/cache.js"
import { wsHub } from "./websocket-hub.js"
import { sendNotification } from "./notification.service.js"

const userCache = cache.withNamespace("users:me")

/**
 * Milestone thresholds for media consumption badges.
 * 11 tiers: 1, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 5000
 */
const MEDIA_MILESTONES = [1, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 5000] as const

/**
 * Mapping of media domains to their corresponding 11 badge IDs in badges.json.
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
 * Milestone thresholds for custom list curation badges.
 * 4 tiers: 1, 5, 10, 25 entries across custom lists.
 */
const CUSTOM_LIST_MILESTONES = [1, 5, 10, 25] as const
const CUSTOM_LIST_BADGE_IDS = [81, 82, 83, 84] as const

let badgeEvaluatorServiceLogged = false

/**
 * Automated Badge Progression & Achievement Evaluation Service.
 *
 * Evaluates media consumption thresholds, custom list curation, and special
 * roles, awarding new badges to users in real time and broadcasting notifications.
 */
export class BadgeEvaluatorService {
  private static instance: BadgeEvaluatorService

  private constructor() {
    BadgeEvaluatorService.logStatus()
  }

  /**
   * Logs status of the BadgeEvaluatorService on boot.
   */
  public static logStatus(): void {
    if (badgeEvaluatorServiceLogged) return
    badgeEvaluatorServiceLogged = true
    logger.service("badge-evaluator", "badge progression & achievement evaluator")
  }

  /**
   * Returns the singleton instance of BadgeEvaluatorService.
   */
  public static getInstance(): BadgeEvaluatorService {
    if (!BadgeEvaluatorService.instance) {
      BadgeEvaluatorService.instance = new BadgeEvaluatorService()
    }
    return BadgeEvaluatorService.instance
  }

  /**
   * Gets total tracked media count for a user in a specific domain.
   */
  private async getMediaCount(userId: string, mediaType: string): Promise<number> {
    const normalized = mediaType.toUpperCase()
    switch (normalized) {
      case "ANIME":
        return await prisma.animeList.count({ where: { userId } })
      case "MANGA":
        return await prisma.mangaList.count({ where: { userId } })
      case "MOVIE":
        return await prisma.movieList.count({ where: { userId } })
      case "TV":
        return await prisma.tvList.count({ where: { userId } })
      case "GAME":
        return await prisma.gameList.count({ where: { userId } })
      case "BOOK":
        return await prisma.bookList.count({ where: { userId } })
      case "MUSIC":
      case "MUSIC_ALBUM":
      case "MUSIC_TRACK":
        return await prisma.musicList.count({ where: { userId } })
      default:
        return 0
    }
  }

  /**
   * Evaluates and awards media milestone badges for a given user and media type.
   *
   * @param userId - ID of the user
   * @param mediaType - Media domain type (ANIME, MANGA, MOVIE, TV, GAME, BOOK, MUSIC)
   * @returns Array of newly awarded badge IDs
   */
  public async evaluateMediaBadges(
    userId: string,
    mediaType: MediaType | string
  ): Promise<number[]> {
    const normalized = mediaType.toUpperCase()
    const badgeIds =
      normalized === "MUSIC_ALBUM" || normalized === "MUSIC_TRACK"
        ? MEDIA_BADGE_MAP["MUSIC"]
        : MEDIA_BADGE_MAP[normalized]

    if (!badgeIds) return []

    const count = await this.getMediaCount(userId, normalized)
    const earnedBadgeIds: number[] = []

    for (let i = 0; i < MEDIA_MILESTONES.length; i++) {
      const threshold = MEDIA_MILESTONES[i]
      const badgeId = badgeIds[i]
      if (threshold !== undefined && badgeId !== undefined && count >= threshold) {
        earnedBadgeIds.push(badgeId)
      }
    }

    return await this.grantBadges(userId, earnedBadgeIds)
  }

  /**
   * Evaluates and awards custom list curation badges for a given user.
   *
   * @param userId - ID of the user
   * @returns Array of newly awarded badge IDs
   */
  public async evaluateCustomListBadges(userId: string): Promise<number[]> {
    const count = await prisma.customListEntry.count({
      where: { customList: { userId } },
    })

    const earnedBadgeIds: number[] = []
    for (let i = 0; i < CUSTOM_LIST_MILESTONES.length; i++) {
      const threshold = CUSTOM_LIST_MILESTONES[i]
      const badgeId = CUSTOM_LIST_BADGE_IDS[i]
      if (threshold !== undefined && badgeId !== undefined && count >= threshold) {
        earnedBadgeIds.push(badgeId)
      }
    }

    return await this.grantBadges(userId, earnedBadgeIds)
  }

  /**
   * Evaluates and awards special role badges (Admin #2, etc.) for a user.
   *
   * @param userId - ID of the user
   * @param permissions - Array of 32-bit permission chunks or IRISBitField instance
   * @returns Array of newly awarded badge IDs
   */
  public async evaluateRoleBadges(
    userId: string,
    isAdmin: boolean
  ): Promise<number[]> {
    const earnedBadgeIds: number[] = []
    if (isAdmin) {
      earnedBadgeIds.push(2) // Admin badge ID 2
    }

    return await this.grantBadges(userId, earnedBadgeIds)
  }

  /**
   * Comprehensive badge evaluation across all tracks for a user.
   *
   * @param userId - ID of the user
   * @returns Array of all newly awarded badge IDs
   */
  public async evaluateAllBadges(userId: string): Promise<number[]> {
    const mediaDomains = ["ANIME", "MANGA", "MOVIE", "TV", "GAME", "BOOK", "MUSIC"]
    const newlyAwarded: number[] = []

    for (const domain of mediaDomains) {
      const awarded = await this.evaluateMediaBadges(userId, domain)
      newlyAwarded.push(...awarded)
    }

    const listAwarded = await this.evaluateCustomListBadges(userId)
    newlyAwarded.push(...listAwarded)

    return newlyAwarded
  }

  /**
   * Grants earned badges to the user in the database, invalidates cache,
   * dispatches notifications, and emits real-time WebSocket events.
   *
   * @param userId - ID of the user
   * @param targetBadgeIds - Badge IDs to ensure the user possesses
   * @returns Array of newly unlocked badge IDs
   */
  public async grantBadges(
    userId: string,
    targetBadgeIds: number[]
  ): Promise<number[]> {
    if (targetBadgeIds.length === 0) return []

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, badges: true },
    })

    if (!user) return []

    const currentSet = new Set(user.badges)
    const newBadgeIds = targetBadgeIds.filter((id) => !currentSet.has(id))

    if (newBadgeIds.length === 0) return []

    const updatedBadges = [...user.badges, ...newBadgeIds]

    await prisma.user.update({
      where: { id: userId },
      data: { badges: updatedBadges },
    })

    // Invalidate cached user profile
    await userCache.del(`user:${userId}`)

    // Dispatch real-time notifications and WS events for each newly unlocked badge
    for (const badgeId of newBadgeIds) {
      const badge = getBadgeById(badgeId)
      if (!badge) continue

      try {
        await sendNotification({
          userId,
          app: "IRIS",
          category: "achievements",
          priority: "NORMAL",
          content: {
            title: `🏆 Badge Unlocked: ${badge.name}`,
            body: badge.description,
            icon: badge.icon,
            link: "/settings?tab=account",
          },
        })
      } catch (notifErr) {
        logger.service.missingEnv(
          "badge-evaluator:notification",
          `Could not send encrypted notification: ${String(notifErr)}`
        )
      }

      wsHub.sendToUser(userId, "badge:unlocked", {
        badgeId,
        badge,
        allBadges: updatedBadges,
      })

      logger.service(
        "badge-evaluator",
        `Unlocked badge #${badgeId} (${badge.name}) for user ${userId}`
      )
    }

    return newBadgeIds
  }
}

export const badgeEvaluatorService = BadgeEvaluatorService.getInstance()
